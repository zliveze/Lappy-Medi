import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Workbook from '@/models/Workbook';
import Patient from '@/models/Patient';

export async function GET() {
  try {
    await dbConnect();
    const workbooks = await Workbook.find({}, { fileBufferBase64: 0, columns: 0 })
      .sort({ updatedAt: -1 })
      .lean();  // Plain JS objects — bỏ Mongoose hydration overhead

    return NextResponse.json(workbooks, {
      headers: {
        // Vercel Edge cache giữ 10s → request trùng trong 10s không vào DB
        // stale-while-revalidate=30 cho phép serve cache cũ trong khi làm mới nền
        'Cache-Control': 's-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    console.error('Error fetching workbooks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { fileName, isSimpleFormat, fileBufferBase64, columns, patients } = body;

    if (!fileName || !columns) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create workbook
    const workbook = await Workbook.create({
      fileName,
      isSimpleFormat: !!isSimpleFormat,
      fileBufferBase64,
      columns
    });

    // 2. Create patient documents with orderIndex — dùng insertMany để tối ưu 1 round-trip
    if (patients && Array.isArray(patients) && patients.length > 0) {
      const patientDocs = patients.map((patient: any, index: number) => {
        // Clean patient data to avoid _id or mongo fields conflict
        const cleanPatient = { ...patient };
        delete cleanPatient._id;
        delete cleanPatient.id;
        delete cleanPatient.workbookId;
        delete cleanPatient.orderIndex;
        delete cleanPatient.isDeleted;
        delete cleanPatient.createdAt;
        delete cleanPatient.updatedAt;

        return {
          workbookId: workbook._id,
          orderIndex: index,
          isDeleted: false,
          ...cleanPatient
        };
      });

      await Patient.insertMany(patientDocs, { ordered: false });
    }

    return NextResponse.json({
      success: true,
      workbookId: workbook._id,
      fileName: workbook.fileName
    });
  } catch (error: any) {
    console.error('Error importing workbook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

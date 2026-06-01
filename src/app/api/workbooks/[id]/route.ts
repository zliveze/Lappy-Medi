import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Workbook from '@/models/Workbook';
import Patient from '@/models/Patient';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;

    const workbook = await Workbook.findById(id);
    if (!workbook) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }

    const patients = await Patient.find({ workbookId: id, isDeleted: false })
      .sort({ orderIndex: 1 });

    return NextResponse.json({
      workbook,
      patients
    });
  } catch (error: any) {
    console.error('Error fetching workbook details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;

    const workbook = await Workbook.findByIdAndDelete(id);
    if (!workbook) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }

    // Delete all associated patients
    await Patient.deleteMany({ workbookId: id });

    return NextResponse.json({ success: true, message: 'Workbook and associated patients deleted' });
  } catch (error: any) {
    console.error('Error deleting workbook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

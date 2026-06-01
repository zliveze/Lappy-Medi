import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Patient from '@/models/Patient';
import Workbook from '@/models/Workbook';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { workbookId, ...patientData } = body;

    if (!workbookId) {
      return NextResponse.json({ error: 'Missing workbookId' }, { status: 400 });
    }

    const workbookExists = await Workbook.exists({ _id: workbookId });
    if (!workbookExists) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }

    // Find the next orderIndex
    const lastPatient = await Patient.findOne({ workbookId, isDeleted: false })
      .sort({ orderIndex: -1 });
    const orderIndex = lastPatient ? lastPatient.orderIndex + 1 : 0;

    // Create the patient document
    const patient = await Patient.create({
      workbookId,
      orderIndex,
      isDeleted: false,
      ...patientData
    });

    return NextResponse.json(patient);
  } catch (error: any) {
    console.error('Error creating patient:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

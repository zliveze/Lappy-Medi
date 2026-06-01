import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Patient from '@/models/Patient';
import Workbook from '@/models/Workbook';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');

    if (!sinceParam) {
      return NextResponse.json({ error: 'Missing since parameter' }, { status: 400 });
    }

    const sinceDate = new Date(sinceParam);
    const serverTime = new Date().toISOString();

    // Check if workbook exists first
    const workbookExists = await Workbook.exists({ _id: id });
    if (!workbookExists) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }

    // Find all patients updated or deleted since the 'since' timestamp
    const updatedPatients = await Patient.find({
      workbookId: id,
      updatedAt: { $gt: sinceDate }
    }).sort({ orderIndex: 1 });

    return NextResponse.json({
      serverTime,
      updatedPatients
    });
  } catch (error: any) {
    console.error('Error in sync endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

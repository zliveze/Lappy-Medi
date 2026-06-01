import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Patient from '@/models/Patient';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;
    const body = await request.json();
    const { orderedIds } = body;

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'Missing orderedIds array' }, { status: 400 });
    }

    // Perform bulk update of orderIndex
    const bulkOps = orderedIds.map((patientId: string, index: number) => ({
      updateOne: {
        filter: { _id: patientId, workbookId: id },
        update: { $set: { orderIndex: index } }
      }
    }));

    await Patient.bulkWrite(bulkOps);

    return NextResponse.json({ success: true, message: 'Patients reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering patients:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

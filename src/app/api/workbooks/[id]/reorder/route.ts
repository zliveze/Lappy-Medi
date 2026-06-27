import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Patient from '@/models/Patient';
import { verifyAccessKey } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accessKey = request.headers.get('x-access-key');
    const auth = await verifyAccessKey(accessKey);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Mã khóa không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
    }

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

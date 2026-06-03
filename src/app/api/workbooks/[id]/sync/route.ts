import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Patient from '@/models/Patient';

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
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid since date' }, { status: 400 });
    }

    // serverTime được tính TRƯỚC khi query để tránh race condition:
    // nếu có update xảy ra trong lúc query chạy, nó sẽ được bắt ở lần poll tiếp theo
    const serverTime = new Date().toISOString();

    // Trả về cả bệnh nhân isDeleted=true để máy kia biết mà xóa (soft-delete sync)
    const updatedPatients = await Patient.find(
      { workbookId: id, updatedAt: { $gt: sinceDate } },
    ).sort({ orderIndex: 1 }).lean();

    return NextResponse.json(
      { serverTime, updatedPatients },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in sync endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

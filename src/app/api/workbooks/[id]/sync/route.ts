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
    const serverTime = new Date().toISOString();

    // Chỉ cần 1 query Patient — bỏ Workbook.exists() không cần thiết
    // Nếu workbookId không tồn tại, query trả về mảng rỗng — hoàn toàn hợp lệ
    const updatedPatients = await Patient.find(
      { workbookId: id, updatedAt: { $gt: sinceDate } },
      // Projection: chỉ lấy các trường cần thiết, bỏ fileBufferBase64 không có trong Patient
    ).sort({ orderIndex: 1 }).lean();

    return NextResponse.json(
      { serverTime, updatedPatients },
      {
        headers: {
          // Không cache response này ở CDN — luôn cần dữ liệu tươi
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in sync endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

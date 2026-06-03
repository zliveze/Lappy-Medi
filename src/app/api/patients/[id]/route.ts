import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Patient from '@/models/Patient';

// Danh sách các key hệ thống cần loại bỏ khỏi dữ liệu cập nhật
const SYSTEM_KEYS = new Set([
  '_id', 'id', 'workbookId', 'createdAt', 'updatedAt', '__v', 'isDeleted'
]);

/**
 * Lọc sạch dữ liệu trước khi cập nhật MongoDB:
 * - Loại bỏ các key hệ thống (metadata)
 * - Loại bỏ key rỗng "" (nguyên nhân gây lỗi "empty update path")
 * - Loại bỏ key bắt đầu bằng "$" (ngăn chặn injection)
 * - Giữ lại chuỗi rỗng "" làm giá trị (xóa dữ liệu ô)
 */
function cleanUpdateData(body: any): Record<string, any> {
  const cleaned: Record<string, any> = {};
  if (!body || typeof body !== 'object') return cleaned;

  for (const [key, value] of Object.entries(body)) {
    // Bỏ qua key rỗng, key hệ thống, key bắt đầu bằng $
    if (!key || key.trim() === '' || SYSTEM_KEYS.has(key) || key.startsWith('$')) {
      continue;
    }
    // Bỏ qua giá trị undefined/null
    if (value === undefined || value === null) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;
    const body = await request.json();
    const updateData = cleanUpdateData(body);

    // Không có gì để cập nhật → trả về dữ liệu hiện tại ngay lập tức
    if (Object.keys(updateData).length === 0) {
      const patient = await Patient.findById(id).lean();
      return NextResponse.json(patient || { error: 'Patient not found' });
    }

    // Dùng findOneAndUpdate thay vì updateOne + findById (tiết kiệm 1 truy vấn DB)
    const updatedPatient = await Patient.findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { new: true, strict: false }
    ).lean();

    if (!updatedPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json(updatedPatient);
  } catch (error: any) {
    console.error('Error updating patient:', error);
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

    // Soft-delete: đánh dấu isDeleted=true thay vì xóa thật
    // → Sync endpoint có thể phát hiện và báo các máy khác xóa bệnh nhân tương ứng
    const result = await Patient.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!result) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Patient soft-deleted' });
  } catch (error: any) {
    console.error('Error deleting patient:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

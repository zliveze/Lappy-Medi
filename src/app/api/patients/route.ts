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

// Danh sách các key hệ thống cần loại bỏ khỏi dữ liệu cập nhật
const SYSTEM_KEYS = new Set([
  '_id', 'id', 'workbookId', 'createdAt', 'updatedAt', '__v', 'isDeleted'
]);

/**
 * Lọc sạch dữ liệu trước khi cập nhật MongoDB:
 * - Loại bỏ các key hệ thống (metadata)
 * - Loại bỏ key rỗng ""
 * - Loại bỏ key bắt đầu bằng "$"
 * - Giữ lại chuỗi rỗng "" làm giá trị (xóa dữ liệu ô)
 */
function cleanUpdateData(body: any): Record<string, any> {
  const cleaned: Record<string, any> = {};
  if (!body || typeof body !== 'object') return cleaned;

  for (const [key, value] of Object.entries(body)) {
    if (!key || key.trim() === '' || SYSTEM_KEYS.has(key) || key.startsWith('$')) {
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { ids, updateData } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid ids' }, { status: 400 });
    }

    const cleaned = cleanUpdateData(updateData);
    if (Object.keys(cleaned).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const result = await Patient.updateMany(
      { _id: { $in: ids } },
      { $set: cleaned }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error batch updating patients:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


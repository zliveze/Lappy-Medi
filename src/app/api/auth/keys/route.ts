import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AccessKey from '@/models/AccessKey';

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Sinh key ngẫu nhiên 25 kí tự phân tách bằng dấu gạch ngang
function generateRandomKey(): string {
  let rawKey = '';
  for (let i = 0; i < 25; i++) {
    const randIndex = Math.floor(Math.random() * ALPHABET.length);
    rawKey += ALPHABET[randIndex];
  }
  return rawKey.match(/.{1,5}/g)!.join('-');
}

export async function POST(request: Request) {
  try {
    // Bảo vệ bằng ACCESS_SECRET_KEY
    const adminSecret = request.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== process.env.ACCESS_SECRET_KEY) {
      return NextResponse.json({ error: 'Không có quyền thực hiện hành động này.' }, { status: 403 });
    }

    await dbConnect();
    const body = await request.json();
    const { user, days } = body;

    if (!user || typeof user !== 'string' || !user.trim()) {
      return NextResponse.json({ error: 'Thiếu tên người sở hữu key (user).' }, { status: 400 });
    }

    let exp: Date | null = null;
    if (days && typeof days === 'number' && days > 0) {
      exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const key = generateRandomKey();

    await AccessKey.create({
      key,
      user: user.trim(),
      exp
    });

    return NextResponse.json({
      success: true,
      key,
      user: user.trim(),
      exp: exp ? exp.toISOString() : null
    });
  } catch (error: any) {
    console.error('[API AUTH KEY GENERATE ERROR]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi tạo key.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { verifyAccessKey } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    let key = '';
    
    // Đọc key từ request body
    try {
      const body = await request.json();
      key = body.key || '';
    } catch (e) {
      // Request body có thể rỗng hoặc không phải JSON
    }

    // Nếu không có trong body, đọc từ request headers
    if (!key) {
      key = request.headers.get('x-access-key') || '';
    }

    if (!key) {
      return NextResponse.json(
        { valid: false, error: 'Thiếu mã khóa xác thực (access key).' },
        { status: 400 }
      );
    }

    const result = await verifyAccessKey(key);
    
    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: 'Mã khóa không chính xác hoặc đã hết hạn.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: result.payload?.user,
      exp: result.payload?.exp
    });
  } catch (error: any) {
    console.error('[API VERIFY KEY ERROR]:', error);
    return NextResponse.json(
      { valid: false, error: error.message || 'Lỗi hệ thống khi xác thực.' },
      { status: 500 }
    );
  }
}

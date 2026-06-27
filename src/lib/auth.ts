import dbConnect from '@/lib/db';
import AccessKey from '@/models/AccessKey';

export interface VerifyResult {
  valid: boolean;
  payload?: {
    user: string;
    exp: number;
  };
}

/**
 * Xác thực mã key truy cập được gửi từ client bằng cách kiểm tra trực tiếp trong MongoDB.
 * Hỗ trợ định dạng Windows License Key (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX) và cho phép người dùng tự đặt tên.
 */
export async function verifyAccessKey(key: string | null | undefined): Promise<VerifyResult> {
  const secretKey = process.env.ACCESS_SECRET_KEY;
  
  if (!secretKey) {
    console.error('[AUTH ERROR] Biến môi trường ACCESS_SECRET_KEY chưa được cấu hình.');
    return { valid: false };
  }

  if (!key) {
    return { valid: false };
  }

  try {
    const cleanKey = key.toUpperCase().replace(/-/g, '').trim();
    if (cleanKey.length !== 25) {
      return { valid: false };
    }

    // Định dạng lại key để khớp với định dạng lưu trong database (phân tách 5 kí tự bằng dấu gạch ngang)
    const formattedKey = cleanKey.match(/.{1,5}/g)!.join('-');

    await dbConnect();
    
    // Tìm kiếm trong database
    const doc = await AccessKey.findOne({ key: formattedKey });
    if (!doc) {
      return { valid: false }; // Mã key không tồn tại
    }

    // Kiểm tra thời hạn hết hạn
    let expTimestamp = 0;
    if (doc.exp) {
      const expDate = new Date(doc.exp);
      expTimestamp = Math.floor(expDate.getTime() / 1000);
      
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds > expTimestamp) {
        return { valid: false }; // Mã key đã hết hạn
      }
    }

    return {
      valid: true,
      payload: {
        user: doc.user,
        exp: expTimestamp
      }
    };
  } catch (error) {
    console.error('[AUTH VERIFY ERROR]:', error);
    return { valid: false };
  }
}

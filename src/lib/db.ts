import mongoose from 'mongoose';
import dns from 'dns';

// Tự động cấu hình DNS để tránh lỗi chặn SRV (ECONNREFUSED querySrv) phổ biến ở nhà mạng Việt Nam (Viettel, VNPT, FPT)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Bỏ qua nếu không thể override DNS (ví dụ trên Vercel Edge)
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // Kiểm tra MONGODB_URI tại runtime (không phải build time) để tránh lỗi Vercel build
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Giới hạn connection pool để tránh tốn RAM trên Vercel serverless
      maxPoolSize: 5,
      minPoolSize: 1,
      // Timeout hợp lý để tránh function treo quá lâu
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;

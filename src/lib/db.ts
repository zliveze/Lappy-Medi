import mongoose from 'mongoose';
import dns from 'dns';

// Tự động cấu hình DNS để tránh lỗi chặn SRV (ECONNREFUSED querySrv) phổ biến ở nhà mạng Việt Nam (Viettel, VNPT, FPT)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('Forced Node.js DNS resolver to use Google & Cloudflare DNS.');
} catch (e) {
  console.warn('DNS override failed, falling back to default resolver:', e);
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
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
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
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

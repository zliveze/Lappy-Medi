import mongoose from 'mongoose';

const AccessKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    user: { type: String, required: true },
    exp: { type: Date, default: null }, // null means unlimited
  },
  { timestamps: true }
);

export default mongoose.models.AccessKey || mongoose.model('AccessKey', AccessKeySchema);

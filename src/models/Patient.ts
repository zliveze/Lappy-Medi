import mongoose, { Schema, Document } from 'mongoose';

export interface IPatient extends Document {
  workbookId: mongoose.Types.ObjectId;
  orderIndex: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

const PatientSchema: Schema = new Schema({
  workbookId: { type: Schema.Types.ObjectId, ref: 'Workbook', required: true, index: true },
  orderIndex: { type: Number, required: true },
  isDeleted: { type: Boolean, default: false, index: true }
}, {
  strict: false, // Allows storing dynamic fields on the document flatly
  timestamps: true
});

// Compound index for optimal sync polling performance
PatientSchema.index({ workbookId: 1, updatedAt: 1 });

export default mongoose.models.Patient || mongoose.model<IPatient>('Patient', PatientSchema);

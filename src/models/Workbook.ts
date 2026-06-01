import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkbook extends Document {
  fileName: string;
  fileBufferBase64?: string; // base64 of original Excel workbook template
  columns: any[]; // ColumnConfig[]
  isSimpleFormat: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkbookSchema: Schema = new Schema({
  fileName: { type: String, required: true },
  fileBufferBase64: { type: String },
  columns: { type: Array, required: true, default: [] },
  isSimpleFormat: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.models.Workbook || mongoose.model<IWorkbook>('Workbook', WorkbookSchema);

export interface PatientData {
  [key: string]: string | number | undefined;
  CODE?: string;
  'HỌ VÀ TÊN'?: string;
  NS?: string;
  GT?: string;
  'Cân nặng'?: number | string;
  'Chiều cao'?: number | string;
  BMI?: number | string;
  'THỂ TRẠNG'?: string;
  'KHÁM TỔNG QUÁT'?: string;
  'PHÂN LOẠI SỨC KHỎE'?: string;
  Xquang?: string;
  'Siêu âm'?: string;
  'Điện tim'?: string;
}

export interface ColumnConfig {
  key: string;
  header: string;
  visible: boolean;
  width?: number;
}

export const STANDARD_COLUMNS: ColumnConfig[] = [
  { key: 'CODE', header: 'CODE', visible: true, width: 100 },
  { key: 'HỌ VÀ TÊN', header: 'HỌ VÀ TÊN', visible: true, width: 180 },
  { key: 'NS', header: 'NS', visible: true, width: 80 },
  { key: 'GT', header: 'GT', visible: true, width: 60 },
  { key: 'Cân nặng', header: 'Cân nặng', visible: true, width: 80 },
  { key: 'Chiều cao', header: 'Chiều cao', visible: true, width: 90 },
  { key: 'BMI', header: 'BMI', visible: true, width: 70 },
  { key: 'THỂ TRẠNG', header: 'THỂ TRẠNG', visible: true, width: 100 },
  { key: 'KHÁM TỔNG QUÁT', header: 'KHÁM TỔNG QUÁT', visible: true, width: 300 },
  { key: 'PHÂN LOẠI SỨC KHỎE', header: 'PHÂN LOẠI SỨC KHỎE', visible: true, width: 150 },
  { key: 'Xquang', header: 'Xquang', visible: true, width: 250 },
  { key: 'Siêu âm', header: 'Siêu âm', visible: true, width: 300 },
  { key: 'Điện tim', header: 'Điện tim', visible: true, width: 150 },
];

export const STANDARD_COLUMN_KEYS = STANDARD_COLUMNS.map(c => c.key);

// Options cho các trường khám
export const BLOOD_PRESSURE_OPTIONS = [
  'Tăng HA có điều trị',
  'Tăng HA không điều trị',
  'TD tăng HA',
];

export const EYE_OPTIONS = [
  'Đục thủy tinh thể',
  '2 mắt lão thị',
];

export const ENT_OPTIONS = [
  'Amidan quá phát',
  'Viêm họng hạt',
  'Viêm mũi dị ứng',
];

export const DENTAL_OPTIONS = [
  'Sâu răng',
  'Mất răng',
  'Vôi răng',
];

export const LIVER_OPTIONS = [
  'Gan nhiễm mỡ độ 1',
  'Gan nhiễm mỡ độ 2',
  'Gan nhiễm mỡ độ 3',
];

export const KIDNEY_OPTIONS = [
  'Sỏi thận Trái',
  'Sỏi thận Phải',
  'Sỏi thận 2 bên',
];

export const VISION_OPTIONS = [
  '1/10', '2/10', '3/10', '4/10', '5/10',
  '6/10', '7/10', '8/10', '9/10', '10/10',
];

export const CLASSIFICATION_OPTIONS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
];

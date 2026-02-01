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
  { key: 'Xquang', header: 'Xquang', visible: true, width: 250 },
  { key: 'Siêu âm', header: 'Siêu âm', visible: true, width: 300 },
  { key: 'Điện tim', header: 'Điện tim', visible: true, width: 150 },
  { key: 'PHÂN LOẠI SỨC KHỎE', header: 'PHÂN LOẠI SỨC KHỎE', visible: true, width: 150 },
];

export const STANDARD_COLUMN_KEYS = STANDARD_COLUMNS.map(c => c.key);

// Options cho các trường khám
// Options cũ - giữ lại để tương thích ngược khi parse
export const BLOOD_PRESSURE_OPTIONS_LEGACY = [
  'Tăng HA đang điều trị',
  'Tăng HA không điều trị',
  'TD tăng HA',
  'tăng HA',
];

// Options mới cho giao diện Nội khoa linh hoạt
export const INTERNAL_PREFIX_OPTIONS = ['Theo dõi', 'Tăng', '']; // Rỗng = không có prefix
export const INTERNAL_CONDITION_OPTIONS = ['THA', 'Mạch nhanh'];
export const INTERNAL_TIME_UNIT_OPTIONS = ['ngày', 'tuần', 'tháng', 'năm'];
export const INTERNAL_TREATMENT_OPTIONS = ['đang điều trị', 'không điều trị', ''];

// Giữ lại export cũ để tương thích
export const BLOOD_PRESSURE_OPTIONS = BLOOD_PRESSURE_OPTIONS_LEGACY;

// Options bệnh lý mắt - dùng chung (2 mắt)
export const EYE_OPTIONS_BOTH = [
  'Đục thủy tinh thể 2 mắt',
  '2 mắt lão thị',
  '2 mắt mộng thịt độ I',
  '2 mắt mộng thịt độ II',
  '2 mắt mộng thịt độ III',
];

// Options bệnh lý mắt - riêng từng mắt
export const EYE_OPTIONS_SINGLE = [
  'đục thủy tinh thể',
  'lão thị',
  'nhược thị',
  'cườm mắt',
  'mộng thịt độ I',
  'mộng thịt độ II',
  'mộng thịt độ III',
];

// Giữ lại EYE_OPTIONS để tương thích ngược
export const EYE_OPTIONS = [
  'đục thủy tinh thể',
  '2 mắt lão thị',
];

export const ENT_OPTIONS = [
  'amidan quá phát',
  'viêm họng hạt',
  'viêm mũi dị ứng',

];

export const DENTAL_OPTIONS = [
  'sâu răng',
  'mất răng',
  'vôi răng',
  'mất nhiều răng',
  'hàm tháo lắp',
  'mòn cổ chân răng',
  'sâu răng đã điều trị',
  'sâu răng chưa điều trị',
  'mất răng đã điều trị',
  'mất răng chưa điều trị',
];

export const LIVER_OPTIONS = [
  'gan nhiễm mỡ độ I',
  'gan nhiễm mỡ độ II',
  'gan nhiễm mỡ độ III',
];

export const KIDNEY_OPTIONS = [
  'sỏi thận trái',
  'sỏi thận phải',
  'sỏi thận 2 bên',
];

export const ULTRASOUND_ABDOMEN_NOTE_OPTIONS = [
  'polyp túi mật',
  'sỏi túi mật',
  'dày thành túi mật',
  'nang thận trái',
  'nang thận phải',
  'nang thận 2 bên',
  'phì đại tiền liệt tuyến',
  'nốt vôi tiền liệt tuyến',
];

export const ULTRASOUND_BREAST_OPTIONS = [
  'sang thương vú trái BIRADS II',
  'sang thương vú phải BIRADS II',
  'sang thương 2 vú BIRADS II',
  'nang tuyến vú',
  'u xơ tuyến vú',
];

export const ULTRASOUND_THYROID_OPTIONS = [
  'bướu giáp nhân',
  'nang tuyến giáp',
  'viêm tuyến giáp',
  'TIRADS II',
  'TIRADS III',
];

export const ULTRASOUND_GYNECOLOGY_OPTIONS = [
  'u xơ tử cung',
  'nang buồng trứng',
  'polyp buồng tử cung',
  'viêm phần phụ',
];

export const VISION_OPTIONS = [
  '10/10', '9/10', '8/10', '7/10', '6/10',
  '5/10', '4/10', '3/10', '2/10', '1/10', '0/10',
];

// Options ĐNT (Đếm Ngón Tay) cho thị lực kém
export const DNT_OPTIONS = [
  'ĐNT 1m', 'ĐNT 2m', 'ĐNT 3m', 'ĐNT 4m', 'ĐNT 5m',
  'ST(+)', 'ST(-)', 'BBL', // Sáng tối
];

// Options trục điện tim
export const ECG_AXIS_OPTIONS = [
  'trục điện tim trung gian',
  'trục điện tim lệch trái',
  'trục điện tim lệch phải',
  'trục vô định',
];

export const CLASSIFICATION_OPTIONS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
];

// Các cột cần kiểm tra khi bệnh nhân đã có phân loại sức khỏe
export const REQUIRED_COLUMNS_FOR_CLASSIFIED = [
  'Cân nặng',
  'Chiều cao',
  'BMI',
  'THỂ TRẠNG',
  'KHÁM TỔNG QUÁT',
  'Xquang',
  'Siêu âm',
  'Điện tim',
];

/**
 * Kiểm tra xem bệnh nhân đã có phân loại sức khỏe chưa
 */
export function hasClassification(patient: PatientData): boolean {
  const classification = patient['PHÂN LOẠI SỨC KHỎE'];
  return classification !== undefined && classification !== null && String(classification).trim() !== '';
}

/**
 * Kiểm tra xem một cột có thiếu dữ liệu không (cho bệnh nhân đã phân loại)
 */
export function isMissingData(patient: PatientData, columnKey: string): boolean {
  // Chỉ highlight nếu bệnh nhân đã có phân loại
  if (!hasClassification(patient)) return false;

  // Chỉ kiểm tra các cột trong danh sách cần thiết
  if (!REQUIRED_COLUMNS_FOR_CLASSIFIED.includes(columnKey)) return false;

  const value = patient[columnKey];
  return value === undefined || value === null || String(value).trim() === '';
}

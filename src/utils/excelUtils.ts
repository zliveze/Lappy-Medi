import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PatientData, ColumnConfig, STANDARD_COLUMN_KEYS, STANDARD_COLUMNS } from '@/types/patient';

const HEADER_KEYWORDS = ['CODE', 'HỌ VÀ TÊN'];
const PREFERRED_SHEET_NAME = 'DS';
const MAX_HEADER_SCAN_ROWS = 20;

// Lưu trữ thông tin file gốc để giữ format khi export
export interface OriginalFileInfo {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  headerRow: number;
  originalHeaders: string[];
  columnMapping: Map<string, number>; // header -> column index (1-based)
}

let originalFileInfo: OriginalFileInfo | null = null;

export interface TableGroup {
  tableName: string;  // Tên bảng/công ty
  startRow: number;   // Dòng bắt đầu
  headerRow: number;  // Dòng header
  data: PatientData[];
}

export interface ImportResult {
  data: PatientData[];
  columns: ColumnConfig[];
  fileName: string;
  isSimpleFormat: boolean;
  tables?: TableGroup[];  // Nhiều bảng nếu có
}

/**
 * Lấy thông tin file gốc
 */
export function getOriginalFileInfo(): OriginalFileInfo | null {
  return originalFileInfo;
}

/**
 * Reset thông tin file gốc
 */
export function resetOriginalFileInfo(): void {
  originalFileInfo = null;
}

/**
 * Tìm tất cả các bảng trong worksheet (mỗi bảng có header riêng)
 * Trả về danh sách { tableName, headerRow }
 */
function findAllTables(worksheet: ExcelJS.Worksheet): { tableName: string; headerRow: number }[] {
  const tables: { tableName: string; headerRow: number }[] = [];
  
  for (let row = 1; row <= worksheet.rowCount; row++) {
    const rowData = worksheet.getRow(row);
    let hasHeaderKeyword = false;
    
    // Kiểm tra xem dòng này có phải là header không
    for (let col = 1; col <= Math.min(rowData.cellCount, 10); col++) {
      const cell = rowData.getCell(col);
      const cellValue = String(cell.value || '').toUpperCase().trim();
      if (HEADER_KEYWORDS.some(keyword => cellValue.includes(keyword))) {
        hasHeaderKeyword = true;
        break;
      }
    }
    
    if (hasHeaderKeyword) {
      // Tìm tên bảng từ các dòng phía trên (thường là 1-3 dòng)
      let tableName = '';
      for (let searchRow = row - 1; searchRow >= Math.max(1, row - 5); searchRow--) {
        const searchRowData = worksheet.getRow(searchRow);
        const firstCell = searchRowData.getCell(1);
        const cellText = String(firstCell.value || '').trim();
        // Tìm dòng có chứa "DS" hoặc "DANH SÁCH" - thường là tên công ty
        if (cellText.length > 10 && (cellText.toUpperCase().includes('DS ') || cellText.toUpperCase().includes('DANH SÁCH'))) {
          tableName = cellText;
          break;
        }
      }
      tables.push({ tableName: tableName || `Bảng ${tables.length + 1}`, headerRow: row });
    }
  }
  
  return tables.length > 0 ? tables : [{ tableName: '', headerRow: 1 }];
}

/**
 * Tìm dòng header trong worksheet (ExcelJS - 1-based index)
 */
function findHeaderRowExcel(worksheet: ExcelJS.Worksheet): number {
  for (let row = 1; row <= Math.min(worksheet.rowCount, MAX_HEADER_SCAN_ROWS); row++) {
    const rowData = worksheet.getRow(row);
    for (let col = 1; col <= rowData.cellCount; col++) {
      const cell = rowData.getCell(col);
      const cellValue = String(cell.value || '').toUpperCase().trim();
      if (HEADER_KEYWORDS.some(keyword => cellValue.includes(keyword))) {
        return row;
      }
    }
  }
  return 1; // Default to first row
}

/**
 * Import file Excel với ExcelJS - giữ nguyên format
 * Hỗ trợ nhiều bảng trong cùng sheet
 */
export async function importExcel(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  // Chọn sheet: ưu tiên "DS", nếu không có thì lấy sheet đầu tiên
  let worksheet = workbook.worksheets.find(
    ws => ws.name.toUpperCase() === PREFERRED_SHEET_NAME.toUpperCase()
  );
  if (!worksheet) {
    worksheet = workbook.worksheets[0];
  }
  
  const sheetName = worksheet.name;
  
  // Tìm tất cả các bảng trong sheet
  const allTables = findAllTables(worksheet);
  const hasMultipleTables = allTables.length > 1;
  
  // Sử dụng bảng đầu tiên cho header chính
  const headerRow = allTables[0].headerRow;
  
  // Lấy danh sách headers từ bảng đầu tiên
  const headerRowData = worksheet.getRow(headerRow);
  const headers: string[] = [];
  const columnMapping = new Map<string, number>();
  
  headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const headerName = String(cell.value || '').trim();
    if (headerName) {
      headers.push(headerName);
      columnMapping.set(headerName, colNumber);
    }
  });
  
  // Đọc dữ liệu bệnh nhân từ tất cả các bảng
  const data: PatientData[] = [];
  const tableGroups: TableGroup[] = [];
  
  for (let tableIdx = 0; tableIdx < allTables.length; tableIdx++) {
    const table = allTables[tableIdx];
    const nextTable = allTables[tableIdx + 1];
    const endRow = nextTable ? nextTable.headerRow - 1 : worksheet.rowCount;
    const tableData: PatientData[] = [];
    
    for (let rowNum = table.headerRow + 1; rowNum <= endRow; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const patient: PatientData = {};
      let hasData = false;
      
      // Kiểm tra xem dòng này có phải là header của bảng tiếp theo không
      let isNextHeader = false;
      for (let col = 1; col <= Math.min(row.cellCount, 10); col++) {
        const cellValue = String(row.getCell(col).value || '').toUpperCase().trim();
        if (HEADER_KEYWORDS.some(keyword => cellValue.includes(keyword))) {
          isNextHeader = true;
          break;
        }
      }
      if (isNextHeader) break;
      
      headers.forEach(header => {
        const colNum = columnMapping.get(header);
        if (colNum) {
          const cell = row.getCell(colNum);
          let value = cell.value;
          
          // Xử lý các kiểu giá trị đặc biệt
          if (value instanceof Date) {
            value = value.toLocaleDateString('vi-VN');
          } else if (typeof value === 'object' && value !== null) {
            // RichText hoặc formula
            if ('result' in value) {
              value = value.result;
            } else if ('richText' in value) {
              value = (value as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
            } else {
              value = String(value);
            }
          }
          
          patient[header] = value !== null && value !== undefined ? String(value) : '';
          if (value !== null && value !== undefined && value !== '') {
            hasData = true;
          }
        }
      });
      
      if (hasData) {
        // Thêm tên bảng vào patient nếu có nhiều bảng
        if (hasMultipleTables && table.tableName) {
          patient['_tableName'] = table.tableName;
        }
        tableData.push(patient);
        data.push(patient);
      }
    }
    
    if (hasMultipleTables) {
      tableGroups.push({
        tableName: table.tableName,
        startRow: table.headerRow,
        headerRow: table.headerRow,
        data: tableData,
      });
    }
  }
  
  // Lưu thông tin file gốc
  originalFileInfo = {
    workbook,
    sheetName,
    headerRow,
    originalHeaders: headers,
    columnMapping,
  };
  
  // Kiểm tra file đơn giản
  const basicColumns = ['CODE', 'HỌ VÀ TÊN', 'NS', 'GT'];
  const hasOnlyBasicColumns = headers.every(h => 
    basicColumns.some(bc => h.toUpperCase().includes(bc.toUpperCase()) || bc.toUpperCase().includes(h.toUpperCase()))
  ) || headers.length <= 6;
  const isSimpleFormat = hasOnlyBasicColumns && headers.length <= 6;
  
  // Tạo cấu hình cột
  const columnSet = new Set(headers.map(h => h.toUpperCase()));
  const columns: ColumnConfig[] = [];
  
  headers.forEach((header) => {
    const standardCol = STANDARD_COLUMNS.find(sc => 
      sc.key.toUpperCase() === header.toUpperCase()
    );
    columns.push({
      key: header,
      header: header,
      visible: true,
      width: standardCol?.width || 120,
    });
  });
  
  // Thêm các cột tiêu chuẩn còn thiếu
  if (isSimpleFormat) {
    STANDARD_COLUMNS.forEach(stdCol => {
      if (!columnSet.has(stdCol.key.toUpperCase())) {
        columns.push({
          key: stdCol.key,
          header: stdCol.header,
          visible: true,
          width: stdCol.width,
        });
      }
    });
  } else {
    STANDARD_COLUMN_KEYS.forEach(key => {
      if (!columnSet.has(key.toUpperCase())) {
        const stdCol = STANDARD_COLUMNS.find(sc => sc.key === key);
        columns.push({
          key: key,
          header: key,
          visible: true,
          width: stdCol?.width || 120,
        });
      }
    });
  }
  
  return {
    data,
    columns,
    fileName: file.name,
    isSimpleFormat,
    tables: hasMultipleTables ? tableGroups : undefined,
  };
}

/**
 * Export dữ liệu ra file Excel - giữ nguyên format file gốc
 */
export async function exportExcel(
  data: PatientData[],
  columns: ColumnConfig[],
  fileName: string = 'Ket_Qua_Kham.xlsx'
): Promise<void> {
  const visibleColumns = columns.filter(col => col.visible);
  
  if (originalFileInfo) {
    await exportWithOriginalFormat(data, visibleColumns, fileName);
  } else {
    await exportNewFile(data, visibleColumns, fileName);
  }
}

/**
 * Export với format file gốc - GIỮ NGUYÊN MÀU SẮC VÀ STYLE
 */
async function exportWithOriginalFormat(
  data: PatientData[],
  visibleColumns: ColumnConfig[],
  fileName: string
): Promise<void> {
  if (!originalFileInfo) return;
  
  const { workbook, sheetName, headerRow, columnMapping } = originalFileInfo;
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) return;
  
  // Tạo mapping từ header sang column index
  const headerToCol = new Map<string, number>();
  columnMapping.forEach((colIndex, header) => {
    headerToCol.set(header.toUpperCase(), colIndex);
  });
  
  // Tìm cột cuối cùng
  let lastCol = Math.max(...Array.from(columnMapping.values()));
  
  // Thêm các cột mới vào cuối
  visibleColumns.forEach(col => {
    if (!headerToCol.has(col.key.toUpperCase())) {
      lastCol++;
      headerToCol.set(col.key.toUpperCase(), lastCol);
      
      // Thêm header cho cột mới
      const headerCell = worksheet.getRow(headerRow).getCell(lastCol);
      headerCell.value = col.header;
      
      // Copy style từ cột header đầu tiên
      const firstHeaderCell = worksheet.getRow(headerRow).getCell(1);
      if (firstHeaderCell.style) {
        headerCell.style = { ...firstHeaderCell.style };
      }
    }
  });
  
  // Lấy style mẫu từ dòng dữ liệu đầu tiên (nếu có)
  const templateRow = worksheet.getRow(headerRow + 1);
  const templateStyles = new Map<number, Partial<ExcelJS.Style>>();
  templateRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (cell.style) {
      templateStyles.set(colNumber, { ...cell.style });
    }
  });
  
  // Ghi dữ liệu bệnh nhân
  data.forEach((patient, rowIndex) => {
    const dataRowNum = headerRow + 1 + rowIndex;
    const row = worksheet.getRow(dataRowNum);
    
    visibleColumns.forEach(col => {
      const colIndex = headerToCol.get(col.key.toUpperCase());
      if (colIndex !== undefined) {
        const cell = row.getCell(colIndex);
        const value = patient[col.key];
        
        // Giữ nguyên style cũ hoặc dùng template style
        const existingStyle = cell.style;
        const templateStyle = templateStyles.get(colIndex);
        
        // Set giá trị
        if (value !== undefined && value !== null && value !== '') {
          cell.value = value;
        } else {
          cell.value = '';
        }
        
        // Giữ style (uu tiên style hiện có, nếu không thì dùng template)
        if (existingStyle && Object.keys(existingStyle).length > 0) {
          cell.style = existingStyle;
        } else if (templateStyle) {
          cell.style = templateStyle;
        }
      }
    });
  });
  
  // Xuất file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, fileName);
}

/**
 * Export file mới (không có file gốc)
 */
async function exportNewFile(
  data: PatientData[],
  visibleColumns: ColumnConfig[],
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(PREFERRED_SHEET_NAME);
  
  // Thêm header
  const headerRow = worksheet.addRow(visibleColumns.map(col => col.header));
  
  // Style cho header
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  
  // Thêm dữ liệu
  data.forEach((patient) => {
    const rowData = visibleColumns.map(col => patient[col.key] ?? '');
    const row = worksheet.addRow(rowData);
    
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = {
        vertical: 'top',
        wrapText: true,
      };
    });
  });
  
  // Thiết lập độ rộng cột
  visibleColumns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width ? col.width / 7 : 15;
  });
  
  // Xuất file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, fileName);
}

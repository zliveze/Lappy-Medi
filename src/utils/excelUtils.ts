import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PatientData, ColumnConfig, STANDARD_COLUMN_KEYS, STANDARD_COLUMNS, isMissingData } from '@/types/patient';

const HEADER_KEYWORDS = ['CODE', 'HỌ VÀ TÊN'];
const PREFERRED_SHEET_NAME = 'DS';
const MAX_HEADER_SCAN_ROWS = 20;

// Thông tin về 1 bảng trong sheet
export interface TableInfo {
  tableName: string;
  headerRow: number;
  dataStartRow: number; // headerRow + 1
  dataEndRow: number;   // Dòng cuối của bảng (trước bảng tiếp theo hoặc cuối sheet)
}

// Lưu trữ thông tin file gốc để giữ format khi export
export interface OriginalFileInfo {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  headerRow: number;
  originalHeaders: string[];
  columnMapping: Map<string, number>; // header -> column index (1-based)
  fileName: string; // Tên file gốc
  tables: TableInfo[]; // Thông tin về các bảng trong sheet
}

let originalFileInfo: OriginalFileInfo | null = null;

// Lưu trữ workbook buffer trong IndexedDB để có thể khôi phục
const WORKBOOK_DB_NAME = 'MediExcelDB';
const WORKBOOK_STORE_NAME = 'workbooks';
const WORKBOOK_KEY = 'originalWorkbook';

async function saveWorkbookToIndexedDB(buffer: ArrayBuffer, sheetName: string, headerRow: number, headers: string[], columnMapping: Map<string, number>, fileName: string, tables: TableInfo[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKBOOK_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WORKBOOK_STORE_NAME)) {
        db.createObjectStore(WORKBOOK_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(WORKBOOK_STORE_NAME, 'readwrite');
      const store = tx.objectStore(WORKBOOK_STORE_NAME);
      // Chuyển Map thành object để lưu
      const mappingObj: Record<string, number> = {};
      columnMapping.forEach((v, k) => { mappingObj[k] = v; });
      store.put({
        buffer,
        sheetName,
        headerRow,
        headers,
        columnMapping: mappingObj,
        fileName,
        tables,
        savedAt: new Date().toISOString()
      }, WORKBOOK_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function loadWorkbookFromIndexedDB(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open(WORKBOOK_DB_NAME, 1);
    request.onerror = () => resolve(false);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WORKBOOK_STORE_NAME)) {
        db.createObjectStore(WORKBOOK_STORE_NAME);
      }
    };
    request.onsuccess = async () => {
      try {
        const db = request.result;
        const tx = db.transaction(WORKBOOK_STORE_NAME, 'readonly');
        const store = tx.objectStore(WORKBOOK_STORE_NAME);
        const getRequest = store.get(WORKBOOK_KEY);
        getRequest.onsuccess = async () => {
          const data = getRequest.result;
          if (data && data.buffer) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(data.buffer);
            // Khôi phục columnMapping từ object
            const columnMapping = new Map<string, number>();
            Object.entries(data.columnMapping).forEach(([k, v]) => {
              columnMapping.set(k, v as number);
            });
            originalFileInfo = {
              workbook,
              sheetName: data.sheetName,
              headerRow: data.headerRow,
              originalHeaders: data.headers,
              columnMapping,
              fileName: data.fileName,
              tables: data.tables || [],
            };
            console.log('Restored workbook from IndexedDB:', data.fileName);
            resolve(true);
          } else {
            resolve(false);
          }
        };
        getRequest.onerror = () => resolve(false);
      } catch (e) {
        console.error('Error loading workbook from IndexedDB:', e);
        resolve(false);
      }
    };
  });
}

// Xóa dữ liệu trong IndexedDB
async function clearIndexedDB(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.open(WORKBOOK_DB_NAME, 1);
    request.onerror = () => resolve();
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WORKBOOK_STORE_NAME)) {
        db.createObjectStore(WORKBOOK_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      try {
        const db = request.result;
        const tx = db.transaction(WORKBOOK_STORE_NAME, 'readwrite');
        const store = tx.objectStore(WORKBOOK_STORE_NAME);
        store.delete(WORKBOOK_KEY);
        tx.oncomplete = () => {
          console.log('Cleared workbook from IndexedDB');
          resolve();
        };
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    };
  });
}

// Export để có thể gọi từ page
// expectedFileName: nếu có, chỉ restore nếu filename khớp
export async function restoreOriginalWorkbook(expectedFileName?: string): Promise<boolean> {
  // Kiểm tra nếu đã có originalFileInfo trong memory
  const currentInfo = originalFileInfo;
  if (currentInfo) {
    // Nếu có expectedFileName, kiểm tra xem có khớp không
    if (expectedFileName && currentInfo.fileName !== expectedFileName) {
      console.log('Current workbook does not match expected file:', expectedFileName, 'vs', currentInfo.fileName);
      return false;
    }
    return true;
  }

  // Load từ IndexedDB
  const loaded = await loadWorkbookFromIndexedDB();

  // Kiểm tra lại sau khi load
  const loadedInfo = originalFileInfo;

  // Nếu có expectedFileName, kiểm tra sau khi load
  if (loaded && expectedFileName && loadedInfo && loadedInfo.fileName !== expectedFileName) {
    console.log('Loaded workbook does not match expected file:', expectedFileName, 'vs', loadedInfo.fileName);
    // Clear vì không khớp
    originalFileInfo = null;
    return false;
  }

  return loaded;
}

export function hasOriginalWorkbook(): boolean {
  return originalFileInfo !== null;
}

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
 * Reset thông tin file gốc và xóa IndexedDB
 */
export async function resetOriginalFileInfo(): Promise<void> {
  originalFileInfo = null;
  await clearIndexedDB();
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
      let isSkipRow = false;
      const firstCellValue = String(row.getCell(1).value || '').toUpperCase().trim();

      for (let col = 1; col <= Math.min(row.cellCount, 10); col++) {
        const cellValue = String(row.getCell(col).value || '').toUpperCase().trim();
        if (HEADER_KEYWORDS.some(keyword => cellValue.includes(keyword))) {
          isNextHeader = true;
          break;
        }
      }

      // Kiểm tra dòng cần skip:
      // 1. Dòng tên bảng (chứa "DS " hoặc "DANH SÁCH")
      // 2. Dòng ghi chú (chứa "LẤY MẪU", "KHÁM TỪ", v.v.)
      // 3. Dòng có cùng nội dung ở nhiều cột liên tiếp (thường là ghi chú)
      if (firstCellValue.length > 5) {
        if (firstCellValue.includes('DS ') ||
          firstCellValue.includes('DANH SÁCH') ||
          firstCellValue.includes('LẤY MẪU') ||
          firstCellValue.includes('KHÁM TỪ') ||
          firstCellValue.includes('GHI CHÚ')) {
          isSkipRow = true;
        }

        // Kiểm tra nếu nhiều cột có cùng giá trị (dấu hiệu của dòng ghi chú merged)
        if (!isSkipRow) {
          let sameValueCount = 0;
          for (let col = 2; col <= Math.min(row.cellCount, 6); col++) {
            const cellValue = String(row.getCell(col).value || '').trim();
            if (cellValue === firstCellValue.toLowerCase() || cellValue.toUpperCase() === firstCellValue) {
              sameValueCount++;
            }
          }
          if (sameValueCount >= 3) {
            isSkipRow = true;
          }
        }
      }

      if (isNextHeader) break;
      if (isSkipRow) continue; // Skip dòng ghi chú/tên bảng

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

          // Normalize header để map đúng key chuẩn
          const normalizedHeader = header.toUpperCase().trim().replace(/\s+/g, ' ');
          const standardCol = STANDARD_COLUMNS.find(sc =>
            sc.key.toUpperCase().trim().replace(/\s+/g, ' ') === normalizedHeader
          );
          const key = standardCol ? standardCol.key : header;

          patient[key] = value !== null && value !== undefined ? String(value) : '';
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

  // Tạo danh sách TableInfo từ allTables
  const tableInfos: TableInfo[] = allTables.map((table, idx) => {
    const nextTable = allTables[idx + 1];
    return {
      tableName: table.tableName,
      headerRow: table.headerRow,
      dataStartRow: table.headerRow + 1,
      dataEndRow: nextTable ? nextTable.headerRow - 1 : worksheet.rowCount,
    };
  });

  // Lưu thông tin file gốc
  originalFileInfo = {
    workbook,
    sheetName,
    headerRow,
    originalHeaders: headers,
    columnMapping,
    fileName: file.name,
    tables: tableInfos,
  };

  // Lưu workbook vào IndexedDB để có thể khôi phục sau refresh
  try {
    const bufferToSave = await workbook.xlsx.writeBuffer();
    await saveWorkbookToIndexedDB(
      bufferToSave as ArrayBuffer,
      sheetName,
      headerRow,
      headers,
      columnMapping,
      file.name,
      tableInfos
    );
    console.log('Saved workbook to IndexedDB:', file.name, 'tables:', tableInfos.length);
  } catch (e) {
    console.error('Error saving workbook to IndexedDB:', e);
  }

  // Kiểm tra file đơn giản
  const basicColumns = ['CODE', 'HỌ VÀ TÊN', 'NS', 'GT'];
  const hasOnlyBasicColumns = headers.every(h =>
    basicColumns.some(bc => h.toUpperCase().includes(bc.toUpperCase()) || bc.toUpperCase().includes(h.toUpperCase()))
  ) || headers.length <= 6;
  const isSimpleFormat = hasOnlyBasicColumns && headers.length <= 6;

  // Normalize header để so sánh (loại bỏ dấu cách thừa, chuyển uppercase)
  const normalizeHeader = (h: string) => h.toUpperCase().trim().replace(/\s+/g, ' ');

  // Tạo cấu hình cột - sử dụng Set để tránh trùng lặp
  const columnSet = new Set(headers.map(h => normalizeHeader(h)));
  const addedKeys = new Set<string>(); // Track các key đã thêm
  const columns: ColumnConfig[] = [];

  headers.forEach((header) => {
    const normalizedHeader = normalizeHeader(header);

    // Kiểm tra xem đã thêm cột này chưa
    if (addedKeys.has(normalizedHeader)) {
      return; // Skip nếu đã có
    }

    const standardCol = STANDARD_COLUMNS.find(sc =>
      normalizeHeader(sc.key) === normalizedHeader
    );

    // Sử dụng key chuẩn nếu có, nếu không dùng header gốc
    const key = standardCol ? standardCol.key : header;

    columns.push({
      key: key,
      header: standardCol ? standardCol.header : header,
      visible: true,
      width: standardCol?.width || 120,
    });

    addedKeys.add(normalizedHeader);
  });

  // Thêm các cột tiêu chuẩn còn thiếu (theo thứ tự chuẩn, PHÂN LOẠI SỨC KHỎE cuối cùng)
  STANDARD_COLUMNS.forEach(stdCol => {
    const normalizedKey = normalizeHeader(stdCol.key);
    if (!addedKeys.has(normalizedKey)) {
      columns.push({
        key: stdCol.key,
        header: stdCol.header,
        visible: true,
        width: stdCol.width,
      });
      addedKeys.add(normalizedKey);
    }
  });

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
  fileName?: string
): Promise<void> {
  const visibleColumns = columns.filter(col => col.visible);

  // Ưu tiên: fileName truyền vào > originalFileInfo.fileName > mặc định
  let exportFileName = fileName || (originalFileInfo?.fileName) || 'Ket_Qua_Kham.xlsx';

  // Đảm bảo có đuôi .xlsx
  if (!exportFileName.toLowerCase().endsWith('.xlsx') && !exportFileName.toLowerCase().endsWith('.xls')) {
    exportFileName += '.xlsx';
  }

  console.log('Export with fileName:', exportFileName, 'originalFileInfo:', !!originalFileInfo);

  if (originalFileInfo) {
    try {
      await exportWithOriginalFormat(data, visibleColumns, exportFileName);
    } catch (error) {
      console.error('Failed to export with original format, falling back to new file:', error);
      // Fallback: export as new file nếu có lỗi với original format
      await exportNewFile(data, visibleColumns, exportFileName);
    }
  } else {
    await exportNewFile(data, visibleColumns, exportFileName);
  }
}

/**
 * Export với format file gốc - GIỮ NGUYÊN MÀU SẮC VÀ STYLE
 * Hỗ trợ nhiều bảng trong cùng sheet
 */
async function exportWithOriginalFormat(
  data: PatientData[],
  visibleColumns: ColumnConfig[],
  fileName: string
): Promise<void> {
  if (!originalFileInfo) return;

  const { workbook: originalWorkbook, sheetName, columnMapping, tables: originalTables, headerRow } = originalFileInfo;

  // Clone workbook để không ảnh hưởng đến bản gốc
  const cloneBuffer = await originalWorkbook.xlsx.writeBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(cloneBuffer);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) return;

  // Đảm bảo có ít nhất 1 table info (fallback nếu tables rỗng)
  const tables: TableInfo[] = (originalTables && originalTables.length > 0)
    ? originalTables
    : [{
      tableName: '',
      headerRow: headerRow,
      dataStartRow: headerRow + 1,
      dataEndRow: worksheet.rowCount,
    }];

  // Tạo mapping từ header sang column index
  const headerToCol = new Map<string, number>();
  columnMapping.forEach((colIndex, header) => {
    headerToCol.set(header.toUpperCase(), colIndex);
  });

  // Tìm cột cuối cùng (fallback = 0 nếu không có cột nào)
  const colValues = Array.from(columnMapping.values());
  let lastCol = colValues.length > 0 ? Math.max(...colValues) : 0;

  // Thêm các cột mới vào header của TẤT CẢ các bảng
  tables.forEach(table => {
    visibleColumns.forEach(col => {
      if (!headerToCol.has(col.key.toUpperCase())) {
        lastCol++;
        headerToCol.set(col.key.toUpperCase(), lastCol);
      }
      // Thêm header cho cột mới vào mỗi bảng
      const colIdx = headerToCol.get(col.key.toUpperCase());
      if (colIdx) {
        const headerCell = worksheet.getRow(table.headerRow).getCell(colIdx);
        if (!headerCell.value) {
          headerCell.value = col.header;
          // Copy style từ cột header đầu tiên của bảng đó
          const firstHeaderCell = worksheet.getRow(table.headerRow).getCell(1);
          if (firstHeaderCell.style) {
            headerCell.style = { ...firstHeaderCell.style };
          }
        }
      }
    });
  });

  // Tìm index cột cho công thức BMI và Thể trạng
  const weightColIdx = headerToCol.get('CÂN NẶNG');
  const heightColIdx = headerToCol.get('CHIỀU CAO');
  const bmiColIdx = headerToCol.get('BMI');

  // Chuyển sang ký tự cột Excel
  const weightCol = weightColIdx ? getColumnLetter(weightColIdx - 1) : null;
  const heightCol = heightColIdx ? getColumnLetter(heightColIdx - 1) : null;
  const bmiCol = bmiColIdx ? getColumnLetter(bmiColIdx - 1) : null;

  // Nhóm dữ liệu theo bảng (dựa trên _tableName) - với logic kế thừa từ BN trước đó
  const dataByTable = new Map<string, PatientData[]>();
  const defaultTableName = tables.length > 0 ? (tables[0].tableName || '') : '';

  // Gán _tableName cho những patient chưa có bằng cách kế thừa từ patient trước đó
  let lastTableName = defaultTableName;
  data.forEach(patient => {
    const patientTableName = patient['_tableName'] as string | undefined;
    if (patientTableName) {
      lastTableName = patientTableName;
    }

    const tableKey = lastTableName;
    if (!dataByTable.has(tableKey)) {
      dataByTable.set(tableKey, []);
    }
    dataByTable.get(tableKey)!.push(patient);
  });

  // Ghi dữ liệu cho từng bảng
  tables.forEach(table => {
    const tableData = dataByTable.get(table.tableName) || [];

    // Lấy style mẫu từ dòng dữ liệu đầu tiên của bảng này
    const templateRow = worksheet.getRow(table.dataStartRow);
    const templateStyles = new Map<number, Partial<ExcelJS.Style>>();
    try {
      templateRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (cell.style) {
          templateStyles.set(colNumber, { ...cell.style });
        }
      });
    } catch (e) {
      console.warn('Error getting template styles for row', table.dataStartRow, e);
    }

    // Ghi dữ liệu bệnh nhân vào đúng vị trí của bảng
    tableData.forEach((patient, rowIndex) => {
      const dataRowNum = table.dataStartRow + rowIndex;
      const row = worksheet.getRow(dataRowNum);

      visibleColumns.forEach(col => {
        const colIndex = headerToCol.get(col.key.toUpperCase());
        if (colIndex !== undefined && colIndex > 0) {
          try {
            const cell = row.getCell(colIndex);
            const value = patient[col.key];

            // Giữ nguyên style cũ hoặc dùng template style
            const existingStyle = cell.style;
            const templateStyle = templateStyles.get(colIndex);

            // Set công thức BMI nếu là cột BMI
            if (col.key === 'BMI' && weightCol && heightCol) {
              cell.value = {
                formula: `IF(OR(${weightCol}${dataRowNum}="",${heightCol}${dataRowNum}=""),"",ROUND(${weightCol}${dataRowNum}/(${heightCol}${dataRowNum}^2),2))`,
                result: value || undefined
              };
            }
            // Set công thức Thể trạng nếu là cột THỂ TRẠNG
            else if (col.key === 'THỂ TRẠNG' && bmiCol) {
              cell.value = {
                formula: `IF(${bmiCol}${dataRowNum}="","",IF(${bmiCol}${dataRowNum}<18,"Thiếu cân",IF(${bmiCol}${dataRowNum}<=25,"Bình thường","Thừa cân")))`,
                result: value || undefined
              };
            }
            // Set giá trị bình thường
            else if (value !== undefined && value !== null && value !== '') {
              cell.value = value;
            } else {
              cell.value = '';
            }

            // Giữ style (ưu tiên style hiện có, nếu không thì dùng template)
            // Nhưng KHÔNG giữ lại fill màu vàng từ style cũ - sẽ xử lý riêng
            const styleToApply = existingStyle && Object.keys(existingStyle).length > 0
              ? { ...existingStyle }
              : (templateStyle ? { ...templateStyle } : undefined);

            if (styleToApply) {
              // Xóa fill cũ trước khi apply style
              delete styleToApply.fill;
              cell.style = styleToApply;
            }

            // Highlight missing data với màu vàng - CHỈ khi bệnh nhân đã phân loại VÀ ô thiếu dữ liệu
            const patientValue = patient[col.key];
            const isEmpty = patientValue === undefined || patientValue === null || String(patientValue).trim() === '';
            if (isMissingData(patient, col.key) && isEmpty) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }, // Màu vàng
              };
            }
            // Nếu có dữ liệu hoặc không cần highlight -> không tô màu (cell sẽ không có fill)
          } catch (cellError) {
            console.warn('Error setting cell value at row', dataRowNum, 'col', colIndex, cellError);
          }
        }
      });
    });
  });

  // Xuất file
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
  } catch (writeError) {
    console.error('Error writing workbook buffer:', writeError);
    throw writeError;
  }
}

/**
 * Tìm index cột theo key (0-based)
 */
function findColumnIndex(columns: ColumnConfig[], key: string): number {
  return columns.findIndex(col =>
    col.key.toUpperCase() === key.toUpperCase() ||
    col.header.toUpperCase() === key.toUpperCase()
  );
}

/**
 * Chuyển số cột (0-based) sang ký tự cột Excel (A, B, C, ..., Z, AA, AB, ...)
 */
function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
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

  // Tìm index các cột cần thiết cho công thức
  const weightColIdx = findColumnIndex(visibleColumns, 'Cân nặng');
  const heightColIdx = findColumnIndex(visibleColumns, 'Chiều cao');
  const bmiColIdx = findColumnIndex(visibleColumns, 'BMI');
  const physiqueColIdx = findColumnIndex(visibleColumns, 'THỂ TRẠNG');

  // Chuyển sang ký tự cột Excel (1-based trong Excel)
  const weightCol = weightColIdx >= 0 ? getColumnLetter(weightColIdx) : null;
  const heightCol = heightColIdx >= 0 ? getColumnLetter(heightColIdx) : null;
  const bmiCol = bmiColIdx >= 0 ? getColumnLetter(bmiColIdx) : null;

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
  data.forEach((patient, rowIndex) => {
    const excelRowNum = rowIndex + 2; // +2 vì header ở dòng 1, dữ liệu bắt đầu từ dòng 2
    const rowData = visibleColumns.map((col, colIndex) => {
      // Nếu là cột BMI và có cột Cân nặng + Chiều cao -> dùng công thức
      if (col.key === 'BMI' && weightCol && heightCol) {
        return null; // Sẽ set công thức sau
      }
      // Nếu là cột Thể trạng và có cột BMI -> dùng công thức
      if (col.key === 'THỂ TRẠNG' && bmiCol) {
        return null; // Sẽ set công thức sau
      }
      return patient[col.key] ?? '';
    });
    const row = worksheet.addRow(rowData);

    // Set công thức BMI: =ROUND(CânNặng/(ChiềuCao^2), 2)
    if (bmiColIdx >= 0 && weightCol && heightCol) {
      const bmiCell = row.getCell(bmiColIdx + 1);
      bmiCell.value = {
        formula: `IF(OR(${weightCol}${excelRowNum}="",${heightCol}${excelRowNum}=""),"",ROUND(${weightCol}${excelRowNum}/(${heightCol}${excelRowNum}^2),2))`,
        result: patient['BMI'] || undefined
      };
    }

    // Set công thức Thể trạng: =IF(BMI<18,"Thiếu cân",IF(BMI<=25,"Bình thường","Thừa cân"))
    if (physiqueColIdx >= 0 && bmiCol) {
      const physiqueCell = row.getCell(physiqueColIdx + 1);
      physiqueCell.value = {
        formula: `IF(${bmiCol}${excelRowNum}="","",IF(${bmiCol}${excelRowNum}<18,"Thiếu cân",IF(${bmiCol}${excelRowNum}<=25,"Bình thường","Thừa cân")))`,
        result: patient['THỂ TRẠNG'] || undefined
      };
    }

    row.eachCell((cell, colNumber) => {
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

      // Highlight missing data với màu vàng - chỉ khi bệnh nhân đã phân loại VÀ ô thiếu dữ liệu
      const colKey = visibleColumns[colNumber - 1]?.key;
      if (colKey) {
        const patientValue = patient[colKey];
        const isEmpty = patientValue === undefined || patientValue === null || String(patientValue).trim() === '';
        if (isMissingData(patient, colKey) && isEmpty) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }, // Màu vàng
          };
        }
      }
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

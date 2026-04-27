'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PatientData, ColumnConfig, STANDARD_COLUMNS } from '@/types/patient';
import { importExcel, exportExcel, resetOriginalFileInfo, restoreOriginalWorkbook, hasOriginalWorkbook } from '@/utils/excelUtils';
import { PatientTable } from '@/components/PatientTable';
import { PatientEditor } from '@/components/PatientEditor';
import { Button } from '@/components/ui/button';
import { Upload, Download, Plus, Database, PlusCircle, X, Save, RefreshCw, Radiation, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast, Toaster } from 'sonner';

// Sample data matching the provided format
const SAMPLE_DATA: PatientData[] = [
  {
    CODE: '5081',
    'HỌ VÀ TÊN': 'Trần Văn Hòa',
    NS: '26/07/1992',
    GT: 'Nam',
    'Cân nặng': 66,
    'Chiều cao': 1.74,
    BMI: 21.80,
    'THỂ TRẠNG': 'Bình thường',
    'KHÁM TỔNG QUÁT': '- RHM: sức nhai 90%, sâu răng, mất răng, vệ sinh răng',
    'Siêu âm': '- Siêu âm Bụng: chưa phát hiện bất thường',
    'Điện tim': '- Nhịp xoang: 60 l/p',
    'PHÂN LOẠI SỨC KHỎE': 'II',
  },
  {
    CODE: '5082',
    'HỌ VÀ TÊN': 'Trần Văn Phú',
    NS: '14/04/1986',
    GT: 'Nam',
    'Cân nặng': 81,
    'Chiều cao': 1.73,
    BMI: 27.06,
    'THỂ TRẠNG': 'Thừa cân',
    'KHÁM TỔNG QUÁT': '- Mắt: mắt (P) 10/10, mắt (T) 10/10, mắt phải sụp mi nhẹ',
    'Siêu âm': '- Siêu âm Bụng: chưa phát hiện bất thường',
    'Điện tim': '- Nhịp xoang: 64 l/p',
    'PHÂN LOẠI SỨC KHỎE': 'II',
  },
  {
    CODE: '5083',
    'HỌ VÀ TÊN': 'Trần Võ Quốc Anh',
    NS: '30/05/2001',
    GT: 'Nam',
    'Cân nặng': 65,
    'Chiều cao': 1.57,
    BMI: 26.37,
    'THỂ TRẠNG': 'Thừa cân',
    'KHÁM TỔNG QUÁT': '- Mắt: CK mắt (P) 10/10, mắt (T) 10/10\n- TMH: amidan quá phát',
    'Siêu âm': '- Siêu âm Bụng: Sỏi thận 2 bên',
    'Điện tim': '- Nhịp xoang: 65 l/p',
    'PHÂN LOẠI SỨC KHỎE': 'II',
  },
  {
    CODE: '5084',
    'HỌ VÀ TÊN': 'Tsằn Mỹ Cảnh',
    NS: '18/02/1990',
    GT: 'Nam',
    'Cân nặng': 65,
    'Chiều cao': 1.65,
    BMI: 23.88,
    'THỂ TRẠNG': 'Bình thường',
    'KHÁM TỔNG QUÁT': '- Nội khoa: tăng huyết áp đang điều trị (HA 150/100 mmHg)\n- Mắt: CK mắt (P) 10/10, mắt (T) 9/10',
    'Siêu âm': '- Siêu âm Bụng: gan nhiễm mỡ độ I',
    'Điện tim': '- Nhịp xoang: 75 l/p',
    'PHÂN LOẠI SỨC KHỎE': 'II',
  },
  {
    CODE: '5085',
    'HỌ VÀ TÊN': 'Võ Như Y',
    NS: '15/11/1979',
    GT: 'Nam',
    'Cân nặng': 72,
    'Chiều cao': 1.64,
    BMI: 26.77,
    'THỂ TRẠNG': 'Thừa cân',
    'KHÁM TỔNG QUÁT': '- Mắt: mắt (P) 10/10, mắt (T) 6/10\n- RHM: sức nhai 100%, vôi răng',
    'Siêu âm': '- Siêu âm Bụng: chưa phát hiện bất thường',
    'Điện tim': '- Nhịp xoang: 60 l/p',
    'PHÂN LOẠI SỨC KHỎE': 'II',
  },
  {
    CODE: '5086',
    'HỌ VÀ TÊN': 'Võ Thanh Phương',
    NS: '09/10/1994',
    GT: 'Nam',
    'Cân nặng': '',
    'Chiều cao': '',
    BMI: '',
    'THỂ TRẠNG': '',
    'KHÁM TỔNG QUÁT': '',
    'Siêu âm': '',
    'Điện tim': '',
    'PHÂN LOẠI SỨC KHỎE': '',
  },
  {
    CODE: '5087',
    'HỌ VÀ TÊN': 'Võ Thị Thu Diểm',
    NS: '01/01/1991',
    GT: 'Nữ',
    'Cân nặng': 58,
    'Chiều cao': 1.46,
    BMI: 27.21,
    'THỂ TRẠNG': 'Thừa cân',
    'KHÁM TỔNG QUÁT': '- Mắt: CK mắt (P) 9/10, mắt (T) 9/10\n- RHM: sức nhai 90%, sâu răng',
    'Siêu âm': '- Siêu âm Tuyến vú: không tổn thương khu trú trên siêu âm tuyến vú\n- Siêu âm Bụng: gan nhiễm mỡ độ I\n- Siêu âm Phụ Khoa: chưa phát hiện bất thường',
    'Điện tim': '- Nhịp xoang: 78 l/p',
    'PHÂN LOẠI SỨC KHỎE': 'II',
  },
];

export default function Home() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(STANDARD_COLUMNS);
  const [fileName, setFileName] = useState<string>('');
  const [isSimpleFormat, setIsSimpleFormat] = useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clipboard state for copy/paste patient data
  const [copiedPatientData, setCopiedPatientData] = useState<PatientData | null>(null);

  // Batch X-ray mode state
  const [batchXrayMode, setBatchXrayMode] = useState(false);
  const [selectedForBatchXray, setSelectedForBatchXray] = useState<number[]>([]);

  // AutoSave key
  const AUTOSAVE_KEY = 'mediexcel_autosave';
  const CLIPBOARD_KEY = 'mediexcel_clipboard';
  const AUTOSAVE_INTERVAL = 30000; // 30 giây

  // Show toast notification - sử dụng sonner
  const showToast = useCallback((message: string) => {
    // Phân loại và hiển thị toast phù hợp
    if (message.includes('✅') || message.includes('thành công')) {
      toast.success(message.replace(/[✅➕]/g, '').trim(), {
        duration: 3000,
      });
    } else if (message.includes('❌') || message.includes('Lỗi')) {
      toast.error(message.replace('❌', '').trim(), {
        duration: 4000,
      });
    } else if (message.includes('🗑️') || message.includes('xoá')) {
      toast.warning(message.replace('🗑️', '').trim(), {
        duration: 3000,
      });
    } else if (message.includes('➕') || message.includes('thêm')) {
      toast.info(message.replace('➕', '').trim(), {
        duration: 3000,
      });
    } else {
      toast(message, {
        duration: 3000,
      });
    }
  }, []);

  // Load dữ liệu từ localStorage khi khởi động
  useEffect(() => {
    const loadData = async () => {
      const savedData = localStorage.getItem(AUTOSAVE_KEY);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.patients && parsed.patients.length > 0) {
            setPatients(parsed.patients);
            setColumns(parsed.columns || STANDARD_COLUMNS);
            setFileName(parsed.fileName || 'AutoSave');
            setIsSimpleFormat(parsed.isSimpleFormat || false);
            setLastSaved(new Date(parsed.savedAt));

            // Khôi phục workbook gốc từ IndexedDB - chỉ nếu khớp fileName
            const restored = await restoreOriginalWorkbook(parsed.fileName);
            if (restored) {
              showToast('📦 Đã khôi phục dữ liệu và format file gốc');
            } else {
              showToast('📦 Đã khôi phục dữ liệu (cần import lại file để giữ format gốc khi export)');
            }
          }
        } catch (e) {
          console.error('Error loading autosave:', e);
        }
      }

      // Load clipboard data
      const clipboardData = localStorage.getItem(CLIPBOARD_KEY);
      if (clipboardData) {
        try {
          const parsed = JSON.parse(clipboardData);
          setCopiedPatientData(parsed);
        } catch (e) {
          console.error('Error loading clipboard:', e);
        }
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AutoSave mỗi 30 giây khi có thay đổi
  useEffect(() => {
    if (patients.length === 0) return;

    const saveToLocalStorage = () => {
      const dataToSave = {
        patients,
        columns,
        fileName,
        isSimpleFormat,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    };

    // Save ngay khi có thay đổi
    setHasUnsavedChanges(true);

    // AutoSave sau mỗi khoảng thời gian
    const interval = setInterval(saveToLocalStorage, AUTOSAVE_INTERVAL);

    // Save khi user rời trang
    const handleBeforeUnload = () => {
      saveToLocalStorage();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [patients, columns, fileName, isSimpleFormat]);

  // Manual save
  const handleManualSave = useCallback(() => {
    if (patients.length === 0) return;
    const dataToSave = {
      patients,
      columns,
      fileName,
      isSimpleFormat,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
    setLastSaved(new Date());
    setHasUnsavedChanges(false);
    showToast('✅ Đã lưu dữ liệu!');
  }, [patients, columns, fileName, isSimpleFormat, showToast]);

  // Clear autosave
  const handleClearAutoSave = useCallback(async () => {
    if (confirm('Xóa dữ liệu đã lưu? Thao tác này không thể hoàn tác.')) {
      localStorage.removeItem(AUTOSAVE_KEY);
      setPatients([]);
      setColumns(STANDARD_COLUMNS);
      setFileName('');
      setLastSaved(null);
      await resetOriginalFileInfo();
      showToast('🗑️ Đã xóa dữ liệu');
    }
  }, [showToast]);

  // Keyboard shortcut Ctrl+S để lưu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (patients.length > 0) {
          const dataToSave = {
            patients,
            columns,
            fileName,
            isSimpleFormat,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          showToast('✅ Đã lưu dữ liệu!');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [patients, columns, fileName, isSimpleFormat, showToast]);

  // Import Excel
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importExcel(file);
      setPatients(result.data);
      setColumns(result.columns);
      setFileName(result.fileName);
      setIsSimpleFormat(result.isSimpleFormat);
      setSelectedRow(null);
      showToast(result.isSimpleFormat
        ? '✅ Đã import file danh sách đơn giản - Tự động thêm các cột khám'
        : '✅ Đã import file full cột - Giữ nguyên format gốc'
      );
    } catch (error) {
      console.error('Import error:', error);
      alert('Lỗi khi import file. Vui lòng kiểm tra định dạng file.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [showToast]);

  // Export Excel - sử dụng tên file gốc
  const handleExport = useCallback(async () => {
    if (patients.length === 0) {
      alert('Chưa có dữ liệu để xuất!');
      return;
    }
    try {
      // Khôi phục workbook gốc nếu chưa có
      if (!hasOriginalWorkbook()) {
        await restoreOriginalWorkbook();
      }

      // Truyền fileName để đảm bảo giữ tên file gốc
      await exportExcel(patients, columns, fileName || undefined);

      if (hasOriginalWorkbook()) {
        showToast('✅ Đã xuất file với format gốc!');
      } else {
        showToast('✅ Đã xuất file (format mới - import lại file gốc để giữ format)');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Lỗi khi xuất file!');
    }
  }, [patients, columns, fileName, showToast]);

  // Toggle column visibility
  const handleColumnToggle = useCallback((key: string) => {
    setColumns(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  // Reorder columns
  const handleColumnReorder = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const newColumns = [...prev];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      return newColumns;
    });
  }, []);

  // Load sample data
  const handleLoadSample = useCallback(async () => {
    await resetOriginalFileInfo(); // Reset file gốc khi load mẫu
    setPatients(SAMPLE_DATA);
    setFileName('Dữ liệu mẫu');
    setIsSimpleFormat(false);
    setSelectedRow(null);
  }, []);

  // Edit patient
  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setIsEditorOpen(true);
  }, []);

  // Delete patient
  const handleDelete = useCallback((index: number) => {
    const patientName = patients[index]?.['HỌ VÀ TÊN'] || patients[index]?.['CODE'] || 'Bệnh nhân';
    setPatients(prev => prev.filter((_, i) => i !== index));
    if (selectedRow === index) {
      setSelectedRow(null);
    }
    showToast(`🗑️ Đã xoá ${patientName}`);
  }, [selectedRow, patients, showToast]);

  // Save patient
  const handleSave = useCallback((updatedPatient: PatientData) => {
    if (editingIndex !== null) {
      setPatients(prev => prev.map((p, i) =>
        i === editingIndex ? updatedPatient : p
      ));
      showToast('✅ Đã lưu dữ liệu!');
    }
  }, [editingIndex, showToast]);

  // Save and close
  const handleSaveAndClose = useCallback((updatedPatient: PatientData) => {
    if (editingIndex !== null) {
      setPatients(prev => prev.map((p, i) =>
        i === editingIndex ? updatedPatient : p
      ));
    }
    setIsEditorOpen(false);
    setEditingIndex(null);
    showToast('✅ Đã lưu thành công!');
  }, [editingIndex, showToast]);

  // Add new column
  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return;

    const key = newColumnName.trim();
    // Check if column already exists
    if (columns.some(c => c.key === key)) {
      showToast('❌ Cột này đã tồn tại!');
      return;
    }

    setColumns(prev => [...prev, { key, header: key, visible: true, width: 150 }]);
    // Add empty value for this column to all patients
    setPatients(prev => prev.map(p => ({ ...p, [key]: '' })));
    setNewColumnName('');
    setShowAddColumn(false);
    showToast(`✅ Đã thêm cột "${key}"`);
  }, [newColumnName, columns, showToast]);

  // Navigate between patients in editor
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (editingIndex === null) return;

    const newIndex = direction === 'prev' ? editingIndex - 1 : editingIndex + 1;
    if (newIndex >= 0 && newIndex < patients.length) {
      setEditingIndex(newIndex);
    }
  }, [editingIndex, patients.length]);

  // Add new patient
  const handleAddNew = useCallback(() => {
    const newPatient: PatientData = {
      CODE: '',
      'HỌ VÀ TÊN': '',
      NS: '',
      GT: '',
      'Cân nặng': '',
      'Chiều cao': '',
      BMI: '',
      'THỂ TRẠNG': '',
      'KHÁM TỔNG QUÁT': '',
      'PHÂN LOẠI SỨC KHỏE': '',
      Xquang: '',
      'Siêu âm': '',
      'Điện tim': '',
    };
    setPatients(prev => [...prev, newPatient]);
    setEditingIndex(patients.length);
    setIsEditorOpen(true);
    showToast('➕ Đã thêm bệnh nhân mới - Vui lòng nhập thông tin');
  }, [patients.length, showToast]);

  // Move patient position
  const handleMovePatient = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= patients.length) return;
    setPatients(prev => {
      const newPatients = [...prev];
      const [removed] = newPatients.splice(fromIndex, 1);
      newPatients.splice(toIndex, 0, removed);
      return newPatients;
    });
    // Update selected row to follow the moved patient
    if (selectedRow === fromIndex) {
      setSelectedRow(toIndex);
    } else if (selectedRow !== null) {
      if (fromIndex < selectedRow && toIndex >= selectedRow) {
        setSelectedRow(selectedRow - 1);
      } else if (fromIndex > selectedRow && toIndex <= selectedRow) {
        setSelectedRow(selectedRow + 1);
      }
    }
    showToast(`✅ Đã di chuyển bệnh nhân`);
  }, [patients.length, selectedRow, showToast]);

  // Insert new patient at specific position
  const handleInsertPatient = useCallback((atIndex: number) => {
    // Kế thừa _tableName từ BN ở vị trí chèn (nếu có)
    const existingPatient = patients[atIndex];
    const tableName = existingPatient?.['_tableName'] || '';

    const newPatient: PatientData = {
      CODE: '',
      'HỌ VÀ TÊN': '',
      NS: '',
      GT: '',
      'Cân nặng': '',
      'Chiều cao': '',
      BMI: '',
      'THỂ TRẠNG': '',
      'KHÁM TỔNG QUÁT': '',
      'PHÂN LOẠI SỨC KHỎE': '',
      Xquang: '',
      'Siêu âm': '',
      'Điện tim': '',
      ...(tableName ? { '_tableName': tableName } : {}),
    };
    setPatients(prev => {
      const newPatients = [...prev];
      newPatients.splice(atIndex, 0, newPatient);
      return newPatients;
    });
    setEditingIndex(atIndex);
    setIsEditorOpen(true);
  }, [patients]);

  // Copy patient data (medical data only, keep CODE/HỌ TÊN/NS/GT)
  const handleCopyPatient = useCallback(() => {
    if (editingIndex === null) return;
    const patient = patients[editingIndex];
    if (!patient) return;

    // Copy only medical data (not basic info)
    const medicalData: PatientData = {
      'Cân nặng': patient['Cân nặng'],
      'Chiều cao': patient['Chiều cao'],
      BMI: patient['BMI'],
      'THỂ TRẠNG': patient['THỂ TRẠNG'],
      'KHÁM TỔNG QUÁT': patient['KHÁM TỔNG QUÁT'],
      'PHÂN LOẠI SỨC KHỎE': patient['PHÂN LOẠI SỨC KHỎE'],
      Xquang: patient['Xquang'],
      'Siêu âm': patient['Siêu âm'],
      'Điện tim': patient['Điện tim'],
    };

    setCopiedPatientData(medicalData);
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(medicalData));
    showToast('📋 Đã sao chép dữ liệu khám');
  }, [editingIndex, patients, showToast]);

  // Paste patient data
  const handlePastePatient = useCallback(() => {
    if (editingIndex === null || !copiedPatientData) return;

    setPatients(prev => prev.map((p, i) => {
      if (i === editingIndex) {
        return {
          ...p,
          ...copiedPatientData,
        };
      }
      return p;
    }));
    showToast('📥 Đã dán dữ liệu khám');
  }, [editingIndex, copiedPatientData, showToast]);

  // Clear patient medical data
  const handleClearPatientData = useCallback(() => {
    if (editingIndex === null) return;

    setPatients(prev => prev.map((p, i) => {
      if (i === editingIndex) {
        return {
          ...p,
          'Cân nặng': '',
          'Chiều cao': '',
          BMI: '',
          'THỂ TRẠNG': '',
          'KHÁM TỔNG QUÁT': '',
          'PHÂN LOẠI SỨC KHỎE': '',
          Xquang: '',
          'Siêu âm': '',
          'Điện tim': '',
        };
      }
      return p;
    }));
    showToast('🗑️ Đã xóa dữ liệu khám');
  }, [editingIndex, showToast]);

  // Toggle batch X-ray mode
  const handleToggleBatchXrayMode = useCallback(() => {
    setBatchXrayMode(prev => !prev);
    setSelectedForBatchXray([]);
  }, []);

  // Toggle patient selection for batch X-ray
  const handleToggleBatchXraySelection = useCallback((index: number) => {
    setSelectedForBatchXray(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  }, []);

  // Apply batch X-ray default
  const handleApplyBatchXray = useCallback(() => {
    if (selectedForBatchXray.length === 0) {
      showToast('⚠️ Chưa chọn bệnh nhân nào');
      return;
    }

    const defaultXray = ' - Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang';
    setPatients(prev => prev.map((p, i) => {
      if (selectedForBatchXray.includes(i)) {
        return { ...p, Xquang: defaultXray };
      }
      return p;
    }));

    showToast(`✅ Đã đặt Xquang mặc định cho ${selectedForBatchXray.length} bệnh nhân`);
    setBatchXrayMode(false);
    setSelectedForBatchXray([]);
  }, [selectedForBatchXray, showToast]);

  return (
    <main className="min-h-screen bg-emerald-50/30">
      {/* Compact Header */}
      <header className="bg-white border-b border-emerald-200">
        <div className="w-full px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/img/kay.jpg" alt="Lappy Medi Logo" className="h-8 w-8 rounded-full object-cover" />
              <h1 className="text-lg font-bold text-gray-900">Lappy Medi</h1>
              {fileName && (
                <>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {fileName}
                  </span>
                  {isSimpleFormat && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      DS đơn giản
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* AutoSave status */}
              {lastSaved && (
                <span className={`text-[10px] px-2 py-0.5 rounded ${hasUnsavedChanges ? 'text-orange-600 bg-orange-50' : 'text-green-600 bg-green-50'}`}>
                  {hasUnsavedChanges ? '⏳ Chưa lưu' : `✓ ${lastSaved.toLocaleTimeString('vi-VN')}`}
                </span>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                id="file-import"
              />

              {/* Save button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSave}
                disabled={patients.length === 0}
                className={`gap-1 h-7 text-xs ${hasUnsavedChanges ? 'border-orange-400 text-orange-600' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
                title="Lưu dữ liệu (Ctrl+S)"
              >
                <Save className="h-3 w-3" />
                Lưu
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Upload className="h-3 w-3" />
                Import
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={patients.length === 0}
                className="gap-1 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="h-3 w-3" />
                Export
              </Button>

              {/* <Button
                variant="secondary"
                size="sm"
                onClick={handleLoadSample}
                className="gap-1 h-7 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              >
                <Database className="h-3 w-3" />
                Mẫu
              </Button> */}

              <Button
                size="sm"
                onClick={handleAddNew}
                className="gap-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-3 w-3" />
                Thêm
              </Button>

              {/* Batch X-ray button */}
              {batchXrayMode ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={handleApplyBatchXray}
                    className="gap-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Check className="h-3 w-3" />
                    Xác nhận ({selectedForBatchXray.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleToggleBatchXrayMode}
                    className="h-7 text-xs text-gray-500"
                  >
                    Hủy
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleBatchXrayMode}
                  disabled={patients.length === 0}
                  className="gap-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                  title="Đặt Xquang mặc định hàng loạt"
                >
                  <Radiation className="h-3 w-3" />
                  Xquang
                </Button>
              )}

              {/* Clear data button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAutoSave}
                className="gap-1 h-7 text-xs text-gray-400 hover:text-red-500"
                title="Xóa tất cả dữ liệu"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - full width, max height */}
      <div className="w-full px-2 py-2">
        <div className="bg-white rounded shadow-sm border border-emerald-200 p-2 h-[calc(100vh-60px)]">
          {/* Add column button + help text */}
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showAddColumn ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Tên cột mới..."
                    className="w-48"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                  />
                  <Button size="sm" className="h-6 text-xs" onClick={handleAddColumn}>
                    Thêm
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowAddColumn(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddColumn(true)}
                  className="gap-1 h-6 text-xs text-gray-500"
                >
                  <PlusCircle className="h-3 w-3" />
                  Thêm cột
                </Button>
              )}
            </div>
            <span className="text-[10px] text-gray-400">
              ↑↓ hàng | ←→ cuộn | Alt+Kéo | Enter sửa
            </span>
          </div>

          <PatientTable
            data={patients}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onColumnToggle={handleColumnToggle}
            onColumnReorder={handleColumnReorder}
            onMovePatient={handleMovePatient}
            onInsertPatient={handleInsertPatient}
            selectedRow={selectedRow}
            onSelectRow={setSelectedRow}
            batchXrayMode={batchXrayMode}
            selectedForBatchXray={selectedForBatchXray}
            onToggleBatchXray={handleToggleBatchXraySelection}
          />
        </div>
      </div>

      {/* Sonner Toast - luôn hiển thị trên modal */}
      <Toaster
        position="top-center"
        richColors
        expand={true}
        toastOptions={{
          style: {
            zIndex: 99999,
          },
        }}
      />

      {/* Editor Modal */}
      <PatientEditor
        patient={editingIndex !== null ? patients[editingIndex] : null}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleSave}
        onSaveAndClose={handleSaveAndClose}
        onNavigate={handleNavigate}
        canNavigatePrev={editingIndex !== null && editingIndex > 0}
        canNavigateNext={editingIndex !== null && editingIndex < patients.length - 1}
        currentIndex={editingIndex ?? 0}
        totalCount={patients.length}
        onCopy={handleCopyPatient}
        onPaste={handlePastePatient}
        onClearData={handleClearPatientData}
        canPaste={copiedPatientData !== null}
      />
    </main>
  );
}

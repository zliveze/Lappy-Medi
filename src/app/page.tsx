'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PatientData, ColumnConfig, STANDARD_COLUMNS } from '@/types/patient';
import { importExcel, exportExcel, resetOriginalFileInfo, restoreOriginalWorkbook, hasOriginalWorkbook, loadOriginalWorkbookFromBase64 } from '@/utils/excelUtils';
import { PatientTable } from '@/components/PatientTable';
import { PatientEditor } from '@/components/PatientEditor';
import { Button } from '@/components/ui/button';
import { Upload, Download, Plus, PlusCircle, X, RefreshCw, Radiation, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast, Toaster } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud MongoDB & Syncing State
  const [workbooks, setWorkbooks] = useState<any[]>([]);
  const [currentWorkbookId, setCurrentWorkbookId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('connected');
  // lastSyncedAt dùng ref thay vì state để tránh useEffect polling bị restart
  // sau mỗi lần poll thành công (setLastSyncedAt cũ gây cleanup/re-subscribe liên tục)
  const lastSyncedAtRef = useRef<string | null>(null);

  // Clipboard state for copy/paste patient data
  const [copiedPatientData, setCopiedPatientData] = useState<PatientData | null>(null);

  // Batch X-ray mode state
  const [batchXrayMode, setBatchXrayMode] = useState(false);
  const [selectedForBatchXray, setSelectedForBatchXray] = useState<number[]>([]);

  // Toggle tooth detail table
  const [enableToothDetail, setEnableToothDetail] = useState(true);

  // Delete password dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState(false);

  // Smart Polling: chỉ poll khi tab đang hiển thị
  const isTabVisibleRef = useRef(true);

  // Debounce ref for column cloud-sync
  const columnSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce ref for reorder API call
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Adaptive poll interval: 3s khi có thay đổi, 5s khi idle
  const pollIntervalRef = useRef<number>(3000);

  // Keys
  const CLIPBOARD_KEY = 'mediexcel_clipboard';
  const COLUMNS_KEY = (id: string) => `mediexcel_columns_${id}`;
  const PATIENTS_CACHE_KEY = (id: string) => `mediexcel_patients_${id}`;
  const WORKBOOK_META_KEY = (id: string) => `mediexcel_meta_${id}`;

  // Show toast notification - sử dụng sonner
  const showToast = useCallback((message: string) => {
    if (message.includes('✅') || message.includes('thành công')) {
      toast.success(message.replace(/[✅➕]/g, '').trim(), { duration: 3000 });
    } else if (message.includes('❌') || message.includes('Lỗi')) {
      toast.error(message.replace('❌', '').trim(), { duration: 4000 });
    } else if (message.includes('🗑️') || message.includes('xoá')) {
      toast.warning(message.replace('🗑️', '').trim(), { duration: 3000 });
    } else if (message.includes('➕') || message.includes('thêm')) {
      toast.info(message.replace('➕', '').trim(), { duration: 3000 });
    } else {
      toast(message, { duration: 3000 });
    }
  }, []);

  // Smart Polling: Theo dõi trạng thái tab (visible/hidden)
  // Polling effect sẽ tự xử lý immediate poll khi tab quay lại
  useEffect(() => {
    const handleVisibility = () => {
      isTabVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Fetch all workbooks from MongoDB
  const fetchWorkbooks = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      const res = await fetch('/api/workbooks');
      if (res.ok) {
        const data = await res.json();
        setWorkbooks(data);
        setSyncStatus('connected');
      } else {
        setSyncStatus('offline');
      }
    } catch (e) {
      console.error('Error fetching workbooks:', e);
      setSyncStatus('offline');
    }
  }, []);

  // Load specific workbook by ID — LocalStorage first, then cloud refresh
  const loadWorkbook = useCallback(async (id: string) => {
    // === PHASE 1: Instant load from LocalStorage cache ===
    try {
      const cachedPatients = localStorage.getItem(PATIENTS_CACHE_KEY(id));
      const cachedMeta = localStorage.getItem(WORKBOOK_META_KEY(id));
      const cachedColumns = localStorage.getItem(COLUMNS_KEY(id));

      if (cachedPatients && cachedMeta) {
        const meta = JSON.parse(cachedMeta);
        const patients = JSON.parse(cachedPatients);
        const cols = cachedColumns ? JSON.parse(cachedColumns) : (meta.columns || STANDARD_COLUMNS);

        setPatients(patients);
        setColumns(cols);
        setFileName(meta.fileName);
        setIsSimpleFormat(meta.isSimpleFormat || false);
        setCurrentWorkbookId(id);
        localStorage.setItem('mediexcel_current_workbook_id', id);
        setLastSaved(meta.updatedAt ? new Date(meta.updatedAt) : null);
        // Show cached data immediately — cloud refresh happens below in background
      }
    } catch (e) {
      console.error('Error reading LS cache:', e);
    }

    // === PHASE 2: Background cloud refresh ===
    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/workbooks/${id}`);
      if (res.ok) {
        const { workbook, patients: loadedPatients } = await res.json();

        // User's saved column preferences override cloud columns
        const cachedColumns = localStorage.getItem(COLUMNS_KEY(id));
        const colsToUse = cachedColumns ? JSON.parse(cachedColumns) : (workbook.columns || STANDARD_COLUMNS);

        setPatients(loadedPatients);
        setColumns(colsToUse);
        setFileName(workbook.fileName);
        setIsSimpleFormat(workbook.isSimpleFormat || false);
        setCurrentWorkbookId(id);
        localStorage.setItem('mediexcel_current_workbook_id', id);

        // Update LS cache with fresh cloud data
        localStorage.setItem(PATIENTS_CACHE_KEY(id), JSON.stringify(loadedPatients));
        localStorage.setItem(WORKBOOK_META_KEY(id), JSON.stringify({
          fileName: workbook.fileName,
          isSimpleFormat: workbook.isSimpleFormat,
          columns: workbook.columns,
          updatedAt: workbook.updatedAt,
        }));

        // Restore original workbook buffer
        if (workbook.fileBufferBase64) {
          await loadOriginalWorkbookFromBase64(workbook.fileBufferBase64, workbook.fileName);
        }

        // Dùng server timestamp (workbook.updatedAt) làm seed — tránh lệch clock client/server
        lastSyncedAtRef.current = workbook.updatedAt || new Date().toISOString();
        setLastSaved(new Date(workbook.updatedAt));
        setSyncStatus('connected');
        showToast(`📦 Đã tải file "${workbook.fileName}" từ Cloud!`);
      } else {
        showToast('❌ Lỗi không thể tải file từ database');
        setSyncStatus('offline');
      }
    } catch (e) {
      console.error('Error loading workbook:', e);
      showToast('❌ Mất kết nối - Đang dùng dữ liệu đã lưu tạm');
      setSyncStatus('offline');
    }
  }, [showToast]);

  // Load initial data (workbooks list and restore last session)
  useEffect(() => {
    const initData = async () => {
      await fetchWorkbooks();

      // Khôi phục workbook đang làm dở từ session trước
      const savedWorkbookId = localStorage.getItem('mediexcel_current_workbook_id');
      if (savedWorkbookId) {
        await loadWorkbook(savedWorkbookId);
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

      // Load tooth detail setting
      const savedToothDetail = localStorage.getItem('mediexcel_tooth_detail');
      if (savedToothDetail !== null) {
        setEnableToothDetail(savedToothDetail === 'true');
      }
    };
    initData();
  }, [fetchWorkbooks, loadWorkbook]);

  // Ref để trỏ tới isEditorOpen mới nhất mà không trigger re-subscribe effect
  const isEditorOpenRef = useRef(isEditorOpen);
  useEffect(() => { isEditorOpenRef.current = isEditorOpen; }, [isEditorOpen]);

  // Ref để trỏ tới setPatients/setSyncStatus mới nhất (stable refs)
  const setPatientsRef = useRef(setPatients);
  const setSyncStatusRef = useRef(setSyncStatus);

  // Ref để workbookId có thể đọc từ trong callback mà không cần dependency
  const currentWorkbookIdRef = useRef(currentWorkbookId);
  useEffect(() => { currentWorkbookIdRef.current = currentWorkbookId; }, [currentWorkbookId]);

  // ═══════════════════════════════════════════════════════════════════════
  // REAL-TIME SYNC: Fast polling 3s + immediate poll khi tab quay lại
  // Vercel không hỗ trợ WebSocket → polling là cách duy nhất.
  // Tối ưu: 3s active, 5s editor mở, dừng hoàn toàn khi tab ẩn.
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentWorkbookId) return;

    // Reset timestamp khi đổi workbook
    lastSyncedAtRef.current = null;

    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;
    let isPolling = false; // guard chống gọi trùng

    // ── Core poll function ──────────────────────────────────────────────
    const doPoll = async () => {
      if (stopped || isPolling) return;

      // Tab ẩn → dừng hoàn toàn, không gọi API, chờ visibilitychange
      if (!isTabVisibleRef.current) return;

      const since = lastSyncedAtRef.current;
      if (!since) {
        // Chưa có seed → chờ loadWorkbook hoàn thành
        timeoutId = setTimeout(doPoll, 200);
        return;
      }

      isPolling = true;
      try {
        const res = await fetch(
          `/api/workbooks/${currentWorkbookId}/sync?since=${encodeURIComponent(since)}`
        );
        if (stopped) return;

        if (res.ok) {
          const { serverTime, updatedPatients } = await res.json();
          let hadChanges = false;

          if (updatedPatients && updatedPatients.length > 0) {
            hadChanges = true;
            setPatientsRef.current(prev => {
              const prevMap = new Map(prev.map((p: any) => [p._id, p]));
              let nextPatients = [...prev];
              let changed = false;

              updatedPatients.forEach((up: any) => {
                if (up.isDeleted) {
                  if (prevMap.has(up._id)) {
                    nextPatients = nextPatients.filter((p: any) => p._id !== up._id);
                    changed = true;
                  }
                } else if (prevMap.has(up._id)) {
                  nextPatients = nextPatients.map((p: any) => p._id === up._id ? up : p);
                  changed = true;
                } else {
                  nextPatients.push(up);
                  changed = true;
                }
              });

              if (changed) {
                nextPatients.sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
                // Cập nhật LS cache với dữ liệu mới nhất
                const wbId = currentWorkbookIdRef.current;
                if (wbId) {
                  try { localStorage.setItem(`mediexcel_patients_${wbId}`, JSON.stringify(nextPatients)); } catch {}
                }
                return nextPatients;
              }
              return prev;
            });
          }

          // Luôn dùng serverTime làm cursor
          lastSyncedAtRef.current = serverTime;
          setSyncStatusRef.current('connected');

          // Adaptive: có thay đổi → 3s (nhanh nhất), idle → 5s
          pollIntervalRef.current = hadChanges ? 3000 : 5000;
        } else {
          setSyncStatusRef.current('offline');
          pollIntervalRef.current = 10000; // offline → 10s retry
        }
      } catch (e) {
        console.error('Sync poll error:', e);
        setSyncStatusRef.current('offline');
        pollIntervalRef.current = 10000;
      } finally {
        isPolling = false;
      }

      // Schedule next poll
      if (!stopped) {
        timeoutId = setTimeout(doPoll, pollIntervalRef.current);
      }
    };

    // ── Immediate poll khi tab quay lại focus ────────────────────────────
    const handleVisibilityForPoll = () => {
      if (!document.hidden && !stopped && lastSyncedAtRef.current) {
        // Tab vừa quay lại → hủy timeout hiện tại, poll ngay lập tức
        clearTimeout(timeoutId);
        doPoll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityForPoll);

    // ── Start ───────────────────────────────────────────────────────────
    // Bắt đầu vòng poll (sẽ tự chờ nếu chưa có seed timestamp)
    timeoutId = setTimeout(doPoll, 500);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityForPoll);
    };
  }, [currentWorkbookId]);

  // Xóa toàn bộ dữ liệu file hiện tại — yêu cầu mật khẩu
  const handleClearAutoSave = useCallback(() => {
    if (!currentWorkbookId) return;
    setDeletePassword('');
    setDeletePasswordError(false);
    setShowDeleteDialog(true);
  }, [currentWorkbookId]);

  const confirmDeleteWithPassword = useCallback(async () => {
    const CORRECT_PASSWORD = '01678898707Abc!';
    if (deletePassword !== CORRECT_PASSWORD) {
      setDeletePasswordError(true);
      return;
    }
    setShowDeleteDialog(false);

    if (!currentWorkbookId) return;
    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/workbooks/${currentWorkbookId}`, { method: 'DELETE' });
      if (res.ok) {
        // Clear LS cache for this workbook
        localStorage.removeItem(PATIENTS_CACHE_KEY(currentWorkbookId));
        localStorage.removeItem(WORKBOOK_META_KEY(currentWorkbookId));
        localStorage.removeItem(COLUMNS_KEY(currentWorkbookId));
        setPatients([]);
        setColumns(STANDARD_COLUMNS);
        setFileName('');
        setCurrentWorkbookId(null);
        localStorage.removeItem('mediexcel_current_workbook_id');
        await resetOriginalFileInfo();
        await fetchWorkbooks();
        setSyncStatus('connected');
        showToast('🗑️ Đã xóa file khỏi database!');
      } else {
        showToast('❌ Lỗi khi xóa file');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Mất kết nối');
      setSyncStatus('offline');
    }
  }, [currentWorkbookId, deletePassword, fetchWorkbooks, showToast]);

  // Keyboard shortcut Ctrl+S để làm mới / đồng bộ thủ công
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        fetchWorkbooks();
        if (currentWorkbookId) {
          loadWorkbook(currentWorkbookId);
        }
        showToast('🔄 Đã làm mới và đồng bộ dữ liệu từ Cloud!');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWorkbookId, fetchWorkbooks, loadWorkbook, showToast]);

  // Import Excel
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importExcel(file);
      setSyncStatus('syncing');

      // Tải workbook gốc và các dòng dữ liệu bệnh nhân lên MongoDB
      const res = await fetch('/api/workbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: result.fileName,
          isSimpleFormat: result.isSimpleFormat,
          fileBufferBase64: result.fileBufferBase64,
          columns: result.columns,
          patients: result.data
        })
      });

      if (res.ok) {
        const { workbookId } = await res.json();
        setCurrentWorkbookId(workbookId);
        localStorage.setItem('mediexcel_current_workbook_id', workbookId);
        
        // Tải dữ liệu chính thức từ DB để nhận đầy đủ _id của bệnh nhân
        await loadWorkbook(workbookId);
        await fetchWorkbooks();

        showToast(result.isSimpleFormat
          ? '✅ Đã import danh sách đơn giản lên Cloud thành công!'
          : '✅ Đã import danh sách đầy đủ lên Cloud thành công!'
        );
      } else {
        showToast('❌ Lỗi khi lưu file lên Cloud database');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Lỗi khi import file. Vui lòng kiểm tra định dạng file.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [loadWorkbook, fetchWorkbooks, showToast]);

  // Export Excel - sử dụng file mẫu gốc
  const handleExport = useCallback(async () => {
    if (patients.length === 0) {
      alert('Chưa có dữ liệu để xuất!');
      return;
    }
    try {
      // Khôi phục workbook mẫu từ DB nếu trong bộ nhớ chưa có
      if (!hasOriginalWorkbook() && currentWorkbookId) {
        setSyncStatus('syncing');
        const res = await fetch(`/api/workbooks/${currentWorkbookId}`);
        if (res.ok) {
          const { workbook } = await res.json();
          if (workbook.fileBufferBase64) {
            await loadOriginalWorkbookFromBase64(workbook.fileBufferBase64, workbook.fileName);
          }
        }
        setSyncStatus('connected');
      }

      await exportExcel(patients, columns, fileName || undefined);

      if (hasOriginalWorkbook()) {
        showToast('✅ Đã xuất file với format gốc!');
      } else {
        showToast('✅ Đã xuất file (định dạng mới)');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Lỗi khi xuất file!');
    }
  }, [patients, columns, fileName, currentWorkbookId, showToast]);

  // Persist column changes: LS immediately, cloud debounced
  const saveColumnsToStorage = useCallback((newColumns: ColumnConfig[], workbookId: string | null) => {
    if (!workbookId) return;
    // Instant LS save
    localStorage.setItem(COLUMNS_KEY(workbookId), JSON.stringify(newColumns));
    // Debounced cloud sync (1.5s after last change)
    if (columnSyncTimerRef.current) clearTimeout(columnSyncTimerRef.current);
    columnSyncTimerRef.current = setTimeout(() => {
      fetch(`/api/workbooks/${workbookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: newColumns }),
      }).catch(err => console.error('Column cloud sync failed:', err));
    }, 1500);
  }, []);

  // Toggle column visibility
  const handleColumnToggle = useCallback((key: string) => {
    setColumns(prev => {
      const updated = prev.map(col =>
        col.key === key ? { ...col, visible: !col.visible } : col
      );
      saveColumnsToStorage(updated, currentWorkbookId);
      return updated;
    });
  }, [currentWorkbookId, saveColumnsToStorage]);

  // Reorder columns
  const handleColumnReorder = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const newColumns = [...prev];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      saveColumnsToStorage(newColumns, currentWorkbookId);
      return newColumns;
    });
  }, [currentWorkbookId, saveColumnsToStorage]);

  // Edit patient
  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setIsEditorOpen(true);
  }, []);

  // Delete patient (soft-delete with instant real-time sync update)
  const handleDelete = useCallback(async (index: number) => {
    const patient = patients[index];
    if (!patient) return;
    const patientName = patient['HỌ VÀ TÊN'] || patient['CODE'] || 'Bệnh nhân';
    const patientId = patient._id;

    if (!patientId) {
      setPatients(prev => prev.filter((_, i) => i !== index));
      if (selectedRow === index) setSelectedRow(null);
      showToast(`🗑️ Đã xoá ${patientName}`);
      return;
    }

    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/patients/${patientId}`, { method: 'DELETE' });
      if (res.ok) {
        setPatients(prev => prev.filter((_, i) => i !== index));
        if (selectedRow === index) {
          setSelectedRow(null);
        }
        setSyncStatus('connected');
        showToast(`🗑️ Đã xoá bệnh nhân ${patientName}`);
      } else {
        showToast('❌ Lỗi khi xóa bệnh nhân khỏi Cloud');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Lỗi kết nối - Không thể xóa');
      setSyncStatus('offline');
    }
  }, [selectedRow, patients, showToast]);

  // Save patient — LS first, then cloud background
  const handleSave = useCallback(async (updatedPatient: PatientData) => {
    if (editingIndex !== null) {
      const patientId = updatedPatient._id;
      if (!patientId) return;

      // Instant LS update
      setPatients(prev => {
        const updated = prev.map((p, i) => i === editingIndex ? updatedPatient : p);
        if (currentWorkbookId) {
          localStorage.setItem(PATIENTS_CACHE_KEY(currentWorkbookId), JSON.stringify(updated));
        }
        return updated;
      });

      // Background cloud sync
      setSyncStatus('syncing');
      try {
        const res = await fetch(`/api/patients/${patientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPatient)
        });

        if (res.ok) {
          const savedPatient = await res.json();
          setPatients(prev => {
            const updated = prev.map((p, i) => i === editingIndex ? savedPatient : p);
            if (currentWorkbookId) {
              localStorage.setItem(PATIENTS_CACHE_KEY(currentWorkbookId), JSON.stringify(updated));
            }
            return updated;
          });
          setSyncStatus('connected');
          showToast('✅ Đã lưu dữ liệu lên Cloud!');
        } else {
          showToast('❌ Lỗi khi lưu dữ liệu lên MongoDB');
          setSyncStatus('offline');
        }
      } catch (e) {
        console.error('Error saving patient:', e);
        showToast('❌ Lỗi kết nối - Đang giữ dữ liệu tạm thời');
        setSyncStatus('offline');
      }
    }
  }, [editingIndex, currentWorkbookId, showToast]);

  // Save and close — LS first, then cloud background
  const handleSaveAndClose = useCallback(async (updatedPatient: PatientData) => {
    if (editingIndex !== null) {
      const patientId = updatedPatient._id;
      if (!patientId) {
        setIsEditorOpen(false);
        setEditingIndex(null);
        return;
      }

      // Instant LS update
      setPatients(prev => {
        const updated = prev.map((p, i) => i === editingIndex ? updatedPatient : p);
        if (currentWorkbookId) {
          localStorage.setItem(PATIENTS_CACHE_KEY(currentWorkbookId), JSON.stringify(updated));
        }
        return updated;
      });

      // Background cloud sync
      setSyncStatus('syncing');
      fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPatient)
      }).then(async res => {
        if (res.ok) {
          const savedPatient = await res.json();
          setPatients(prev => {
            const updated = prev.map(p => p._id === savedPatient._id ? savedPatient : p);
            if (currentWorkbookId) {
              localStorage.setItem(PATIENTS_CACHE_KEY(currentWorkbookId), JSON.stringify(updated));
            }
            return updated;
          });
          setSyncStatus('connected');
          showToast('✅ Đã lưu thành công!');
        } else {
          showToast('❌ Lỗi khi lưu lên Cloud');
          setSyncStatus('offline');
        }
      }).catch(e => {
        console.error('Error saving patient:', e);
        showToast('❌ Lỗi kết nối - Đã giữ tạm trên thiết bị');
        setSyncStatus('offline');
      });
    }
    setIsEditorOpen(false);
    setEditingIndex(null);
  }, [editingIndex, currentWorkbookId, showToast]);

  // Add new column
  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return;

    const key = newColumnName.trim();
    if (columns.some(c => c.key === key)) {
      showToast('❌ Cột này đã tồn tại!');
      return;
    }

    setColumns(prev => [...prev, { key, header: key, visible: true, width: 150 }]);
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

  // Add new patient (instantly creates on cloud and updates all browsers)
  const handleAddNew = useCallback(async () => {
    if (!currentWorkbookId) {
      showToast('⚠️ Vui lòng chọn hoặc Import một file trước!');
      return;
    }

    const newPatientData = {
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
    };

    try {
      setSyncStatus('syncing');
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workbookId: currentWorkbookId,
          ...newPatientData
        })
      });

      if (res.ok) {
        const createdPatient = await res.json();
        setPatients(prev => [...prev, createdPatient]);
        setEditingIndex(patients.length);
        setIsEditorOpen(true);
        setSyncStatus('connected');
        showToast('➕ Đã thêm bệnh nhân mới');
      } else {
        showToast('❌ Lỗi khi tạo bệnh nhân');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Mất kết nối');
      setSyncStatus('offline');
    }
  }, [currentWorkbookId, patients.length, showToast]);

  // Move patient position — debounce 800ms để tránh spam API khi kéo thả liên tục
  const handleMovePatient = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= patients.length || !currentWorkbookId) return;

    setPatients(prev => {
      const newPatients = [...prev];
      const [removed] = newPatients.splice(fromIndex, 1);
      newPatients.splice(toIndex, 0, removed);

      // Debounce: huỷ lần gọi trước, chỉ gửi API sau khi dừng kéo 800ms
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
      const orderedIds = newPatients.map(p => p._id);
      setSyncStatus('syncing');
      reorderTimerRef.current = setTimeout(() => {
        fetch(`/api/workbooks/${currentWorkbookId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds })
        }).then(() => setSyncStatus('connected'))
          .catch(() => setSyncStatus('offline'));
      }, 800);

      return newPatients;
    });

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
  }, [patients.length, selectedRow, currentWorkbookId, showToast]);

  // Insert new patient at specific position (instantly creates on cloud and updates all browsers)
  const handleInsertPatient = useCallback(async (atIndex: number) => {
    if (!currentWorkbookId) return;

    const existingPatient = patients[atIndex];
    const tableName = existingPatient?.['_tableName'] || '';

    const newPatientData = {
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

    try {
      setSyncStatus('syncing');
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workbookId: currentWorkbookId,
          ...newPatientData
        })
      });

      if (res.ok) {
        const createdPatient = await res.json();
        setPatients(prev => {
          const newPatients = [...prev];
          newPatients.splice(atIndex, 0, createdPatient);
          
          const orderedIds = newPatients.map(p => p._id);
          fetch(`/api/workbooks/${currentWorkbookId}/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds })
          });

          return newPatients;
        });

        setEditingIndex(atIndex);
        setIsEditorOpen(true);
        setSyncStatus('connected');
      } else {
        showToast('❌ Lỗi khi chèn bệnh nhân');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Lỗi kết nối');
      setSyncStatus('offline');
    }
  }, [currentWorkbookId, patients, showToast]);

  // Copy patient data (medical data only, keep CODE/HỌ TÊN/NS/GT)
  const handleCopyPatient = useCallback(() => {
    if (editingIndex === null) return;
    const patient = patients[editingIndex];
    if (!patient) return;

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

  // Paste patient data and auto patch to database
  const handlePastePatient = useCallback(async () => {
    if (editingIndex === null || !copiedPatientData) return;
    const patient = patients[editingIndex];
    const patientId = patient._id;
    if (!patientId) return;

    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copiedPatientData)
      });
      if (res.ok) {
        const saved = await res.json();
        setPatients(prev => prev.map((p, i) => i === editingIndex ? saved : p));
        setSyncStatus('connected');
        showToast('📥 Đã dán và đồng bộ dữ liệu khám!');
      } else {
        showToast('❌ Lỗi khi lưu dữ liệu dán');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Lỗi kết nối');
      setSyncStatus('offline');
    }
  }, [editingIndex, patients, copiedPatientData, showToast]);

  // Clear patient medical data and sync to database
  const handleClearPatientData = useCallback(async () => {
    if (editingIndex === null) return;
    const patient = patients[editingIndex];
    const patientId = patient._id;
    if (!patientId) return;

    const clearedData = {
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

    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clearedData)
      });
      if (res.ok) {
        const saved = await res.json();
        setPatients(prev => prev.map((p, i) => i === editingIndex ? saved : p));
        setSyncStatus('connected');
        showToast('🗑️ Đã xóa sạch dữ liệu khám');
      } else {
        showToast('❌ Lỗi khi xóa dữ liệu');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Lỗi kết nối');
      setSyncStatus('offline');
    }
  }, [editingIndex, patients, showToast]);

  // Toggle batch X-ray mode
  const handleToggleBatchXrayMode = useCallback(() => {
    setBatchXrayMode(prev => !prev);
    setSelectedForBatchXray([]);
  }, []);

  // Toggle tooth detail setting
  const handleToggleToothDetail = useCallback(() => {
    setEnableToothDetail(prev => {
      const newVal = !prev;
      localStorage.setItem('mediexcel_tooth_detail', String(newVal));
      return newVal;
    });
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

  // Apply batch X-ray default and patch concurrently to MongoDB
  const handleApplyBatchXray = useCallback(async () => {
    if (selectedForBatchXray.length === 0) {
      showToast('⚠️ Chưa chọn bệnh nhân nào');
      return;
    }

    const defaultXray = ' - Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang';
    setSyncStatus('syncing');
    
    try {
      const promises = selectedForBatchXray.map(async (i) => {
        const patient = patients[i];
        if (patient && patient._id) {
          await fetch(`/api/patients/${patient._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Xquang: defaultXray })
          });
        }
      });

      await Promise.all(promises);

      setPatients(prev => prev.map((p, i) => {
        if (selectedForBatchXray.includes(i)) {
          return { ...p, Xquang: defaultXray };
        }
        return p;
      }));

      setSyncStatus('connected');
      showToast(`✅ Đã đặt Xquang mặc định cho ${selectedForBatchXray.length} bệnh nhân`);
    } catch (e) {
      console.error(e);
      showToast('❌ Lỗi khi lưu hàng loạt Xquang');
      setSyncStatus('offline');
    }

    setBatchXrayMode(false);
    setSelectedForBatchXray([]);
  }, [selectedForBatchXray, patients, showToast]);

  return (
    <main className="min-h-screen bg-emerald-50/30">
      {/* Compact Header */}
      <header className="bg-white border-b border-emerald-200">
        <div className="w-full px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/img/kay.jpg" alt="Lappy Medi Logo" className="h-8 w-8 rounded-full object-cover" />
              <h1 className="text-lg font-bold text-gray-900 mr-2">Lappy Medi</h1>
              
              {/* Dropdown chọn file từ Cloud */}
              <Select
                value={currentWorkbookId || 'none'}
                onValueChange={(val) => {
                  if (val !== 'none') {
                    loadWorkbook(val);
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 min-w-[150px] max-w-[250px]">
                  <SelectValue placeholder="Chọn file y tế..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>--- Chọn file từ MongoDB ---</SelectItem>
                  {workbooks.map((wb) => (
                    <SelectItem key={wb._id} value={wb._id}>
                      📁 {wb.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Chỉ báo trạng thái kết nối & đồng bộ Cloud */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 border border-emerald-200">
                {syncStatus === 'connected' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-emerald-700 font-semibold">Cloud Đồng bộ</span>
                  </>
                )}
                {syncStatus === 'syncing' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin"></span>
                    <span className="text-amber-700">Đang lưu...</span>
                  </>
                )}
                {syncStatus === 'offline' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span className="text-rose-700">Ngoại tuyến (Lưu tạm)</span>
                  </>
                )}
              </div>

              {isSimpleFormat && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  DS đơn giản
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* AutoSave status */}
              {lastSaved && (
                <span className="text-[10px] px-2 py-0.5 rounded text-green-600 bg-green-50">
                  {`Lưu cuối: ${lastSaved.toLocaleTimeString('vi-VN')}`}
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

              {/* Sync button */}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetchWorkbooks();
                  if (currentWorkbookId) {
                    await loadWorkbook(currentWorkbookId);
                  }
                }}
                disabled={!currentWorkbookId}
                className="gap-1 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                title="Làm mới dữ liệu từ Cloud (Ctrl+S)"
              >
                <RefreshCw className="h-3 w-3" />
                Đồng bộ
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

              <Button
                size="sm"
                onClick={handleAddNew}
                className="gap-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-3 w-3" />
                Thêm
              </Button>

              {/* Toggle tooth detail button */}
              <Button
                size="sm"
                variant={enableToothDetail ? 'default' : 'outline'}
                onClick={handleToggleToothDetail}
                className={`gap-1 h-7 text-xs ${enableToothDetail ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'}`}
                title="Bật/tắt bảng chọn chi tiết răng cho sâu răng, mất răng"
              >
                Chi tiết răng: {enableToothDetail ? 'Bật' : 'Tắt'}
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

              {/* Clear file button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAutoSave}
                disabled={!currentWorkbookId}
                className="gap-1 h-7 text-xs text-gray-400 hover:text-red-500"
                title="Xóa file hiện tại khỏi database"
              >
                <X className="h-3.5 w-3.5" />
              </Button>

              {/* Delete password dialog */}
              {showDeleteDialog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-80 border border-red-200">
                    <h2 className="text-base font-bold text-red-600 mb-1">⚠️ Xác nhận xóa file</h2>
                    <p className="text-xs text-gray-500 mb-4">
                      Hành động này sẽ xóa vĩnh viễn file và toàn bộ dữ liệu bệnh nhân.
                      Vui lòng nhập mật khẩu để xác nhận.
                    </p>
                    <input
                      type="password"
                      autoFocus
                      value={deletePassword}
                      onChange={e => { setDeletePassword(e.target.value); setDeletePasswordError(false); }}
                      onKeyDown={e => e.key === 'Enter' && confirmDeleteWithPassword()}
                      placeholder="Nhập mật khẩu..."
                      className={`w-full border rounded-lg px-3 py-2 text-sm mb-1 outline-none focus:ring-2 ${
                        deletePasswordError
                          ? 'border-red-400 focus:ring-red-300'
                          : 'border-gray-300 focus:ring-emerald-300'
                      }`}
                    />
                    {deletePasswordError && (
                      <p className="text-xs text-red-500 mb-3">❌ Mật khẩu không đúng!</p>
                    )}
                    {!deletePasswordError && <div className="mb-3" />}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowDeleteDialog(false)}
                        className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={confirmDeleteWithPassword}
                        className="px-4 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        Xóa file
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
            <span className="text-[10px] text-gray-400 font-medium">
              ↑↓ hàng | ←→ cuộn | Alt+Kéo | Enter sửa | Ctrl+S đồng bộ
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
        enableToothDetail={enableToothDetail}
      />
    </main>
  );
}

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PatientData, ColumnConfig } from '@/types/patient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, GripVertical, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Plus, MoreHorizontal } from 'lucide-react';

interface PatientTableProps {
  data: PatientData[];
  columns: ColumnConfig[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onColumnToggle: (key: string) => void;
  onColumnReorder: (fromIndex: number, toIndex: number) => void;
  onMovePatient: (fromIndex: number, toIndex: number) => void;
  onInsertPatient: (atIndex: number) => void;
  selectedRow: number | null;
  onSelectRow: (index: number | null) => void;
}

export function PatientTable({
  data,
  columns,
  onEdit,
  onDelete,
  onColumnToggle,
  onColumnReorder,
  onMovePatient,
  onInsertPatient,
  selectedRow,
  onSelectRow,
}: PatientTableProps) {
  const visibleColumns = columns.filter((col) => col.visible);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [showActions, setShowActions] = useState(false); // Toggle hiển thị các nút action
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Pan/drag state for scrolling
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  // Mouse drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan with middle mouse button or when holding space
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setStartPos({ x: e.clientX, y: e.clientY });
      setScrollPos({
        x: tableRef.current?.scrollLeft || 0,
        y: tableRef.current?.scrollTop || 0,
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !tableRef.current) return;
    e.preventDefault();
    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    tableRef.current.scrollLeft = scrollPos.x - dx;
    tableRef.current.scrollTop = scrollPos.y - dy;
  }, [isPanning, startPos, scrollPos]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableRef.current) return;
      const scrollAmount = 100;
      
      switch (e.key) {
        case 'ArrowLeft':
          tableRef.current.scrollLeft -= scrollAmount;
          break;
        case 'ArrowRight':
          tableRef.current.scrollLeft += scrollAmount;
          break;
        case 'ArrowUp':
          if (selectedRow !== null && selectedRow > 0) {
            onSelectRow(selectedRow - 1);
          }
          break;
        case 'ArrowDown':
          if (selectedRow !== null && selectedRow < data.length - 1) {
            onSelectRow(selectedRow + 1);
          } else if (selectedRow === null && data.length > 0) {
            onSelectRow(0);
          }
          break;
        case 'Enter':
          if (selectedRow !== null) {
            onEdit(selectedRow);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRow, data.length, onSelectRow, onEdit]);

  // Drag handlers for column reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedColumn !== null && draggedColumn !== targetIndex) {
      // Find actual indices in full columns array
      const fromCol = visibleColumns[draggedColumn];
      const toCol = visibleColumns[targetIndex];
      const fromIdx = columns.findIndex(c => c.key === fromCol.key);
      const toIdx = columns.findIndex(c => c.key === toCol.key);
      onColumnReorder(fromIdx, toIdx);
    }
    setDraggedColumn(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header controls */}
      <div className="mb-1 flex items-center gap-3">
        {/* Toggle hiển thị cột */}
        <button
          onClick={() => setShowColumnToggle(!showColumnToggle)}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800"
        >
          {showColumnToggle ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showColumnToggle ? 'Ẩn' : 'Hiển thị'} cột ({visibleColumns.length}/{columns.length})
        </button>
        
        {/* Toggle thao tác */}
        <button
          onClick={() => setShowActions(!showActions)}
          className={`flex items-center gap-1 text-xs ${showActions ? 'text-emerald-700 font-medium' : 'text-gray-500 hover:text-emerald-600'}`}
        >
          <MoreHorizontal className="h-3 w-3" />
          {showActions ? 'Ẩn thao tác' : 'Thao tác'}
        </button>
      </div>
      {showColumnToggle && (
        <div className="mb-1 p-2 bg-gray-50 rounded border flex flex-wrap gap-2">
          {columns.map((col) => (
            <label key={col.key} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox
                checked={col.visible}
                onCheckedChange={() => onColumnToggle(col.key)}
                className="h-3 w-3"
              />
              <span className="text-gray-600">{col.header}</span>
            </label>
          ))}
        </div>
      )}

      {/* Table */}
      <div 
        ref={tableRef}
        className={`flex-1 overflow-auto border rounded ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
        style={{ touchAction: 'pan-x pan-y' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <table className="w-full border-collapse min-w-max text-xs">
          <thead className="bg-emerald-600 text-white sticky top-0 z-10">
            <tr>
              {showActions && (
                <th className="px-1 py-1 text-center font-medium border-r border-emerald-500 sticky left-0 bg-emerald-600 z-20 w-24">
                  Thao tác
                </th>
              )}
              {visibleColumns.map((col, idx) => (
                <th
                  key={col.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`px-1 py-1 text-left font-medium border-r border-emerald-500 cursor-move select-none ${
                    draggedColumn === idx ? 'opacity-50 bg-emerald-700' : ''
                  }`}
                  style={{ minWidth: col.width ? col.width * 0.7 : 70 }}
                >
                  <div className="flex items-center gap-0.5">
                    <GripVertical className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
                    <span className="truncate">{col.header}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-8 text-center text-gray-500">
                  Chưa có dữ liệu. Vui lòng import file Excel.
                </td>
              </tr>
            ) : (
              data.map((patient, index) => {
                // Kiểm tra xem có phải dòng đầu của bảng mới không
                const currentTableName = patient['_tableName'] as string | undefined;
                const prevTableName = index > 0 ? (data[index - 1]['_tableName'] as string | undefined) : undefined;
                const isNewTable = currentTableName && currentTableName !== prevTableName;
                
                return (
                  <React.Fragment key={index}>
                    {/* Dòng phân cách bảng mới */}
                    {isNewTable && (
                      <tr className="bg-amber-100 border-t-2 border-amber-400">
                        <td colSpan={visibleColumns.length + 1} className="px-3 py-2 font-semibold text-amber-800 text-sm">
                          📋 {currentTableName}
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b hover:bg-emerald-50 cursor-pointer ${
                        selectedRow === index ? 'bg-emerald-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                      onClick={() => onSelectRow(selectedRow === index ? null : index)}
                      onDoubleClick={() => onEdit(index)}
                    >
                  {/* Action buttons - chỉ hiển thị khi showActions */}
                  {showActions && (
                    <td className="px-1 py-0.5 text-center border-r sticky left-0 bg-inherit z-10 w-24">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-gray-500 hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); onMovePatient(index, index - 1); }}
                          disabled={index === 0}
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-gray-500 hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); onMovePatient(index, index + 1); }}
                          disabled={index === data.length - 1}
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-blue-500 hover:bg-blue-100"
                          onClick={(e) => { e.stopPropagation(); onInsertPatient(index); }}
                          title="Chèn BN mới"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-emerald-600 hover:bg-emerald-100"
                          onClick={(e) => { e.stopPropagation(); onEdit(index); }}
                          title="Sửa"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-red-500 hover:bg-red-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Xóa bệnh nhân này?')) onDelete(index);
                          }}
                          title="Xóa"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                  {visibleColumns.map((col) => {
                    // Giới hạn chiều ngang theo loại cột
                    const maxWidth = col.key.includes('KHÁM') || col.key.includes('Siêu âm') || col.key.includes('Xquang') 
                      ? 300 
                      : col.width ? col.width * 0.8 : 120;
                    
                    return (
                      <td
                        key={col.key}
                        className="px-1 py-0.5 border-r border-gray-200 align-top"
                        style={{ 
                          minWidth: col.width ? col.width * 0.5 : 60,
                          maxWidth: maxWidth,
                        }}
                      >
                        {col.key === 'THỂ TRẠNG' ? (
                          <span className={`font-medium ${
                            String(patient[col.key]).includes('Bình thường') ? 'text-emerald-600' :
                            String(patient[col.key]).includes('Thừa cân') ? 'text-orange-600' :
                            String(patient[col.key]).includes('Thiếu cân') ? 'text-yellow-600' : ''
                          }`}>
                            {patient[col.key] || ''}
                          </span>
                        ) : col.key === 'PHÂN LOẠI SỨC KHỎẺ' ? (
                          <span className={`font-medium ${
                            String(patient[col.key]).includes('I') && !String(patient[col.key]).includes('II') ? 'text-emerald-600' :
                            String(patient[col.key]).includes('II') && !String(patient[col.key]).includes('III') ? 'text-teal-600' :
                            String(patient[col.key]).includes('III') ? 'text-yellow-600' :
                            String(patient[col.key]).includes('IV') ? 'text-orange-600' :
                            String(patient[col.key]).includes('V') ? 'text-red-600' : ''
                          }`}>
                            {patient[col.key] || ''}
                          </span>
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-gray-700">
                            {patient[col.key] ?? ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Compact footer */}
      <div className="mt-1 text-xs text-gray-400 flex justify-between">
        <span>Tổng: {data.length} bệnh nhân</span>
        <span>Double-click hoặc Enter để sửa</span>
      </div>
    </div>
  );
}

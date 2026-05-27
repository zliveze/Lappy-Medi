import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Check } from 'lucide-react';

interface ToothSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'mất răng' | 'sâu răng';
  initialTeeth: number[];
  onConfirm: (selectedTeeth: number[]) => void;
  onRemove: () => void;
}

// FDI World Dental Federation notation tooth groups
const QUADRANT_1 = [18, 17, 16, 15, 14, 13, 12, 11]; // Hàm trên phải (Q1) - từ ngoài vào trong
const QUADRANT_2 = [21, 22, 23, 24, 25, 26, 27, 28]; // Hàm trên trái (Q2) - từ trong ra ngoài
const QUADRANT_4 = [48, 47, 46, 45, 44, 43, 42, 41]; // Hàm dưới phải (Q4) - từ ngoài vào trong
const QUADRANT_3 = [31, 32, 33, 34, 35, 36, 37, 38]; // Hàm dưới trái (Q3) - từ trong ra ngoài

const getToothShortName = (num: number): string => {
  const lastDigit = num % 10;
  switch (lastDigit) {
    case 1: return 'Răng cửa giữa (R1)';
    case 2: return 'Răng cửa bên (R2)';
    case 3: return 'Răng nanh (R3)';
    case 4: return 'Răng tiền cối 1 (R4)';
    case 5: return 'Răng tiền cối 2 (R5)';
    case 6: return 'Răng cối lớn 1 (R6)';
    case 7: return 'Răng cối lớn 2 (R7)';
    case 8: return 'Răng khôn (R8)';
    default: return '';
  }
};

const ToothIcon = ({ className, isMissing }: { className?: string; isMissing?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {isMissing ? (
      // A dashed or faded outline of a tooth for missing tooth
      <path
        strokeDasharray="2,2"
        d="M7 3C9 2.5 10 3.5 12 5C14 3.5 15 2.5 17 3C19 3.5 19.5 5.5 19 8C18.5 10.5 17 14 16 17C15 20 14 21.5 13 21.5C12 21.5 12 20 12 18.5C12 20 12 21.5 11 21.5C10 21.5 9 20 8 17C7 14 5.5 10.5 5 8C4.5 5.5 5 3.5 7 3Z"
      />
    ) : (
      // Standard stylized tooth contour
      <path d="M7 3C9 2.5 10 3.5 12 5C14 3.5 15 2.5 17 3C19 3.5 19.5 5.5 19 8C18.5 10.5 17 14 16 17C15 20 14 21.5 13 21.5C12 21.5 12 20 12 18.5C12 20 12 21.5 11 21.5C10 21.5 9 20 8 17C7 14 5.5 10.5 5 8C4.5 5.5 5 3.5 7 3Z" />
    )}
  </svg>
);

export function ToothSelectionDialog({
  isOpen,
  onClose,
  type,
  initialTeeth,
  onConfirm,
  onRemove,
}: ToothSelectionDialogProps) {
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null);

  // Sync initial state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeeth(initialTeeth);
    }
  }, [isOpen, initialTeeth]);

  const toggleTooth = (tooth: number) => {
    setSelectedTeeth((prev) =>
      prev.includes(tooth) ? prev.filter((t) => t !== tooth) : [...prev, tooth]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedTeeth);
  };

  const selectAll = () => {
    // Select all 32 teeth
    const all = [...QUADRANT_1, ...QUADRANT_2, ...QUADRANT_3, ...QUADRANT_4];
    setSelectedTeeth(all);
  };

  const clearAll = () => {
    setSelectedTeeth([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col p-6 bg-white border border-slate-200 text-slate-800 rounded-xl shadow-xl">
        <DialogHeader className="flex-shrink-0 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${type === 'sâu răng' ? 'bg-rose-500 shadow-rose-500/30' : 'bg-slate-400 shadow-slate-400/30'} shadow-lg`}></span>
              Chọn danh sách răng bị {type === 'sâu răng' ? 'sâu' : 'mất'}
            </DialogTitle>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Click vào từng răng để chọn hoặc bỏ chọn. Cung hàm được bố trí theo góc nhìn đối diện của bác sĩ.
          </p>
        </DialogHeader>

        {/* Tooth selection layout */}
        <div className="flex-grow py-6 flex flex-col items-center justify-center min-h-[300px]">
          {/* Main Dental Map with Midlines */}
          <div className="relative border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 w-full max-w-3xl">
            {/* Midline Crosshair Indicators */}
            {/* Vertical midline */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300/60 -translate-x-1/2 pointer-events-none z-10"></div>
            {/* Horizontal midline */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-300/60 -translate-y-1/2 pointer-events-none z-10"></div>

            {/* Upper Arch (Hàm trên) */}
            <div className="grid grid-cols-2 gap-x-12 pb-6 border-b border-slate-200">
              {/* Q1: Hàm trên Phải (Dentist's Top Left) */}
              <div className="flex justify-end items-center gap-1.5 pr-2">
                {QUADRANT_1.map((tooth) => {
                  const isSelected = selectedTeeth.includes(tooth);
                  return (
                    <ToothButton
                      key={tooth}
                      num={tooth}
                      isSelected={isSelected}
                      type={type}
                      onClick={() => toggleTooth(tooth)}
                      onMouseEnter={() => setHoveredTooth(tooth)}
                      onMouseLeave={() => setHoveredTooth(null)}
                    />
                  );
                })}
              </div>

              {/* Q2: Hàm trên Trái (Dentist's Top Right) */}
              <div className="flex justify-start items-center gap-1.5 pl-2">
                {QUADRANT_2.map((tooth) => {
                  const isSelected = selectedTeeth.includes(tooth);
                  return (
                    <ToothButton
                      key={tooth}
                      num={tooth}
                      isSelected={isSelected}
                      type={type}
                      onClick={() => toggleTooth(tooth)}
                      onMouseEnter={() => setHoveredTooth(tooth)}
                      onMouseLeave={() => setHoveredTooth(null)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Midline Label (Hàm Trên / Hàm Dưới) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 text-[10px] px-2 py-0.5 rounded-full text-slate-500 font-medium z-20 select-none uppercase tracking-widest shadow-sm">
              Khớp cắn
            </div>

            {/* Lower Arch (Hàm dưới) */}
            <div className="grid grid-cols-2 gap-x-12 pt-6">
              {/* Q4: Hàm dưới Phải (Dentist's Bottom Left) */}
              <div className="flex justify-end items-center gap-1.5 pr-2">
                {QUADRANT_4.map((tooth) => {
                  const isSelected = selectedTeeth.includes(tooth);
                  return (
                    <ToothButton
                      key={tooth}
                      num={tooth}
                      isSelected={isSelected}
                      type={type}
                      onClick={() => toggleTooth(tooth)}
                      onMouseEnter={() => setHoveredTooth(tooth)}
                      onMouseLeave={() => setHoveredTooth(null)}
                    />
                  );
                })}
              </div>

              {/* Q3: Hàm dưới Trái (Dentist's Bottom Right) */}
              <div className="flex justify-start items-center gap-1.5 pl-2">
                {QUADRANT_3.map((tooth) => {
                  const isSelected = selectedTeeth.includes(tooth);
                  return (
                    <ToothButton
                      key={tooth}
                      num={tooth}
                      isSelected={isSelected}
                      type={type}
                      onClick={() => toggleTooth(tooth)}
                      onMouseEnter={() => setHoveredTooth(tooth)}
                      onMouseLeave={() => setHoveredTooth(null)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Quadrant Labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-2 mt-4 select-none">
              <span>HÀM TRÊN PHẢI (Q1)</span>
              <span>HÀM TRÊN TRÁI (Q2)</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-2 mt-12 select-none">
              <span>HÀM DƯỚI PHẢI (Q4)</span>
              <span>HÀM DƯỚI TRÁI (Q3)</span>
            </div>
          </div>
        </div>

        {/* Selected Summary and Hover Info */}
        <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-lg flex items-center justify-between text-sm min-h-[50px] mb-4">
          <div className="flex items-center gap-2 text-slate-600">
            <strong>Răng đang trỏ:</strong>{' '}
            {hoveredTooth ? (
              <span className="text-emerald-600 font-medium">
                Răng {hoveredTooth} - {getToothShortName(hoveredTooth)}
              </span>
            ) : (
              <span className="text-slate-400 italic">Rê chuột lên răng để xem chi tiết</span>
            )}
          </div>
          <div className="text-slate-600 text-right flex items-center gap-2">
            <strong>Đã chọn:</strong>{' '}
            {selectedTeeth.length > 0 ? (
              <span className={`font-semibold ${type === 'sâu răng' ? 'text-rose-600' : 'text-slate-700'}`}>
                {selectedTeeth.length} răng ({[...selectedTeeth].sort((a, b) => a - b).join(', ')})
              </span>
            ) : (
              <span className="text-slate-400 italic">Chưa chọn răng nào</span>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <DialogFooter className="flex items-center justify-between w-full border-t border-slate-100 pt-4 flex-wrap gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={selectAll}
              className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 bg-white"
            >
              Chọn tất cả (32)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearAll}
              className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 bg-white"
            >
              Bỏ chọn tất cả
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onRemove}
              className="text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa khỏi bệnh lý
            </Button>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 bg-white"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className={`flex items-center gap-1.5 text-white ${
                type === 'sâu răng'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200'
              }`}
            >
              <Check className="w-4 h-4" />
              Xác nhận (OK)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ToothButtonProps {
  num: number;
  isSelected: boolean;
  type: 'mất răng' | 'sâu răng';
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function ToothButton({
  num,
  isSelected,
  type,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ToothButtonProps) {
  const isSâu = type === 'sâu răng';

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative w-9 h-14 rounded border flex flex-col items-center justify-between py-1.5 transition-all duration-200 group select-none ${
        isSelected
          ? isSâu
            ? 'bg-rose-50 border-rose-400 text-rose-700 scale-105 shadow-sm'
            : 'bg-slate-100 border-slate-400 text-slate-600 scale-105 shadow-sm border-dashed'
          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:scale-105'
      }`}
    >
      {/* Tooth number */}
      <span className={`text-[10px] font-bold tracking-tighter ${isSelected ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'}`}>
        {num}
      </span>

      {/* SVG Tooth representation */}
      <ToothIcon
        isMissing={!isSâu && isSelected}
        className={`w-5 h-5 transition-transform duration-200 ${
          isSelected
            ? isSâu
              ? 'text-rose-500 scale-110 drop-shadow-[0_0_2px_rgba(244,63,94,0.3)]'
              : 'text-slate-500 opacity-60 scale-90'
            : 'text-slate-300 group-hover:text-slate-400 group-hover:scale-105'
        }`}
      />

      {/* Visual Indicator Overlay */}
      {isSelected && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {isSâu ? (
            // A red decay dot on the tooth crown
            <span className="w-1.5 h-1.5 bg-rose-600 border border-white rounded-full animate-pulse shadow-[0_0_3px_rgba(225,29,72,0.6)] mt-2"></span>
          ) : (
            // A diagonal line representing missing/extracted tooth
            <span className="absolute w-[80%] h-[1.5px] bg-slate-400 rotate-[35deg]"></span>
          )}
        </span>
      )}
    </button>
  );
}

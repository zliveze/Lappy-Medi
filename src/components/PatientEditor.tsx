'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PatientData, BLOOD_PRESSURE_OPTIONS, EYE_OPTIONS_SINGLE, EYE_OPTIONS_BOTH, ENT_OPTIONS, DENTAL_OPTIONS, LIVER_OPTIONS, KIDNEY_OPTIONS, VISION_OPTIONS, DNT_OPTIONS, ECG_AXIS_OPTIONS, CLASSIFICATION_OPTIONS, ULTRASOUND_ABDOMEN_NOTE_OPTIONS, ULTRASOUND_BREAST_OPTIONS } from '@/types/patient';
import { calculateBMI, getPhysiqueFromBMI } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ChevronLeft, ChevronRight, Copy, ClipboardPaste, Trash2 } from 'lucide-react';

interface PatientEditorProps {
  patient: PatientData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PatientData) => void;
  onSaveAndClose: (data: PatientData) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  currentIndex: number;
  totalCount: number;
  // New props for copy/paste/clear
  onCopy?: () => void;
  onPaste?: () => void;
  onClearData?: () => void;
  canPaste?: boolean;
}

interface BPReading {
  systolic: string;
  diastolic: string;
}

interface ExamState {
  // Chưa phát hiện bệnh lý
  noPathologyFound: boolean;
  // Nội khoa
  internalEnabled: boolean;
  bpReadings: BPReading[]; // Hỗ trợ nhiều lần đo
  bpCondition: string;
  bpNote: string;
  // Mắt
  eyeEnabled: boolean;
  visionLeft: string;
  visionRight: string;
  visionLeftMode: 'normal' | 'dnt'; // Chế độ thị lực: bình thường hoặc ĐNT
  visionRightMode: 'normal' | 'dnt';
  hasGlasses: boolean;
  eyeConditionsBoth: string[]; // Bệnh lý 2 mắt
  eyeConditionsLeft: string[]; // Bệnh lý mắt trái
  eyeConditionsRight: string[]; // Bệnh lý mắt phải
  eyeNote: string;
  // TMH
  entEnabled: boolean;
  entConditions: string[];
  entNote: string;
  // RHM
  dentalEnabled: boolean;
  chewingPower: number;
  dentalConditions: string[];
  dentalNote: string;
  // Ngoại khoa
  surgeryEnabled: boolean;
  surgery: string;
  // Da liễu
  dermaEnabled: boolean;
  dermatology: string;
}

interface ImagingState {
  xrayEnabled: boolean;
  xrayNotes: string[]; // Chuyển sang mảng ghi chú
  // Siêu âm - mỗi loại có checkbox riêng
  abdomenEnabled: boolean;
  liverConditions: string[]; // Đổi sang mảng để hỗ trợ nhiều bệnh lý
  kidneyConditions: string[];
  abdomenNote: string; // Ghi chú thêm cho siêu âm bụng
  thyroidEnabled: boolean;
  thyroid: string;
  breastEnabled: boolean;
  breast: string;
  gynecologyEnabled: boolean;
  gynecology: string;
  // Điện tim
  ecgEnabled: boolean;
  heartRate: string;
  ecgAxis: string; // Trục điện tim
  ecgNotes: string[];
}

export function PatientEditor({
  patient,
  isOpen,
  onClose,
  onSave,
  onSaveAndClose,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  currentIndex,
  totalCount,
  onCopy,
  onPaste,
  onClearData,
  canPaste,
}: PatientEditorProps) {
  // Tab state - reset về vital khi chuyển bệnh nhân
  const [activeTab, setActiveTab] = useState('vital');

  // Ref for auto-focus weight input
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Basic info - Thông tin cơ bản
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');

  // Thể lực
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bmi, setBmi] = useState('');
  const [physique, setPhysique] = useState({ text: '', color: '' });
  const [classification, setClassification] = useState('');
  const [isClassificationManual, setIsClassificationManual] = useState(false); // Theo dõi nếu user chọn tay

  // Exam state
  const [exam, setExam] = useState<ExamState>({
    noPathologyFound: false,
    internalEnabled: false,
    bpReadings: [{ systolic: '', diastolic: '' }],
    bpCondition: '',
    bpNote: '',
    eyeEnabled: false,
    visionLeft: '10/10',
    visionRight: '10/10',
    visionLeftMode: 'normal',
    visionRightMode: 'normal',
    hasGlasses: false,
    eyeConditionsBoth: [],
    eyeConditionsLeft: [],
    eyeConditionsRight: [],
    eyeNote: '',
    entEnabled: false,
    entConditions: [],
    entNote: '',
    dentalEnabled: false,
    chewingPower: 100,
    dentalConditions: [],
    dentalNote: '',
    surgeryEnabled: false,
    surgery: 'Bình thường',
    dermaEnabled: false,
    dermatology: 'Bình thường',
  });

  // Imaging state - mặc định để trống, chỉ hiển thị text mặc định khi build
  const [imaging, setImaging] = useState<ImagingState>({
    xrayEnabled: false,
    xrayNotes: [''],
    abdomenEnabled: false,
    liverConditions: [],
    kidneyConditions: [],
    abdomenNote: '',
    thyroidEnabled: false,
    thyroid: '',
    breastEnabled: false,
    breast: '',
    gynecologyEnabled: false,
    gynecology: '',
    ecgEnabled: false,
    heartRate: '',
    ecgAxis: '',
    ecgNotes: [''],
  });

  // Theo dõi patient ID trước đó để biết khi nào chuyển bệnh nhân mới
  const prevPatientIdRef = React.useRef<string | undefined>();

  // Parse existing data when patient changes
  useEffect(() => {
    if (patient) {
      // Chỉ reset về tab thể lực khi chuyển sang bệnh nhân MỚI (khác CODE)
      const currentPatientId = String(patient['CODE'] || '');
      if (prevPatientIdRef.current !== undefined && prevPatientIdRef.current !== currentPatientId) {
        setActiveTab('vital');
      }
      prevPatientIdRef.current = currentPatientId;

      // Basic info - Thông tin cơ bản
      setCode(String(patient['CODE'] || ''));
      setName(String(patient['HỌ VÀ TÊN'] || patient['HỌ TÊN'] || ''));
      setDob(String(patient['NS'] || ''));
      setGender(String(patient['GT'] || ''));

      // Thể lực
      setWeight(String(patient['Cân nặng'] || ''));
      setHeight(String(patient['Chiều cao'] || ''));
      const existingClassification = String(patient['PHÂN LOẠI SỨC KHỎE'] || '');
      setClassification(existingClassification);
      // Nếu đã có phân loại từ trước thì coi như user đã chọn tay
      setIsClassificationManual(!!existingClassification);

      // Calculate BMI if weight and height exist
      const w = parseFloat(String(patient['Cân nặng'] || '0'));
      const h = parseFloat(String(patient['Chiều cao'] || '0'));
      if (w > 0 && h > 0) {
        const calculatedBmi = calculateBMI(w, h);
        setBmi(String(calculatedBmi));
        setPhysique(getPhysiqueFromBMI(calculatedBmi));
      } else {
        setBmi('');
        setPhysique({ text: '', color: '' });
        // Auto-focus weight input if patient has no weight data
        setTimeout(() => {
          weightInputRef.current?.focus();
        }, 100);
      }

      // Parse general exam
      const generalExam = String(patient['KHÁM TỔNG QUÁT'] || '');
      parseGeneralExam(generalExam);

      // Imaging
      const xrayText = String(patient['Xquang'] || '');
      const ultrasoundText = String(patient['Siêu âm'] || '');
      const ecgText = String(patient['Điện tim'] || '');

      // Parse X-Quang
      // Tách dòng và loại bỏ prefix ' - '
      // Also filter out default text so input stays empty
      const defaultXrayText = 'Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang';
      const parsedXrayNotes = xrayText
        .split('\n')
        .map(line => {
          let cleanLine = line.trim();
          if (cleanLine.startsWith('- ')) cleanLine = cleanLine.substring(2).trim();
          else if (cleanLine.startsWith('-')) cleanLine = cleanLine.substring(1).trim();
          return cleanLine;
        })
        .filter(line => line && line.toLowerCase() !== defaultXrayText.toLowerCase());

      if (parsedXrayNotes.length === 0) parsedXrayNotes.push('');

      // Parse ultrasound text to detect which types are enabled
      const hasAbdomen = ultrasoundText.toLowerCase().includes('bụng');
      const hasThyroid = ultrasoundText.toLowerCase().includes('giáp');
      const hasBreast = ultrasoundText.toLowerCase().includes('vú');
      const hasGynecology = ultrasoundText.toLowerCase().includes('phụ khoa');

      // Parse liver and kidney conditions from ultrasound text
      const parsedLiverConditions: string[] = [];
      const parsedKidneyConditions: string[] = [];
      LIVER_OPTIONS.forEach(opt => {
        if (ultrasoundText.includes(opt)) parsedLiverConditions.push(opt);
      });
      KIDNEY_OPTIONS.forEach(opt => {
        if (ultrasoundText.includes(opt)) parsedKidneyConditions.push(opt);
      });

      // Parse nội dung siêu âm từng loại
      const parseUltrasoundSection = (text: string, sectionName: string): string => {
        const regex = new RegExp(`-\\s*Siêu âm\\s*${sectionName}:\\s*(.+?)(?=\\n|$)`, 'i');
        const match = text.match(regex);
        if (match) {
          const content = match[1].trim();
          // Nếu là text mặc định thì trả về rỗng
          if (content.toLowerCase().includes('chưa ghi nhận bất thường') ||
            content.toLowerCase().includes('chưa phát hiện bất thường') ||
            content.toLowerCase().includes('không tổn thương')) {
            return '';
          }
          return content;
        }
        return '';
      };

      // Parse abdomen note (loại bỏ các bệnh lý gan/thận đã parse)
      let parsedAbdomenNote = parseUltrasoundSection(ultrasoundText, 'Bụng');
      [...parsedLiverConditions, ...parsedKidneyConditions].forEach(cond => {
        parsedAbdomenNote = parsedAbdomenNote.replace(cond, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
      });

      const parsedThyroid = parseUltrasoundSection(ultrasoundText, 'Tuyến giáp');
      const parsedBreast = parseUltrasoundSection(ultrasoundText, 'Tuyến vú');
      const parsedGynecology = parseUltrasoundSection(ultrasoundText, 'Phụ Khoa');

      // Parse ECG axis
      let parsedEcgAxis = '';
      ECG_AXIS_OPTIONS.forEach(opt => {
        if (ecgText.includes(opt)) parsedEcgAxis = opt;
      });

      // Parse heart rate
      const hrMatch = ecgText.match(/Nhịp xoang[:\s]*(\d+)/i);
      const parsedHeartRate = hrMatch ? hrMatch[1] : '';

      // Parse ECG notes from lines
      const parsedEcgNotes: string[] = [];
      const ecgLines = ecgText.split('\n');

      ecgLines.forEach(line => {
        let cleanLine = line.trim();
        // Remove prefix ' - '
        if (cleanLine.startsWith('- ')) cleanLine = cleanLine.substring(2).trim();
        else if (cleanLine.startsWith('-')) cleanLine = cleanLine.substring(1).trim();

        // Skip if empty
        if (!cleanLine) return;

        // Skip known parts
        if (cleanLine.toLowerCase().includes('nhịp xoang')) return;
        if (ECG_AXIS_OPTIONS.some(opt => cleanLine.includes(opt))) return;

        parsedEcgNotes.push(cleanLine);
      });

      if (parsedEcgNotes.length === 0) parsedEcgNotes.push('');

      setImaging({
        xrayEnabled: !!xrayText,
        xrayNotes: parsedXrayNotes,
        abdomenEnabled: hasAbdomen,
        liverConditions: parsedLiverConditions,
        kidneyConditions: parsedKidneyConditions,
        abdomenNote: parsedAbdomenNote,
        thyroidEnabled: hasThyroid,
        thyroid: parsedThyroid,
        breastEnabled: hasBreast,
        breast: parsedBreast,
        gynecologyEnabled: hasGynecology,
        gynecology: parsedGynecology,
        ecgEnabled: !!ecgText,
        heartRate: parsedHeartRate,
        ecgAxis: parsedEcgAxis,
        ecgNotes: parsedEcgNotes,
      });
    }
  }, [patient]);

  const parseGeneralExam = (text: string) => {
    const lines = text.split('\n');
    const newExam: ExamState = {
      noPathologyFound: false,
      internalEnabled: false,
      bpReadings: [{ systolic: '', diastolic: '' }],
      bpCondition: '',
      bpNote: '',
      eyeEnabled: false,
      visionLeft: '10/10',
      visionRight: '10/10',
      visionLeftMode: 'normal',
      visionRightMode: 'normal',
      hasGlasses: false,
      eyeConditionsBoth: [],
      eyeConditionsLeft: [],
      eyeConditionsRight: [],
      eyeNote: '',
      entEnabled: false,
      entConditions: [],
      entNote: '',
      dentalEnabled: false,
      chewingPower: 100,
      dentalConditions: [],
      dentalNote: '',
      surgeryEnabled: false,
      surgery: 'Bình thường',
      dermaEnabled: false,
      dermatology: 'Bình thường',
    };

    // Kiểm tra nếu là "Hiện chưa phát hiện bệnh lý"
    if (text.toLowerCase().includes('hiện chưa phát hiện bệnh lý') || text.toLowerCase().includes('chưa phát hiện bệnh lý')) {
      newExam.noPathologyFound = true;
      setExam(newExam);
      return;
    }

    lines.forEach(line => {
      const lowerLine = line.toLowerCase();

      // Parse Nội khoa
      if (lowerLine.includes('nội khoa') || lowerLine.includes('ha ') || lowerLine.includes('huyết áp')) {
        newExam.internalEnabled = true;
        const readings: BPReading[] = [];
        const bpRegex = /L?(\d)?\s*HA\s*(\d+)\/(\d+)/gi;
        let match;
        while ((match = bpRegex.exec(line)) !== null) {
          readings.push({ systolic: match[2], diastolic: match[3] });
        }
        if (readings.length > 0) {
          newExam.bpReadings = readings;
        } else {
          const bpMatch = line.match(/HA\s*(\d+)\/(\d+)/i);
          if (bpMatch) {
            newExam.bpReadings = [{ systolic: bpMatch[1], diastolic: bpMatch[2] }];
          }
        }
        // Check longer options first to avoid false matches (e.g., "tăng HA" matching "Tăng HA đang điều trị")
        const sortedBpOptions = [...BLOOD_PRESSURE_OPTIONS].sort((a, b) => b.length - a.length);
        for (const opt of sortedBpOptions) {
          if (line.toLowerCase().includes(opt.toLowerCase())) {
            newExam.bpCondition = opt;
            break; // Take the first (longest) match
          }
        }
        // Parse ghi chú nội khoa - phần text sau các thông tin đã parse
        let noteText = line.replace(/^.*?:/, '').trim();
        BLOOD_PRESSURE_OPTIONS.forEach(opt => {
          noteText = noteText.replace(new RegExp(opt, 'gi'), '');
        });
        noteText = noteText.replace(/L?\d?\s*HA\s*\d+\/\d+\s*mmHg/gi, '').replace(/\([^)]*\)/g, '').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
        if (noteText && noteText !== 'Bình thường') newExam.bpNote = noteText;
      }

      // Parse Mắt
      if (lowerLine.includes('mắt')) {
        newExam.eyeEnabled = true;
        if (lowerLine.includes('ck ')) newExam.hasGlasses = true;

        // Parse thị lực - hỗ trợ cả x/10 và ĐNT
        const visionMatchR = line.match(/mắt\s*\(P\)\s*((?:\d+\/\d+)|(?:ĐNT\s*\d+m)|(?:ST\([+-]\)))/i);
        const visionMatchL = line.match(/mắt\s*\(T\)\s*((?:\d+\/\d+)|(?:ĐNT\s*\d+m)|(?:ST\([+-]\)))/i);
        if (visionMatchR) {
          newExam.visionRight = visionMatchR[1];
          newExam.visionRightMode = visionMatchR[1].includes('ĐNT') || visionMatchR[1].includes('ST') ? 'dnt' : 'normal';
        }
        if (visionMatchL) {
          newExam.visionLeft = visionMatchL[1];
          newExam.visionLeftMode = visionMatchL[1].includes('ĐNT') || visionMatchL[1].includes('ST') ? 'dnt' : 'normal';
        }

        // Parse bệnh lý mắt
        EYE_OPTIONS_BOTH.forEach(opt => {
          if (line.toLowerCase().includes(opt.toLowerCase())) {
            if (!newExam.eyeConditionsBoth.includes(opt)) newExam.eyeConditionsBoth.push(opt);
          }
        });

        // Parse ghi chú mắt - loại bỏ các thông tin đã parse
        let eyeNote = line.replace(/^.*?:/, '').trim();
        eyeNote = eyeNote.replace(/CK\s*/gi, '').replace(/mắt\s*\([PT]\)\s*\d+\/\d+/gi, '').replace(/mắt\s*\([PT]\)\s*ĐNT\s*\d+m/gi, '');
        EYE_OPTIONS_BOTH.forEach(opt => { eyeNote = eyeNote.replace(new RegExp(opt, 'gi'), ''); });
        eyeNote = eyeNote.replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
        if (eyeNote) newExam.eyeNote = eyeNote;
      }

      // Parse TMH
      if (lowerLine.includes('tmh') || lowerLine.includes('amidan') || lowerLine.includes('viêm họng') || lowerLine.includes('viêm mũi')) {
        newExam.entEnabled = true;
        ENT_OPTIONS.forEach(opt => {
          if (line.toLowerCase().includes(opt.toLowerCase())) {
            if (!newExam.entConditions.includes(opt)) newExam.entConditions.push(opt);
          }
        });
        // Parse ghi chú TMH
        let entNote = line.replace(/^.*?:/, '').trim();
        ENT_OPTIONS.forEach(opt => { entNote = entNote.replace(new RegExp(opt, 'gi'), ''); });
        entNote = entNote.replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
        if (entNote && entNote !== 'Bình thường') newExam.entNote = entNote;
      }

      // Parse RHM
      if (lowerLine.includes('rhm') || lowerLine.includes('sức nhai') || lowerLine.includes('răng')) {
        newExam.dentalEnabled = true;
        const chewMatch = line.match(/sức nhai\s*(\d+)%/i);
        if (chewMatch) newExam.chewingPower = parseInt(chewMatch[1]);
        DENTAL_OPTIONS.forEach(opt => {
          if (line.toLowerCase().includes(opt.toLowerCase())) {
            if (!newExam.dentalConditions.includes(opt)) newExam.dentalConditions.push(opt);
          }
        });
        // Parse ghi chú RHM
        let dentalNote = line.replace(/^.*?:/, '').trim();
        dentalNote = dentalNote.replace(/sức nhai\s*\d+%/gi, '');
        DENTAL_OPTIONS.forEach(opt => { dentalNote = dentalNote.replace(new RegExp(opt, 'gi'), ''); });
        dentalNote = dentalNote.replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
        if (dentalNote && dentalNote !== 'Bình thường') newExam.dentalNote = dentalNote;
      }

      // Parse Ngoại khoa
      if (lowerLine.includes('ngoại khoa')) {
        newExam.surgeryEnabled = true;
        const surgeryText = line.replace(/^.*?:/, '').trim();
        if (surgeryText) newExam.surgery = surgeryText;
      }

      // Parse Da liễu
      if (lowerLine.includes('da liễu')) {
        newExam.dermaEnabled = true;
        const dermaText = line.replace(/^.*?:/, '').trim();
        if (dermaText) newExam.dermatology = dermaText;
      }
    });

    setExam(newExam);
  };

  // Calculate BMI when weight/height changes
  useEffect(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (w > 0 && h > 0) {
      const calculatedBmi = calculateBMI(w, h);
      setBmi(String(calculatedBmi));
      setPhysique(getPhysiqueFromBMI(calculatedBmi));
    } else {
      setBmi('');
      setPhysique({ text: '', color: '' });
    }
  }, [weight, height]);

  // Auto-calculate classification based on exam and imaging data
  // Chỉ tự động nếu user chưa chọn tay
  useEffect(() => {
    if (isClassificationManual) return; // User đã chọn tay, không tự động

    // Đếm số bất thường
    let abnormalityCount = 0;

    // 1. Kiểm tra thể trạng (Cân nặng bình thường)
    if (physique.text && physique.text !== 'Bình thường') {
      abnormalityCount++;
    }

    // 2. Kiểm tra khám tổng quát - nếu KHÔNG phải "chưa phát hiện bệnh lý"
    if (!exam.noPathologyFound) {
      // Có nội khoa với tình trạng tăng HA hoặc ghi chú
      if (exam.internalEnabled && (exam.bpCondition || exam.bpNote)) {
        abnormalityCount++;
      }
      // Có bệnh lý mắt, có kính (tật khúc xạ), hoặc thị lực giảm (< 10/10) khi không đeo kính
      if (exam.eyeEnabled) {
        const hasEyeConditions = exam.eyeConditionsBoth.length > 0 || exam.eyeConditionsLeft.length > 0 || exam.eyeConditionsRight.length > 0 || exam.eyeNote;
        // Có kính = có tật khúc xạ = bất thường (Loại II)
        const hasRefractionError = exam.hasGlasses;
        // Thị lực giảm khi KHÔNG đeo kính (< 10/10)
        const hasReducedVision = !exam.hasGlasses && (exam.visionLeft !== '10/10' || exam.visionRight !== '10/10');
        if (hasEyeConditions || hasRefractionError || hasReducedVision) {
          abnormalityCount++;
        }
      }
      // Có bệnh lý TMH
      if (exam.entEnabled && (exam.entConditions.length > 0 || exam.entNote)) {
        abnormalityCount++;
      }
      // Có bệnh lý RHM (sức nhai < 100% hoặc có bệnh)
      if (exam.dentalEnabled && (exam.chewingPower < 100 || exam.dentalConditions.length > 0 || exam.dentalNote)) {
        abnormalityCount++;
      }
      // Ngoại khoa bất thường
      if (exam.surgeryEnabled && exam.surgery && exam.surgery !== 'Bình thường') {
        abnormalityCount++;
      }
      // Da liễu bất thường
      if (exam.dermaEnabled && exam.dermatology && exam.dermatology !== 'Bình thường') {
        abnormalityCount++;
      }
    }

    // 3. Kiểm tra cận lâm sàng
    // Xquang - nếu có ghi chú khác mặc định
    if (imaging.xrayEnabled) {
      const hasCustomXray = imaging.xrayNotes.some(n => n && n.trim() && !n.toLowerCase().includes('chưa ghi nhận bất thường'));
      if (hasCustomXray) abnormalityCount++;
    }

    // Siêu âm bụng - có bệnh lý gan/thận hoặc ghi chú
    if (imaging.abdomenEnabled) {
      if (imaging.liverConditions.length > 0 || imaging.kidneyConditions.length > 0 || imaging.abdomenNote) {
        abnormalityCount++;
      }
    }

    // Siêu âm tuyến giáp có ghi chú
    if (imaging.thyroidEnabled && imaging.thyroid) {
      abnormalityCount++;
    }

    // Siêu âm vú có ghi chú
    if (imaging.breastEnabled && imaging.breast) {
      abnormalityCount++;
    }

    // Siêu âm phụ khoa có ghi chú
    if (imaging.gynecologyEnabled && imaging.gynecology) {
      abnormalityCount++;
    }

    // Điện tim - có ghi chú (nhưng KHÔNG tính vào bất thường theo yêu cầu user)
    // => Điện tim chỉ cần có nhịp xoang, trục điện tim, ghi chú thêm không ảnh hưởng

    // Quyết định phân loại
    if (abnormalityCount === 0 && physique.text === 'Bình thường' && (exam.noPathologyFound || !exam.internalEnabled)) {
      // Tất cả bình thường -> Loại I
      setClassification('I');
    } else if (abnormalityCount >= 1) {
      // Có 1 bất thường trở lên -> Loại II
      setClassification('II');
    }
    // Nếu chưa đủ điều kiện thì không tự động set
  }, [physique, exam, imaging, isClassificationManual]);

  // Build general exam text - only include enabled sections
  const buildGeneralExam = useCallback((): string => {
    // Nếu tick "Chưa phát hiện bệnh lý" thì trả về ngay
    if (exam.noPathologyFound) {
      return ' - Hiện chưa phát hiện bệnh lý';
    }

    const parts: string[] = [];

    // Nội khoa - hỗ trợ nhiều lần đo
    if (exam.internalEnabled) {
      let bp = '';
      const validReadings = exam.bpReadings.filter(r => r.systolic && r.diastolic);
      if (validReadings.length > 0) {
        if (validReadings.length === 1) {
          bp = `HA ${validReadings[0].systolic}/${validReadings[0].diastolic} mmHg`;
        } else {
          // Format: L1 HA 140/90 mmHg, L2 HA 150/90 mmHg
          const bpParts = validReadings.map((r, i) => `L${i + 1} HA ${r.systolic}/${r.diastolic} mmHg`);
          bp = bpParts.join(', ');
        }
        if (exam.bpCondition) bp = `${exam.bpCondition} (${bp})`;
      } else if (exam.bpCondition) {
        bp = exam.bpCondition;
      }
      if (exam.bpNote) bp += (bp ? ', ' : '') + exam.bpNote;
      if (bp) parts.push(` - Nội khoa: ${bp}`);
    }

    // Mắt
    if (exam.eyeEnabled) {
      const prefix = exam.hasGlasses ? 'CK ' : '';
      let eyeText = `${prefix}mắt (P) ${exam.visionRight}, mắt (T) ${exam.visionLeft}`;

      // Bệnh lý 2 mắt
      if (exam.eyeConditionsBoth.length > 0) {
        eyeText += `, ${exam.eyeConditionsBoth.join(', ')}`;
      }
      // Bệnh lý mắt phải
      if (exam.eyeConditionsRight.length > 0) {
        eyeText += `, mắt (P): ${exam.eyeConditionsRight.join(', ')}`;
      }
      // Bệnh lý mắt trái
      if (exam.eyeConditionsLeft.length > 0) {
        eyeText += `, mắt (T): ${exam.eyeConditionsLeft.join(', ')}`;
      }
      if (exam.eyeNote) eyeText += `, ${exam.eyeNote}`;
      parts.push(` - Mắt: ${eyeText}`);
    }

    // TMH
    if (exam.entEnabled) {
      let tmh = exam.entConditions.length > 0 ? exam.entConditions.join(', ') : '';
      if (exam.entNote) tmh += (tmh ? ', ' : '') + exam.entNote;
      if (tmh) parts.push(` - TMH: ${tmh}`);
    }

    // RHM
    if (exam.dentalEnabled) {
      let rhm = `sức nhai ${exam.chewingPower}%`;
      if (exam.dentalConditions.length > 0) {
        rhm += `, ${exam.dentalConditions.join(', ')}`;
      }
      if (exam.dentalNote) rhm += `, ${exam.dentalNote}`;
      parts.push(` - RHM: ${rhm}`);
    }

    // Ngoại khoa
    if (exam.surgeryEnabled && exam.surgery && exam.surgery !== 'Bình thường') {
      parts.push(` - Ngoại khoa: ${exam.surgery}`);
    }

    // Da liễu
    if (exam.dermaEnabled && exam.dermatology && exam.dermatology !== 'Bình thường') {
      parts.push(` - Da liễu: ${exam.dermatology}`);
    }

    return parts.join('\n');
  }, [exam]);

  // Build ultrasound text - only include enabled types
  // Mặc định theo format yêu cầu:
  // - Siêu âm Tuyến vú: không tổn thương khu trú trên siêu âm tuyến vú
  // - Siêu âm Bụng: chưa phát hiện bất thường
  // - Siêu âm Phụ Khoa: chưa phát hiện bất thường
  // - Siêu âm tuyến giáp: chưa phát hiện bất thường
  const buildUltrasound = useCallback((): string => {
    const parts: string[] = [];

    // Tuyến vú - đặt trước theo thứ tự yêu cầu
    if (imaging.breastEnabled) {
      const defaultBreast = 'không tổn thương khu trú trên siêu âm tuyến vú';
      parts.push(` - Siêu âm Tuyến vú: ${imaging.breast || defaultBreast}`);
    }

    // Bụng - logic mới: ghép các bệnh lý
    if (imaging.abdomenEnabled) {
      const conditions: string[] = [];
      if (imaging.liverConditions.length > 0) {
        conditions.push(...imaging.liverConditions);
      }
      if (imaging.kidneyConditions.length > 0) {
        conditions.push(...imaging.kidneyConditions);
      }
      if (imaging.abdomenNote) {
        conditions.push(imaging.abdomenNote);
      }

      const abdomenText = conditions.length > 0
        ? conditions.join(', ')
        : 'chưa phát hiện bất thường';
      parts.push(` - Siêu âm Bụng: ${abdomenText}`);
    }

    // Phụ Khoa
    if (imaging.gynecologyEnabled) {
      parts.push(` - Siêu âm Phụ Khoa: ${imaging.gynecology || 'chưa phát hiện bất thường'}`);
    }

    // Tuyến giáp
    if (imaging.thyroidEnabled) {
      parts.push(` - Siêu âm tuyến giáp: ${imaging.thyroid || 'chưa phát hiện bất thường'}`);
    }

    return parts.join('\n');
  }, [imaging]);

  // Build ECG text - only if enabled
  const buildEcg = useCallback((): string => {
    if (!imaging.ecgEnabled) return '';
    const ecgParts: string[] = [];
    if (imaging.heartRate) {
      ecgParts.push(`Nhịp xoang: ${imaging.heartRate} l/p`);
    } else {
      ecgParts.push('Nhịp xoang đều');
    }
    if (imaging.ecgAxis) {
      ecgParts.push(imaging.ecgAxis);
    }
    if (imaging.ecgNotes && imaging.ecgNotes.length > 0) {
      const validNotes = imaging.ecgNotes.filter(n => n && n.trim());
      if (validNotes.length > 0) {
        ecgParts.push(...validNotes);
      }
    }
    // Join with newline and prefix each line with ' - '
    return ecgParts.map(part => ` - ${part}`).join('\n');
  }, [imaging]);

  const buildUpdatedPatient = (): PatientData | null => {
    if (!patient) return null;

    // Build Xray string - use default if enabled but no custom notes
    let xrayString = '';
    if (imaging.xrayEnabled) {
      const validNotes = imaging.xrayNotes.filter(n => n && n.trim());
      if (validNotes.length > 0) {
        xrayString = validNotes.map(n => ` - ${n}`).join('\n');
      } else {
        // Default value when no notes entered
        xrayString = ' - Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang';
      }
    }

    return {
      ...patient,
      'CODE': code,
      'HỌ VÀ TÊN': name,
      'NS': dob,
      'GT': gender,
      'Cân nặng': weight ? parseFloat(weight) : '',
      'Chiều cao': height ? parseFloat(height) : '',
      'BMI': bmi ? parseFloat(bmi) : '',
      'THỂ TRẠNG': physique.text,
      'PHÂN LOẠI SỨC KHỎE': classification,
      'KHÁM TỔNG QUÁT': buildGeneralExam(),
      'Xquang': xrayString,
      'Siêu âm': buildUltrasound(),
      'Điện tim': buildEcg(),
    };
  };

  const handleSave = () => {
    const updatedPatient = buildUpdatedPatient();
    if (updatedPatient) {
      onSave(updatedPatient);
    }
  };

  const handleSaveAndClose = () => {
    const updatedPatient = buildUpdatedPatient();
    if (updatedPatient) {
      onSaveAndClose(updatedPatient);
    }
  };

  const toggleArrayItem = (
    arr: string[],
    item: string,
    setter: (items: string[]) => void
  ) => {
    if (arr.includes(item)) {
      setter(arr.filter(i => i !== item));
    } else {
      setter([...arr, item]);
    }
  };

  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              Chỉnh sửa: {patient['CODE']} - {patient['HỌ VÀ TÊN'] || patient['HỌ TÊN'] || ''} {patient['NS'] ? `(${patient['NS']})` : ''}
            </DialogTitle>
            <div className="flex items-center gap-2 mr-8">
              {/* Copy/Paste/Clear buttons */}
              {onCopy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCopy}
                  title="Sao chép dữ liệu bệnh nhân (Ctrl+C)"
                  className="gap-1 text-gray-500 hover:text-blue-600"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {onPaste && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPaste}
                  disabled={!canPaste}
                  title="Dán dữ liệu (Ctrl+V)"
                  className="gap-1 text-gray-500 hover:text-green-600"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </Button>
              )}
              {onClearData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Xóa toàn bộ dữ liệu khám của bệnh nhân này?')) {
                      onClearData();
                    }
                  }}
                  title="Xóa dữ liệu khám"
                  className="gap-1 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              <span className="text-gray-300">|</span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('prev')}
                disabled={!canNavigatePrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500">
                {currentIndex + 1} / {totalCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('next')}
                disabled={!canNavigateNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="vital">Thể Lực & Phân Loại</TabsTrigger>
            <TabsTrigger value="exam">Khám Tổng Quát</TabsTrigger>
            <TabsTrigger value="imaging">Cận Lâm Sàng</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            {/* Tab 1: Vital - Gọn gàng hơn */}
            <TabsContent value="vital" className="m-0 space-y-4">
              {/* Thông tin cơ bản */}
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold text-lg">Thông tin cơ bản</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>CODE</Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Mã NV"
                    />
                  </div>
                  <div>
                    <Label>Họ và tên</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                  <div>
                    <Label>Năm sinh</Label>
                    <Input
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      placeholder="01/01/1990"
                    />
                  </div>
                  <div>
                    <Label>Giới tính</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nam">Nam</SelectItem>
                        <SelectItem value="Nữ">Nữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Thể lực */}
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold text-lg">Thể lực</h3>
                <div className="grid grid-cols-4 gap-4 items-end">
                  <div>
                    <Label>Cân nặng (kg)</Label>
                    <Input
                      ref={weightInputRef}
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="65"
                    />
                  </div>
                  <div>
                    <Label>Chiều cao (cm hoặc m)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={height}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Nếu nhập >= 100 thì coi là cm, tự chuyển sang m
                        if (val && parseFloat(val) >= 100) {
                          setHeight(String((parseFloat(val) / 100).toFixed(2)));
                        } else {
                          setHeight(val);
                        }
                      }}
                      placeholder="170 hoặc 1.70"
                    />
                  </div>
                  <div>
                    <Label>BMI</Label>
                    <Input value={bmi} readOnly className="bg-gray-50 font-semibold" />
                  </div>
                  <div>
                    <Label>Thể trạng</Label>
                    <div className={`h-10 flex items-center justify-center px-3 border rounded-md bg-gray-50 font-semibold ${physique.color}`}>
                      {physique.text || '-'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  💡 Nhập chiều cao dạng cm (VD: 170) sẽ tự động chuyển thành m (1.70)
                </p>
              </div>
            </TabsContent>

            {/* Tab 2: General Exam */}
            <TabsContent value="exam" className="space-y-4 m-0">
              {/* Checkbox: Chưa phát hiện bệnh lý */}
              <div className="p-3 border rounded-lg bg-green-50 border-green-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={exam.noPathologyFound}
                    onCheckedChange={(checked) => setExam({ ...exam, noPathologyFound: !!checked })}
                  />
                  <span className="font-semibold text-green-700">Hiện chưa phát hiện bệnh lý</span>
                  <span className="text-sm text-gray-500">(Tích vào nếu không có bất thường)</span>
                </label>
              </div>

              <div className={`grid grid-cols-2 gap-4 ${exam.noPathologyFound ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Nội khoa */}
                <div className={`p-4 border rounded-lg space-y-3 ${exam.internalEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={exam.internalEnabled}
                      onCheckedChange={(checked) => setExam({ ...exam, internalEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Nội khoa</h3>
                  </label>
                  {exam.internalEnabled && (
                    <>
                      {/* Nhiều lần đo huyết áp */}
                      {exam.bpReadings.map((reading, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <span className="pb-2 text-sm font-medium text-gray-600 w-8">L{idx + 1}</span>
                          <div className="flex-1">
                            <Label>Tâm thu</Label>
                            <Input
                              type="number"
                              value={reading.systolic}
                              onChange={(e) => {
                                const newReadings = [...exam.bpReadings];
                                newReadings[idx] = { ...newReadings[idx], systolic: e.target.value };
                                setExam({ ...exam, bpReadings: newReadings });
                              }}
                              placeholder="120"
                            />
                          </div>
                          <span className="pb-2">/</span>
                          <div className="flex-1">
                            <Label>Tâm trương</Label>
                            <Input
                              type="number"
                              value={reading.diastolic}
                              onChange={(e) => {
                                const newReadings = [...exam.bpReadings];
                                newReadings[idx] = { ...newReadings[idx], diastolic: e.target.value };
                                setExam({ ...exam, bpReadings: newReadings });
                              }}
                              placeholder="80"
                            />
                          </div>
                          <span className="pb-2 text-sm text-gray-500">mmHg</span>
                          {idx > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 h-8"
                              onClick={() => {
                                const newReadings = exam.bpReadings.filter((_, i) => i !== idx);
                                setExam({ ...exam, bpReadings: newReadings });
                              }}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      ))}
                      {exam.bpReadings.length < 3 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExam({ ...exam, bpReadings: [...exam.bpReadings, { systolic: '', diastolic: '' }] })}
                        >
                          + Thêm lần đo
                        </Button>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {BLOOD_PRESSURE_OPTIONS.map((opt) => (
                          <Button
                            key={opt}
                            size="sm"
                            variant={exam.bpCondition === opt ? 'default' : 'outline'}
                            onClick={() => setExam({ ...exam, bpCondition: exam.bpCondition === opt ? '' : opt })}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                      <Input
                        placeholder="Ghi chú thêm..."
                        value={exam.bpNote}
                        onChange={(e) => setExam({ ...exam, bpNote: e.target.value })}
                      />
                    </>
                  )}
                </div>

                {/* Mắt */}
                <div className={`p-4 border rounded-lg space-y-3 ${exam.eyeEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={exam.eyeEnabled}
                      onCheckedChange={(checked) => setExam({ ...exam, eyeEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Mắt</h3>
                  </label>
                  {exam.eyeEnabled && (
                    <>
                      {/* Thị lực */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Mắt phải */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="w-20">Mắt (P)</Label>
                            <Button
                              size="sm"
                              variant={exam.visionRightMode === 'normal' ? 'default' : 'outline'}
                              onClick={() => setExam({ ...exam, visionRightMode: 'normal', visionRight: '10/10' })}
                            >
                              x/10
                            </Button>
                            <Button
                              size="sm"
                              variant={exam.visionRightMode === 'dnt' ? 'default' : 'outline'}
                              onClick={() => setExam({ ...exam, visionRightMode: 'dnt', visionRight: 'ĐNT 3m' })}
                            >
                              ĐNT
                            </Button>
                          </div>
                          <Select value={exam.visionRight} onValueChange={(v) => setExam({ ...exam, visionRight: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(exam.visionRightMode === 'normal' ? VISION_OPTIONS : DNT_OPTIONS).map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Bệnh lý mắt phải */}
                          <div className="flex flex-wrap gap-1">
                            {EYE_OPTIONS_SINGLE.map((opt) => (
                              <Button
                                key={opt}
                                size="sm"
                                variant={exam.eyeConditionsRight.includes(opt) ? 'default' : 'outline'}
                                onClick={() => toggleArrayItem(exam.eyeConditionsRight, opt, (items) => setExam({ ...exam, eyeConditionsRight: items }))}
                                className="text-xs px-2 py-1 h-7"
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Mắt trái */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="w-20">Mắt (T)</Label>
                            <Button
                              size="sm"
                              variant={exam.visionLeftMode === 'normal' ? 'default' : 'outline'}
                              onClick={() => setExam({ ...exam, visionLeftMode: 'normal', visionLeft: '10/10' })}
                            >
                              x/10
                            </Button>
                            <Button
                              size="sm"
                              variant={exam.visionLeftMode === 'dnt' ? 'default' : 'outline'}
                              onClick={() => setExam({ ...exam, visionLeftMode: 'dnt', visionLeft: 'ĐNT 3m' })}
                            >
                              ĐNT
                            </Button>
                          </div>
                          <Select value={exam.visionLeft} onValueChange={(v) => setExam({ ...exam, visionLeft: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(exam.visionLeftMode === 'normal' ? VISION_OPTIONS : DNT_OPTIONS).map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Bệnh lý mắt trái */}
                          <div className="flex flex-wrap gap-1">
                            {EYE_OPTIONS_SINGLE.map((opt) => (
                              <Button
                                key={opt}
                                size="sm"
                                variant={exam.eyeConditionsLeft.includes(opt) ? 'default' : 'outline'}
                                onClick={() => toggleArrayItem(exam.eyeConditionsLeft, opt, (items) => setExam({ ...exam, eyeConditionsLeft: items }))}
                                className="text-xs px-2 py-1 h-7"
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bệnh lý 2 mắt + Có kính */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={exam.hasGlasses}
                            onCheckedChange={(checked) => setExam({ ...exam, hasGlasses: !!checked })}
                          />
                          <span>Có kính (CK)</span>
                        </label>
                        {EYE_OPTIONS_BOTH.map((opt) => (
                          <Button
                            key={opt}
                            size="sm"
                            variant={exam.eyeConditionsBoth.includes(opt) ? 'default' : 'outline'}
                            onClick={() => toggleArrayItem(exam.eyeConditionsBoth, opt, (items) => setExam({ ...exam, eyeConditionsBoth: items }))}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>

                      <Input
                        placeholder="Ghi chú thêm..."
                        value={exam.eyeNote}
                        onChange={(e) => setExam({ ...exam, eyeNote: e.target.value })}
                      />
                    </>
                  )}
                </div>

                {/* TMH */}
                <div className={`p-4 border rounded-lg space-y-3 ${exam.entEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={exam.entEnabled}
                      onCheckedChange={(checked) => setExam({ ...exam, entEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Tai Mũi Họng</h3>
                  </label>
                  {exam.entEnabled && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {ENT_OPTIONS.map((opt) => (
                          <Button
                            key={opt}
                            size="sm"
                            variant={exam.entConditions.includes(opt) ? 'default' : 'outline'}
                            onClick={() => toggleArrayItem(exam.entConditions, opt, (items) => setExam({ ...exam, entConditions: items }))}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                      <Input
                        placeholder="Ghi chú thêm..."
                        value={exam.entNote}
                        onChange={(e) => setExam({ ...exam, entNote: e.target.value })}
                      />
                    </>
                  )}
                </div>

                {/* RHM */}
                <div className={`p-4 border rounded-lg space-y-3 ${exam.dentalEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={exam.dentalEnabled}
                      onCheckedChange={(checked) => setExam({ ...exam, dentalEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Răng Hàm Mặt</h3>
                  </label>
                  {exam.dentalEnabled && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Sức nhai:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={exam.chewingPower}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                              setExam({ ...exam, chewingPower: val });
                            }}
                            className="w-20"
                          />
                          <span>%</span>
                        </div>
                        {/* Nút chọn nhanh - xuống dòng riêng */}
                        <div className="flex flex-wrap gap-1">
                          {[100, 95, 94, 90, 85, 80, 75, 70].map(v => (
                            <Button
                              key={v}
                              size="sm"
                              variant={exam.chewingPower === v ? 'default' : 'outline'}
                              onClick={() => setExam({ ...exam, chewingPower: v })}
                              className="px-2 h-7"
                            >
                              {v}%
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DENTAL_OPTIONS.map((opt) => (
                          <Button
                            key={opt}
                            size="sm"
                            variant={exam.dentalConditions.includes(opt) ? 'default' : 'outline'}
                            onClick={() => toggleArrayItem(exam.dentalConditions, opt, (items) => setExam({ ...exam, dentalConditions: items }))}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                      <Input
                        placeholder="Ghi chú thêm..."
                        value={exam.dentalNote}
                        onChange={(e) => setExam({ ...exam, dentalNote: e.target.value })}
                      />
                    </>
                  )}
                </div>

                {/* Ngoại khoa */}
                <div className={`p-4 border rounded-lg space-y-3 ${exam.surgeryEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={exam.surgeryEnabled}
                      onCheckedChange={(checked) => setExam({ ...exam, surgeryEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Ngoại khoa</h3>
                  </label>
                  {exam.surgeryEnabled && (
                    <Textarea
                      value={exam.surgery}
                      onChange={(e) => setExam({ ...exam, surgery: e.target.value })}
                      placeholder="Nhập kết quả khám ngoại khoa..."
                      rows={3}
                    />
                  )}
                </div>

                {/* Da liễu */}
                <div className={`p-4 border rounded-lg space-y-3 ${exam.dermaEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={exam.dermaEnabled}
                      onCheckedChange={(checked) => setExam({ ...exam, dermaEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Da liễu</h3>
                  </label>
                  {exam.dermaEnabled && (
                    <Textarea
                      value={exam.dermatology}
                      onChange={(e) => setExam({ ...exam, dermatology: e.target.value })}
                      placeholder="Nhập kết quả khám da liễu..."
                      rows={3}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Imaging */}
            <TabsContent value="imaging" className="space-y-4 m-0">
              <div className="grid grid-cols-2 gap-4">
                {/* Điện tim */}
                <div className={`p-4 border rounded-lg space-y-3 ${imaging.ecgEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={imaging.ecgEnabled}
                      onCheckedChange={(checked) => setImaging({ ...imaging, ecgEnabled: !!checked })}
                    />
                    <h3 className="font-semibold">Điện Tâm Đồ</h3>
                  </label>
                  {imaging.ecgEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Nhịp tim (l/p)</Label>
                          <Input
                            type="number"
                            value={imaging.heartRate}
                            onChange={(e) => setImaging({ ...imaging, heartRate: e.target.value })}
                            placeholder="VD: 75"
                          />
                        </div>
                        <div>
                          <Label>Trục điện tim</Label>
                          <Select value={imaging.ecgAxis || 'none'} onValueChange={(v) => setImaging({ ...imaging, ecgAxis: v === 'none' ? '' : v })}>
                            <SelectTrigger><SelectValue placeholder="Chọn trục..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Không ghi</SelectItem>
                              {ECG_AXIS_OPTIONS.map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Ghi chú thêm</Label>
                        <div className="space-y-2">
                          {imaging.ecgNotes.map((note, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <Input
                                value={note}
                                onChange={(e) => {
                                  const newNotes = [...imaging.ecgNotes];
                                  newNotes[idx] = e.target.value;
                                  setImaging({ ...imaging, ecgNotes: newNotes });
                                }}
                                placeholder={`Ghi chú ${idx + 1}...`}
                              />
                              {imaging.ecgNotes.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 h-10 w-10 p-0"
                                  onClick={() => {
                                    const newNotes = imaging.ecgNotes.filter((_, i) => i !== idx);
                                    setImaging({ ...imaging, ecgNotes: newNotes });
                                  }}
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setImaging({ ...imaging, ecgNotes: [...imaging.ecgNotes, ''] })}
                            className="w-full border-dashed"
                          >
                            + Thêm ghi chú
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* X-Quang */}
                <div className={`p-4 border rounded-lg space-y-3 ${imaging.xrayEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={imaging.xrayEnabled}
                        onCheckedChange={(checked) => setImaging({ ...imaging, xrayEnabled: !!checked })}
                      />
                      <h3 className="font-semibold">X-Quang</h3>
                    </label>
                    {imaging.xrayEnabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setImaging({ ...imaging, xrayNotes: ['Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang'] })}
                      >
                        Đặt mặc định
                      </Button>
                    )}
                  </div>
                  {imaging.xrayEnabled && (
                    <div className="space-y-2">
                      {imaging.xrayNotes.map((note, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            id={`xray-note-${idx}`}
                            value={note}
                            onChange={(e) => {
                              const newNotes = [...imaging.xrayNotes];
                              newNotes[idx] = e.target.value;
                              setImaging({ ...imaging, xrayNotes: newNotes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const newIndex = imaging.xrayNotes.length;
                                setImaging({ ...imaging, xrayNotes: [...imaging.xrayNotes, ''] });
                                // Focus vào input mới sau khi DOM được cập nhật
                                setTimeout(() => {
                                  const newInput = document.getElementById(`xray-note-${newIndex}`);
                                  if (newInput) newInput.focus();
                                }, 50);
                              }
                            }}
                            placeholder={idx === 0 ? 'Mặc định: Hình ảnh tim, phổi chưa ghi nhận bất thường' : `Ghi chú ${idx + 1}...`}
                          />
                          {imaging.xrayNotes.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 h-10 w-10 p-0"
                              onClick={() => {
                                const newNotes = imaging.xrayNotes.filter((_, i) => i !== idx);
                                setImaging({ ...imaging, xrayNotes: newNotes });
                              }}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newIndex = imaging.xrayNotes.length;
                          setImaging({ ...imaging, xrayNotes: [...imaging.xrayNotes, ''] });
                          // Focus vào input mới
                          setTimeout(() => {
                            const newInput = document.getElementById(`xray-note-${newIndex}`);
                            if (newInput) newInput.focus();
                          }, 50);
                        }}
                        className="w-full border-dashed"
                      >
                        + Thêm kết quả/ghi chú
                      </Button>
                    </div>
                  )}
                </div>

                {/* Siêu âm - mỗi loại có checkbox riêng */}
                <div className="col-span-2 p-4 border rounded-lg space-y-4">
                  <h3 className="font-semibold">Siêu âm</h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Siêu âm bụng - UI mới không xung đột */}
                    <div className={`p-3 border rounded-lg space-y-3 ${imaging.abdomenEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={imaging.abdomenEnabled}
                          onCheckedChange={(checked) => setImaging({ ...imaging, abdomenEnabled: !!checked })}
                        />
                        <span className="font-medium">Siêu âm Bụng</span>
                      </label>
                      {imaging.abdomenEnabled && (
                        <>
                          {/* Gan */}
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">Gan:</Label>
                            <div className="flex flex-wrap gap-1">
                              {LIVER_OPTIONS.map((opt) => (
                                <Button
                                  key={opt}
                                  size="sm"
                                  variant={imaging.liverConditions.includes(opt) ? 'default' : 'outline'}
                                  onClick={() => toggleArrayItem(imaging.liverConditions, opt, (items) => setImaging({ ...imaging, liverConditions: items }))}
                                  className="text-xs h-7"
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Thận */}
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">Thận:</Label>
                            <div className="flex flex-wrap gap-1">
                              {KIDNEY_OPTIONS.map((opt) => (
                                <Button
                                  key={opt}
                                  size="sm"
                                  variant={imaging.kidneyConditions.includes(opt) ? 'default' : 'outline'}
                                  onClick={() => toggleArrayItem(imaging.kidneyConditions, opt, (items) => setImaging({ ...imaging, kidneyConditions: items }))}
                                  className="text-xs h-7"
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Ghi chú thêm */}
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">Mẫu nhanh:</Label>
                            <div className="flex flex-wrap gap-1">
                              {ULTRASOUND_ABDOMEN_NOTE_OPTIONS.map((opt) => (
                                <Button
                                  key={opt}
                                  size="sm"
                                  variant={imaging.abdomenNote === opt ? 'default' : 'outline'}
                                  onClick={() => setImaging({ ...imaging, abdomenNote: opt })}
                                  className="text-xs h-7"
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <Input
                            value={imaging.abdomenNote}
                            onChange={(e) => setImaging({ ...imaging, abdomenNote: e.target.value })}
                            placeholder="Ghi chú thêm (VD: nang gan, polyp túi mật...)"
                          />

                          {/* Hiển thị kết quả */}
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>Kết quả:</strong>{' '}
                            {imaging.liverConditions.length === 0 && imaging.kidneyConditions.length === 0 && !imaging.abdomenNote
                              ? 'chưa ghi nhận bất thường'
                              : [...imaging.liverConditions, ...imaging.kidneyConditions, imaging.abdomenNote].filter(Boolean).join(', ')
                            }
                          </div>
                        </>
                      )}
                    </div>

                    {/* Siêu âm Tuyến giáp */}
                    <div className={`p-3 border rounded-lg space-y-2 ${imaging.thyroidEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={imaging.thyroidEnabled}
                          onCheckedChange={(checked) => setImaging({ ...imaging, thyroidEnabled: !!checked })}
                        />
                        <span className="font-medium">Siêu âm Tuyến giáp</span>
                      </label>
                      {imaging.thyroidEnabled && (
                        <Input
                          value={imaging.thyroid}
                          onChange={(e) => setImaging({ ...imaging, thyroid: e.target.value })}
                          placeholder="chưa ghi nhận bất thường"
                        />
                      )}
                    </div>

                    {/* Siêu âm Tuyến vú */}
                    <div className={`p-3 border rounded-lg space-y-2 ${imaging.breastEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={imaging.breastEnabled}
                          onCheckedChange={(checked) => setImaging({ ...imaging, breastEnabled: !!checked })}
                        />
                        <span className="font-medium">Siêu âm Tuyến vú</span>
                      </label>
                      {imaging.breastEnabled && (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {ULTRASOUND_BREAST_OPTIONS.map((opt) => (
                              <Button
                                key={opt}
                                size="sm"
                                variant={imaging.breast === opt ? 'default' : 'outline'}
                                onClick={() => setImaging({ ...imaging, breast: opt })}
                                className="text-xs h-7"
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                          <Input
                            value={imaging.breast}
                            onChange={(e) => setImaging({ ...imaging, breast: e.target.value })}
                            placeholder="chưa ghi nhận bất thường"
                          />
                        </>
                      )}
                    </div>

                    {/* Siêu âm Phụ khoa */}
                    <div className={`p-3 border rounded-lg space-y-2 ${imaging.gynecologyEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={imaging.gynecologyEnabled}
                          onCheckedChange={(checked) => setImaging({ ...imaging, gynecologyEnabled: !!checked })}
                        />
                        <span className="font-medium">Siêu âm Phụ khoa</span>
                      </label>
                      {imaging.gynecologyEnabled && (
                        <Input
                          value={imaging.gynecology}
                          onChange={(e) => setImaging({ ...imaging, gynecology: e.target.value })}
                          placeholder="chưa ghi nhận bất thường"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Phân loại sức khỏe - Hiển thị ở tất cả các tab */}
        <div className="flex-shrink-0 border-t pt-3 mt-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm whitespace-nowrap">Phân loại SK:</span>
              <div className="flex gap-1">
                {CLASSIFICATION_OPTIONS.map((opt) => (
                  <Button
                    key={opt}
                    size="sm"
                    variant={classification === opt ? 'default' : 'outline'}
                    onClick={() => setClassification(opt)}
                    className="min-w-[40px] h-8"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
              {classification && (
                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  Loại {classification}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} size="sm">
                Hủy
              </Button>
              <Button variant="secondary" onClick={handleSave} size="sm" className="gap-1">
                <Save className="h-3 w-3" />
                Lưu
              </Button>
              <Button onClick={handleSaveAndClose} size="sm" className="gap-1">
                <Save className="h-3 w-3" />
                Lưu & Đóng
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

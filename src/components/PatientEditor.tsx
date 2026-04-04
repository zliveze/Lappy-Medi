'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PatientData, BLOOD_PRESSURE_OPTIONS, INTERNAL_PREFIX_OPTIONS, INTERNAL_CONDITION_OPTIONS, INTERNAL_TIME_UNIT_OPTIONS, INTERNAL_TREATMENT_OPTIONS, EYE_OPTIONS_SINGLE, EYE_OPTIONS_BOTH, ENT_OPTIONS, DENTAL_OPTIONS, LIVER_OPTIONS, KIDNEY_OPTIONS, VISION_OPTIONS, DNT_OPTIONS, ECG_AXIS_OPTIONS, CLASSIFICATION_OPTIONS, ULTRASOUND_ABDOMEN_NOTE_OPTIONS, ULTRASOUND_BREAST_OPTIONS, ULTRASOUND_THYROID_OPTIONS, ULTRASOUND_GYNECOLOGY_OPTIONS, ULTRASOUND_CARDIAC_OPTIONS } from '@/types/patient';
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

// Entry cho mỗi bệnh lý nội khoa
interface InternalConditionEntry {
    prefix: string; // "Theo dõi", "Tăng", ""
    condition: string; // "tăng huyết áp", "ĐTĐ", ..., "Mạch nhanh"
    timeValue: string; // số (ví dụ: "3") - dùng cho các bệnh lý thông thường
    timeUnit: string; // "ngày", "tuần", "tháng", "năm"
    treatment: string; // "đang điều trị", "không điều trị", "điều trị không thường xuyên", "bỏ điều trị", ""
    heartRate?: string; // nhịp tim (ví dụ: "102") - chỉ dùng cho "Mạch nhanh"
}

interface ExamState {
    // Chưa phát hiện bệnh lý
    noPathologyFound: boolean;
    // Nội khoa
    internalEnabled: boolean;
    bpReadings: BPReading[]; // Hỗ trợ nhiều lần đo
    bpCondition: string; // Giữ lại để tương thích ngược
    bpNote: string;
    internalConditions: InternalConditionEntry[]; // Danh sách bệnh lý nội khoa mới
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
    cardiacEnabled: boolean; // Siêu âm tim
    cardiac: string; // Text với helper buttons
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
    // Tab state - luôn reset về "Thể Lực & Phân Loại" khi chuyển bệnh nhân
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
        internalConditions: [],
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
        surgery: '',
        dermaEnabled: false,
        dermatology: '',
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
        cardiacEnabled: false,
        cardiac: '',
        ecgEnabled: false,
        heartRate: '',
        ecgAxis: '',
        ecgNotes: [''],
    });

    // === Dirty state tracking (theo dõi trạng thái lưu trong phiên chỉnh sửa) ===
    const [isDirty, setIsDirty] = useState(false);
    const isSettlingRef = useRef(false); // Tránh đánh dấu dirty khi đang load dữ liệu bệnh nhân

    // Reset dirty state khi chuyển bệnh nhân
    useEffect(() => {
        if (patient) {
            const hasData = 
                (patient['Cân nặng'] !== undefined && patient['Cân nặng'] !== null && String(patient['Cân nặng']).trim() !== '') ||
                (patient['KHÁM TỔNG QUÁT'] !== undefined && patient['KHÁM TỔNG QUÁT'] !== null && String(patient['KHÁM TỔNG QUÁT']).trim() !== '') ||
                (patient['PHÂN LOẠI SỨC KHỎE'] !== undefined && patient['PHÂN LOẠI SỨC KHỎE'] !== null && String(patient['PHÂN LOẠI SỨC KHỎE']).trim() !== '');
            isSettlingRef.current = true;
            setIsDirty(!hasData); // Nếu đã có data → không dirty; chưa có → dirty
            const timer = setTimeout(() => {
                isSettlingRef.current = false;
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [patient]);

    // Theo dõi thay đổi form state → đánh dấu dirty
    useEffect(() => {
        if (isSettlingRef.current) return; // Bỏ qua khi đang load dữ liệu
        setIsDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weight, height, exam, imaging]);

    // Theo dõi index trước đó để phân biệt chuyển bệnh nhân vs lưu dữ liệu
    const prevIndexRef = useRef<number | undefined>();

    // Reset tab về "Thể Lực & Phân Loại" khi chuyển bệnh nhân (index thay đổi)
    useEffect(() => {
        if (prevIndexRef.current !== undefined && prevIndexRef.current !== currentIndex) {
            setActiveTab('vital');
        }
        prevIndexRef.current = currentIndex;
    }, [currentIndex]);

    // Parse existing data when patient changes
    useEffect(() => {
        if (patient) {

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
            const hasCardiac = ultrasoundText.toLowerCase().includes('tim');

            // Parse liver and kidney conditions from ultrasound text
            // Sort LIVER_OPTIONS từ độ cao đến thấp (III, II, I) để tránh "độ I" match sai trong "độ II"
            const parsedLiverConditions: string[] = [];
            const parsedKidneyConditions: string[] = [];
            const sortedLiverOptions = [...LIVER_OPTIONS].sort((a, b) => {
                // Đếm số chữ I để sắp xếp giảm dần: III=3, II=2, I=1
                const countI = (str: string) => (str.match(/I/g) || []).length;
                return countI(b) - countI(a);
            });
            // Chỉ lấy MỘT độ gan (cao nhất) để tránh conflict
            for (const opt of sortedLiverOptions) {
                if (ultrasoundText.includes(opt)) {
                    parsedLiverConditions.push(opt);
                    break; // Dừng lại sau khi tìm thấy
                }
            }
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

            // Parse abdomen note - giữ nguyên toàn bộ text (không loại bỏ gan/thận vì đã hợp nhất vào abdomenNote)
            const parsedAbdomenNote = parseUltrasoundSection(ultrasoundText, 'Bụng');

            const parsedThyroid = parseUltrasoundSection(ultrasoundText, 'Tuyến giáp');
            const parsedBreast = parseUltrasoundSection(ultrasoundText, 'Tuyến vú');
            const parsedGynecology = parseUltrasoundSection(ultrasoundText, 'Phụ Khoa');
            const parsedCardiac = parseUltrasoundSection(ultrasoundText, 'Tim');

            // Parse ECG axis
            let parsedEcgAxis = '';
            ECG_AXIS_OPTIONS.forEach(opt => {
                if (ecgText.includes(opt)) parsedEcgAxis = opt;
            });

            // Parse heart rate - handle both numeric and "đều" cases
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

                // Skip known parts - but be more precise to avoid losing data
                // Skip ONLY if the line is exactly or primarily about these items
                if (cleanLine.toLowerCase().match(/^nhịp xoang[:\s]*(\d+|đều)/i)) return;
                if (ECG_AXIS_OPTIONS.some(opt => cleanLine === opt)) return;

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
                cardiacEnabled: hasCardiac,
                cardiac: parsedCardiac,
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
            internalConditions: [],
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
            surgery: '',
            dermaEnabled: false,
            dermatology: '',
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
            // Loại trừ các dòng thuộc chuyên khoa khác để tránh match "theo dõi", "huyết áp" sai
            const isOtherSpecialty = /[-–]\s*(tmh|rhm|mắt|ngoại khoa|da liễu)\s*:/i.test(line);
            if (!isOtherSpecialty && (lowerLine.includes('nội khoa') || lowerLine.includes('ha ') || lowerLine.includes('huyết áp') ||
                lowerLine.includes('tăng huyết áp') || lowerLine.includes('đtđ') || lowerLine.includes('theo dõi'))) {
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

                // Parse bệnh lý nội khoa mới với format: [prefix] [condition] khoảng [time] [unit] [treatment]
                const internalConditions: InternalConditionEntry[] = [];
                const conditionPatterns = [
                    // Pattern: theo dõi tăng huyết áp khoảng 3 tháng đang điều trị
                    /(?:(theo dõi|tăng)\s+)?(tăng huyết áp|THA|ĐTĐ|Rối loạn mỡ máu|Gout)(?:\s+khoảng\s+(\d+)\s+(ngày|tuần|tháng|năm))?(?:\s+(đang điều trị|không điều trị|điều trị không thường xuyên|bỏ điều trị))?/gi
                ];

                // Parse pattern riêng cho "mạch nhanh" với nhịp tim
                const machNhanhPattern = /(?:(theo dõi)\s+)?mạch nhanh(?:\s*\((\d+)\))?/gi;
                let machNhanhMatch;
                while ((machNhanhMatch = machNhanhPattern.exec(line)) !== null) {
                    internalConditions.push({
                        prefix: machNhanhMatch[1] || '',
                        condition: 'Mạch nhanh',
                        timeValue: '',
                        timeUnit: '',
                        treatment: '',
                        heartRate: machNhanhMatch[2] || ''
                    });
                }

                for (const pattern of conditionPatterns) {
                    let condMatch;
                    while ((condMatch = pattern.exec(line)) !== null) {
                        internalConditions.push({
                            prefix: condMatch[1] || '',
                            condition: condMatch[2] || '',
                            timeValue: condMatch[3] || '',
                            timeUnit: condMatch[4] || '',
                            treatment: condMatch[5] || ''
                        });
                    }
                }

                if (internalConditions.length > 0) {
                    newExam.internalConditions = internalConditions;
                }

                // Fallback: Check legacy options for backward compatibility
                if (internalConditions.length === 0) {
                    const sortedBpOptions = [...BLOOD_PRESSURE_OPTIONS].sort((a, b) => b.length - a.length);
                    for (const opt of sortedBpOptions) {
                        if (line.toLowerCase().includes(opt.toLowerCase())) {
                            newExam.bpCondition = opt;
                            break;
                        }
                    }
                }

                // Parse ghi chú nội khoa - phần text sau các thông tin đã parse
                let noteText = line.replace(/^.*?:/, '').trim();
                BLOOD_PRESSURE_OPTIONS.forEach(opt => {
                    noteText = noteText.replace(new RegExp(opt, 'gi'), '');
                });
                // Remove parsed conditions
                noteText = noteText.replace(/(?:theo dõi|tăng)?\s*(?:tăng huyết áp|THA|ĐTĐ|Rối loạn mỡ máu|Gout)(?:\s+khoảng\s+\d+\s+(?:ngày|tuần|tháng|năm))?(?:\s+(?:đang điều trị|không điều trị|điều trị không thường xuyên|bỏ điều trị))?/gi, '');
                // Remove parsed "mạch nhanh" với nhịp tim
                noteText = noteText.replace(/(?:theo dõi\s+)?mạch nhanh(?:\s*\(\d+\))?/gi, '');
                noteText = noteText.replace(/L?\d?\s*HA\s*\d+\/\d+\s*mmHg/gi, '').replace(/\([^)]*\)/g, '').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
                if (noteText && noteText !== 'Bình thường') newExam.bpNote = noteText;
            }

            // Parse Mắt - chỉ match dòng thuộc phần Mắt, tránh match từ "mắt" trong các phần khác (VD: ngoại khoa)
            // Kiểm tra dòng có prefix "- Mắt:" hoặc chứa pattern thị lực mắt (P)/(T)
            const isEyeSectionLine = /[-–]\s*mắt\s*:/i.test(line) || /mắt\s*\([PT]\)/i.test(line);
            // Loại trừ các dòng thuộc chuyên khoa khác
            const isOtherSection = /[-–]\s*(ngoại khoa|da liễu|nội khoa|tmh|rhm)\s*:/i.test(line);
            if (isEyeSectionLine && !isOtherSection) {
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

                // Parse bệnh lý mắt - tất cả đưa vào eyeNote để UI buttons có thể toggle đúng
                // Tách các options thành 2 nhóm: mộng thịt (exclusive) và các bệnh khác
                const mongThitOptions = EYE_OPTIONS_BOTH.filter(opt => opt.includes('mộng thịt'));
                const otherEyeOptions = EYE_OPTIONS_BOTH.filter(opt => !opt.includes('mộng thịt'));

                // Sắp xếp mộng thịt từ độ cao đến thấp (III, II, I)
                const sortedMongThit = [...mongThitOptions].sort((a, b) => {
                    const countI = (str: string) => (str.match(/I/g) || []).length;
                    return countI(b) - countI(a);
                });

                // Collect parsed conditions vào danh sách tạm
                const parsedEyeConditions: string[] = [];

                // Chỉ lấy MỘT mức độ mộng thịt (cao nhất)
                for (const opt of sortedMongThit) {
                    if (line.toLowerCase().includes(opt.toLowerCase())) {
                        parsedEyeConditions.push(opt);
                        break; // Dừng lại sau khi tìm thấy
                    }
                }

                // Parse các bệnh lý mắt khác (không exclusive)
                otherEyeOptions.forEach(opt => {
                    if (line.toLowerCase().includes(opt.toLowerCase())) {
                        if (!parsedEyeConditions.includes(opt)) parsedEyeConditions.push(opt);
                    }
                });

                // Parse ghi chú mắt - loại bỏ các thông tin đã parse (vision, CK, known conditions)
                let eyeNote = line.replace(/^.*?:/, '').trim();
                eyeNote = eyeNote.replace(/CK\s*/gi, '').replace(/mắt\s*\([PT]\)\s*\d+\/\d+/gi, '').replace(/mắt\s*\([PT]\)\s*ĐNT\s*\d+m/gi, '');
                // Sắp xếp theo độ dài giảm dần để tránh "độ III" bị replace sai thành "II"
                const sortedEyeOptions = [...EYE_OPTIONS_BOTH].sort((a, b) => b.length - a.length);
                sortedEyeOptions.forEach(opt => { eyeNote = eyeNote.replace(new RegExp(opt, 'gi'), ''); });
                eyeNote = eyeNote.replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();

                // Gộp tất cả parsed conditions + ghi chú thêm vào eyeNote
                const allEyeParts = [...parsedEyeConditions];
                if (eyeNote) allEyeParts.push(eyeNote);
                newExam.eyeNote = allEyeParts.join(', ');
                // eyeConditionsBoth/Left/Right để trống - mọi thứ quản lý qua eyeNote
            }

            // Parse TMH - điền toàn bộ vào entNote
            if (lowerLine.includes('tmh') || lowerLine.includes('amidan') || lowerLine.includes('viêm họng') || lowerLine.includes('viêm mũi')) {
                newExam.entEnabled = true;
                // Lấy toàn bộ text sau dấu :
                let entNote = line.replace(/^.*?:/, '').trim();
                entNote = entNote.replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
                if (entNote && entNote !== 'Bình thường') newExam.entNote = entNote;
            }

            // Parse RHM - điền toàn bộ vào dentalNote
            if (lowerLine.includes('rhm') || lowerLine.includes('sức nhai') || lowerLine.includes('răng')) {
                newExam.dentalEnabled = true;
                const chewMatch = line.match(/sức nhai\s*(\d+)%/i);
                if (chewMatch) newExam.chewingPower = parseInt(chewMatch[1]);
                // Lấy text sau dấu :, loại bỏ phần sức nhai
                let dentalNote = line.replace(/^.*?:/, '').trim();
                dentalNote = dentalNote.replace(/sức nhai\s*\d+%,?\s*/gi, '');
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

        // 2. Kiểm tra có kính (tật khúc xạ) - LUÔN kiểm tra, không phụ thuộc noPathologyFound
        if (exam.hasGlasses) {
            abnormalityCount++;
        }

        // 3. Kiểm tra khám tổng quát - nếu KHÔNG phải "chưa phát hiện bệnh lý"
        if (!exam.noPathologyFound) {
            // Có nội khoa với tình trạng tăng HA hoặc ghi chú
            if (exam.internalEnabled && (exam.bpCondition || exam.bpNote)) {
                abnormalityCount++;
            }
            // Có bệnh lý mắt, hoặc thị lực giảm (< 10/10) khi không đeo kính
            if (exam.eyeEnabled) {
                const hasEyeConditions = exam.eyeConditionsBoth.length > 0 || exam.eyeConditionsLeft.length > 0 || exam.eyeConditionsRight.length > 0 || exam.eyeNote;
                // Thị lực giảm khi KHÔNG đeo kính (< 10/10)
                const hasReducedVision = !exam.hasGlasses && (exam.visionLeft !== '10/10' || exam.visionRight !== '10/10');
                if (hasEyeConditions || hasReducedVision) {
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

        // Nội khoa - hỗ trợ nhiều lần đo và bệnh lý linh hoạt
        if (exam.internalEnabled) {
            const internalParts: string[] = [];

            // Build huyết áp
            let bpText = '';
            const validReadings = exam.bpReadings.filter(r => r.systolic && r.diastolic);
            if (validReadings.length > 0) {
                if (validReadings.length === 1) {
                    bpText = `HA ${validReadings[0].systolic}/${validReadings[0].diastolic} mmHg`;
                } else {
                    // Format: L1 HA 140/90 mmHg, L2 HA 150/90 mmHg
                    const bpParts = validReadings.map((r, i) => `L${i + 1} HA ${r.systolic}/${r.diastolic} mmHg`);
                    bpText = bpParts.join(', ');
                }
            }

            // Kiểm tra có bệnh lý tăng huyết áp không
            const hasTHA = exam.internalConditions.some(entry => entry.condition === 'tăng huyết áp' || entry.condition === 'THA');

            // Nếu không có tăng huyết áp, thêm huyết áp ở đầu như cũ
            if (!hasTHA && bpText) {
                internalParts.push(bpText);
            }

            // Build bệnh lý nội khoa mới
            if (exam.internalConditions.length > 0) {
                const conditionTexts = exam.internalConditions.map(entry => {
                    const parts: string[] = [];
                    if (entry.prefix) parts.push(entry.prefix.toLowerCase());

                    // Xử lý riêng cho "Mạch nhanh" - thêm nhịp tim trong ngoặc
                    if (entry.condition === 'Mạch nhanh') {
                        parts.push('mạch nhanh');
                        if (entry.heartRate) {
                            parts.push(`(${entry.heartRate})`);
                        }
                    } else {
                        if (entry.condition) parts.push(entry.condition);
                        if (entry.timeValue && entry.timeUnit) {
                            parts.push(`khoảng ${entry.timeValue} ${entry.timeUnit}`);
                        }
                        if (entry.treatment) parts.push(entry.treatment);
                    }

                    let conditionText = parts.join(' ');

                    // Nếu là tăng huyết áp và có huyết áp, thêm vào trong ngoặc
                    if ((entry.condition === 'tăng huyết áp' || entry.condition === 'THA') && bpText) {
                        conditionText += ` (${bpText})`;
                    }

                    return conditionText;
                }).filter(Boolean);
                if (conditionTexts.length > 0) {
                    internalParts.push(...conditionTexts);
                }
            }

            // Giữ lại bpCondition cũ cho tương thích ngược
            if (exam.bpCondition && exam.internalConditions.length === 0) {
                internalParts.push(exam.bpCondition);
            }

            if (exam.bpNote) internalParts.push(exam.bpNote);

            if (internalParts.length > 0) {
                parts.push(` - Nội khoa: ${internalParts.join(', ')}`);
            }
        }

        // Mắt
        if (exam.eyeEnabled) {
            const prefix = exam.hasGlasses ? 'CK ' : '';
            let eyeText = `${prefix}mắt (P) ${exam.visionRight}, mắt (T) ${exam.visionLeft}`;

            // Tất cả bệnh lý mắt được quản lý qua eyeNote
            if (exam.eyeNote) eyeText += `, ${exam.eyeNote}`;
            parts.push(` - Mắt: ${eyeText}`);
        }

        // TMH - chỉ dùng entNote (tất cả options đã được điền vào đây)
        if (exam.entEnabled && exam.entNote) {
            parts.push(` - TMH: ${exam.entNote}`);
        }

        // RHM - chỉ dùng dentalNote (tất cả options đã được điền vào đây)
        if (exam.dentalEnabled) {
            let rhm = `sức nhai ${exam.chewingPower}%`;
            if (exam.dentalNote) rhm += `, ${exam.dentalNote}`;
            parts.push(` - RHM: ${rhm}`);
        }

        // Ngoại khoa - chỉ thêm khi enabled VÀ có nội dung
        if (exam.surgeryEnabled && exam.surgery) {
            parts.push(` - Ngoại khoa: ${exam.surgery}`);
        }

        // Da liễu - chỉ thêm khi enabled VÀ có nội dung
        if (exam.dermaEnabled && exam.dermatology) {
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
    // - Siêu âm Tim: chưa phát hiện bất thường
    const buildUltrasound = useCallback((): string => {
        const parts: string[] = [];

        // Tuyến vú - đặt trước theo thứ tự yêu cầu
        if (imaging.breastEnabled) {
            const defaultBreast = 'không tổn thương khu trú trên siêu âm tuyến vú';
            parts.push(` - Siêu âm Tuyến vú: ${imaging.breast || defaultBreast}`);
        }

        // Bụng - chỉ dùng abdomenNote (tất cả options đã được điền vào đây)
        if (imaging.abdomenEnabled) {
            const abdomenText = imaging.abdomenNote.trim() || 'chưa phát hiện bất thường';
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

        // Tim - chỉ dùng text đơn giản
        if (imaging.cardiacEnabled) {
            parts.push(` - Siêu âm Tim: ${imaging.cardiac || 'chưa phát hiện bất thường'}`);
        }

        return parts.join('\n');
    }, [imaging]);

    // Build ECG text - only if enabled
    const buildEcg = useCallback((): string => {
        if (!imaging.ecgEnabled) return '';
        const ecgParts: string[] = [];
        // Only add heart rate if user entered a value
        if (imaging.heartRate) {
            ecgParts.push(`Nhịp xoang: ${imaging.heartRate} l/p`);
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
            setIsDirty(false);
        }
    };

    const handleSaveAndClose = () => {
        const updatedPatient = buildUpdatedPatient();
        if (updatedPatient) {
            onSaveAndClose(updatedPatient);
            setIsDirty(false);
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

    // Helper function để kiểm tra exact match trong chuỗi (tránh "độ III" match với "độ I")
    const isExactMatchInNote = (note: string, option: string): boolean => {
        if (!note || !option) return false;
        // Tạo regex pattern với word boundary hoặc dấu phẩy/đầu/cuối chuỗi
        // Escape special regex characters trong option
        const escapedOption = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Pattern: option phải ở đầu chuỗi, cuối chuỗi, hoặc được bao quanh bởi dấu phẩy/khoảng trắng
        const pattern = new RegExp(`(^|,\\s*)${escapedOption}(\\s*,|\\s*$)`, 'i');
        return pattern.test(note);
    };

    if (!patient) return null;



    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-xl">
                                Chỉnh sửa: {patient['CODE']} - {patient['HỌ VÀ TÊN'] || patient['HỌ TÊN'] || ''} {patient['NS'] ? `(${patient['NS']})` : ''}
                            </DialogTitle>
                            {/* Trạng thái lưu của bệnh nhân */}
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    !isDirty
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                        : 'bg-amber-100 text-amber-700 border border-amber-300'
                                }`}
                                title={!isDirty ? 'Dữ liệu đã được lưu' : 'Có thay đổi chưa lưu'}
                            >
                                {!isDirty ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Đã lưu
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                        Chưa lưu
                                    </>
                                )}
                            </span>
                        </div>
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

                                            {/* Giao diện bệnh lý nội khoa mới - dạng cột linh hoạt */}
                                            <div className="border-t pt-3 mt-3">
                                                <Label className="text-sm font-medium mb-2 block">Bệnh lý nội khoa:</Label>
                                                {exam.internalConditions.map((entry, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center mb-2 flex-wrap">
                                                        {/* Cột 1: Prefix */}
                                                        <Select
                                                            value={entry.prefix || 'none'}
                                                            onValueChange={(v) => {
                                                                const newConditions = [...exam.internalConditions];
                                                                newConditions[idx] = { ...newConditions[idx], prefix: v === 'none' ? '' : v };
                                                                setExam({ ...exam, internalConditions: newConditions });
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-28 h-8">
                                                                <SelectValue placeholder="Prefix..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">(không)</SelectItem>
                                                                {INTERNAL_PREFIX_OPTIONS.filter(o => o).map(opt => (
                                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        {/* Cột 2: Bệnh lý */}
                                                        <Select
                                                            value={entry.condition}
                                                            onValueChange={(v) => {
                                                                const newConditions = [...exam.internalConditions];
                                                                newConditions[idx] = { ...newConditions[idx], condition: v };
                                                                setExam({ ...exam, internalConditions: newConditions });
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-36 h-8">
                                                                <SelectValue placeholder="Bệnh lý..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {INTERNAL_CONDITION_OPTIONS.map(opt => (
                                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        {/* Cột 3: Thời gian HOẶC Nhịp tim (tùy theo loại bệnh lý) */}
                                                        {entry.condition === 'Mạch nhanh' ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-sm text-gray-500">nhịp tim:</span>
                                                                <Input
                                                                    type="number"
                                                                    value={entry.heartRate || ''}
                                                                    onChange={(e) => {
                                                                        const newConditions = [...exam.internalConditions];
                                                                        newConditions[idx] = { ...newConditions[idx], heartRate: e.target.value };
                                                                        setExam({ ...exam, internalConditions: newConditions });
                                                                    }}
                                                                    placeholder="102"
                                                                    className="w-20 h-8"
                                                                />
                                                                <span className="text-sm text-gray-500">lần/phút</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-sm text-gray-500">khoảng</span>
                                                                <Input
                                                                    type="number"
                                                                    value={entry.timeValue}
                                                                    onChange={(e) => {
                                                                        const newConditions = [...exam.internalConditions];
                                                                        newConditions[idx] = { ...newConditions[idx], timeValue: e.target.value };
                                                                        setExam({ ...exam, internalConditions: newConditions });
                                                                    }}
                                                                    placeholder="3"
                                                                    className="w-16 h-8"
                                                                />
                                                                <Select
                                                                    value={entry.timeUnit || 'none'}
                                                                    onValueChange={(v) => {
                                                                        const newConditions = [...exam.internalConditions];
                                                                        newConditions[idx] = { ...newConditions[idx], timeUnit: v === 'none' ? '' : v };
                                                                        setExam({ ...exam, internalConditions: newConditions });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-24 h-8">
                                                                        <SelectValue placeholder="đơn vị..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="none">(không)</SelectItem>
                                                                        {INTERNAL_TIME_UNIT_OPTIONS.map(opt => (
                                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}

                                                        {/* Cột 4: Điều trị - ẩn nếu là "Mạch nhanh" */}
                                                        {entry.condition !== 'Mạch nhanh' && (
                                                            <Select
                                                                value={entry.treatment || 'none'}
                                                                onValueChange={(v) => {
                                                                    const newConditions = [...exam.internalConditions];
                                                                    newConditions[idx] = { ...newConditions[idx], treatment: v === 'none' ? '' : v };
                                                                    setExam({ ...exam, internalConditions: newConditions });
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-36 h-8">
                                                                    <SelectValue placeholder="Điều trị..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">(không)</SelectItem>
                                                                    {INTERNAL_TREATMENT_OPTIONS.filter(o => o).map(opt => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}

                                                        {/* Nút xóa */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-500 h-8 px-2"
                                                            onClick={() => {
                                                                const newConditions = exam.internalConditions.filter((_, i) => i !== idx);
                                                                setExam({ ...exam, internalConditions: newConditions });
                                                            }}
                                                        >
                                                            ✕
                                                        </Button>
                                                    </div>
                                                ))}

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setExam({
                                                        ...exam,
                                                        internalConditions: [...exam.internalConditions, {
                                                            prefix: '',
                                                            condition: 'tăng huyết áp',
                                                            timeValue: '',
                                                            timeUnit: '',
                                                            treatment: ''
                                                        }]
                                                    })}
                                                >
                                                    + Thêm bệnh lý
                                                </Button>

                                                {/* Preview kết quả */}
                                                {exam.internalConditions.length > 0 && (
                                                    <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                        <strong>Kết quả:</strong>{' '}
                                                        {exam.internalConditions.map((entry, idx) => {
                                                            const parts: string[] = [];
                                                            if (entry.prefix) parts.push(entry.prefix.toLowerCase());

                                                            // Xử lý riêng cho "Mạch nhanh"
                                                            if (entry.condition === 'Mạch nhanh') {
                                                                parts.push('mạch nhanh');
                                                                if (entry.heartRate) {
                                                                    parts.push(`(${entry.heartRate})`);
                                                                }
                                                            } else {
                                                                if (entry.condition) parts.push(entry.condition);
                                                                if (entry.timeValue && entry.timeUnit) {
                                                                    parts.push(`khoảng ${entry.timeValue} ${entry.timeUnit}`);
                                                                }
                                                                if (entry.treatment) parts.push(entry.treatment);
                                                            }
                                                            return parts.join(' ');
                                                        }).filter(Boolean).join(', ')}
                                                    </div>
                                                )}
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
                                                        {EYE_OPTIONS_SINGLE.map((opt) => {
                                                            const isMongThit = opt.includes('Mộng thịt');
                                                            const optWithSide = `mắt (P): ${opt}`;
                                                            // Kiểm tra trong cả eyeConditionsRight (cũ) và eyeNote (mới) - dùng exact match
                                                            const isSelected = exam.eyeConditionsRight.includes(opt) || isExactMatchInNote(exam.eyeNote, optWithSide);
                                                            return (
                                                                <Button
                                                                    key={opt}
                                                                    size="sm"
                                                                    variant={isSelected ? 'default' : 'outline'}
                                                                    onClick={() => {
                                                                        const currentNote = exam.eyeNote.trim();
                                                                        if (isExactMatchInNote(currentNote, optWithSide)) {
                                                                            // Nếu đã có thì xóa đi
                                                                            const newNote = currentNote
                                                                                .replace(new RegExp(optWithSide.replace(/[()]/g, '\\$&') + ',?\\s*', 'gi'), '')
                                                                                .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                .replace(/,\s*,/g, ',')
                                                                                .trim();
                                                                            setExam({ ...exam, eyeNote: newNote });
                                                                        } else {
                                                                            if (isMongThit) {
                                                                                // Mộng thịt exclusive - xóa các độ mộng thịt mắt phải khác trước
                                                                                let newNote = currentNote;
                                                                                EYE_OPTIONS_SINGLE.filter(o => o.includes('Mộng thịt')).forEach(mongThitOpt => {
                                                                                    const mongThitWithSide = `mắt (P): ${mongThitOpt}`;
                                                                                    newNote = newNote
                                                                                        .replace(new RegExp(mongThitWithSide.replace(/[()]/g, '\\$&') + ',?\\s*', 'gi'), '')
                                                                                        .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                        .replace(/,\s*,/g, ',')
                                                                                        .trim();
                                                                                });
                                                                                newNote = newNote ? `${newNote}, ${optWithSide}` : optWithSide;
                                                                                setExam({ ...exam, eyeNote: newNote });
                                                                            } else {
                                                                                // Nếu chưa có thì cộng thêm
                                                                                const newNote = currentNote ? `${currentNote}, ${optWithSide}` : optWithSide;
                                                                                setExam({ ...exam, eyeNote: newNote });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="text-xs px-2 py-1 h-7"
                                                                >
                                                                    {opt}
                                                                </Button>
                                                            );
                                                        })}
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
                                                        {EYE_OPTIONS_SINGLE.map((opt) => {
                                                            const isMongThit = opt.includes('Mộng thịt');
                                                            const optWithSide = `mắt (T): ${opt}`;
                                                            // Kiểm tra trong cả eyeConditionsLeft (cũ) và eyeNote (mới) - dùng exact match
                                                            const isSelected = exam.eyeConditionsLeft.includes(opt) || isExactMatchInNote(exam.eyeNote, optWithSide);
                                                            return (
                                                                <Button
                                                                    key={opt}
                                                                    size="sm"
                                                                    variant={isSelected ? 'default' : 'outline'}
                                                                    onClick={() => {
                                                                        const currentNote = exam.eyeNote.trim();
                                                                        if (isExactMatchInNote(currentNote, optWithSide)) {
                                                                            // Nếu đã có thì xóa đi
                                                                            const newNote = currentNote
                                                                                .replace(new RegExp(optWithSide.replace(/[()]/g, '\\$&') + ',?\\s*', 'gi'), '')
                                                                                .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                .replace(/,\s*,/g, ',')
                                                                                .trim();
                                                                            setExam({ ...exam, eyeNote: newNote });
                                                                        } else {
                                                                            if (isMongThit) {
                                                                                // Mộng thịt exclusive - xóa các độ mộng thịt mắt trái khác trước
                                                                                let newNote = currentNote;
                                                                                EYE_OPTIONS_SINGLE.filter(o => o.includes('Mộng thịt')).forEach(mongThitOpt => {
                                                                                    const mongThitWithSide = `mắt (T): ${mongThitOpt}`;
                                                                                    newNote = newNote
                                                                                        .replace(new RegExp(mongThitWithSide.replace(/[()]/g, '\\$&') + ',?\\s*', 'gi'), '')
                                                                                        .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                        .replace(/,\s*,/g, ',')
                                                                                        .trim();
                                                                                });
                                                                                newNote = newNote ? `${newNote}, ${optWithSide}` : optWithSide;
                                                                                setExam({ ...exam, eyeNote: newNote });
                                                                            } else {
                                                                                // Nếu chưa có thì cộng thêm
                                                                                const newNote = currentNote ? `${currentNote}, ${optWithSide}` : optWithSide;
                                                                                setExam({ ...exam, eyeNote: newNote });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="text-xs px-2 py-1 h-7"
                                                                >
                                                                    {opt}
                                                                </Button>
                                                            );
                                                        })}
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
                                                {EYE_OPTIONS_BOTH.map((opt) => {
                                                    const isMongThit = opt.includes('mộng thịt');
                                                    // Kiểm tra trong cả eyeConditionsBoth (cũ) và eyeNote (mới) - dùng exact match
                                                    const isSelected = isExactMatchInNote(exam.eyeNote, opt);
                                                    return (
                                                        <Button
                                                            key={opt}
                                                            size="sm"
                                                            variant={isSelected ? 'default' : 'outline'}
                                                            onClick={() => {
                                                                const currentNote = exam.eyeNote.trim();
                                                                if (isExactMatchInNote(currentNote, opt)) {
                                                                    // Nếu đã có thì xóa đi
                                                                    const newNote = currentNote
                                                                        .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                        .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                        .replace(/,\s*,/g, ',')
                                                                        .trim();
                                                                    setExam({ ...exam, eyeNote: newNote });
                                                                } else {
                                                                    if (isMongThit) {
                                                                        // Mộng thịt exclusive - xóa các độ mộng thịt khác trước
                                                                        // Sắp xếp dài nhất trước để tránh "độ I" match sai trong "độ III"
                                                                        let newNote = currentNote;
                                                                        const sortedMongThitOpts = EYE_OPTIONS_BOTH.filter(o => o.includes('mộng thịt')).sort((a, b) => b.length - a.length);
                                                                        sortedMongThitOpts.forEach(mongThitOpt => {
                                                                            newNote = newNote
                                                                                .replace(new RegExp(mongThitOpt + ',?\\s*', 'gi'), '')
                                                                                .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                .replace(/,\s*,/g, ',')
                                                                                .trim();
                                                                        });
                                                                        newNote = newNote ? `${newNote}, ${opt}` : opt;
                                                                        setExam({ ...exam, eyeNote: newNote });
                                                                    } else {
                                                                        // Nếu chưa có thì cộng thêm
                                                                        const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                        setExam({ ...exam, eyeNote: newNote });
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            {opt}
                                                        </Button>
                                                    );
                                                })}
                                            </div>

                                            <Input
                                                placeholder="Ghi chú thêm..."
                                                value={exam.eyeNote}
                                                onChange={(e) => setExam({ ...exam, eyeNote: e.target.value })}
                                            />

                                            {/* Preview kết quả Mắt */}
                                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                <strong>Kết quả:</strong>{' '}
                                                {(() => {
                                                    const prefix = exam.hasGlasses ? 'CK ' : '';
                                                    let eyeText = `${prefix}mắt (P) ${exam.visionRight}, mắt (T) ${exam.visionLeft}`;
                                                    if (exam.eyeNote) eyeText += `, ${exam.eyeNote}`;
                                                    return eyeText;
                                                })()}
                                            </div>
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
                                                        variant={exam.entNote.includes(opt) ? 'default' : 'outline'}
                                                        onClick={() => {
                                                            const currentNote = exam.entNote.trim();
                                                            if (currentNote.includes(opt)) {
                                                                // Nếu đã có thì xóa đi
                                                                const newNote = currentNote
                                                                    .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                    .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                    .replace(/,\s*,/g, ',')
                                                                    .trim();
                                                                setExam({ ...exam, entNote: newNote });
                                                            } else {
                                                                // Nếu chưa có thì cộng thêm
                                                                const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                setExam({ ...exam, entNote: newNote });
                                                            }
                                                        }}
                                                    >
                                                        {opt}
                                                    </Button>
                                                ))}
                                            </div>
                                            <Input
                                                placeholder="Ghi chú (VD: Viêm họng cấp, Viêm mũi dị ứng...)"
                                                value={exam.entNote}
                                                onChange={(e) => setExam({ ...exam, entNote: e.target.value })}
                                            />
                                            {/* Preview kết quả TMH */}
                                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                <strong>Kết quả:</strong>{' '}
                                                {exam.entNote || 'Bình thường'}
                                            </div>
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
                                                        onFocus={(e) => e.target.select()}
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
                                                        variant={exam.dentalNote.includes(opt) ? 'default' : 'outline'}
                                                        onClick={() => {
                                                            const currentNote = exam.dentalNote.trim();
                                                            if (currentNote.includes(opt)) {
                                                                // Nếu đã có thì xóa đi
                                                                const newNote = currentNote
                                                                    .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                    .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                    .replace(/,\s*,/g, ',')
                                                                    .trim();
                                                                setExam({ ...exam, dentalNote: newNote });
                                                            } else {
                                                                // Nếu chưa có thì cộng thêm
                                                                const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                setExam({ ...exam, dentalNote: newNote });
                                                            }
                                                        }}
                                                    >
                                                        {opt}
                                                    </Button>
                                                ))}
                                            </div>
                                            <Input
                                                placeholder="Ghi chú bệnh lý răng miệng..."
                                                value={exam.dentalNote}
                                                onChange={(e) => setExam({ ...exam, dentalNote: e.target.value })}
                                            />
                                            {/* Preview kết quả RHM */}
                                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                <strong>Kết quả:</strong>{' '}
                                                {(() => {
                                                    let rhm = `sức nhai ${exam.chewingPower}%`;
                                                    if (exam.dentalNote) rhm += `, ${exam.dentalNote}`;
                                                    return rhm;
                                                })()}
                                            </div>
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
                                        <>
                                            <Textarea
                                                value={exam.surgery}
                                                onChange={(e) => setExam({ ...exam, surgery: e.target.value })}
                                                placeholder="Nhập kết quả khám ngoại khoa..."
                                                rows={3}
                                            />
                                            {/* Preview kết quả Ngoại khoa */}
                                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                <strong>Kết quả:</strong>{' '}
                                                {exam.surgery || 'Bình thường'}
                                            </div>
                                        </>
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
                                        <>
                                            <Textarea
                                                value={exam.dermatology}
                                                onChange={(e) => setExam({ ...exam, dermatology: e.target.value })}
                                                placeholder="Nhập kết quả khám da liễu..."
                                                rows={3}
                                            />
                                            {/* Preview kết quả Da liễu */}
                                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                <strong>Kết quả:</strong>{' '}
                                                {exam.dermatology || 'Bình thường'}
                                            </div>
                                        </>
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
                                                            {LIVER_OPTIONS.map((opt) => {
                                                                // Kiểm tra exact match để tránh "độ I" match với "độ II" hoặc "độ III"
                                                                const isSelected = imaging.abdomenNote.split(',').map(s => s.trim()).includes(opt);
                                                                return (
                                                                    <Button
                                                                        key={opt}
                                                                        size="sm"
                                                                        variant={isSelected ? 'default' : 'outline'}
                                                                        onClick={() => {
                                                                            const currentNote = imaging.abdomenNote.trim();
                                                                            // Loại bỏ tất cả các option gan khác trước (exclusive selection)
                                                                            let cleanedNote = currentNote;
                                                                            LIVER_OPTIONS.forEach(liverOpt => {
                                                                                cleanedNote = cleanedNote.replace(new RegExp(liverOpt + ',?\\s*', 'gi'), '');
                                                                            });
                                                                            cleanedNote = cleanedNote.replace(/^[\s,]+|[\s,]+$/g, '').replace(/,\s*,/g, ',').trim();

                                                                            if (isSelected) {
                                                                                // Nếu đã chọn thì bỏ chọn
                                                                                setImaging({ ...imaging, abdomenNote: cleanedNote });
                                                                            } else {
                                                                                // Nếu chưa chọn thì chọn
                                                                                const newNote = cleanedNote ? `${opt}, ${cleanedNote}` : opt;
                                                                                setImaging({ ...imaging, abdomenNote: newNote });
                                                                            }
                                                                        }}
                                                                        className="text-xs h-7"
                                                                    >
                                                                        {opt}
                                                                    </Button>
                                                                );
                                                            })}
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
                                                                    variant={imaging.abdomenNote.includes(opt) ? 'default' : 'outline'}
                                                                    onClick={() => {
                                                                        const currentNote = imaging.abdomenNote.trim();
                                                                        if (currentNote.includes(opt)) {
                                                                            // Nếu đã có thì xóa đi
                                                                            const newNote = currentNote
                                                                                .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                                .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                .replace(/,\s*,/g, ',')
                                                                                .trim();
                                                                            setImaging({ ...imaging, abdomenNote: newNote });
                                                                        } else {
                                                                            // Nếu chưa có thì cộng thêm
                                                                            const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                            setImaging({ ...imaging, abdomenNote: newNote });
                                                                        }
                                                                    }}
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
                                                                    variant={imaging.abdomenNote.includes(opt) ? 'default' : 'outline'}
                                                                    onClick={() => {
                                                                        // Cộng thêm vào ghi chú thay vì thay thế
                                                                        const currentNote = imaging.abdomenNote.trim();
                                                                        if (currentNote.includes(opt)) {
                                                                            // Nếu đã có thì xóa đi
                                                                            const newNote = currentNote
                                                                                .split(', ')
                                                                                .filter(item => item !== opt)
                                                                                .join(', ');
                                                                            setImaging({ ...imaging, abdomenNote: newNote });
                                                                        } else {
                                                                            // Nếu chưa có thì cộng thêm
                                                                            const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                            setImaging({ ...imaging, abdomenNote: newNote });
                                                                        }
                                                                    }}
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
                                                        {imaging.abdomenNote || 'chưa phát hiện bất thường'}
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
                                                <>
                                                    <div className="flex flex-wrap gap-1">
                                                        {ULTRASOUND_THYROID_OPTIONS.map((opt) => {
                                                            const isTirads = opt.includes('TIRADS');
                                                            // Kiểm tra chính xác bằng regex word boundary
                                                            const isSelected = new RegExp(`(^|,\\s*)${opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*,|$)`, 'i').test(imaging.thyroid) || imaging.thyroid === opt;
                                                            return (
                                                                <Button
                                                                    key={opt}
                                                                    size="sm"
                                                                    variant={isSelected ? 'default' : 'outline'}
                                                                    onClick={() => {
                                                                        let currentNote = imaging.thyroid.trim();

                                                                        if (isTirads) {
                                                                            // TIRADS exclusive - xóa tất cả TIRADS khác trước
                                                                            ULTRASOUND_THYROID_OPTIONS.filter(o => o.includes('TIRADS')).forEach(tiradsOpt => {
                                                                                currentNote = currentNote.replace(new RegExp(tiradsOpt + ',?\\s*', 'gi'), '');
                                                                            });
                                                                            currentNote = currentNote.replace(/^[\s,]+|[\s,]+$/g, '').replace(/,\s*,/g, ',').trim();

                                                                            if (isSelected) {
                                                                                // Đã chọn thì bỏ chọn
                                                                                setImaging({ ...imaging, thyroid: currentNote });
                                                                            } else {
                                                                                // Chưa chọn thì chọn
                                                                                const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                                setImaging({ ...imaging, thyroid: newNote });
                                                                            }
                                                                        } else {
                                                                            // Các option khác - toggle bình thường
                                                                            if (isSelected) {
                                                                                const newNote = currentNote
                                                                                    .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                                    .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                    .replace(/,\s*,/g, ',')
                                                                                    .trim();
                                                                                setImaging({ ...imaging, thyroid: newNote });
                                                                            } else {
                                                                                const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                                setImaging({ ...imaging, thyroid: newNote });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="text-xs h-7"
                                                                >
                                                                    {opt}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                    <Input
                                                        value={imaging.thyroid}
                                                        onChange={(e) => setImaging({ ...imaging, thyroid: e.target.value })}
                                                        placeholder="chưa phát hiện bất thường"
                                                    />
                                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                        <strong>Kết quả:</strong>{' '}
                                                        {imaging.thyroid || 'chưa phát hiện bất thường'}
                                                    </div>
                                                </>
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
                                                                variant={imaging.breast.includes(opt) ? 'default' : 'outline'}
                                                                onClick={() => {
                                                                    const currentNote = imaging.breast.trim();
                                                                    if (currentNote.includes(opt)) {
                                                                        // Nếu đã có thì xóa đi
                                                                        const newNote = currentNote
                                                                            .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                            .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                            .replace(/,\s*,/g, ',')
                                                                            .trim();
                                                                        setImaging({ ...imaging, breast: newNote });
                                                                    } else {
                                                                        // Nếu chưa có thì cộng thêm
                                                                        const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                        setImaging({ ...imaging, breast: newNote });
                                                                    }
                                                                }}
                                                                className="text-xs h-7"
                                                            >
                                                                {opt}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <Input
                                                        value={imaging.breast}
                                                        onChange={(e) => setImaging({ ...imaging, breast: e.target.value })}
                                                        placeholder="không tổn thương khu trú trên siêu âm tuyến vú"
                                                    />
                                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                        <strong>Kết quả:</strong>{' '}
                                                        {imaging.breast || 'không tổn thương khu trú trên siêu âm tuyến vú'}
                                                    </div>
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
                                                <>
                                                    <div className="flex flex-wrap gap-1">
                                                        {ULTRASOUND_GYNECOLOGY_OPTIONS.map((opt) => (
                                                            <Button
                                                                key={opt}
                                                                size="sm"
                                                                variant={imaging.gynecology.includes(opt) ? 'default' : 'outline'}
                                                                onClick={() => {
                                                                    const currentNote = imaging.gynecology.trim();
                                                                    if (currentNote.includes(opt)) {
                                                                        const newNote = currentNote
                                                                            .replace(new RegExp(opt + ',?\\s*', 'gi'), '')
                                                                            .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                            .replace(/,\s*,/g, ',')
                                                                            .trim();
                                                                        setImaging({ ...imaging, gynecology: newNote });
                                                                    } else {
                                                                        const newNote = currentNote ? `${currentNote}, ${opt}` : opt;
                                                                        setImaging({ ...imaging, gynecology: newNote });
                                                                    }
                                                                }}
                                                                className="text-xs h-7"
                                                            >
                                                                {opt}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <Input
                                                        value={imaging.gynecology}
                                                        onChange={(e) => setImaging({ ...imaging, gynecology: e.target.value })}
                                                        placeholder="chưa phát hiện bất thường"
                                                    />
                                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                        <strong>Kết quả:</strong>{' '}
                                                        {imaging.gynecology || 'chưa phát hiện bất thường'}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Siêu âm Tim - Textarea với helper buttons */}
                                        <div className={`p-3 border rounded-lg space-y-3 ${imaging.cardiacEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox
                                                    checked={imaging.cardiacEnabled}
                                                    onCheckedChange={(checked) => setImaging({ ...imaging, cardiacEnabled: !!checked })}
                                                />
                                                <span className="font-medium">Siêu âm Tim</span>
                                            </label>
                                            {imaging.cardiacEnabled && (
                                                <>
                                                    {/* Helper buttons - Chức năng */}
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Mẫu nhanh - Chức năng:</Label>
                                                        <div className="flex flex-wrap gap-1">
                                                            {[
                                                                'chức năng tâm thu thất trái bình thường',
                                                                'chức năng tâm trương thất trái bình thường',
                                                                'chức năng tâm thu thất phải bình thường',
                                                            ].map((text) => {
                                                                const isSelected = imaging.cardiac.includes(text);
                                                                return (
                                                                    <Button
                                                                        key={text}
                                                                        size="sm"
                                                                        variant={isSelected ? 'default' : 'outline'}
                                                                        onClick={() => {
                                                                            const currentText = imaging.cardiac.trim();
                                                                            if (isSelected) {
                                                                                // Xóa text này
                                                                                const newText = currentText
                                                                                    .replace(new RegExp(text + ',?\\s*', 'gi'), '')
                                                                                    .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                    .replace(/,\s*,/g, ',')
                                                                                    .trim();
                                                                                setImaging({ ...imaging, cardiac: newText });
                                                                            } else {
                                                                                // Thêm text này
                                                                                const newText = currentText ? `${currentText}, ${text}` : text;
                                                                                setImaging({ ...imaging, cardiac: newText });
                                                                            }
                                                                        }}
                                                                        className="text-xs h-7"
                                                                    >
                                                                        {text.replace('chức năng ', '').replace(' bình thường', ' BT')}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Helper buttons - Hở van */}
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Mẫu nhanh - Hở van:</Label>
                                                        <div className="flex flex-wrap gap-1">
                                                            {ULTRASOUND_CARDIAC_OPTIONS.map((text) => {
                                                                const isSelected = imaging.cardiac.includes(text);
                                                                return (
                                                                    <Button
                                                                        key={text}
                                                                        size="sm"
                                                                        variant={isSelected ? 'default' : 'outline'}
                                                                        onClick={() => {
                                                                            const currentText = imaging.cardiac.trim();
                                                                            if (isSelected) {
                                                                                const newText = currentText
                                                                                    .replace(new RegExp(text + ',?\\s*', 'gi'), '')
                                                                                    .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                    .replace(/,\s*,/g, ',')
                                                                                    .trim();
                                                                                setImaging({ ...imaging, cardiac: newText });
                                                                            } else {
                                                                                const newText = currentText ? `${currentText}, ${text}` : text;
                                                                                setImaging({ ...imaging, cardiac: newText });
                                                                            }
                                                                        }}
                                                                        className="text-xs h-7"
                                                                    >
                                                                        {text}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Helper buttons - Khác */}
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Mẫu nhanh - Khác:</Label>
                                                        <div className="flex flex-wrap gap-1">
                                                            {[
                                                                'tăng áp phổi',
                                                                'không tăng áp phổi',
                                                                'dày thất trái',
                                                                'giãn nhĩ trái',
                                                            ].map((text) => {
                                                                const isSelected = imaging.cardiac.includes(text);
                                                                return (
                                                                    <Button
                                                                        key={text}
                                                                        size="sm"
                                                                        variant={isSelected ? 'default' : 'outline'}
                                                                        onClick={() => {
                                                                            const currentText = imaging.cardiac.trim();
                                                                            if (isSelected) {
                                                                                const newText = currentText
                                                                                    .replace(new RegExp(text + ',?\\s*', 'gi'), '')
                                                                                    .replace(/^[\s,]+|[\s,]+$/g, '')
                                                                                    .replace(/,\s*,/g, ',')
                                                                                    .trim();
                                                                                setImaging({ ...imaging, cardiac: newText });
                                                                            } else {
                                                                                const newText = currentText ? `${currentText}, ${text}` : text;
                                                                                setImaging({ ...imaging, cardiac: newText });
                                                                            }
                                                                        }}
                                                                        className="text-xs h-7"
                                                                    >
                                                                        {text}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Textarea để chỉnh sửa */}
                                                    <div>
                                                        <Label className="text-sm font-medium">Kết quả (có thể chỉnh sửa trực tiếp):</Label>
                                                        <Textarea
                                                            value={imaging.cardiac}
                                                            onChange={(e) => setImaging({ ...imaging, cardiac: e.target.value })}
                                                            placeholder="chưa phát hiện bất thường"
                                                            rows={4}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                </>
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

            {/* === PREVIEW PANEL - floats beside the dialog, both sections always visible === */}
            {isOpen && (
                <div className="fixed z-[60] w-[340px] max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 shadow-lg bg-white"
                     style={{
                         top: '50%',
                         transform: 'translateY(-50%)',
                         left: 'calc(50% + 512px + 12px)',
                     }}>
                    {/* === KHÁM TỔNG QUÁT === */}
                    <div className="sticky top-0 z-10 px-4 py-2 border-b bg-emerald-100 border-emerald-200">
                        <span className="font-semibold text-sm text-emerald-800">📋 KHÁM TỔNG QUÁT</span>
                    </div>
                    <div className="p-3">
                        {(() => {
                            const examText = buildGeneralExam();
                            if (!examText) {
                                return <span className="text-gray-400 italic text-xs">Chưa có dữ liệu</span>;
                            }
                            return (
                                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                                    {examText}
                                </pre>
                            );
                        })()}
                    </div>

                    {/* === CẬN LÂM SÀNG === */}
                    <div className="sticky top-0 z-10 px-4 py-2 border-y bg-indigo-100 border-indigo-200">
                        <span className="font-semibold text-sm text-indigo-800">📋 CẬN LÂM SÀNG</span>
                    </div>
                    <div className="p-3 space-y-2">
                        {/* X-Quang */}
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">X-Quang</span>
                            {(() => {
                                if (!imaging.xrayEnabled) {
                                    return <p className="text-xs text-gray-400 italic mt-0.5">Không có</p>;
                                }
                                const validNotes = imaging.xrayNotes.filter(n => n && n.trim());
                                const xrayText = validNotes.length > 0
                                    ? validNotes.map(n => ` - ${n}`).join('\n')
                                    : ' - Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang';
                                return <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed mt-0.5">{xrayText}</pre>;
                            })()}
                        </div>
                        <hr className="border-gray-100" />
                        {/* Siêu âm */}
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Siêu âm</span>
                            {(() => {
                                const usText = buildUltrasound();
                                if (!usText) {
                                    return <p className="text-xs text-gray-400 italic mt-0.5">Không có</p>;
                                }
                                return <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed mt-0.5">{usText}</pre>;
                            })()}
                        </div>
                        <hr className="border-gray-100" />
                        {/* Điện tim */}
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Điện tim</span>
                            {(() => {
                                const ecgText = buildEcg();
                                if (!ecgText) {
                                    return <p className="text-xs text-gray-400 italic mt-0.5">Không có</p>;
                                }
                                return <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed mt-0.5">{ecgText}</pre>;
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </Dialog>
    );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PatientData, BLOOD_PRESSURE_OPTIONS, EYE_OPTIONS, ENT_OPTIONS, DENTAL_OPTIONS, LIVER_OPTIONS, KIDNEY_OPTIONS, VISION_OPTIONS, CLASSIFICATION_OPTIONS } from '@/types/patient';
import { calculateBMI, getPhysiqueFromBMI } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';

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
}

interface BPReading {
  systolic: string;
  diastolic: string;
}

interface ExamState {
  // Nội khoa
  internalEnabled: boolean;
  bpReadings: BPReading[]; // Hỗ trợ nhiều lần đo
  bpCondition: string;
  bpNote: string;
  // Mắt
  eyeEnabled: boolean;
  visionLeft: string;
  visionRight: string;
  hasGlasses: boolean;
  eyeConditions: string[];
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
  xray: string;
  // Siêu âm - mỗi loại có checkbox riêng
  abdomenEnabled: boolean;
  abdomen: string;
  liver: string;
  kidney: string;
  thyroidEnabled: boolean;
  thyroid: string;
  breastEnabled: boolean;
  breast: string;
  gynecologyEnabled: boolean;
  gynecology: string;
  // Điện tim
  ecgEnabled: boolean;
  heartRate: string;
  ecgNote: string;
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
}: PatientEditorProps) {
  // Basic info
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bmi, setBmi] = useState('');
  const [physique, setPhysique] = useState({ text: '', color: '' });
  const [classification, setClassification] = useState('');

  // Exam state
  const [exam, setExam] = useState<ExamState>({
    internalEnabled: false,
    bpReadings: [{ systolic: '', diastolic: '' }],
    bpCondition: '',
    bpNote: '',
    eyeEnabled: false,
    visionLeft: '10/10',
    visionRight: '10/10',
    hasGlasses: false,
    eyeConditions: [],
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

  // Imaging state
  const [imaging, setImaging] = useState<ImagingState>({
    xrayEnabled: false,
    xray: '',
    abdomenEnabled: false,
    abdomen: 'chưa ghi nhận bất thường',
    liver: '',
    kidney: '',
    thyroidEnabled: false,
    thyroid: 'chưa ghi nhận bất thường',
    breastEnabled: false,
    breast: 'chưa ghi nhận bất thường',
    gynecologyEnabled: false,
    gynecology: 'chưa ghi nhận bất thường',
    ecgEnabled: false,
    heartRate: '',
    ecgNote: '',
  });

  // Parse existing data when patient changes
  useEffect(() => {
    if (patient) {
      // Basic info
      setWeight(String(patient['Cân nặng'] || ''));
      setHeight(String(patient['Chiều cao'] || ''));
      setClassification(String(patient['PHÂN LOẠI SỨC KHỎE'] || ''));

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
      }

      // Parse general exam
      const generalExam = String(patient['KHÁM TỔNG QUÁT'] || '');
      parseGeneralExam(generalExam);

      // Imaging
      const xrayText = String(patient['Xquang'] || '');
      const ultrasoundText = String(patient['Siêu âm'] || '');
      const ecgText = String(patient['Điện tim'] || '');
      
      // Parse ultrasound text to detect which types are enabled
      const hasAbdomen = ultrasoundText.toLowerCase().includes('bụng');
      const hasThyroid = ultrasoundText.toLowerCase().includes('giáp');
      const hasBreast = ultrasoundText.toLowerCase().includes('vú');
      const hasGynecology = ultrasoundText.toLowerCase().includes('phụ khoa');
      
      setImaging({
        xrayEnabled: !!xrayText,
        xray: xrayText,
        abdomenEnabled: hasAbdomen,
        abdomen: 'chưa ghi nhận bất thường',
        liver: '',
        kidney: '',
        thyroidEnabled: hasThyroid,
        thyroid: 'chưa ghi nhận bất thường',
        breastEnabled: hasBreast,
        breast: 'chưa ghi nhận bất thường',
        gynecologyEnabled: hasGynecology,
        gynecology: 'chưa ghi nhận bất thường',
        ecgEnabled: !!ecgText,
        heartRate: '',
        ecgNote: ecgText,
      });
      parseUltrasound(String(patient['Siêu âm'] || ''));
      parseEcg(String(patient['Điện tim'] || ''));
    }
  }, [patient]);

  const parseGeneralExam = (text: string) => {
    const lines = text.split('\n');
    const newExam: ExamState = {
      internalEnabled: false,
      bpReadings: [{ systolic: '', diastolic: '' }],
      bpCondition: '',
      bpNote: '',
      eyeEnabled: false,
      visionLeft: '10/10',
      visionRight: '10/10',
      hasGlasses: false,
      eyeConditions: [],
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

    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      
      // Parse Nội khoa
      if (lowerLine.includes('nội khoa') || lowerLine.includes('ha ') || lowerLine.includes('huyết áp')) {
        newExam.internalEnabled = true;
        // Parse nhiều lần đo: L1 HA 140/90, L2 HA 150/90
        const readings: BPReading[] = [];
        const bpRegex = /L?(\d)?\s*HA\s*(\d+)\/(\d+)/gi;
        let match;
        while ((match = bpRegex.exec(line)) !== null) {
          readings.push({ systolic: match[2], diastolic: match[3] });
        }
        if (readings.length > 0) {
          newExam.bpReadings = readings;
        } else {
          // Fallback: parse single BP
          const bpMatch = line.match(/HA\s*(\d+)\/(\d+)/i);
          if (bpMatch) {
            newExam.bpReadings = [{ systolic: bpMatch[1], diastolic: bpMatch[2] }];
          }
        }
        BLOOD_PRESSURE_OPTIONS.forEach(opt => {
          if (line.toLowerCase().includes(opt.toLowerCase())) newExam.bpCondition = opt;
        });
      }
      
      // Parse Mắt
      if (lowerLine.includes('mắt')) {
        newExam.eyeEnabled = true;
        if (lowerLine.includes('ck ')) newExam.hasGlasses = true;
        const visionMatch = line.match(/mắt\s*\(P\)\s*(\d+\/\d+)/i);
        const visionMatchL = line.match(/mắt\s*\(T\)\s*(\d+\/\d+)/i);
        if (visionMatch) newExam.visionRight = visionMatch[1];
        if (visionMatchL) newExam.visionLeft = visionMatchL[1];
        EYE_OPTIONS.forEach(opt => {
          if (line.toLowerCase().includes(opt.toLowerCase())) {
            if (!newExam.eyeConditions.includes(opt)) newExam.eyeConditions.push(opt);
          }
        });
      }
      
      // Parse TMH
      if (lowerLine.includes('tmh') || lowerLine.includes('amidan') || lowerLine.includes('viêm họng') || lowerLine.includes('viêm mũi')) {
        newExam.entEnabled = true;
        ENT_OPTIONS.forEach(opt => {
          if (line.toLowerCase().includes(opt.toLowerCase())) {
            if (!newExam.entConditions.includes(opt)) newExam.entConditions.push(opt);
          }
        });
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
      }
    });

    setExam(newExam);
  };

  const parseUltrasound = (text: string) => {
    // Parse ultrasound text
    const newImaging = { ...imaging };
    
    LIVER_OPTIONS.forEach(opt => {
      if (text.includes(opt)) newImaging.liver = opt;
    });
    
    KIDNEY_OPTIONS.forEach(opt => {
      if (text.includes(opt)) newImaging.kidney = opt;
    });

    setImaging(prev => ({ ...prev, ...newImaging }));
  };

  const parseEcg = (text: string) => {
    const match = text.match(/Nhịp xoang[:\s]*(\d+)/i);
    if (match) {
      setImaging(prev => ({ ...prev, heartRate: match[1] }));
    }
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

  // Build general exam text - only include enabled sections
  const buildGeneralExam = useCallback((): string => {
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
      if (bp) parts.push(`- Nội khoa: ${bp}`);
    }

    // Mắt
    if (exam.eyeEnabled) {
      const prefix = exam.hasGlasses ? 'CK ' : '';
      let eyeText = `${prefix}mắt (P) ${exam.visionRight}, mắt (T) ${exam.visionLeft}`;
      if (exam.eyeConditions.length > 0) {
        eyeText += `, ${exam.eyeConditions.join(', ')}`;
      }
      if (exam.eyeNote) eyeText += `, ${exam.eyeNote}`;
      parts.push(`- Mắt: ${eyeText}`);
    }

    // TMH
    if (exam.entEnabled) {
      let tmh = exam.entConditions.length > 0 ? exam.entConditions.join(', ') : '';
      if (exam.entNote) tmh += (tmh ? ', ' : '') + exam.entNote;
      if (tmh) parts.push(`- TMH: ${tmh}`);
    }

    // RHM
    if (exam.dentalEnabled) {
      let rhm = `sức nhai ${exam.chewingPower}%`;
      if (exam.dentalConditions.length > 0) {
        rhm += `, ${exam.dentalConditions.join(', ')}`;
      }
      if (exam.dentalNote) rhm += `, ${exam.dentalNote}`;
      parts.push(`- RHM: ${rhm}`);
    }

    // Ngoại khoa
    if (exam.surgeryEnabled && exam.surgery && exam.surgery !== 'Bình thường') {
      parts.push(`- Ngoại khoa: ${exam.surgery}`);
    }

    // Da liễu
    if (exam.dermaEnabled && exam.dermatology && exam.dermatology !== 'Bình thường') {
      parts.push(`- Da liễu: ${exam.dermatology}`);
    }

    return parts.join('\n');
  }, [exam]);

  // Build ultrasound text - only include enabled types
  const buildUltrasound = useCallback((): string => {
    const parts: string[] = [];

    // Bụng
    if (imaging.abdomenEnabled) {
      let abdomenText = imaging.abdomen || 'chưa ghi nhận bất thường';
      if (imaging.liver && imaging.liver !== 'none') abdomenText = imaging.liver;
      if (imaging.kidney && imaging.kidney !== 'none') abdomenText = imaging.kidney;
      if (imaging.liver && imaging.liver !== 'none' && imaging.kidney && imaging.kidney !== 'none') {
        abdomenText = `${imaging.liver}, ${imaging.kidney}`;
      }
      parts.push(`- Siêu âm Bụng: ${abdomenText}`);
    }
    
    if (imaging.thyroidEnabled) {
      parts.push(`- Siêu âm Tuyến giáp: ${imaging.thyroid || 'chưa ghi nhận bất thường'}`);
    }
    if (imaging.breastEnabled) {
      parts.push(`- Siêu âm Tuyến vú: ${imaging.breast || 'chưa ghi nhận bất thường'}`);
    }
    if (imaging.gynecologyEnabled) {
      parts.push(`- Siêu âm Phụ Khoa: ${imaging.gynecology || 'chưa ghi nhận bất thường'}`);
    }

    return parts.join('\n');
  }, [imaging]);

  // Build ECG text - only if enabled
  const buildEcg = useCallback((): string => {
    if (!imaging.ecgEnabled) return '';
    if (imaging.heartRate) {
      return `- Nhịp xoang: ${imaging.heartRate} l/p`;
    }
    return '- Nhịp xoang đều';
  }, [imaging]);

  const buildUpdatedPatient = (): PatientData | null => {
    if (!patient) return null;

    return {
      ...patient,
      'Cân nặng': weight ? parseFloat(weight) : '',
      'Chiều cao': height ? parseFloat(height) : '',
      'BMI': bmi ? parseFloat(bmi) : '',
      'THỂ TRẠNG': physique.text,
      'PHÂN LOẠI SỨC KHỎE': classification,
      'KHÁM TỔNG QUÁT': buildGeneralExam(),
      'Xquang': imaging.xrayEnabled ? imaging.xray : '',
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

        <Tabs defaultValue="vital" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="vital">Thể Lực & Phân Loại</TabsTrigger>
            <TabsTrigger value="exam">Khám Tổng Quát</TabsTrigger>
            <TabsTrigger value="imaging">Cận Lâm Sàng</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            {/* Tab 1: Vital & Classification */}
            <TabsContent value="vital" className="space-y-6 m-0">
              <div className="grid grid-cols-2 gap-6">
                {/* BMI Section */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold text-lg">Tính BMI</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Cân nặng (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="VD: 65"
                      />
                    </div>
                    <div>
                      <Label>Chiều cao (m)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="VD: 1.70"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>BMI</Label>
                      <Input value={bmi} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                      <Label>Thể trạng</Label>
                      <div className={`h-10 flex items-center px-3 border rounded-md bg-gray-50 font-medium ${physique.color}`}>
                        {physique.text || '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Classification Section */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold text-lg">Phân loại sức khỏe</h3>
                  <div className="flex flex-wrap gap-2">
                    {CLASSIFICATION_OPTIONS.map((opt) => (
                      <Button
                        key={opt}
                        variant={classification === opt ? 'default' : 'outline'}
                        onClick={() => setClassification(opt)}
                        className="min-w-[80px]"
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <Label>Kết quả</Label>
                    <Input value={classification} readOnly className="bg-gray-50 font-medium" />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: General Exam */}
            <TabsContent value="exam" className="space-y-4 m-0">
              <div className="grid grid-cols-2 gap-4">
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
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Label>Mắt trái (T)</Label>
                          <Select value={exam.visionLeft} onValueChange={(v) => setExam({ ...exam, visionLeft: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {VISION_OPTIONS.map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label>Mắt phải (P)</Label>
                          <Select value={exam.visionRight} onValueChange={(v) => setExam({ ...exam, visionRight: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {VISION_OPTIONS.map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={exam.hasGlasses}
                          onCheckedChange={(checked) => setExam({ ...exam, hasGlasses: !!checked })}
                        />
                        <span>Có kính (CK)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {EYE_OPTIONS.map((opt) => (
                          <Button
                            key={opt}
                            size="sm"
                            variant={exam.eyeConditions.includes(opt) ? 'default' : 'outline'}
                            onClick={() => toggleArrayItem(exam.eyeConditions, opt, (items) => setExam({ ...exam, eyeConditions: items }))}
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
                      <div>
                        <Label>Sức nhai: {exam.chewingPower}%</Label>
                        <Slider
                          value={[exam.chewingPower]}
                          onValueChange={([v]) => setExam({ ...exam, chewingPower: v })}
                          min={0}
                          max={100}
                          step={5}
                          className="mt-2"
                        />
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
                        <Label>Kết quả</Label>
                        <Input
                          value={imaging.heartRate ? `- Nhịp xoang: ${imaging.heartRate} l/p` : '- Nhịp xoang đều'}
                          readOnly
                          className="bg-gray-50"
                        />
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
                        onClick={() => setImaging({ ...imaging, xray: 'Hình ảnh tim, phổi chưa ghi nhận bất thường trên phim xquang' })}
                      >
                        Đặt mặc định
                      </Button>
                    )}
                  </div>
                  {imaging.xrayEnabled && (
                    <Textarea
                      value={imaging.xray}
                      onChange={(e) => setImaging({ ...imaging, xray: e.target.value })}
                      placeholder="Nhập kết quả X-Quang..."
                      rows={3}
                    />
                  )}
                </div>

                {/* Siêu âm - mỗi loại có checkbox riêng */}
                <div className="col-span-2 p-4 border rounded-lg space-y-4">
                  <h3 className="font-semibold">Siêu âm</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Siêu âm bụng */}
                    <div className={`p-3 border rounded-lg space-y-2 ${imaging.abdomenEnabled ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={imaging.abdomenEnabled}
                          onCheckedChange={(checked) => setImaging({ ...imaging, abdomenEnabled: !!checked })}
                        />
                        <span className="font-medium">Siêu âm Bụng</span>
                      </label>
                      {imaging.abdomenEnabled && (
                        <>
                          <Input
                            value={imaging.abdomen}
                            onChange={(e) => setImaging({ ...imaging, abdomen: e.target.value })}
                            placeholder="chưa ghi nhận bất thường"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={imaging.liver} onValueChange={(v) => setImaging({ ...imaging, liver: v })}>
                              <SelectTrigger><SelectValue placeholder="Gan..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Không có</SelectItem>
                                {LIVER_OPTIONS.map(v => (
                                  <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={imaging.kidney} onValueChange={(v) => setImaging({ ...imaging, kidney: v })}>
                              <SelectTrigger><SelectValue placeholder="Thận..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Không có</SelectItem>
                                {KIDNEY_OPTIONS.map(v => (
                                  <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                        <Input
                          value={imaging.breast}
                          onChange={(e) => setImaging({ ...imaging, breast: e.target.value })}
                          placeholder="chưa ghi nhận bất thường"
                        />
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

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="secondary" onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Lưu
          </Button>
          <Button onClick={handleSaveAndClose} className="gap-2">
            <Save className="h-4 w-4" />
            Lưu & Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

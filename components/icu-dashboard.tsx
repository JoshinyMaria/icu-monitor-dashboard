'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Droplets,
  HeartPulse,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Users,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import FileUpload from '@/components/kokonutui/file-upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PatientSidebar } from '@/components/patient-sidebar/patient-sidebar';
import {
  Model,
  PatientRecord,
  Scenario,
  Vitals,
} from '@/lib/patient-types';
import {
  calculateSensorFusion,
  computeRiskFactors,
  computeRiskScore,
  parseKaggleCsv,
  parseSinglePatientText,
} from '@/lib/patient-parser';
import demoCohortData from '@/public/data/demo-cohort.json';

const initialDemoCohort = demoCohortData as PatientRecord[];

const scenarios: Record<Scenario, { label: string; values: Vitals }> = {
  custom: {
    label: 'Custom / uploaded',
    values: {
      hr: 82,
      spo2: 96,
      temp: 37.1,
      systolic: 112,
      diastolic: 73,
      rr: 18,
      ecg: 0,
    },
  },
  stable: {
    label: 'Stable baseline',
    values: {
      hr: 75,
      spo2: 98,
      temp: 36.8,
      systolic: 120,
      diastolic: 78,
      rr: 16,
      ecg: 0,
    },
  },
  sepsis: {
    label: 'Impending sepsis',
    values: {
      hr: 118,
      spo2: 93,
      temp: 39.2,
      systolic: 85,
      diastolic: 55,
      rr: 26,
      ecg: 0,
    },
  },
  hypoxia: {
    label: 'Acute hypoxia',
    values: {
      hr: 110,
      spo2: 81,
      temp: 37,
      systolic: 105,
      diastolic: 68,
      rr: 32,
      ecg: 0,
    },
  },
  shock: {
    label: 'Cardiogenic shock',
    values: {
      hr: 135,
      spo2: 89,
      temp: 36.2,
      systolic: 70,
      diastolic: 46,
      rr: 28,
      ecg: 1,
    },
  },
};

function VitalCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  color,
  data,
}: {
  label: string;
  value: string | number;
  unit: string;
  delta: string;
  icon: typeof HeartPulse;
  color: string;
  data: number[];
}) {
  const points = data
    .map((n, i) => `${(i / (data.length - 1)) * 100},${32 - n}`)
    .join(' ');
  const gradientId = `spark-${label.replaceAll(' ', '-')}`;

  return (
    <Card className="vital-card relative gap-0 overflow-hidden border-0 bg-white/72 py-0 ring-1 ring-white/80">
      <CardContent className="relative flex min-h-36 flex-col justify-between p-[18px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
            <span
              className="grid size-7 place-items-center rounded-lg"
              style={{ backgroundColor: `${color}18`, color }}
            >
              <Icon className="size-3.5" />
            </span>
            {label}
          </div>
          <span className="text-[11px] font-medium text-emerald-600">
            {delta}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[2rem] font-semibold tracking-[-0.06em] text-slate-900">
              {value}
            </span>
            <span className="ml-1.5 text-xs font-medium text-slate-400">
              {unit}
            </span>
          </div>
          <svg
            aria-hidden="true"
            className="h-9 w-20 overflow-visible"
            viewBox="0 0 100 34"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1">
                <stop stopColor={color} stopOpacity=".12" />
                <stop offset="1" stopColor={color} stopOpacity=".8" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              points={points}
              stroke={`url(#${gradientId})`}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="metric-pill rounded-2xl border border-white/80 bg-white/58 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <ChevronRight className="size-3.5 text-slate-300" />
      </div>
      <div className="font-mono text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{note}</div>
    </div>
  );
}

function ControlSlider({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-mono text-xs font-semibold text-slate-900">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) =>
          onChange(typeof next === 'number' ? next : next[0])
        }
        className="vitals-slider"
      />
    </div>
  );
}

function getInitialPatient(): PatientRecord | null {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('patient');
    if (targetId) {
      const target = initialDemoCohort.find((p) => p.id === targetId);
      if (target) return target;
    }
  }
  return (
    initialDemoCohort.find((p) => p.riskLevel === 'critical') ||
    initialDemoCohort[0] ||
    null
  );
}

export function IcuDashboard() {
  const [model, setModel] = useState<Model>('fusion');
  const [scenario, setScenario] = useState<Scenario>('custom');
  const [cohort, setCohort] = useState<PatientRecord[]>(() => initialDemoCohort);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(
    () => getInitialPatient(),
  );
  const [vitals, setVitals] = useState<Vitals>(
    () => getInitialPatient()?.currentVitals || scenarios.custom.values,
  );
  const [controlsOpen, setControlsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? navigator.onLine : true,
  );

  // Online / Offline monitor
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Synchronize active patient selection with URL query parameter
  const selectPatient = useCallback(
    (p: PatientRecord) => {
      setSelectedPatient(p);
      setVitals(p.currentVitals);
      setScenario('custom');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('patient', p.id);
        window.history.replaceState(null, '', url.toString());
      }
    },
    [],
  );

  // Load demo cohort (from /data/demo-cohort.json or fallback)
  const loadDemoCohort = useCallback(async () => {
    setIsLoadingCohort(true);
    try {
      const res = await fetch('/data/demo-cohort.json');
      if (res.ok) {
        const data = (await res.json()) as PatientRecord[];
        setCohort(data);
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('patient');
        const initial =
          data.find((item) => item.id === targetId) ||
          data.find((item) => item.riskLevel === 'critical') ||
          data[0];
        if (initial) {
          selectPatient(initial);
        }
      } else {
        setCohort(initialDemoCohort);
        if (initialDemoCohort[0]) selectPatient(initialDemoCohort[0]);
      }
    } catch (err) {
      console.error('Failed to load demo cohort:', err);
      setCohort(initialDemoCohort);
      if (initialDemoCohort[0]) selectPatient(initialDemoCohort[0]);
    } finally {
      setIsLoadingCohort(false);
    }
  }, [selectPatient]);

  // Read URL params and verify fresh background fetch without blocking UI
  useEffect(() => {
    let active = true;

    fetch('/data/demo-cohort.json')
      .then((res) => (res.ok ? (res.json() as Promise<PatientRecord[]>) : null))
      .then((data) => {
        if (!active || !data || data.length === 0) return;
        setCohort(data);
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const targetId = params.get('patient');
          const initial =
            data.find((item) => item.id === targetId) ||
            data.find((item) => item.riskLevel === 'critical') ||
            data[0];
          if (initial) {
            selectPatient(initial);
          }
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectPatient]);

  // Derived sensor-fusion calculations
  const dbp = vitals.diastolic;
  const shockIndex = vitals.hr / vitals.systolic;
  const map = (2 * dbp + vitals.systolic) / 3;
  const pulsePressure = vitals.systolic - dbp;
  const risk = computeRiskScore(vitals, model);
  const state = risk >= 70 ? 'critical' : risk >= 30 ? 'moderate' : 'stable';
  const stateLabel =
    state === 'critical'
      ? 'High risk'
      : state === 'moderate'
        ? 'Early warning'
        : 'Patient stable';

  const factors = computeRiskFactors(
    vitals,
    calculateSensorFusion(vitals),
  );

  const chartData = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        time: `${Math.floor(index / 3)
          .toString()
          .padStart(2, '0')}:${((index % 3) * 20).toString().padStart(2, '0')}`,
        heart: Number(
          (
            vitals.hr +
            Math.sin(index * 0.72) * 2.4 +
            Math.cos(index * 0.23) * 1.1
          ).toFixed(1),
        ),
        spo2: Number((vitals.spo2 + Math.cos(index * 0.48) * 0.55).toFixed(1)),
      })),
    [vitals.hr, vitals.spo2],
  );

  // Update vital signs from what-if sliders and sync with active patient
  const updateVital = (key: keyof Vitals, value: number) => {
    setScenario('custom');
    const nextVitals: Vitals = {
      ...vitals,
      [key]: value,
      ...(key === 'systolic' ? { diastolic: Math.round(value * 0.65) } : {}),
    };
    setVitals(nextVitals);

    if (selectedPatient) {
      const derived = calculateSensorFusion(nextVitals);
      const riskScore = computeRiskScore(nextVitals, model);
      const riskLevel =
        riskScore >= 70 ? 'critical' : riskScore >= 30 ? 'moderate' : 'stable';
      const newFactors = computeRiskFactors(nextVitals, derived);

      const updated: PatientRecord = {
        ...selectedPatient,
        currentVitals: nextVitals,
        derived,
        riskScore,
        riskLevel,
        factors: newFactors,
        isModified: true,
      };

      setSelectedPatient(updated);
      setCohort((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    }
  };

  const chooseScenario = (next: Scenario) => {
    setScenario(next);
    const nextVitals = scenarios[next].values;
    setVitals(nextVitals);

    if (selectedPatient) {
      const derived = calculateSensorFusion(nextVitals);
      const riskScore = computeRiskScore(nextVitals, model);
      const riskLevel =
        riskScore >= 70 ? 'critical' : riskScore >= 30 ? 'moderate' : 'stable';
      const newFactors = computeRiskFactors(nextVitals, derived);

      const updated: PatientRecord = {
        ...selectedPatient,
        currentVitals: nextVitals,
        derived,
        riskScore,
        riskLevel,
        factors: newFactors,
        isModified: next !== 'stable',
      };

      setSelectedPatient(updated);
      setCohort((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    }
  };

  // Reset current patient to admission baseline vitals
  const resetPatientToBaseline = useCallback(() => {
    if (!selectedPatient) return;
    const baseline = selectedPatient.baselineVitals;
    const derived = calculateSensorFusion(baseline);
    const riskScore = computeRiskScore(baseline, model);
    const riskLevel =
      riskScore >= 70 ? 'critical' : riskScore >= 30 ? 'moderate' : 'stable';
    const newFactors = computeRiskFactors(baseline, derived);

    const updated: PatientRecord = {
      ...selectedPatient,
      currentVitals: { ...baseline },
      derived,
      riskScore,
      riskLevel,
      factors: newFactors,
      isModified: false,
    };

    setSelectedPatient(updated);
    setVitals({ ...baseline });
    setScenario('custom');
    setCohort((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  }, [selectedPatient, model]);

  // Model selection handler that synchronizes scores across active view & roster
  const handleModelChange = (nextModel: Model) => {
    setModel(nextModel);
    if (selectedPatient) {
      const derived = calculateSensorFusion(vitals);
      const riskScore = computeRiskScore(vitals, nextModel);
      const riskLevel =
        riskScore >= 70 ? 'critical' : riskScore >= 30 ? 'moderate' : 'stable';
      const newFactors = computeRiskFactors(vitals, derived);
      setSelectedPatient((curr) =>
        curr
          ? {
              ...curr,
              riskScore,
              riskLevel,
              factors: newFactors,
            }
          : null,
      );
    }
    setCohort((prev) =>
      prev.map((p) => {
        const derived = calculateSensorFusion(p.currentVitals);
        const score = computeRiskScore(p.currentVitals, nextModel);
        const level =
          score >= 70 ? 'critical' : score >= 30 ? 'moderate' : 'stable';
        const f = computeRiskFactors(p.currentVitals, derived);
        return {
          ...p,
          riskScore: score,
          riskLevel: level,
          factors: f,
        };
      }),
    );
  };

  // Previous & Next cycling
  const cyclePatient = useCallback(
    (direction: 'prev' | 'next') => {
      if (cohort.length === 0) return;
      const currentIndex = selectedPatient
        ? cohort.findIndex((p) => p.id === selectedPatient.id)
        : 0;
      const nextIndex =
        direction === 'next'
          ? (currentIndex + 1) % cohort.length
          : (currentIndex - 1 + cohort.length) % cohort.length;
      selectPatient(cohort[nextIndex]);
    },
    [cohort, selectedPatient, selectPatient],
  );

  // Jump to next critical patient (Rapid triage jump)
  const jumpToNextCritical = useCallback(() => {
    if (cohort.length === 0) return;
    const currentIndex = selectedPatient
      ? cohort.findIndex((p) => p.id === selectedPatient.id)
      : -1;
    const criticalIndices = cohort
      .map((p, idx) => ({ p, idx }))
      .filter((x) => x.p.riskLevel === 'critical');

    if (criticalIndices.length === 0) return;

    const nextCritical =
      criticalIndices.find((x) => x.idx > currentIndex) || criticalIndices[0];
    selectPatient(nextCritical.p);
  }, [cohort, selectedPatient, selectPatient]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === '[' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        cyclePatient('prev');
      } else if (e.key === ']' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        cyclePatient('next');
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        jumpToNextCritical();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cyclePatient, jumpToNextCritical]);

  const comparison: Array<[string, number, number]> = [
    ['Accuracy', 92.2, 99.8],
    ['Precision', 94.4, 99.88],
    ['Recall', 96.42, 99.88],
    ['ROC-AUC', 96.78, 99.99],
  ];

  // Ingest Kaggle CSV or plain-text record
  const handlePatientFile = async (file: File) => {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.csv')) {
      const records = parseKaggleCsv(text, file.name);
      if (records.length > 0) {
        setCohort(records);
        selectPatient(records[0]);
        setFileName(file.name);
      }
    } else {
      const record = parseSinglePatientText(text, file.name);
      setCohort((prev) => [
        record,
        ...prev.filter((p) => p.id !== record.id),
      ]);
      selectPatient(record);
      setFileName(file.name);
    }
  };

  // Full-page empty state when cohort is completely empty
  if (!selectedPatient && cohort.length === 0) {
    return (
      <main className="empty-state relative grid min-h-screen place-items-center overflow-hidden bg-[#f6f8fd] px-4 py-20 text-slate-900">
        <div className="ambient ambient-pink" />
        <div className="ambient ambient-blue" />
        <div className="absolute left-5 top-5 flex items-center gap-3 md:left-8 md:top-7">
          <div className="brand-orb grid size-10 place-items-center rounded-[14px] text-white shadow-lg shadow-pink-200/50">
            <HeartPulse className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">
              ICU AI Monitor
            </div>
            <div className="text-[11px] text-slate-400">
              Simulation environment
            </div>
          </div>
        </div>

        <section className="relative z-10 grid w-full max-w-4xl gap-4 rounded-[30px] border border-white/80 bg-white/58 p-5 shadow-[0_28px_80px_rgba(60,75,115,.11)] backdrop-blur-2xl md:grid-cols-[1fr_1.1fr] md:p-7">
          <div className="flex flex-col justify-center p-2 md:p-5">
            <Badge
              variant="outline"
              className="mb-5 w-fit border-pink-200/70 bg-white/60 text-pink-600"
            >
              <Sparkles /> Patient workspace
            </Badge>
            <h1 className="max-w-md text-3xl font-semibold tracking-[-0.055em] text-slate-900 md:text-[2.6rem] md:leading-[1.08]">
              ICU Deterioration Intelligence.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-6 text-slate-500">
              Load a multi-patient Kaggle dataset, drop a plain-text medical record,
              or explore the pre-trained ICU demo cohort.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                onClick={() => void loadDemoCohort()}
                className="spectral-button rounded-xl text-white shadow-md shadow-pink-200/50"
              >
                <Sparkles className="size-4" /> Load Kaggle Demo Cohort
              </Button>
            </div>

            <div className="mt-7 rounded-2xl border border-white/80 bg-white/56 p-4 font-mono text-[11px] leading-5 text-slate-500">
              <div className="mb-2 font-sans text-xs font-semibold text-slate-700">
                Supported formats
              </div>
              <div>• Kaggle CSV: icu_patient_dataset.csv</div>
              <div>• Patient TXT: Key-value clinical note</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/90 bg-white/68 p-4 shadow-[inset_0_1px_0_white,0_16px_38px_rgba(68,82,122,.07)]">
            <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
              <CloudUpload className="size-4 text-cyan-500" /> Upload medical records
            </div>
            <FileUpload
              className="patient-upload empty-upload max-w-none"
              acceptedFileTypes={['text/plain', 'text/csv', '.csv', '.txt']}
              maxFileSize={10 * 1024 * 1024}
              uploadDelay={500}
              onUploadSuccess={(file) => void handlePatientFile(file)}
            />
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="size-3.5 text-emerald-500" /> Processed
              locally for this demonstration
            </div>
          </div>
        </section>

        <p className="absolute bottom-5 text-center text-[11px] text-slate-400">
          Proof of concept · Kaggle synthetic ICU evaluation · Not clinically validated
        </p>
      </main>
    );
  }

  const currentPatientIndex = selectedPatient
    ? cohort.findIndex((p) => p.id === selectedPatient.id)
    : 0;

  return (
    <main className="min-h-screen bg-[#f6f8fd] text-slate-900">
      <div className="ambient ambient-pink" />
      <div className="ambient ambient-blue" />

      {/* Desktop SaaS Left Sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <PatientSidebar
          cohort={cohort}
          selectedPatient={selectedPatient}
          onSelectPatient={selectPatient}
          onCyclePatient={cyclePatient}
          onJumpCritical={jumpToNextCritical}
          isLoading={isLoadingCohort}
          onFileUpload={handlePatientFile}
          onLoadDemoCohort={loadDemoCohort}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Off-canvas Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[320px] max-w-[85vw] p-0 border-0 bg-transparent shadow-2xl"
        >
          <PatientSidebar
            cohort={cohort}
            selectedPatient={selectedPatient}
            onSelectPatient={(p) => {
              selectPatient(p);
              setMobileSidebarOpen(false);
            }}
            onCyclePatient={cyclePatient}
            onJumpCritical={jumpToNextCritical}
            isLoading={isLoadingCohort}
            onFileUpload={(file) => {
              void handlePatientFile(file);
              setMobileSidebarOpen(false);
            }}
            onLoadDemoCohort={loadDemoCohort}
            isCollapsed={false}
          />
        </SheetContent>
      </Sheet>

      {/* Main Fluid Bedside View */}
      <div
        className={cn(
          'relative transition-[padding] duration-300',
          isSidebarCollapsed
            ? 'lg:pl-[72px]'
            : 'lg:pl-[310px] xl:pl-[330px]',
        )}
      >
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-white/70 bg-[#f8faff]/72 px-4 backdrop-blur-2xl md:px-7">
          <div className="flex items-center gap-3">
            {/* Mobile Roster Sheet Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open patient roster"
            >
              <Users className="size-4" />
            </Button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-[-0.03em]">
                  ICU AI Monitor
                </h1>
                <Badge
                  variant="outline"
                  className="border-pink-200/70 bg-white/60 text-[10px] text-pink-600"
                >
                  <Sparkles className="size-2.5" /> AI monitor
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Deterioration intelligence · Simulation environment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Online / Sensor Hub Status Pill */}
            {isOnline ? (
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Sensor hub online
              </div>
            ) : (
              <div className="hidden items-center gap-2 rounded-full border border-amber-200/60 bg-amber-50/70 px-3 py-1.5 text-xs font-medium text-amber-700 sm:flex">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Offline · Local cohort
              </div>
            )}

            {/* Quick Header Patient Cycler (convenient on smaller screens) */}
            {cohort.length > 1 && (
              <div className="flex items-center rounded-xl border border-white bg-white/70 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => cyclePatient('prev')}
                  className="size-7 rounded-lg text-slate-500 hover:text-slate-900"
                  title="Previous patient ( [ )"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 font-mono text-xs font-medium text-slate-600">
                  {currentPatientIndex + 1}/{cohort.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => cyclePatient('next')}
                  className="size-7 rounded-lg text-slate-500 hover:text-slate-900"
                  title="Next patient ( ] )"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}

            {/* Simulation controls toggle */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl border-white bg-white/70 lg:hidden"
              onClick={() => setControlsOpen(true)}
              title="Simulation controls"
            >
              <Settings2 className="size-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="relative rounded-xl border-white bg-white/70"
              aria-label="Alerts"
            >
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-pink-500" />
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-6">
          {/* Patient Overview Card */}
          {selectedPatient && (
            <section className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-pink-100 font-mono text-sm font-bold text-slate-700 shadow-sm">
                  {selectedPatient.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold tracking-tight text-slate-900">
                      {selectedPatient.name}
                    </h2>
                    <span className="text-xs text-slate-400">
                      {selectedPatient.unit} · {selectedPatient.bed}
                    </span>
                    {selectedPatient.isModified && (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="border-violet-200 bg-violet-50 text-[10px] text-violet-700"
                        >
                          What-if modified
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetPatientToBaseline}
                          className="h-5 rounded-md px-1.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100 hover:text-violet-900"
                          title="Reset this patient to admission baseline vitals"
                        >
                          <RotateCcw className="mr-1 size-2.5" />
                          Reset
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {selectedPatient.id} · {selectedPatient.age} years · Admitted{' '}
                    {selectedPatient.admitted}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="h-7 border-white bg-white/70 px-2.5 text-slate-500"
                >
                  <Radio className="text-cyan-500 size-3 mr-1" /> Live Bedside
                </Badge>
                <Button
                  variant="outline"
                  className="h-8 rounded-xl border-white bg-white/70 px-3 text-xs"
                  onClick={() => setControlsOpen(true)}
                >
                  <Settings2 className="size-3.5 mr-1" /> Simulation controls
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 rounded-xl px-3 text-xs text-slate-500 hover:bg-white/60"
                  onClick={() => {
                    setCohort([]);
                    setSelectedPatient(null);
                    setFileName(null);
                    setControlsOpen(false);
                  }}
                >
                  Unload all
                </Button>
              </div>
            </section>
          )}

          {/* Vitals Summary Grid */}
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <VitalCard
              label="Heart rate"
              value={vitals.hr}
              unit="bpm"
              delta={vitals.hr <= 100 ? 'In range' : 'Elevated'}
              icon={HeartPulse}
              color="#ff5f91"
              data={[16, 14, 18, 12, 17, 11, 20, 15, 17, 9, 21, 13, 17]}
            />
            <VitalCard
              label="Oxygen saturation"
              value={vitals.spo2}
              unit="%"
              delta={vitals.spo2 >= 95 ? 'Optimal' : 'Below range'}
              icon={Droplets}
              color="#4bbfea"
              data={[12, 13, 12, 12, 14, 13, 15, 13, 14, 12, 15, 14, 13]}
            />
            <VitalCard
              label="Blood pressure"
              value={`${vitals.systolic}/${dbp}`}
              unit="mmHg"
              delta={map >= 65 ? 'Perfusing' : 'MAP low'}
              icon={Waves}
              color="#8e83fa"
              data={[18, 16, 17, 15, 16, 14, 18, 13, 16, 15, 17, 14, 16]}
            />
            <VitalCard
              label="Temperature"
              value={vitals.temp.toFixed(1)}
              unit="°C"
              delta={vitals.temp <= 37.5 ? 'Normal' : 'Elevated'}
              icon={Thermometer}
              color="#ff8d6b"
              data={[18, 18, 17, 16, 16, 15, 15, 14, 13, 13, 12, 12, 11]}
            />
          </section>

          {/* Mid Section: Bedside Waveform & AI Deterioration Gauge */}
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,.75fr)]">
            <Card className="glass-panel gap-0 border-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between px-5 pb-0 pt-5">
                <div>
                  <CardTitle className="text-[15px] font-semibold">
                    Live bedside stream
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-400">
                    12-minute rolling simulation · values refresh with controls
                  </p>
                </div>
                <div className="hidden items-center gap-3 text-[11px] font-medium text-slate-400 sm:flex">
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-pink-500" /> Heart rate
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-cyan-400" /> SpO₂
                  </span>
                </div>
              </CardHeader>
              <CardContent className="h-[310px] px-1 pb-2 pt-5 sm:px-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="heartFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0"
                          stopColor="#ff5f91"
                          stopOpacity={0.22}
                        />
                        <stop offset="1" stopColor="#ff5f91" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="spoFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0"
                          stopColor="#56c9f5"
                          stopOpacity={0.18}
                        />
                        <stop offset="1" stopColor="#56c9f5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(95,112,145,.09)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9aa4b6', fontSize: 10 }}
                      interval={5}
                    />
                    <YAxis
                      yAxisId="heart"
                      domain={['dataMin - 8', 'dataMax + 8']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9aa4b6', fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="spo"
                      orientation="right"
                      domain={[70, 100]}
                      hide
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: '1px solid rgba(100,115,145,.12)',
                        background: 'rgba(255,255,255,.92)',
                        boxShadow: '0 10px 30px rgba(40,55,90,.12)',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      yAxisId="heart"
                      type="monotone"
                      dataKey="heart"
                      name="Heart rate"
                      stroke="#ff5f91"
                      strokeWidth={2.4}
                      fill="url(#heartFill)"
                      isAnimationActive
                    />
                    <Area
                      yAxisId="spo"
                      type="monotone"
                      dataKey="spo2"
                      name="SpO₂"
                      stroke="#56c9f5"
                      strokeWidth={2.2}
                      fill="url(#spoFill)"
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <CardSpotlight
              color="rgba(255, 108, 172, 0.2)"
              radius={420}
              className={cn(
                'risk-card relative min-h-[382px] overflow-hidden rounded-[24px] border-0 bg-white/80 p-0 text-slate-900 shadow-[0_18px_50px_rgba(70,80,120,.11)]',
                state,
              )}
            >
              <div className="relative z-10 flex h-full flex-col p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <BrainCircuit className="size-4 text-violet-500" /> AI
                      risk assessment
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {model === 'fusion'
                        ? 'XGBoost · Sensor fusion'
                        : 'Logistic Regression · Raw vitals'}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      'border-0',
                      state === 'stable' && 'bg-emerald-50 text-emerald-700',
                      state === 'moderate' && 'bg-amber-50 text-amber-700',
                      state === 'critical' && 'bg-rose-50 text-rose-700',
                    )}
                  >
                    {stateLabel}
                  </Badge>
                </div>
                <div className="relative mx-auto my-4 grid size-[176px] place-items-center">
                  <div className="risk-halo absolute inset-3 rounded-full" />
                  <svg
                    className="absolute inset-0 -rotate-90"
                    viewBox="0 0 180 180"
                    aria-hidden="true"
                  >
                    <circle
                      cx="90"
                      cy="90"
                      r="76"
                      fill="none"
                      stroke="rgba(119,132,162,.1)"
                      strokeWidth="10"
                    />
                    <circle
                      className="risk-ring"
                      cx="90"
                      cy="90"
                      r="76"
                      fill="none"
                      strokeLinecap="round"
                      strokeWidth="10"
                      strokeDasharray={`${risk * 4.775} 477.5`}
                    />
                  </svg>
                  <div className="relative text-center">
                    <div className="font-mono text-[3rem] font-semibold leading-none tracking-[-0.08em]">
                      {risk}
                      <span className="ml-1 text-lg text-slate-400">%</span>
                    </div>
                    <div className="mt-2 text-[11px] font-medium uppercase tracking-[.14em] text-slate-400">
                      Deterioration risk
                    </div>
                  </div>
                </div>
                <div className="mt-auto rounded-2xl border border-white/80 bg-white/64 p-3.5 backdrop-blur-xl">
                  {factors.length ? (
                    <div className="space-y-2">
                      {factors.slice(0, 3).map((factor) => (
                        <div
                          key={factor}
                          className="flex items-center gap-2 text-xs font-medium text-slate-600"
                        >
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          {factor}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                      <ShieldCheck className="size-4" /> No active deterioration
                      markers
                    </div>
                  )}
                </div>
              </div>
            </CardSpotlight>
          </section>

          {/* Derived Indicators */}
          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricPill
              label="Shock Index"
              value={shockIndex.toFixed(2)}
              note="Heart rate ÷ systolic BP"
            />
            <MetricPill
              label="Mean arterial pressure"
              value={`${map.toFixed(0)} mmHg`}
              note={
                map >= 65
                  ? 'Above perfusion threshold'
                  : 'Below 65 mmHg threshold'
              }
            />
            <MetricPill
              label="Pulse pressure"
              value={`${pulsePressure} mmHg`}
              note="Systolic BP − diastolic BP"
            />
          </section>

          {/* Bottom Section: Performance Benchmark & Record Ingestion */}
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,.7fr)]">
            <Card className="glass-panel border-0 py-0">
              <CardHeader className="border-b border-slate-100/70 px-5 py-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle className="text-[15px]">
                      Algorithm performance
                    </CardTitle>
                    <p className="mt-1 text-xs text-slate-400">
                      Evaluation on 5,000 synthetic patient records
                    </p>
                  </div>
                  <Tabs
                    value={model}
                    onValueChange={(value) => handleModelChange(value as Model)}
                  >
                    <TabsList className="h-9 rounded-xl bg-slate-100/80 p-1">
                      <TabsTrigger
                        value="fusion"
                        className="rounded-lg px-3 text-xs data-active:bg-white data-active:shadow-sm"
                      >
                        <Sparkles className="size-3 mr-1" /> Sensor fusion
                      </TabsTrigger>
                      <TabsTrigger
                        value="baseline"
                        className="rounded-lg px-3 text-xs data-active:bg-white data-active:shadow-sm"
                      >
                        Baseline
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  {comparison.map(([label, baseline, fusion]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[82px_1fr_1fr] items-center gap-3 text-xs"
                    >
                      <span className="font-medium text-slate-500">
                        {label}
                      </span>
                      <div>
                        <div className="mb-1.5 flex justify-between text-[11px] text-slate-400">
                          <span>Baseline</span>
                          <b className="font-mono text-slate-600">
                            {baseline}%
                          </b>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-300"
                            style={{ width: `${baseline}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 flex justify-between text-[11px] text-slate-400">
                          <span>Fusion</span>
                          <b className="font-mono text-violet-600">{fusion}%</b>
                        </div>
                        <div className="h-1.5 rounded-full bg-violet-50">
                          <div
                            className="spectral-bar h-full rounded-full"
                            style={{ width: `${fusion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50/60 p-3 text-[11px] leading-relaxed text-blue-700">
                  <Zap className="mt-0.5 size-3.5 shrink-0" /> Prototype results
                  are derived from rule-labelled synthetic data and are not
                  clinical validation.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-panel border-0 py-0">
              <CardHeader className="px-5 pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <CloudUpload className="size-4 text-cyan-500" /> Ingest patient
                  records
                </CardTitle>
                <p className="text-xs text-slate-400">
                  Upload multi-patient Kaggle CSV or individual TXT charts
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <FileUpload
                  className="patient-upload max-w-none"
                  acceptedFileTypes={['text/plain', 'text/csv', '.csv', '.txt']}
                  maxFileSize={10 * 1024 * 1024}
                  uploadDelay={400}
                  onUploadSuccess={(file) => void handlePatientFile(file)}
                />
                {fileName && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="size-4" /> {fileName} active in roster
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* Right Drawer: Simulation Controls */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition',
          controlsOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!controlsOpen}
      >
        <button
          type="button"
          aria-label="Close simulation controls"
          onClick={() => setControlsOpen(false)}
          className={cn(
            'absolute inset-0 bg-slate-900/16 backdrop-blur-sm transition-opacity',
            controlsOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <aside
          className={cn(
            'absolute inset-y-0 right-0 w-full max-w-[430px] overflow-y-auto border-l border-white/80 bg-[#f8faff]/92 p-5 shadow-2xl backdrop-blur-3xl transition-transform duration-300',
            controlsOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Simulation controls
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Explore how vital changes affect risk
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedPatient?.isModified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetPatientToBaseline}
                  className="h-8 rounded-xl border-violet-200 bg-violet-50/80 px-2.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                  title="Reset active patient to baseline vitals"
                >
                  <RotateCcw className="mr-1 size-3" />
                  Reset vitals
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setControlsOpen(false)}
                aria-label="Close controls"
              >
                <X />
              </Button>
            </div>
          </div>
          <div className="mb-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
              Clinical scenario
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(scenarios) as Scenario[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseScenario(key)}
                  className={cn(
                    'rounded-xl border border-white bg-white/60 px-3 py-2.5 text-left text-xs font-medium text-slate-500 transition hover:bg-white',
                    scenario === key && 'scenario-active text-slate-900',
                  )}
                >
                  {scenarios[key].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-5 rounded-2xl border border-white/80 bg-white/64 p-[18px]">
            <ControlSlider
              label="Heart rate"
              value={vitals.hr}
              unit=" bpm"
              min={40}
              max={180}
              onChange={(value) => updateVital('hr', value)}
            />
            <ControlSlider
              label="Oxygen saturation"
              value={vitals.spo2}
              unit="%"
              min={70}
              max={100}
              onChange={(value) => updateVital('spo2', value)}
            />
            <ControlSlider
              label="Temperature"
              value={vitals.temp}
              unit="°C"
              min={35}
              max={41}
              step={0.1}
              onChange={(value) =>
                updateVital('temp', Number(value.toFixed(1)))
              }
            />
            <ControlSlider
              label="Systolic pressure"
              value={vitals.systolic}
              unit=" mmHg"
              min={60}
              max={180}
              onChange={(value) => updateVital('systolic', value)}
            />
            <ControlSlider
              label="Respiratory rate"
              value={vitals.rr}
              unit="/min"
              min={8}
              max={40}
              onChange={(value) => updateVital('rr', value)}
            />
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Wind className="size-4 text-violet-500" /> ECG rhythm
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => updateVital('ecg', 0)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium',
                    vitals.ecg === 0 && 'bg-white text-emerald-700 shadow-sm',
                  )}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => updateVital('ecg', 1)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium',
                    vitals.ecg === 1 && 'bg-white text-rose-600 shadow-sm',
                  )}
                >
                  Arrhythmia
                </button>
              </div>
            </div>
          </div>
          <Button
            className="spectral-button mt-5 h-11 w-full rounded-xl text-white"
            onClick={() => setControlsOpen(false)}
          >
            Apply simulation <ChevronRight />
          </Button>
        </aside>
      </div>
    </main>
  );
}

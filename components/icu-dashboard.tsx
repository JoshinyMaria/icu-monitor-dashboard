'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  BrainCircuit,
  ChevronRight,
  CircleUserRound,
  CloudUpload,
  Droplets,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Thermometer,
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
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Model = 'fusion' | 'baseline';
type Scenario = 'custom' | 'stable' | 'sepsis' | 'hypoxia' | 'shock';

type Vitals = {
  hr: number;
  spo2: number;
  temp: number;
  systolic: number;
  diastolic: number;
  rr: number;
  ecg: number;
};

type Patient = {
  name: string;
  id: string;
  age: string;
  unit: string;
  bed: string;
  admitted: string;
  fileName: string;
};

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

const navItems = [
  { label: 'Monitor', icon: LayoutDashboard, active: true },
  { label: 'Patients', icon: Stethoscope },
  { label: 'Analytics', icon: Activity },
  { label: 'Alerts', icon: Bell },
];

function riskFromVitals(v: Vitals, model: Model) {
  const shockIndex = v.hr / v.systolic;
  const map = (2 * v.diastolic + v.systolic) / 3;
  let score = model === 'fusion' ? 8 : 12;

  score += Math.max(0, 94 - v.spo2) * (model === 'fusion' ? 5.2 : 3.6);
  score += Math.max(0, shockIndex - 0.72) * (model === 'fusion' ? 72 : 46);
  score += Math.max(0, 70 - map) * (model === 'fusion' ? 1.25 : 0.7);
  score += Math.max(0, v.temp - 37.5) * (model === 'fusion' ? 8 : 5);
  score += Math.max(0, v.rr - 20) * (model === 'fusion' ? 2.6 : 1.7);
  score += v.ecg * (model === 'fusion' ? 10 : 7);
  return Math.max(2, Math.min(98, Math.round(score)));
}

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

function parsePatientText(text: string, fileName: string) {
  const entries = new Map<string, string>();

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/);
    if (!match) continue;
    const key = match[1]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    entries.set(key, match[2].trim());
  }

  const get = (...aliases: string[]) => {
    for (const alias of aliases) {
      const value = entries.get(alias);
      if (value) return value;
    }
    return undefined;
  };
  const number = (fallback: number, ...aliases: string[]) => {
    const raw = get(...aliases);
    if (!raw) return fallback;
    const value = Number.parseFloat(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(value) ? value : fallback;
  };
  const rhythm = get('ecg arrhythmia', 'arrhythmia', 'ecg rhythm', 'ecg');
  const systolic = number(
    120,
    'systolic bp',
    'systolic blood pressure',
    'systolic',
    'sbp',
  );
  const diastolic = number(
    Math.round(systolic * 0.65),
    'diastolic bp',
    'diastolic blood pressure',
    'diastolic',
    'dbp',
  );

  return {
    patient: {
      name:
        get('patient name', 'name', 'patient') ??
        fileName.replace(/\.txt$/i, ''),
      id: get('patient id', 'record id', 'ehr', 'id') ?? 'Not provided',
      age: get('age', 'patient age') ?? 'Not provided',
      unit: get('unit', 'ward', 'icu') ?? 'ICU',
      bed: get('bed', 'bed number') ?? '—',
      admitted:
        get('admitted', 'admission date', 'date admitted') ?? 'Not provided',
      fileName,
    } satisfies Patient,
    vitals: {
      hr: number(75, 'heart rate', 'heart rate bpm', 'hr', 'pulse'),
      spo2: number(98, 'spo2', 'oxygen saturation', 'oxygen level'),
      temp: number(36.8, 'temperature', 'body temperature', 'temp'),
      systolic,
      diastolic,
      rr: number(16, 'respiratory rate', 'respiration rate', 'rr'),
      ecg:
        rhythm && /arrhythm|abnormal|detected|yes|true|\b1\b/i.test(rhythm)
          ? 1
          : 0,
    } satisfies Vitals,
  };
}

export function IcuDashboard() {
  const [model, setModel] = useState<Model>('fusion');
  const [scenario, setScenario] = useState<Scenario>('custom');
  const [vitals, setVitals] = useState<Vitals>(scenarios.custom.values);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const dbp = vitals.diastolic;
  const shockIndex = vitals.hr / vitals.systolic;
  const map = (2 * dbp + vitals.systolic) / 3;
  const pulsePressure = vitals.systolic - dbp;
  const risk = riskFromVitals(vitals, model);
  const state = risk >= 70 ? 'critical' : risk >= 30 ? 'moderate' : 'stable';
  const stateLabel =
    state === 'critical'
      ? 'High risk'
      : state === 'moderate'
        ? 'Early warning'
        : 'Patient stable';

  const factors = [
    shockIndex > 0.9 && `Elevated Shock Index (${shockIndex.toFixed(2)})`,
    map < 65 && `Low MAP (${map.toFixed(0)} mmHg)`,
    vitals.spo2 < 90 && `Hypoxemia (${vitals.spo2}% SpO₂)`,
    vitals.temp > 38.3 && `High temperature (${vitals.temp.toFixed(1)}°C)`,
    vitals.rr > 24 && `Rapid respiration (${vitals.rr}/min)`,
    vitals.ecg === 1 && 'Arrhythmia detected',
  ].filter(Boolean) as string[];

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

  const updateVital = (key: keyof Vitals, value: number) => {
    setScenario('custom');
    setVitals((current) => ({
      ...current,
      [key]: value,
      ...(key === 'systolic' ? { diastolic: Math.round(value * 0.65) } : {}),
    }));
  };

  const chooseScenario = (next: Scenario) => {
    setScenario(next);
    setVitals(scenarios[next].values);
  };

  const comparison: Array<[string, number, number]> = [
    ['Accuracy', 92.2, 99.8],
    ['Precision', 94.4, 99.88],
    ['Recall', 96.42, 99.88],
    ['ROC-AUC', 96.78, 99.99],
  ];

  const handlePatientFile = async (file: File) => {
    const parsed = parsePatientText(await file.text(), file.name);
    setPatient(parsed.patient);
    setVitals(parsed.vitals);
    setScenario('custom');
    setFileName(file.name);
  };

  if (!patient) {
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
              Start with a patient medical record.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-6 text-slate-500">
              Drop a plain-text record to populate identity, vitals,
              sensor-fusion indicators, and the deterioration risk dashboard.
            </p>
            <div className="mt-7 rounded-2xl border border-white/80 bg-white/56 p-4 font-mono text-[11px] leading-5 text-slate-500">
              <div className="mb-2 font-sans text-xs font-semibold text-slate-700">
                Accepted format
              </div>
              <div>Patient Name: Aarav Rao</div>
              <div>Patient ID: EHR-9041</div>
              <div>Age: 54</div>
              <div>Heart Rate: 82</div>
              <div>SpO2: 96</div>
              <div>Temperature: 37.1</div>
              <div>Systolic BP: 112</div>
              <div>Diastolic BP: 73</div>
              <div>Respiratory Rate: 18</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/90 bg-white/68 p-4 shadow-[inset_0_1px_0_white,0_16px_38px_rgba(68,82,122,.07)]">
            <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
              <CloudUpload className="size-4 text-cyan-500" /> Upload medical
              information
            </div>
            <FileUpload
              className="patient-upload empty-upload max-w-none"
              acceptedFileTypes={['text/plain']}
              maxFileSize={2 * 1024 * 1024}
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
          Proof of concept · Not clinically validated
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fd] text-slate-900">
      <div className="ambient ambient-pink" />
      <div className="ambient ambient-blue" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-white/70 bg-white/58 py-5 backdrop-blur-2xl lg:flex">
        <div className="brand-orb mb-8 grid size-10 place-items-center rounded-[14px] text-white shadow-lg shadow-pink-200/50">
          <HeartPulse className="size-5" />
        </div>
        <nav
          className="flex flex-1 flex-col gap-2"
          aria-label="Main navigation"
        >
          {navItems.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              className={cn(
                'nav-button group relative grid size-11 place-items-center rounded-[14px] text-slate-400 transition',
                active && 'active text-slate-900',
              )}
            >
              <Icon className="size-[18px]" />
              <span className="pointer-events-none absolute left-14 z-50 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                {label}
              </span>
            </button>
          ))}
        </nav>
        <button
          type="button"
          aria-label="Settings"
          className="nav-button grid size-11 place-items-center rounded-[14px] text-slate-400"
        >
          <Settings2 className="size-[18px]" />
        </button>
        <div className="mt-4 grid size-10 place-items-center rounded-full bg-gradient-to-br from-pink-100 to-blue-100 text-slate-600">
          <CircleUserRound className="size-5" />
        </div>
      </aside>

      <div className="relative lg:pl-[76px]">
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-white/70 bg-[#f8faff]/72 px-4 backdrop-blur-2xl md:px-7">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setControlsOpen(true)}
            >
              <Menu />
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
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />{' '}
              Sensor hub online
            </div>
            <Button
              variant="outline"
              size="icon"
              className="relative rounded-xl border-white bg-white/70"
            >
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-pink-500" />
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-6">
          <section className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-pink-100 font-mono text-sm font-bold text-slate-700">
                {patient.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold tracking-tight">
                    {patient.name}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {patient.unit}
                    {patient.bed === '—'
                      ? ' · Bed not provided'
                      : ` · Bed ${patient.bed}`}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {patient.id} · {patient.age} years · Admitted{' '}
                  {patient.admitted}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="h-7 border-white bg-white/70 px-2.5 text-slate-500"
              >
                <Radio className="text-cyan-500" /> Updated now
              </Badge>
              <Button
                variant="outline"
                className="h-8 rounded-xl border-white bg-white/70 px-3 text-xs"
                onClick={() => setControlsOpen(true)}
              >
                <Settings2 /> Simulation controls
              </Button>
              <Button
                variant="ghost"
                className="h-8 rounded-xl px-3 text-xs text-slate-500"
                onClick={() => {
                  setPatient(null);
                  setFileName(null);
                  setControlsOpen(false);
                }}
              >
                Unload record
              </Button>
            </div>
          </section>

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
                    onValueChange={(value) => setModel(value as Model)}
                  >
                    <TabsList className="h-9 rounded-xl bg-slate-100/80 p-1">
                      <TabsTrigger
                        value="fusion"
                        className="rounded-lg px-3 text-xs data-active:bg-white data-active:shadow-sm"
                      >
                        <Sparkles /> Sensor fusion
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
                  <CloudUpload className="size-4 text-cyan-500" /> Loaded
                  patient record
                </CardTitle>
                <p className="text-xs text-slate-400">
                  Replace the current record with another TXT file
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <FileUpload
                  className="patient-upload max-w-none"
                  acceptedFileTypes={['text/plain']}
                  maxFileSize={2 * 1024 * 1024}
                  uploadDelay={650}
                  onUploadSuccess={(file) => void handlePatientFile(file)}
                />
                {fileName && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="size-4" /> {fileName} is active
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setControlsOpen(false)}
            >
              <X />
            </Button>
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

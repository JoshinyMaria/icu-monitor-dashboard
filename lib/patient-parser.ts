import {
  DerivedMetrics,
  Model,
  PatientRecord,
  Vitals,
} from './patient-types';

export function calculateSensorFusion(v: Vitals): DerivedMetrics {
  const shockIndex = Number((v.hr / v.systolic).toFixed(2));
  const map = Number(((2 * v.diastolic + v.systolic) / 3).toFixed(1));
  const pulsePressure = v.systolic - v.diastolic;
  return { shockIndex, map, pulsePressure };
}

export function computeRiskScore(v: Vitals, model: Model = 'fusion'): number {
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

export function computeRiskFactors(
  v: Vitals,
  derived: DerivedMetrics,
): string[] {
  const factors: string[] = [];
  if (derived.shockIndex > 0.9) {
    factors.push(`Elevated Shock Index (${derived.shockIndex.toFixed(2)})`);
  }
  if (derived.map < 65) {
    factors.push(`Low MAP (${derived.map.toFixed(0)} mmHg)`);
  }
  if (v.spo2 < 90) {
    factors.push(`Hypoxemia (${v.spo2}% SpO₂)`);
  }
  if (v.temp > 38.3) {
    factors.push(`High temperature (${v.temp.toFixed(1)}°C)`);
  }
  if (v.rr > 24) {
    factors.push(`Rapid respiration (${v.rr}/min)`);
  }
  if (v.ecg === 1) {
    factors.push('Arrhythmia detected');
  }
  return factors;
}

export function createPatientRecord(
  vitals: Vitals,
  meta: {
    id: string;
    name: string;
    age?: number | string;
    unit?: string;
    bed?: string;
    admitted?: string;
    fileName?: string;
  },
  model: Model = 'fusion',
): PatientRecord {
  const derived = calculateSensorFusion(vitals);
  const riskScore = computeRiskScore(vitals, model);
  const riskLevel =
    riskScore >= 70 ? 'critical' : riskScore >= 30 ? 'moderate' : 'stable';
  const factors = computeRiskFactors(vitals, derived);

  return {
    id: meta.id,
    name: meta.name,
    age: meta.age ?? 'Not provided',
    unit: meta.unit ?? 'ICU',
    bed: meta.bed ?? '—',
    admitted: meta.admitted ?? 'Not provided',
    fileName: meta.fileName,
    baselineVitals: { ...vitals },
    currentVitals: { ...vitals },
    derived,
    riskScore,
    riskLevel,
    factors,
  };
}

export function parseSinglePatientText(
  text: string,
  fileName: string,
): PatientRecord {
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

  const vitals: Vitals = {
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
  };

  const name =
    get('patient name', 'name', 'patient') ?? fileName.replace(/\.txt$/i, '');
  const id = get('patient id', 'record id', 'ehr', 'id') ?? 'EHR-CUSTOM';
  const age = get('age', 'patient age') ?? '52';
  const unit = get('unit', 'ward', 'icu') ?? 'General ICU';
  const bed = get('bed', 'bed number') ?? 'Bed 01';
  const admitted =
    get('admitted', 'admission date', 'date admitted') ?? 'Just admitted';

  return createPatientRecord(vitals, {
    id,
    name,
    age,
    unit,
    bed,
    admitted,
    fileName,
  });
}

const SAMPLE_NAMES = [
  'Aarav Rao',
  'Elena Rostova',
  'Marcus Vance',
  'Amara Okafor',
  'David Chen',
  'Sofia Morales',
  'James Wilson',
  'Priya Patel',
  'Lucas Becker',
  'Fatima Zahra',
  'William Taylor',
  'Mei-Ling Zhou',
  'Alexander Scott',
  'Ananya Iyer',
  'Benjamin Hayes',
  'Camila Vargas',
  'Dmitri Volkov',
  'Grace Hopper',
  'Hassan Al-Mansoor',
  'Isabella Rossi',
];

const UNITS = [
  'Cardiovascular ICU',
  'Trauma ICU',
  'Medical ICU',
  'Neuro ICU',
  'Surgical ICU',
];

export function parseKaggleCsv(
  csvText: string,
  fileName = 'icu_patient_dataset.csv',
): PatientRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]+/g, ''));

  const findIdx = (...possible: string[]) => {
    for (const name of possible) {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const hrIdx = findIdx('heart_rate', 'hr', 'pulse');
  const spo2Idx = findIdx('spo2', 'oxygen_saturation', 'oxygen');
  const ecgIdx = findIdx('ecg_arrhythmia', 'ecg', 'arrhythmia');
  const tempIdx = findIdx('temperature', 'temp');
  const sbpIdx = findIdx('systolic_bp', 'systolic', 'sbp');
  const dbpIdx = findIdx('diastolic_bp', 'diastolic', 'dbp');
  const rrIdx = findIdx('respiratory_rate', 'rr', 'respiration');
  const nameIdx = findIdx('patient_name', 'name');
  const idIdx = findIdx('patient_id', 'id', 'ehr');
  const ageIdx = findIdx('age');
  const unitIdx = findIdx('unit', 'ward');
  const bedIdx = findIdx('bed', 'bed_number');

  const records: PatientRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const cols = rawLine.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));

    const num = (idx: number, fallback: number) => {
      if (idx === -1 || idx >= cols.length) return fallback;
      const v = Number.parseFloat(cols[idx]);
      return Number.isFinite(v) ? v : fallback;
    };

    const str = (idx: number) => {
      if (idx === -1 || idx >= cols.length) return undefined;
      return cols[idx] || undefined;
    };

    const systolic = num(sbpIdx, 120);
    const diastolic = dbpIdx !== -1 ? num(dbpIdx, Math.round(systolic * 0.65)) : Math.round(systolic * 0.65);

    const vitals: Vitals = {
      hr: Math.round(num(hrIdx, 75)),
      spo2: Math.round(num(spo2Idx, 98)),
      temp: Number(num(tempIdx, 36.8).toFixed(1)),
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      rr: Math.round(num(rrIdx, 16)),
      ecg: num(ecgIdx, 0) > 0.5 ? 1 : 0,
    };

    const patientIndex = i - 1;
    const name =
      str(nameIdx) ||
      SAMPLE_NAMES[patientIndex % SAMPLE_NAMES.length] +
        (patientIndex >= SAMPLE_NAMES.length
          ? ` (${Math.floor(patientIndex / SAMPLE_NAMES.length) + 1})`
          : '');
    const id =
      str(idIdx) || `EHR-${(9000 + patientIndex).toString()}`;
    const age = str(ageIdx) || (35 + (patientIndex * 7) % 50).toString();
    const unit = str(unitIdx) || UNITS[patientIndex % UNITS.length];
    const bed =
      str(bedIdx) || `Bed ${((patientIndex % 24) + 1).toString().padStart(2, '0')}`;
    const admitted = '2026-09-08 08:30';

    records.push(
      createPatientRecord(vitals, {
        id,
        name,
        age,
        unit,
        bed,
        admitted,
        fileName,
      }),
    );
  }

  return records;
}

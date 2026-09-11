export type Model = 'fusion' | 'baseline';

export type Scenario = 'custom' | 'stable' | 'sepsis' | 'hypoxia' | 'shock';

export type RiskLevel = 'all' | 'critical' | 'moderate' | 'stable';

export interface Vitals {
  hr: number;
  spo2: number;
  temp: number;
  systolic: number;
  diastolic: number;
  rr: number;
  ecg: number;
}

export interface DerivedMetrics {
  shockIndex: number;
  map: number;
  pulsePressure: number;
}

export interface PatientRecord {
  id: string; // e.g. "EHR-9041"
  name: string; // e.g. "Aarav Rao"
  age: number | string; // e.g. 54
  unit: string; // e.g. "Cardiovascular ICU"
  bed: string; // e.g. "Bed 04"
  admitted: string; // e.g. "2026-09-08 14:30"
  fileName?: string;
  kaggleId?: string; // e.g. "P0001" (original Kaggle dataset ID)
  baselineVitals: Vitals;
  currentVitals: Vitals;
  derived: DerivedMetrics;
  riskScore: number; // 0 - 100
  riskLevel: 'critical' | 'moderate' | 'stable';
  factors: string[];
  isModified?: boolean;
}

export interface PatientFilterState {
  searchQuery: string;
  riskFilter: RiskLevel;
  sortBy: 'risk-desc' | 'risk-asc' | 'bed' | 'name';
}

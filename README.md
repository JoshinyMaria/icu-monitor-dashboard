# ICU Patient Monitoring & Deterioration Intelligence Dashboard

A modern clinical web dashboard for real-time visualization of ICU patient vital signs, sensor-fusion clinical indicators, and machine-learning deterioration risk scoring.

---

## Overview

Traditional bedside monitors are reactive: they alarm only after individual vital signs breach preset single-parameter limits. This platform demonstrates proactive clinical decision support by evaluating multiple vital streams simultaneously, fusing raw telemetry into advanced physiological markers (Shock Index, Mean Arterial Pressure, Pulse Pressure), and predicting deterioration risk via gradient-boosted decision trees (XGBoost).

The web interface is built as a production-grade, static-exportable SaaS dashboard with an interactive 24-patient roster, live telemetry streaming, what-if bedside simulations, and automated dataset synchronization.

---

## Features

- **SaaS Patient Roster & Navigation**:
  - Wide collapsible patient sidebar with live search (`/`), acuity tabs (All, High, Med, Stable) with live patient counts, and selected state indicators.
  - Previous / Next cycling shortcuts (`[` and `]`) and rapid high-acuity triage jump (`Alt+C`).
  - Collapse / expand roster toggle (`Cmd/Ctrl+B`).
  - Full mobile responsiveness via off-canvas Sheet drawer.
- **Sensor Fusion & Clinical Indicators**:
  - **Shock Index**: $\text{Heart Rate} / \text{Systolic BP}$ (early indicator of circulatory failure).
  - **Mean Arterial Pressure (MAP)**: $(2 \times \text{Diastolic BP} + \text{Systolic BP}) / 3$ (organ perfusion indicator, threshold $\ge 65\text{ mmHg}$).
  - **Pulse Pressure**: $\text{Systolic BP} - \text{Diastolic BP}$.
- **Isolated What-if Simulations**:
  - Dedicated simulation drawer for adjusting Heart Rate, SpO2, Blood Pressure, Temperature, Respiratory Rate, and ECG Rhythm per patient.
  - Changes are isolated per patient record with clear "What-if modified" badges and one-click "Reset to baseline" capability.
- **Dual Model Evaluation**:
  - Toggle between **Sensor Fusion (XGBoost)** and **Baseline (Logistic Regression)** with live score re-evaluations across the entire cohort.
- **Flexible Data Ingestion**:
  - Upload multi-patient Kaggle CSV datasets or individual clinical text charts directly from the browser (processed locally via Web APIs).

---

## Algorithmic Approach & Risk Scoring

The dashboard demonstrates clinical deterioration monitoring using a transparent, client-side sensor-fusion calculation. It distinguishes physiological feature derivation, heuristic risk estimation, and interface benchmarking as follows:

### 1. Telemetry Inputs & Derived Physiological Signals

The scoring pipeline ingests seven vital signs and computes three key hemodynamic indices:

- **Primary Telemetry Inputs**:
  - Heart Rate ($\text{HR}$, bpm)
  - Oxygen Saturation ($\text{SpO}_2$, %)
  - Systolic Blood Pressure ($\text{SBP}$, mmHg)
  - Diastolic Blood Pressure ($\text{DBP}$, mmHg)
  - Body Temperature ($\text{Temp}$, °C)
  - Respiratory Rate ($\text{RR}$, breaths/min)
  - Cardiac Arrhythmia indicator ($\text{ECG} \in \{0, 1\}$, derived from rhythm analysis)

- **Derived Hemodynamic Signals**:
  - **Shock Index ($\text{SI}$)**:
    $$\text{SI} = \frac{\text{HR}}{\text{SBP}}$$
    An early indicator of occult hypovolemic or septic shock (normal range $0.5\text{--}0.7$; penalized when $> 0.72$, flagged as clinical warning when $> 0.90$).
  - **Mean Arterial Pressure ($\text{MAP}$)**:
    $$\text{MAP} = \frac{2 \times \text{DBP} + \text{SBP}}{3}$$
    A primary determinant of organ perfusion pressure (threshold $\ge 65\text{ mmHg}$; penalized when $< 70\text{ mmHg}$, flagged as warning when $< 65\text{ mmHg}$).
  - **Pulse Pressure ($\text{PP}$)**:
    $$\text{PP} = \text{SBP} - \text{DBP}$$
    Reflects stroke volume and arterial compliance.

### 2. Browser-Side Sensor Fusion Heuristic

Rather than invoking a server-side ML model or client-side runtime (e.g., ONNX / TensorFlow.js), risk scores are computed directly in TypeScript (`lib/patient-parser.ts`) via a deterministic penalty-accumulation heuristic:

```ts
// Deterministic browser heuristic (lib/patient-parser.ts)
const shockIndex = vitals.hr / vitals.systolic;
const map = (2 * vitals.diastolic + vitals.systolic) / 3;

let score = model === 'fusion' ? 8 : 12;
score += Math.max(0, 94 - vitals.spo2) * (model === 'fusion' ? 5.2 : 3.6);
score += Math.max(0, shockIndex - 0.72) * (model === 'fusion' ? 72 : 46);
score += Math.max(0, 70 - map) * (model === 'fusion' ? 1.25 : 0.7);
score += Math.max(0, vitals.temp - 37.5) * (model === 'fusion' ? 8 : 5);
score += Math.max(0, vitals.rr - 20) * (model === 'fusion' ? 2.6 : 1.7);
score += vitals.ecg * (model === 'fusion' ? 10 : 7);

const riskScore = Math.max(2, Math.min(98, Math.round(score)));
```

Patients are triaged into three acuity bands based on `riskScore`:
- **Stable**: $< 30\%$
- **Moderate Warning**: $30\%\text{--}69\%$
- **Critical Alert**: $\ge 70\%$

Discrete alert factors (e.g., *Low MAP*, *Elevated Shock Index*, *Hypoxemia*) are flagged alongside the numeric score when individual physiological thresholds are breached.

### 3. "Sensor Fusion (XGBoost)" vs. "Baseline (Logistic Regression)" in the UI

The model selector in the dashboard UI provides an interactive visual demonstration rather than shipped machine learning inference:

- **Dynamic Weight Profiles**: Toggling between **Sensor Fusion (XGBoost)** and **Baseline (Logistic Regression)** switches between two hardcoded heuristic coefficient sets in `computeRiskScore`. The `'fusion'` profile exhibits higher sensitivity to compound vital deviations (higher penalty multipliers on Shock Index, hypoxemia, and arrhythmia), whereas `'baseline'` applies flatter penalties.
- **Visual Performance Comparison**: The "Algorithm performance" card (reporting Accuracy, Precision, Recall, and ROC-AUC) displays static prototype benchmark figures for comparative visualization. No trained XGBoost trees or logistic regression weight matrices are shipped, loaded, or executed in the browser bundle.
- **No Clinical Validation**: The comparison illustrates how multi-modal fusion logic contrasts with single-parameter or linear scoring; it is a prototyping simulation and must not be interpreted as validated machine learning inference or clinical evidence.

### 4. Role of the Kaggle Dataset

The Kaggle dataset (`pallachetanareddy/icu-patient-vitals-monitoring-dataset`) is used exclusively for **record ingestion and cohort population**:
- The offline Python ETL script (`scripts/sync_kaggle_cohort.py`) extracts synthetic multi-table telemetry and patient metadata to construct static demonstration fixtures (`public/data/demo-cohort.json`).
- The in-browser ingestion module (`parseKaggleCsv`) parses uploaded CSV files into client-side patient records for live exploration.
- The Kaggle records provide realistic synthetic time-series profiles for UI exploration; they do not serve as a clinical training or statistical validation set within this repository.

---

## Kaggle Dataset & ETL Pipeline

### Dataset Information

- **Dataset**: [ICU Patient Vitals & Deterioration Dataset](https://www.kaggle.com/datasets/pallachetanareddy/icu-patient-vitals-monitoring-dataset)
- **Kaggle Slug**: `pallachetanareddy/icu-patient-vitals-monitoring-dataset`

### Why the Pipeline Exists

1. **Security & Secrets Isolation**: Direct browser fetching from Kaggle cannot be performed because it requires API credentials that must never be exposed to client bundles, and is blocked by CORS.
2. **Two-Table Ingestion & Normalization**: The Kaggle dataset archive provides dual tables: `patient_vitals.csv` (383k+ 15-minute time-series clinical readings) and `patients_meta.csv` (patient demographics, ICU unit assignments, and admission context across 500 patients). The ETL script robustly identifies both tables, joins demographic and ward metadata by patient ID, normalizes clinical telemetry into the structured `PatientRecord` TypeScript interface, calculates sensor-fusion indicators, and computes deterioration alert factors.
3. **Deterministic Static Cohort**: Generates a comprehensive 500-patient cohort at `public/data/demo-cohort.json` (379 Critical, 66 Moderate, 55 Stable) directly from the real dual-table Kaggle dataset, enabling zero-latency exploration and static deployment on Cloudflare Pages without runtime server dependencies. The dashboard sidebar uses lightweight client-side virtualization to scroll all 500 patients with 60fps performance.

---

## Tech Stack

- **Framework**: Next.js (App Router, Static Export `output: 'export'`)
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4.2
- **Icons**: Lucide React
- **Telemetry Charts**: Recharts
- **ETL Scripting**: Python 3.11+ (standard library + optional `kagglehub` / `requests`)

---

## Getting Started

### Prerequisites

- Node.js >= 22.13.0
- npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Type Checking

```bash
# Verify TypeScript types
npx tsc --noEmit

# Compile static production export
npm run build
```

The optimized static production build will be generated in the `out/` directory.

---

## Clinical Demo & Synthetic Data Disclaimer

> [!WARNING]
> **Academic & Prototyping Disclaimer**
>
> The data provided in this project, including records derived from Kaggle dataset `pallachetanareddy/icu-patient-vitals-monitoring-dataset`, consists entirely of **synthetic, simulated patient records** generated for machine learning algorithm prototyping, sensor fusion research, and user interface demonstration.
>
> This software is a proof-of-concept simulation environment and is **not** validated for actual clinical diagnosis, triage, treatment planning, or live patient monitoring. It must **not** be used in real-world clinical or emergency settings without thorough clinical trials, institutional review, and regulatory clearance.

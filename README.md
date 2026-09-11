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

## Kaggle Dataset & ETL Pipeline

### Dataset Information

- **Dataset**: [ICU Patient Vitals & Deterioration Dataset](https://www.kaggle.com/datasets/pallachetanareddy/icu-patient-vitals-monitoring-dataset)
- **Kaggle Slug**: `pallachetanareddy/icu-patient-vitals-monitoring-dataset`

### Why the Pipeline Exists

1. **Security & Secrets Isolation**: Direct browser fetching from Kaggle cannot be performed because it requires API credentials that must never be exposed to client bundles, and is blocked by CORS.
2. **Two-Table Ingestion & Normalization**: The Kaggle dataset archive provides dual tables: `patient_vitals.csv` (383k+ 15-minute time-series clinical readings) and `patients_meta.csv` (patient demographics, ICU unit assignments, and admission context across 500 patients). The ETL script robustly identifies both tables, joins demographic and ward metadata by patient ID, normalizes clinical telemetry into the structured `PatientRecord` TypeScript interface, calculates sensor-fusion indicators, and computes deterioration alert factors.
3. **Deterministic Static Cohort**: Generates a comprehensive 500-patient cohort at `public/data/demo-cohort.json` (379 Critical, 66 Moderate, 55 Stable) directly from the real dual-table Kaggle dataset, enabling zero-latency exploration and static deployment on Cloudflare Pages without runtime server dependencies. The dashboard sidebar uses lightweight client-side virtualization to scroll all 500 patients with 60fps performance.

### Accepted Credentials

The ETL script automatically detects credentials from:
- **Environment Variables**: `KAGGLE_USERNAME` and `KAGGLE_KEY`
- **Kaggle Configuration File**: `~/.kaggle/kaggle.json`

> **Security Note**: Kaggle secrets must **never** be committed to Git or referenced in client-side code. The client dashboard loads only the derived static JSON artifact.

### Running Local Sync

#### 1. Setup Dependencies

```bash
# From the dashboard directory
pip install -r scripts/requirements.txt
```

#### 2. Run Sync Pipeline

- **With Kaggle Credentials** (default 500-patient cohort from actual Kaggle tables):
  ```bash
  export KAGGLE_USERNAME="your_kaggle_username"
  export KAGGLE_KEY="your_kaggle_api_key"
  python scripts/sync_kaggle_cohort.py
  ```

- **Optional Smaller Cohort for Local Development** (`--cohort-size` or `--limit`):
  ```bash
  # Generate a smaller balanced cohort (e.g. 24 patients: 7 critical, 8 moderate, 9 stable)
  python scripts/sync_kaggle_cohort.py --cohort-size 24
  # Or use the --limit flag:
  python scripts/sync_kaggle_cohort.py --limit 24
  ```

- **With Local Dataset Directory or Files** (offline / existing download):
  ```bash
  # Provide directory containing patient_vitals.csv and patients_meta.csv:
  python scripts/sync_kaggle_cohort.py --input-csv /path/to/extracted_dataset/

  # Or point directly to specific files:
  python scripts/sync_kaggle_cohort.py --input-csv /path/to/patient_vitals.csv --input-meta-csv /path/to/patients_meta.csv
  ```

- **Without Credentials** (deterministic benchmark generator):
  ```bash
  # If credentials are not present, the script automatically falls back to
  # the deterministic benchmark generator matching the Kaggle ground-truth rules
  python scripts/sync_kaggle_cohort.py --synthetic-fallback
  ```

- **Verify Cohort Integrity**:
  ```bash
  python scripts/sync_kaggle_cohort.py --verify-only
  ```

---

## Automated GitHub Actions Sync

A scheduled GitHub Actions workflow is provided at [`.github/workflows/sync-kaggle-cohort.yml`](.github/workflows/sync-kaggle-cohort.yml):

- **Triggers**:
  - **Manual**: On-demand via the Actions tab (`workflow_dispatch`).
  - **Scheduled**: Runs weekly every Sunday at 04:00 UTC (`cron: '0 4 * * 0'`).
- **Secrets Configured**: `KAGGLE_USERNAME` and `KAGGLE_KEY` in repository settings.
- **Safety**: Runs with read-only permissions by default, validates the generated cohort, and uploads `demo-cohort.json` as an inspection artifact. Includes an optional scoped pull-request step to review changes before merging.
- **Resilience**: The client UI gracefully uses its committed static cohort if the sync has never run or if network access is unavailable.

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

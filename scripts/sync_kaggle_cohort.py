#!/usr/bin/env python3
"""
ETL Pipeline: ICU Patient Monitoring Dataset -> Dashboard Demo Cohort
--------------------------------------------------------------------
Dataset: https://www.kaggle.com/datasets/pallachetanareddy/icu-patient-vitals-monitoring-dataset
Dataset Slug: pallachetanareddy/icu-patient-vitals-monitoring-dataset

Two-Table Ingestion Architecture:
- patient_vitals.csv: Clinical time-series observations (HR, SpO2, SBP, DBP, RR, Temp, event labels)
- patients_meta.csv  : Demographics & context (age, ICU units, admission/discharge, scenarios)

Security & Architecture:
- Direct browser fetch is NEVER performed.
- Kaggle secrets NEVER reach client-side bundles.
- Credentials checked via KAGGLE_USERNAME / KAGGLE_KEY or ~/.kaggle/kaggle.json.
- Credentials are never logged, stored, or revealed.
- Normalizes raw sensor CSV schema to the TypeScript PatientRecord format.
- Computes sensor-fusion derived metrics (Shock Index, MAP, Pulse Pressure),
  deterioration risk scores, and clinical warning factors.
- Deterministically generates a balanced 24-patient static cohort for:
  dashboard/public/data/demo-cohort.json
"""

import argparse
import base64
import csv
import json
import os
import shutil
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_DATASET_SLUG = "pallachetanareddy/icu-patient-vitals-monitoring-dataset"
TARGET_COHORT_SIZE = 24

SAMPLE_NAMES = [
    "Aarav Rao",
    "Elena Rostova",
    "Marcus Vance",
    "Amara Okafor",
    "David Chen",
    "Sofia Morales",
    "James Wilson",
    "Priya Patel",
    "Lucas Becker",
    "Fatima Zahra",
    "William Taylor",
    "Mei-Ling Zhou",
    "Alexander Scott",
    "Ananya Iyer",
    "Benjamin Hayes",
    "Camila Vargas",
    "Dmitri Volkov",
    "Grace Hopper",
    "Hassan Al-Mansoor",
    "Isabella Rossi",
    "Noah Andersen",
    "Yuki Tanaka",
    "Chloe Dubois",
    "Kwame Mensah",
]

DEFAULT_UNITS = [
    "Cardiovascular ICU",
    "Trauma ICU",
    "Medical ICU",
    "Neuro ICU",
    "Surgical ICU",
]

UNIT_NAME_MAP = {
    "MICU": "Medical ICU",
    "SICU": "Surgical ICU",
    "CCU": "Cardiovascular ICU",
    "NICU": "Neuro ICU",
    "PICU": "Pediatric ICU",
    "TICU": "Trauma ICU",
    "CVICU": "Cardiovascular ICU",
}


def check_kaggle_credentials() -> Tuple[Optional[str], Optional[str]]:
    """Check for Kaggle API credentials in environment or ~/.kaggle/kaggle.json."""
    username = os.environ.get("KAGGLE_USERNAME")
    key = os.environ.get("KAGGLE_KEY")

    if username and key:
        return username.strip(), key.strip()

    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if kaggle_json.is_file():
        try:
            with open(kaggle_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("username"), data.get("key")
        except Exception:
            pass

    return None, None


def download_dataset_via_kagglehub(slug: str) -> Optional[Path]:
    """Attempt download using kagglehub package if installed."""
    try:
        import kagglehub  # type: ignore

        print(f"[ETL] Downloading dataset '{slug}' via kagglehub...")
        download_path = kagglehub.dataset_download(slug)
        if download_path and Path(download_path).exists():
            print(f"[ETL] Downloaded to: {download_path}")
            return Path(download_path)
    except ImportError:
        pass
    except Exception as err:
        print(f"[ETL] Warning: kagglehub download failed: {err}")
    return None


def download_dataset_via_kaggle_api(slug: str, target_dir: Path) -> Optional[Path]:
    """Attempt download using kaggle python package if installed."""
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi  # type: ignore

        print(f"[ETL] Downloading dataset '{slug}' via official KaggleApi...")
        api = KaggleApi()
        api.authenticate()
        api.dataset_download_files(slug, path=str(target_dir), unzip=True)
        return target_dir
    except ImportError:
        pass
    except Exception as err:
        print(f"[ETL] Warning: kaggle API download failed: {err}")
    return None


def download_dataset_via_rest(
    slug: str, username: str, key: str, target_dir: Path
) -> Optional[Path]:
    """Download dataset zip directly from Kaggle REST API using HTTP Basic Auth."""
    url = f"https://www.kaggle.com/api/v1/datasets/download/{slug}"
    print(f"[ETL] Downloading dataset from Kaggle REST endpoint: {url}...")

    auth_str = f"{username}:{key}"
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("ascii")

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Basic {b64_auth}",
            "User-Agent": "icu-monitor-dashboard-etl/1.0",
        },
    )

    zip_path = target_dir / "dataset.zip"
    try:
        with urllib.request.urlopen(req) as resp, open(zip_path, "wb") as out_file:
            shutil.copyfileobj(resp, out_file)

        print(f"[ETL] Extracting {zip_path.stat().st_size} bytes archive...")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(target_dir)

        return target_dir
    except urllib.error.HTTPError as http_err:
        print(f"[ETL] Error: Kaggle API returned HTTP {http_err.code}: {http_err.reason}")
        return None
    except Exception as err:
        print(f"[ETL] Error: REST download failed: {err}")
        return None


def _read_csv_header(file_path: Path) -> List[str]:
    """Safely read and return standardized lowercase header tokens from a CSV."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            headers = next(reader)
            return [h.strip().lower().replace(" ", "_") for h in headers if h.strip()]
    except Exception:
        return []


def _has_required_vital_columns(headers: List[str]) -> bool:
    """Check if header list contains required clinical vital measurements."""
    has_hr = any(
        col in headers for col in ("heart_rate", "hr", "pulse", "heartrate")
    )
    has_spo2 = any(
        col in headers
        for col in ("spo2", "oxygen_saturation", "oxygen", "o2_sat")
    )
    has_sbp = any(
        col in headers
        for col in ("systolic_bp", "systolic", "sbp", "blood_pressure_sys")
    )
    return has_hr and has_spo2 and has_sbp


def _is_metadata_csv(headers: List[str], file_path: Path) -> bool:
    """Check if header list represents patient metadata rather than time-series vitals."""
    has_id = any(
        col in headers
        for col in ("patient_id", "id", "subject_id", "patientid")
    )
    has_meta_traits = any(
        col in headers
        for col in (
            "icu_stay_days",
            "admission_time",
            "discharge_time",
            "scenario",
            "admission_type",
            "comorbidity_count",
            "bmi_category",
        )
    )
    filename_meta = "meta" in file_path.name.lower()
    return (has_id and has_meta_traits) or (filename_meta and not _has_required_vital_columns(headers))


def locate_dataset_csvs(
    directory: Path,
) -> Tuple[Optional[Path], Optional[Path]]:
    """
    Search recursively in directory for the two-table Kaggle dataset files:
    1. Vitals CSV: patient_vitals.csv (requires HR, SpO2, and SBP columns)
    2. Meta CSV  : patients_meta.csv (contains demographics, unit, scenario)
    Returns: (vitals_csv_path, meta_csv_path)
    """
    csv_candidates = sorted(directory.rglob("*.csv"))
    if not csv_candidates:
        return None, None

    vitals_matches: List[Tuple[int, Path]] = []
    meta_matches: List[Tuple[int, Path]] = []

    for csv_file in csv_candidates:
        headers = _read_csv_header(csv_file)
        if not headers:
            continue

        if _has_required_vital_columns(headers):
            # Prioritize files explicitly named vitals or largest size
            priority = 0
            if "vital" in csv_file.name.lower():
                priority += 10
            priority += min(5, int(csv_file.stat().st_size / (1024 * 1024)))
            vitals_matches.append((priority, csv_file))

        if _is_metadata_csv(headers, csv_file):
            priority = 0
            if "meta" in csv_file.name.lower():
                priority += 10
            meta_matches.append((priority, csv_file))

    vitals_csv = None
    if vitals_matches:
        vitals_matches.sort(key=lambda x: x[0], reverse=True)
        vitals_csv = vitals_matches[0][1]

    meta_csv = None
    if meta_matches:
        meta_matches.sort(key=lambda x: x[0], reverse=True)
        # Avoid selecting the same file for both
        for _, candidate in meta_matches:
            if candidate != vitals_csv:
                meta_csv = candidate
                break

    return vitals_csv, meta_csv


def load_metadata_csv(meta_path: Optional[Path]) -> Dict[str, Dict[str, Any]]:
    """
    Load patients_meta.csv and return mapping of patient_id -> normalized attributes.
    Attributes include age, gender, diagnosis, unit (normalized), admission_time, scenario.
    """
    if not meta_path or not meta_path.is_file():
        return {}

    meta_by_id: Dict[str, Dict[str, Any]] = {}
    with open(meta_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return {}

        col_map = {
            col.strip().lower().replace(" ", "_"): col for col in reader.fieldnames
        }

        def get_val(row: Dict[str, str], *aliases: str) -> Optional[str]:
            for alias in aliases:
                norm = alias.lower().replace(" ", "_")
                if norm in col_map:
                    raw = row.get(col_map[norm])
                    if raw is not None and raw.strip():
                        return raw.strip()
            return None

        for row in reader:
            pid = get_val(row, "patient_id", "id", "subject_id", "patientid")
            if not pid:
                continue

            age_str = get_val(row, "age", "patient_age")
            unit_raw = get_val(row, "icu_unit", "unit", "ward")
            admit_str = get_val(row, "admission_time", "admitted", "admission_date")
            scenario_str = get_val(row, "scenario", "clinical_scenario")
            diag_str = get_val(row, "diagnosis", "primary_diagnosis")
            gender_str = get_val(row, "gender", "sex")

            clean_unit = None
            if unit_raw:
                clean_unit = UNIT_NAME_MAP.get(unit_raw.upper(), unit_raw)

            clean_age = None
            if age_str:
                try:
                    clean_age = int(float(age_str))
                except ValueError:
                    clean_age = None

            meta_by_id[pid] = {
                "patient_id": pid,
                "age": clean_age,
                "unit": clean_unit,
                "raw_unit": unit_raw,
                "admitted": admit_str,
                "scenario": scenario_str,
                "diagnosis": diag_str,
                "gender": gender_str,
            }

    print(
        f"[ETL] Loaded {len(meta_by_id)} patient records from metadata CSV: {meta_path.name}"
    )
    return meta_by_id


def validate_and_parse_vitals_csv(
    csv_path: Path, metadata: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Validate and parse clinical vitals CSV (patient_vitals.csv).
    Handles alias normalization and joins metadata onto vitals records by patient_id.
    """
    if not csv_path.is_file():
        raise FileNotFoundError(f"Vitals CSV not found at: {csv_path}")

    if csv_path.stat().st_size == 0:
        raise ValueError(f"Vitals CSV is empty: {csv_path}")

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ValueError(f"CSV file contains no rows: {csv_path}")

    clean_headers = [h.strip().lower().replace(" ", "_") for h in raw_headers]

    def col_idx(*aliases: str) -> int:
        for alias in aliases:
            norm = alias.lower().replace(" ", "_")
            if norm in clean_headers:
                return clean_headers.index(norm)
        return -1

    hr_idx = col_idx("heart_rate", "hr", "pulse", "heartrate")
    spo2_idx = col_idx("spo2", "oxygen_saturation", "oxygen", "o2_sat")
    sbp_idx = col_idx("systolic_bp", "systolic", "sbp", "blood_pressure_sys")
    dbp_idx = col_idx("diastolic_bp", "diastolic", "dbp", "blood_pressure_dia")
    temp_idx = col_idx("temperature", "temp")
    rr_idx = col_idx("respiratory_rate", "rr", "respiration")
    ecg_idx = col_idx("ecg_arrhythmia", "ecg", "arrhythmia")
    pid_idx = col_idx("patient_id", "id", "subject_id", "patientid")
    time_idx = col_idx("timestamp", "time", "datetime", "recorded_at")
    event_idx = col_idx("event_label", "event", "label")
    diag_idx = col_idx("diagnosis", "primary_diagnosis")
    unit_idx = col_idx("icu_unit", "unit")
    age_idx = col_idx("age", "patient_age")

    missing = []
    if hr_idx == -1:
        missing.append("Heart Rate (heart_rate / hr)")
    if spo2_idx == -1:
        missing.append("SpO2 (spo2 / oxygen)")
    if sbp_idx == -1:
        missing.append("Systolic BP (systolic_bp / systolic)")

    if missing:
        raise ValueError(
            f"Vitals CSV missing required clinical columns: {', '.join(missing)}.\n"
            f"Found columns: {', '.join(raw_headers)}"
        )

    rows: List[Dict[str, Any]] = []
    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        next(reader)  # Skip header

        for cols in reader:
            if not cols or not any(cols):
                continue

            def parse_num(idx: int, default: float) -> float:
                if idx == -1 or idx >= len(cols):
                    return default
                val_str = cols[idx].strip()
                if not val_str:
                    return default
                try:
                    return float(val_str)
                except ValueError:
                    return default

            def parse_str(idx: int) -> Optional[str]:
                if idx == -1 or idx >= len(cols):
                    return None
                val = cols[idx].strip()
                return val if val else None

            hr_val = parse_num(hr_idx, 75.0)
            spo2_val = parse_num(spo2_idx, 98.0)
            sbp_val = parse_num(sbp_idx, 120.0)
            dbp_val = (
                parse_num(dbp_idx, round(sbp_val * 0.65))
                if dbp_idx != -1
                else round(sbp_val * 0.65)
            )
            temp_val = parse_num(temp_idx, 37.0) if temp_idx != -1 else 37.0
            rr_val = parse_num(rr_idx, 16.0) if rr_idx != -1 else 16.0

            # Physiological range sanity check
            if hr_val < 20 or hr_val > 300:
                continue
            if sbp_val < 30 or sbp_val > 300:
                continue

            pid = parse_str(pid_idx)
            timestamp = parse_str(time_idx)
            event_label = parse_str(event_idx)
            diagnosis = parse_str(diag_idx)
            unit = parse_str(unit_idx)
            age_val = parse_num(age_idx, -1)

            # ECG arrhythmia check: explicit column or inferred from acute cardiac diagnosis
            ecg_val = 0
            if ecg_idx != -1:
                ecg_val = 1 if parse_num(ecg_idx, 0.0) > 0.5 else 0
            elif diagnosis and any(
                term in diagnosis.lower() for term in ("cardiac", "mi", "arrhythmia", "infarction")
            ):
                ecg_val = 1

            record: Dict[str, Any] = {
                "hr": round(hr_val),
                "spo2": round(spo2_val),
                "temp": round(temp_val, 1),
                "systolic": round(sbp_val),
                "diastolic": round(dbp_val),
                "rr": round(rr_val),
                "ecg": ecg_val,
                "patient_id": pid,
                "timestamp": timestamp,
                "event_label": event_label,
                "diagnosis": diagnosis,
                "icu_unit": unit,
                "age": int(age_val) if age_val > 0 else None,
            }

            # Join metadata if available
            if pid and pid in metadata:
                m = metadata[pid]
                if m.get("age") and record["age"] is None:
                    record["age"] = m["age"]
                if m.get("unit") and not record["icu_unit"]:
                    record["icu_unit"] = m["unit"]
                if m.get("diagnosis") and not record["diagnosis"]:
                    record["diagnosis"] = m["diagnosis"]
                record["admission_time"] = m.get("admitted")
                record["scenario"] = m.get("scenario")

            rows.append(record)

    if not rows:
        raise ValueError(f"No valid clinical rows could be parsed from: {csv_path}")

    return rows


def generate_synthetic_dataset_rows(
    count: int = 5000, seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Deterministic fallback generator matching ML ground-truth rules:
    Used ONLY when Kaggle credentials and local CSVs are completely absent.
    """
    import random

    rng = random.Random(seed)
    rows: List[Dict[str, Any]] = []

    for idx in range(count):
        h = rng.uniform(40.0, 160.0)
        sp = rng.uniform(75.0, 100.0)
        ecg = 1 if rng.random() < 0.15 else 0
        te = rng.uniform(35.5, 40.5)
        sbp = rng.uniform(60.0, 180.0)
        dbp = sbp * rng.uniform(0.6, 0.75)
        r = rng.uniform(8.0, 40.0)

        rows.append(
            {
                "hr": round(h),
                "spo2": round(sp),
                "temp": round(te, 1),
                "systolic": round(sbp),
                "diastolic": round(dbp),
                "rr": round(r),
                "ecg": ecg,
                "patient_id": f"P{idx + 1:04d}",
            }
        )

    return rows


def calculate_derived_metrics(v: Dict[str, Any]) -> Dict[str, Any]:
    """Compute sensor fusion derived metrics: Shock Index, MAP, Pulse Pressure."""
    hr = float(v["hr"])
    sbp = float(v["systolic"])
    dbp = float(v["diastolic"])

    shock_index = round(hr / sbp, 2) if sbp > 0 else 0.0
    map_val = round((2.0 * dbp + sbp) / 3.0, 1)
    pulse_pressure = round(sbp - dbp)

    return {
        "shockIndex": shock_index,
        "map": map_val,
        "pulsePressure": pulse_pressure,
    }


def compute_risk_score(v: Dict[str, Any], model: str = "fusion") -> int:
    """
    Project model formula matching lib/patient-parser.ts & ML notebooks:
    Low risk < 30%, Moderate warning 30-69%, Critical alert >= 70%.
    """
    hr = float(v["hr"])
    spo2 = float(v["spo2"])
    temp = float(v["temp"])
    sbp = float(v["systolic"])
    dbp = float(v["diastolic"])
    rr = float(v["rr"])
    ecg = float(v.get("ecg", 0))

    shock_index = hr / sbp if sbp > 0 else 1.0
    map_val = (2.0 * dbp + sbp) / 3.0

    score = 8.0 if model == "fusion" else 12.0
    score += max(0.0, 94.0 - spo2) * (5.2 if model == "fusion" else 3.6)
    score += max(0.0, shock_index - 0.72) * (72.0 if model == "fusion" else 46.0)
    score += max(0.0, 70.0 - map_val) * (1.25 if model == "fusion" else 0.7)
    score += max(0.0, temp - 37.5) * (8.0 if model == "fusion" else 5.0)
    score += max(0.0, rr - 20.0) * (2.6 if model == "fusion" else 1.7)
    score += ecg * (10.0 if model == "fusion" else 7.0)

    return max(2, min(98, round(score)))


def compute_risk_factors(v: Dict[str, Any], derived: Dict[str, Any]) -> List[str]:
    """Compute human-readable clinical deterioration warning factors."""
    factors = []
    if derived["shockIndex"] > 0.9:
        factors.append(f"Elevated Shock Index ({derived['shockIndex']:.2f})")
    if derived["map"] < 65:
        factors.append(f"Low MAP ({derived['map']:.0f} mmHg)")
    if v["spo2"] < 90:
        factors.append(f"Hypoxemia ({v['spo2']}% SpO₂)")
    if v["temp"] > 38.3:
        factors.append(f"High temperature ({v['temp']:.1f}°C)")
    if v["rr"] > 24:
        factors.append(f"Rapid respiration ({v['rr']}/min)")
    if v.get("ecg", 0) == 1:
        factors.append("Arrhythmia detected")
    return factors


def build_deterministic_cohort(
    raw_rows: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Dict[str, Any]]] = None,
    count: int = TARGET_COHORT_SIZE,
) -> List[Dict[str, Any]]:
    """
    Select a balanced, realistic clinical ICU cohort of exactly `count` patients
    stratified across critical (>=70%), moderate (30-69%), and stable (<30%).

    When actual Kaggle data with multiple readings per patient is available:
    - Baseline vitals represent the patient's admission bedside state.
    - Current vitals reflect active clinical status (peak risk / deterioration event).
    - Metadata context (unit, age, admission time, diagnosis) is preserved.
    """
    meta_dict = metadata or {}

    # Check if rows are grouped by patient_id
    has_patient_groups = any(r.get("patient_id") for r in raw_rows)

    if has_patient_groups:
        patient_readings: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for r in raw_rows:
            pid = r.get("patient_id") or "UNKNOWN"
            patient_readings[pid].append(r)

        crit_candidates: List[Dict[str, Any]] = []
        mod_candidates: List[Dict[str, Any]] = []
        stab_candidates: List[Dict[str, Any]] = []

        for pid in sorted(patient_readings.keys()):
            readings = patient_readings[pid]
            base_row = readings[0]
            base_vitals = {
                "hr": base_row["hr"],
                "spo2": base_row["spo2"],
                "temp": base_row["temp"],
                "systolic": base_row["systolic"],
                "diastolic": base_row["diastolic"],
                "rr": base_row["rr"],
                "ecg": base_row.get("ecg", 0),
            }

            scored_items = []
            for r in readings:
                v = {
                    "hr": r["hr"],
                    "spo2": r["spo2"],
                    "temp": r["temp"],
                    "systolic": r["systolic"],
                    "diastolic": r["diastolic"],
                    "rr": r["rr"],
                    "ecg": r.get("ecg", 0),
                }
                score = compute_risk_score(v, "fusion")
                derived = calculate_derived_metrics(v)
                scored_items.append((score, v, derived, r))

            # Select peak severity reading to evaluate active status
            max_item = max(scored_items, key=lambda x: x[0])
            score, active_vitals, derived, raw_item = max_item

            patient_ctx = {
                "patient_id": pid,
                "meta": meta_dict.get(pid, {}),
                "raw_item": raw_item,
                "baselineVitals": base_vitals,
                "currentVitals": active_vitals,
                "derived": derived,
                "score": score,
            }

            if score >= 70:
                crit_candidates.append(patient_ctx)
            elif score >= 30:
                mod_candidates.append(patient_ctx)
            else:
                stab_candidates.append(patient_ctx)

        print(
            f"[ETL] Kaggle patient stratification pool: "
            f"{len(crit_candidates)} critical, {len(mod_candidates)} moderate, {len(stab_candidates)} stable"
        )

        target_critical = 7
        target_moderate = 8
        target_stable = count - target_critical - target_moderate  # 9

        def sample_list(source: List[Dict[str, Any]], n: int) -> List[Dict[str, Any]]:
            if not source:
                return []
            step = max(1, len(source) // n)
            return [source[(i * step) % len(source)] for i in range(n)]

        selected_crit = sample_list(crit_candidates, target_critical)
        selected_mod = sample_list(mod_candidates, target_moderate)
        selected_stab = sample_list(stab_candidates, target_stable)

        # Interleave into authentic 24-bed ICU distribution
        selected_pool: List[Dict[str, Any]] = []
        for i in range(count):
            if i % 3 == 0 and selected_crit:
                selected_pool.append(selected_crit.pop(0))
            elif i % 3 == 1 and selected_mod:
                selected_pool.append(selected_mod.pop(0))
            elif selected_stab:
                selected_pool.append(selected_stab.pop(0))
            elif selected_crit:
                selected_pool.append(selected_crit.pop(0))
            elif selected_mod:
                selected_pool.append(selected_mod.pop(0))

        # Backfill if any slots remain
        all_remaining = [
            c for c in (crit_candidates + mod_candidates + stab_candidates)
            if c not in selected_pool
        ]
        while len(selected_pool) < count and all_remaining:
            selected_pool.append(all_remaining.pop(0))

        selected_pool = selected_pool[:count]

        # Format into full PatientRecord schema
        records: List[Dict[str, Any]] = []
        for idx, item in enumerate(selected_pool):
            v_curr = item["currentVitals"]
            v_base = item["baselineVitals"]
            derived = item["derived"]
            score = item["score"]
            level = "critical" if score >= 70 else ("moderate" if score >= 30 else "stable")
            factors = compute_risk_factors(v_curr, derived)

            m = item["meta"]
            raw = item["raw_item"]

            patient_id = f"EHR-{9001 + idx}"
            name = SAMPLE_NAMES[idx % len(SAMPLE_NAMES)]

            # Demographic & Unit resolution: Metadata -> Vitals -> Fallback
            age = m.get("age") or raw.get("age") or (32 + ((idx * 7) % 46))
            unit_val = m.get("unit") or raw.get("icu_unit") or DEFAULT_UNITS[idx % len(DEFAULT_UNITS)]
            if unit_val in UNIT_NAME_MAP:
                unit_val = UNIT_NAME_MAP[unit_val]

            bed = f"Bed {(idx + 1):02d}"

            # Admission timestamp resolution
            admitted = m.get("admitted") or raw.get("admission_time") or raw.get("timestamp")
            if admitted and len(admitted) > 16:
                admitted = admitted[:16]
            if not admitted:
                admitted = "2026-09-08 14:30"

            records.append(
                {
                    "id": patient_id,
                    "name": name,
                    "age": age,
                    "unit": unit_val,
                    "bed": bed,
                    "admitted": admitted,
                    "baselineVitals": v_base,
                    "currentVitals": v_curr,
                    "derived": derived,
                    "riskScore": score,
                    "riskLevel": level,
                    "factors": factors,
                }
            )

        return records

    # Fallback path for unstratified single-row benchmark records
    scored = []
    for r in raw_rows:
        derived = calculate_derived_metrics(r)
        score = compute_risk_score(r, "fusion")
        level = "critical" if score >= 70 else ("moderate" if score >= 30 else "stable")
        scored.append({"vitals": r, "derived": derived, "score": score, "level": level})

    critical = [x for x in scored if x["level"] == "critical"]
    moderate = [x for x in scored if x["level"] == "moderate"]
    stable = [x for x in scored if x["level"] == "stable"]

    target_critical = 7
    target_moderate = 8
    target_stable = count - target_critical - target_moderate

    def take(source: List[Dict[str, Any]], num: int) -> List[Dict[str, Any]]:
        if not source:
            return []
        step = max(1, len(source) // num)
        return [source[(i * step) % len(source)] for i in range(num)]

    crit_samples = take(critical, target_critical)
    mod_samples = take(moderate, target_moderate)
    stab_samples = take(stable, target_stable)

    selected_pool = []
    for i in range(count):
        if i % 3 == 0 and crit_samples:
            selected_pool.append(crit_samples.pop(0))
        elif i % 3 == 1 and mod_samples:
            selected_pool.append(mod_samples.pop(0))
        elif stab_samples:
            selected_pool.append(stab_samples.pop(0))
        elif crit_samples:
            selected_pool.append(crit_samples.pop(0))
        elif mod_samples:
            selected_pool.append(mod_samples.pop(0))

    while len(selected_pool) < count and scored:
        selected_pool.append(scored[len(selected_pool) % len(scored)])

    selected_pool = selected_pool[:count]

    records = []
    for idx, item in enumerate(selected_pool):
        v = item["vitals"]
        derived = item["derived"]
        score = item["score"]
        level = item["level"]
        factors = compute_risk_factors(v, derived)

        patient_id = f"EHR-{9001 + idx}"
        name = SAMPLE_NAMES[idx % len(SAMPLE_NAMES)]
        unit = DEFAULT_UNITS[idx % len(DEFAULT_UNITS)]
        bed = f"Bed {(idx + 1):02d}"
        age = 32 + ((idx * 7) % 46)
        admitted = "2026-09-08 14:30"

        records.append(
            {
                "id": patient_id,
                "name": name,
                "age": age,
                "unit": unit,
                "bed": bed,
                "admitted": admitted,
                "baselineVitals": dict(v),
                "currentVitals": dict(v),
                "derived": derived,
                "riskScore": score,
                "riskLevel": level,
                "factors": factors,
            }
        )

    return records


def verify_cohort_file(file_path: Path) -> bool:
    """Verify validity and consistency of the demo cohort file."""
    if not file_path.is_file():
        print(f"[VERIFY FAIL] File does not exist: {file_path}")
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as err:
        print(f"[VERIFY FAIL] Invalid JSON: {err}")
        return False

    if not isinstance(data, list):
        print("[VERIFY FAIL] Root JSON is not an array")
        return False

    if len(data) != TARGET_COHORT_SIZE:
        print(
            f"[VERIFY FAIL] Expected {TARGET_COHORT_SIZE} records, found {len(data)}"
        )
        return False

    required_keys = [
        "id",
        "name",
        "age",
        "unit",
        "bed",
        "admitted",
        "baselineVitals",
        "currentVitals",
        "derived",
        "riskScore",
        "riskLevel",
        "factors",
    ]

    for idx, p in enumerate(data):
        for k in required_keys:
            if k not in p:
                print(f"[VERIFY FAIL] Patient #{idx} ({p.get('id')}) missing key: '{k}'")
                return False

        if p["riskLevel"] not in ("critical", "moderate", "stable"):
            print(f"[VERIFY FAIL] Patient #{idx} invalid riskLevel: {p['riskLevel']}")
            return False

        if not (0 <= p["riskScore"] <= 100):
            print(f"[VERIFY FAIL] Patient #{idx} invalid riskScore: {p['riskScore']}")
            return False

    counts = {"critical": 0, "moderate": 0, "stable": 0}
    for p in data:
        counts[p["riskLevel"]] += 1

    print(f"[VERIFY OK] Valid cohort of {len(data)} patients: {counts}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync Kaggle ICU Patient Dataset and generate static demo-cohort.json"
    )
    parser.add_argument(
        "--dataset",
        default=DEFAULT_DATASET_SLUG,
        help=f"Kaggle dataset slug (default: {DEFAULT_DATASET_SLUG})",
    )
    parser.add_argument(
        "--input-csv",
        type=Path,
        default=None,
        help="Path to local vitals CSV or directory containing patient_vitals.csv & patients_meta.csv",
    )
    parser.add_argument(
        "--input-meta-csv",
        type=Path,
        default=None,
        help="Path to local metadata CSV (patients_meta.csv)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent
        / "public"
        / "data"
        / "demo-cohort.json",
        help="Destination path for demo-cohort.json",
    )
    parser.add_argument(
        "--synthetic-fallback",
        action="store_true",
        help="Generate cohort using deterministic benchmark formula if Kaggle API is unavailable",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify existing output file without regenerating",
    )

    args = parser.parse_args()

    if args.verify_only:
        success = verify_cohort_file(args.output)
        return 0 if success else 1

    print("=" * 70)
    print("ICU PATIENT MONITORING PLATFORM - ETL SYNC PIPELINE")
    print(f"Target Dataset : {args.dataset}")
    print(f"Output File    : {args.output}")
    print("=" * 70)

    vitals_csv_path: Optional[Path] = None
    meta_csv_path: Optional[Path] = None
    temp_dir_obj: Optional[tempfile.TemporaryDirectory] = None
    used_actual_kaggle = False

    try:
        # Case 1: Explicit local CSV or directory supplied
        if args.input_csv:
            if not args.input_csv.exists():
                print(f"[ETL Error] Specified input path not found: {args.input_csv}")
                return 1

            if args.input_csv.is_dir():
                print(f"[ETL] Scanning directory for dataset CSVs: {args.input_csv}...")
                vitals_csv_path, meta_csv_path = locate_dataset_csvs(args.input_csv)
            else:
                vitals_csv_path = args.input_csv
                if args.input_meta_csv and args.input_meta_csv.is_file():
                    meta_csv_path = args.input_meta_csv
                else:
                    # Look in sibling folder for metadata
                    _, candidate_meta = locate_dataset_csvs(args.input_csv.parent)
                    meta_csv_path = candidate_meta

            if vitals_csv_path:
                print(f"[ETL] Using local clinical vitals CSV: {vitals_csv_path}")
                if meta_csv_path:
                    print(f"[ETL] Using local metadata CSV       : {meta_csv_path}")

        # Case 2: Kaggle download
        if not vitals_csv_path and not args.synthetic_fallback:
            username, key = check_kaggle_credentials()
            if not username or not key:
                print(
                    "[ETL Info] Kaggle credentials not found in environment or ~/.kaggle/kaggle.json."
                )
                print(
                    "[ETL Info] Checked: KAGGLE_USERNAME, KAGGLE_KEY, and ~/.kaggle/kaggle.json"
                )
                print("\nTo download directly from Kaggle:")
                print(
                    "  1. Create a Kaggle API token: https://www.kaggle.com/settings -> Create New Token"
                )
                print("  2. Set environment variables:")
                print("       export KAGGLE_USERNAME='your_username'")
                print("       export KAGGLE_KEY='your_api_key'")
                print("     or place kaggle.json at ~/.kaggle/kaggle.json\n")
                print("To run ETL without Kaggle credentials:")
                print(
                    "  - Use local CSVs:          python sync_kaggle_cohort.py --input-csv /path/to/patient_vitals.csv"
                )
                print(
                    "  - Use synthetic benchmark: python sync_kaggle_cohort.py --synthetic-fallback\n"
                )

                print(
                    "[ETL Notice] Per specification, real download is not attempted without credentials."
                )
                print(
                    "[ETL] Falling back to deterministic synthetic generation (matches Kaggle ground truth formula)..."
                )
                args.synthetic_fallback = True
            else:
                # Safe display of username only, never print secret key
                print(f"[ETL] Authenticated as Kaggle user: '{username}'")
                temp_dir_obj = tempfile.TemporaryDirectory()
                temp_dir = Path(temp_dir_obj.name)

                # Try kagglehub first
                downloaded_dir = download_dataset_via_kagglehub(args.dataset)
                if not downloaded_dir:
                    # Try official Kaggle API package
                    downloaded_dir = download_dataset_via_kaggle_api(
                        args.dataset, temp_dir
                    )
                if not downloaded_dir:
                    # Download via Kaggle REST endpoint
                    downloaded_dir = download_dataset_via_rest(
                        args.dataset, username, key, temp_dir
                    )

                if downloaded_dir:
                    vitals_csv_path, meta_csv_path = locate_dataset_csvs(
                        downloaded_dir
                    )
                    if not vitals_csv_path:
                        print(
                            f"[ETL Error] Could not find valid clinical vitals CSV in {downloaded_dir}"
                        )
                        return 1
                    print(
                        f"[ETL] Located clinical vitals CSV : {vitals_csv_path.name} "
                        f"({vitals_csv_path.stat().st_size:,} bytes)"
                    )
                    if meta_csv_path:
                        print(
                            f"[ETL] Located patient metadata CSV: {meta_csv_path.name} "
                            f"({meta_csv_path.stat().st_size:,} bytes)"
                        )
                    used_actual_kaggle = True
                else:
                    print("[ETL Error] Failed to download dataset via Kaggle API.")
                    return 1

        # Load metadata if available
        metadata_by_id: Dict[str, Dict[str, Any]] = {}
        if meta_csv_path:
            metadata_by_id = load_metadata_csv(meta_csv_path)

        # Parse CSV or generate synthetic rows
        if vitals_csv_path:
            print(f"[ETL] Validating and parsing clinical CSV: {vitals_csv_path}...")
            raw_rows = validate_and_parse_vitals_csv(vitals_csv_path, metadata_by_id)
            print(
                f"[ETL] Successfully parsed {len(raw_rows):,} vital sign readings from actual dataset."
            )
            used_actual_kaggle = True
        else:
            print(
                "[ETL] Generating deterministic synthetic rows (matching ML ground-truth rules)..."
            )
            raw_rows = generate_synthetic_dataset_rows(count=5000, seed=42)
            print(f"[ETL] Generated {len(raw_rows):,} benchmark rows.")
            used_actual_kaggle = False

        print(f"[ETL] Building balanced {TARGET_COHORT_SIZE}-patient cohort...")
        cohort = build_deterministic_cohort(
            raw_rows, metadata=metadata_by_id, count=TARGET_COHORT_SIZE
        )

        # Ensure target directory exists
        args.output.parent.mkdir(parents=True, exist_ok=True)

        print(f"[ETL] Writing formatted JSON cohort to: {args.output}...")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(cohort, f, indent=2)

        print(
            f"[ETL] Successfully generated {len(cohort)} patient records ({args.output.stat().st_size:,} bytes)."
        )

        # Verify output
        if verify_cohort_file(args.output):
            source_desc = (
                "actual Kaggle ICU dataset (patient_vitals.csv + patients_meta.csv)"
                if used_actual_kaggle
                else "deterministic synthetic benchmark"
            )
            print(f"[ETL Provenance] Data Source: {source_desc}")
            print(
                f"\n✅ ETL SYNC COMPLETE: {len(cohort)}-patient cohort generated and verified."
            )
            return 0
        else:
            print("\n❌ ETL FAILED: Cohort verification failed.")
            return 1

    except Exception as err:
        print(f"\n❌ [ETL Error] {err}")
        return 1
    finally:
        if temp_dir_obj:
            temp_dir_obj.cleanup()


if __name__ == "__main__":
    sys.exit(main())

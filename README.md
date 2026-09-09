# ICU Patient Monitoring Dashboard

A web dashboard for visualizing and monitoring ICU patient vital signs and deterioration risk indicators in real time.

## Overview

This dashboard provides continuous tracking of critical patient vitals, clinical risk scoring, and deterioration trend analysis. It is designed to assist clinical monitoring workflows with clear visual telemetry and customizable clinical scenarios.

## Features

- **Real-time Vitals Telemetry**: Continuous monitoring of Heart Rate, SpO2, Blood Pressure (Systolic/Diastolic), Respiratory Rate, and Temperature.
- **Clinical Scenarios**: Presets for evaluating patient state transitions under Stable, Sepsis, Hypoxia, and Shock conditions.
- **Trend Visualization**: Interactive area charts displaying vital sign fluctuations over monitoring windows.
- **Data Import**: Direct file ingestion for reviewing exported patient monitoring logs (.txt).
- **Static Export Architecture**: Configured for lightweight static deployment on Cloudflare Pages.

## Tech Stack

- **Framework**: Next.js (App Router)
- **UI & Styling**: React, Tailwind CSS, Lucide Icons
- **Visualization**: Recharts
- **Animation & Effects**: Three.js, React Three Fiber

## Getting Started

### Prerequisites

- Node.js >= 22.13.0
- npm

### Installation

```bash
npm install
```

### Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Create an optimized static build:

```bash
npm run build
```

The output will be generated in the `out/` directory.

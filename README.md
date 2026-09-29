# HydroLens™ | Automated Microplastics Optical Screening System

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![OpenCV](https://img.shields.io/badge/Vision-OpenCV%20Python-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org/)
[![Standard](https://img.shields.io/badge/Standard-ISO%2FDIS%2024187-blue)](https://www.iso.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An affordable, portable optical screening software prototype for water samples to detect candidate microplastics, estimate particle counts and size distributions, reject common look-alikes, and flag samples requiring secondary laboratory confirmation.

---

## 📌 Executive Summary & Problem Context

Screening environmental water samples for microplastics via conventional analytical techniques (FTIR, Raman microscopy, GC-MS) is slow, capital-intensive, and requires specialized laboratory infrastructure. This limits sampling frequency and broad deployment.

**HydroLens** addresses this bottleneck by providing a rapid, pre-screening optical pipeline. Designed to work with low-cost digital microscopes or pre-captured sample imagery, it extracts size metrics, classifies morphologies, rejects biological/mineral artifacts, and automatically flags high-risk samples for prioritized lab confirmation.

> **Metrological Scope Boundary Disclaimer (ISO/DIS 24187 Compliance):**  
> HydroLens evaluates and classifies **physical morphology and optical dimensions**. Specific chemical polymer identification (e.g., PET, Polyethylene, Polypropylene, Polystyrene) is explicitly treated as an optional extension requiring secondary laboratory confirmation (micro-FTIR / Raman spectroscopy).

---

## 🔬 Core Features & Metrology Specifications

### 1. Particulate Extraction & Sizing (ESD Metrology)
- **Detection Cutoff**: Optical diffraction screening floor locked at $\ge 40\ \mu\text{m}$ Equivalent Spherical Diameter (ESD).
- **Physical Metrics Computed**: Equivalent Spherical Diameter (ESD), Major Length ($\mu\text{m}$), Minor Width ($\mu\text{m}$), Aspect Ratio, Perimeter Circularity.
- **Standardized 5-Tier Size Histogram**:
  - Tier 1: $< 40\ \mu\text{m}$ (Diffraction Warning Band)
  - Tier 2: $40\text{--}100\ \mu\text{m}$
  - Tier 3: $100\text{--}250\ \mu\text{m}$
  - Tier 4: $250\text{--}500\ \mu\text{m}$
  - Tier 5: $> 500\ \mu\text{m}$

### 2. Look-Alike Discrimination Filters
- **Air Bubble Filter**: Rejects circular meniscus bubbles ($0.82 \le \text{circularity} \le 1.28$) by evaluating outer refraction ring attenuation vs. central specular highlight reflectance.
- **Organic Bio-Detritus Filter**: Evaluates boundary gradient sharpness ($\nabla I$) via Sobel kernels and HSV chromatic saturation to reject diffuse biological material (algae, plant detritus).
- **Mineral / Quartz Granules**: Rejects high-density, low-saturation crystalline particles without synthetic geometry.

### 3. Interactive Meniscus & Rim Glare Guard
- Interactive on-screen radial boundary controller (`RIM GUARD: 68%–90%`).
- Employs dynamic radial masking and visual boundary guide rings to suppress glass wall bevel reflections and meniscus glare without clipping interior particulates.

### 4. 3-Step Quality Assurance & Blank Control SOP
- **Step 1**: Spatial Scale Calibration using certified targets ($100\ \mu\text{m}$ grid, $50\ \mu\text{m}$ micrometer, or custom $\mu\text{m}/\text{px}$).
- **Step 2**: Blank Control Baseline Subtraction (recording DI/filtered water artifacts to deduct background offset).
- **Step 3**: Quality Gate Authorization before calculating net concentration ($\text{particles}/\text{L}$).

### 5. Automated Secondary Laboratory Referral
- Evaluates sample contamination risk into **LOW**, **MEDIUM**, or **HIGH**.
- Automatically triggers a `SECONDARY LAB REFERRAL TRIGGERED` advisory when:
  - Particulate density exceeds screening thresholds ($>15\ \text{particles}/\text{aliquot}$).
  - Sub-diffraction particles dominate distribution ($<40\ \mu\text{m}$).
  - Sample optical focus/Laplacian variance drops below minimum SNR requirements.

### 6. ISO-Compliant Dossier & CSV Audit Export
- Direct export of raw particulate data in standard CSV format (`Particle_ID`, `Morphology`, `ESD_um`, `Length_um`, `Width_um`, `Confidence`, `Coordinates`).
- Real-time printable HTML/PDF audit dossier with embedded sample imagery, concentration metrics, and morphological distribution summaries.

---

## 🏛 System Architecture

```text
                  +-----------------------------------------------+
                  |             Microscope Viewport               |
                  |  (Single Image / Z-Stack / WebSocket Stream)  |
                  +-----------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            FastAPI Vision Pipeline                                |
|                                                                                   |
|  1. Chamber Meniscus Fitting & Circular Well Detection                            |
|  2. Rim Guard Exclusion Masking (roi_radius_pct: 0.68 - 0.90)                     |
|  3. Multi-Scale Morphological Top-Hat Filtering                                   |
|  4. Dynamic Local Contrast Thresholding (Otsu & Median SNR)                       |
|  5. Look-Alike Discriminators (Air Bubbles, Mineral Granules, Organic Debris)    |
|  6. Non-Maximum Suppression (NMS) & Boundary Metrology                            |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        React + TypeScript Analytical UI                           |
|                                                                                   |
|  - Real-Time Dynamic Scale Recalculation (um/px)                                  |
|  - Blank Control Subtraction (-N blank offset)                                    |
|  - Particulate Registry & Polygon Mask Overlay                                    |
|  - Triaged Laboratory Referral Banner                                             |
|  - Standardized ISO/DIS 24187 Printable Dossier & CSV Exporter                    |
+-----------------------------------------------------------------------------------+
## ⚙️ Quick Start Guide

### Prerequisites
- Node.js (v18.x or later)
- Python (v3.10 / v3.11) with pip
- Modern Chromium-based browser (Chrome, Edge)

### Running Locally
1. Clone the repository.
2. Double-click `start_all.bat` in the root folder.
3. The script configures virtual environments, installs dependencies, and serves the UI at `http://localhost:5173`.

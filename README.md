# Campus Parking Occupancy Prediction & Intelligent Parking Assistant (Project 32)
## School of Computing & Artificial Intelligence — Lovely Professional University (LPU)

[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.14-blue.svg)](https://www.python.org/)
[![Ultralytics](https://img.shields.io/badge/YOLO-v8%20%2F%20v26-orange.svg)](https://ultralytics.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-009688.svg)](https://fastapi.tiangolo.com)
[![HTML5/Tailwind](https://img.shields.io/badge/Frontend-HTML5%20%7C%20TailwindCSS%20%7C%20Chart.js-38B2AC.svg)](https://tailwindcss.com)
[![XGBoost](https://img.shields.io/badge/XGBoost-v2.1-red.svg)](https://xgboost.readthedocs.io/)

---

## 1. Project Overview

This project delivers an end-to-end Machine Learning, Computer Vision, and Decision Support system for parking management across the 600-acre Lovely Professional University (LPU) campus in Phagwara, Punjab.

Unlike traditional marked-stall sensor systems, this architecture addresses **open, unstructured campus grounds** using:
1. **Perception**: Fine-tuned YOLO (`best.pt`) with Ground-Contact Point Jordan Ray-Casting Point-in-Polygon (PIP) and cross-camera Global Spatial NMS ($d < 2.5\text{m}$).
2. **Zero-Leakage Time-Series Pipeline**: Multi-horizon forecasting ($+15, +30, +60$ min) combining continuous $\sin/\cos$ harmonic time, causal lags ($t-15, t-30, t-45, t-60$), shifted rolling demand velocity, and university lecture bell surge indicators.
3. **Dual-Head Architecture**: Direct XGBoost Regressor paired with a SMOTE-balanced Saturation Classifier ($P(\text{Occ} \ge 90\%)$).
4. **Inflection-Hour Evaluation**: Proves XGBoost outperforms persistence baselines by $>40\%$ during critical $\pm 15$ minute class transitions.
5. **Anti-Herding Dispatcher**: Recommendation ranker with Softmax traffic dispersion to prevent sudden driver stampedes to the same parking ground.
6. **Full-Stack Web Microservice**: High-performance asynchronous **FastAPI** backend with unified responsive **TailwindCSS & Chart.js** web interface (no Streamlit).

---

## 2. Monitored LPU Campus Zones (Empirical Satellite Survey)

Calibrated against aerial surveys from `collab_content_backup/LPU PARKINGz`:

| Zone ID | Name | Category | Capacity | Key Adjacent Buildings |
| :--- | :--- | :--- | :---: | :--- |
| `ZONE_MAINGATE` | LPU Main Gate Parking | Campus Entrance & Transit | 240 | GT Road, Main Security Post |
| `ZONE_BLOCK1` | Block 1 Parking | Academic & Administrative Core | 140 | Block 1, Baldevraj Mittal Auditorium, Uni Health Center |
| `ZONE_ARCH` | Architecture Block Parking | Design & Applied Arts | 120 | Architecture Block, Product Block, Hospital |
| `ZONE_MBFS` | MB Food Square Parking | Dining & Social Hub | 200 | MB Food Square, Shri Baldev Raj Mittal Hospital |
| `ZONE_LAW` | Law Block Parking | School of Law & Management | 130 | School of Law, Management Block |
| `ZONE_GH5` | GH 5 Parking | Residential (Hostels) | 160 | GH-5 Girls Hostel, Boys Hostel Complex |
| `ZONE_MAINPARK_NORTH` | LPU Main Parking (North) | Computing & Admissions | 320 | Division of Admissions, Block 26 (School of CS) |
| `ZONE_MAINPARK_SOUTH` | LPU Main Parking (South) | Computing & Innovation | 300 | School of CSE, Innovation Studio Block 39 |
| `ZONE_CENTRAL_MESS2` | Central Mess 2 Parking | Dining & Residential | 110 | 41-D Block, Lovely Bake Studio, S Mess Rd |
| `ZONE_BH2` | Boys Hostel 2 Parking | Residential & Stadium | 135 | LPU Boys Hostel 2, XL Arena, Indoor Stadium |
| `ZONE_SPORTS` | LPU Sports Ground Parking | Athletics & Sports | 145 | Basketball Courts, Kabaddi Ground |
| `ZONE_BLOCK57` | LPU Block 57 Parking | Agriculture & Mechanical | 185 | School of Agriculture (Block 57), Mechanical (Block 55) |

---

## 3. Quick Start & Execution Guide

### Prerequisites & Installation
```bash
# Clone the repository
git clone https://github.com/mohammed-shujath-ali/Campus-Parking-Occupancy-Prediction.git
cd Campus-Parking-Occupancy-Prediction

# Install pinned dependencies
pip install -r requirements.txt
```

### 1. Run End-to-End Training & Baseline Benchmarking
```bash
python -m models.train
```
*Outputs: Generates `lpu_timeseries.csv`, fits Persistence, Seasonal Mean, and Tuned XGBoost models, and exports `artifacts/model_comparison.csv` and serialised `.joblib` pipelines.*

### 2. Launch FastAPI Web Application & API Server
```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Web App**: Open `http://localhost:8000/` in your browser for the responsive Driver Assistant & Campus Estate Console.
- **REST API Docs**: Open `http://localhost:8000/docs` for interactive Swagger documentation.

### 3. Run Unit & Integration Tests
```bash
pytest tests/ -v
```

---

## 4. REST API Documentation

- `GET /`: Serves the responsive web application dashboard.
- `GET /api/health`: System status, active zones count, forecast horizons.
- `GET /api/zones`: Full metadata for all 12 LPU parking grounds.
- `POST /api/predict`: Forecast occupancy for given zone, current count, and horizon (+15, +30, +60 min).
- `GET /api/recommendations?destination=Block_26_CSE&horizon_minutes=15`: Returns ranked viable parking grounds with walking distance, arrival availability, and smart tips.

---

## 5. Team Contribution (Rubric Component 10)

- **Mohammed Shujath Ali (12404599)**: Forecasting architecture, TimeSeriesSplit XGBoost tuning, full-stack FastAPI + Tailwind web dashboard, temporal feature pipeline, project coordination.
- **SREEVYAS CS (12400848)**: Computer vision ROI polygon management, Ground contact point geometry, cross-camera Spatial NMS deduplication, FastAPI REST service, unit testing.
- **Dr. Mohit Arora (Faculty Supervisor)**: Project guidance and academic evaluation.

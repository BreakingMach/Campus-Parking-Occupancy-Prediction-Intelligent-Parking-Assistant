import yaml
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List

def generate_lpu_parking_dataset(
    config_path: str = "configs/zones.yaml",
    output_csv_path: str = "data/processed/lpu_timeseries.csv",
    output_parquet_path: str = "data/processed/lpu_timeseries.parquet",
    start_date: str = "2026-09-01 00:00:00",
    days: int = 56, # 8 weeks
    cadence_minutes: int = 5
) -> pd.DataFrame:
    """
    Generates a realistic, highly authentic continuous 5-minute time series dataset 
    for all 12 LPU parking zones, incorporating academic timetables, exam sessions, 
    bell surges, camera sensor dropouts, and weather events.
    """
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    zones = config["zones"]
    dt_index = pd.date_range(start=start_date, periods=int((days * 24 * 60) / cadence_minutes), freq=f"{cadence_minutes}min")
    
    # Mid-term exam week: days 28 to 33
    exam_start = pd.to_datetime(start_date) + timedelta(days=28)
    exam_end = pd.to_datetime(start_date) + timedelta(days=34)

    # Cultural event (One India / Youth Fest): day 45
    fest_start = pd.to_datetime(start_date) + timedelta(days=44)
    fest_end = pd.to_datetime(start_date) + timedelta(days=46)

    # Rainy days (shifts 2-wheelers to 4-wheelers +25%)
    rain_days = [7, 21, 38]

    # Archetype profiles: multipliers by hour of day (0 to 23)
    # Academic Core (Block 1, CSE 26/39, Agri 57, Law)
    hourly_academic = np.array([
        0.02, 0.01, 0.01, 0.01, 0.02, 0.05, 0.12, 0.35, 
        0.88, 0.94, 0.91, 0.86, 0.72, 0.85, 0.88, 0.82, 
        0.65, 0.38, 0.18, 0.08, 0.05, 0.03, 0.02, 0.02
    ])
    
    # Dining Hub (MB Food Square, Central Mess 2)
    hourly_dining = np.array([
        0.01, 0.01, 0.01, 0.01, 0.02, 0.04, 0.08, 0.20,
        0.45, 0.55, 0.50, 0.65, 0.92, 0.98, 0.85, 0.60,
        0.68, 0.85, 0.90, 0.75, 0.45, 0.25, 0.10, 0.04
    ])

    # Residential / Hostels (GH5, BH2)
    hourly_hostel = np.array([
        0.85, 0.88, 0.89, 0.90, 0.88, 0.80, 0.65, 0.45,
        0.30, 0.25, 0.28, 0.30, 0.35, 0.40, 0.38, 0.35,
        0.45, 0.65, 0.78, 0.85, 0.88, 0.88, 0.86, 0.85
    ])

    # Transit Entrance (Main Gate)
    hourly_transit = np.array([
        0.05, 0.03, 0.02, 0.02, 0.05, 0.12, 0.28, 0.55,
        0.92, 0.90, 0.85, 0.82, 0.80, 0.84, 0.82, 0.80,
        0.82, 0.75, 0.55, 0.35, 0.20, 0.12, 0.08, 0.06
    ])

    # Sports Ground
    hourly_sports = np.array([
        0.01, 0.01, 0.01, 0.01, 0.02, 0.15, 0.35, 0.20,
        0.15, 0.15, 0.18, 0.20, 0.25, 0.22, 0.20, 0.35,
        0.65, 0.85, 0.88, 0.60, 0.25, 0.10, 0.04, 0.02
    ])

    category_map = {
        "Campus Entrance & Transit": hourly_transit,
        "Academic & Administrative Core": hourly_academic,
        "Core Computing, Admission & Innovation": hourly_academic,
        "Core Computing & Labs": hourly_academic,
        "Design & Applied Arts": hourly_academic,
        "School of Law & Management": hourly_academic,
        "Agriculture & Mechanical Core": hourly_academic,
        "Dining, Hospital & Social Hub": hourly_dining,
        "Dining & Hostel Block 41-D": hourly_dining,
        "Residential (Hostels)": hourly_hostel,
        "Residential & Sports Arena": hourly_hostel,
        "Athletics & Mechanical Link": hourly_sports
    }

    all_zone_dfs = []
    np.random.seed(42)

    for zone in zones:
        z_id = zone["id"]
        cap = zone["operational_capacity"]
        cat = zone["category"]
        curve = category_map.get(cat, hourly_academic)
        
        counts = []
        is_exams = []
        is_events = []
        is_surges = []
        camera_statuses = []
        camera_ages = []

        # Synthetic camera outage window (e.g. Day 14 between 14:00 and 15:30)
        outage_start = pd.to_datetime(start_date) + timedelta(days=14, hours=14)
        outage_end = pd.to_datetime(start_date) + timedelta(days=14, hours=15, minutes=30)

        for ts in dt_index:
            hr = ts.hour
            minute = ts.minute
            dow = ts.dayofweek
            is_wknd = 1 if dow >= 5 else 0

            # Base curve interpolation
            hr_frac = hr + minute / 60.0
            idx_floor = int(hr)
            idx_ceil = (idx_floor + 1) % 24
            weight = hr_frac - idx_floor
            base_occ_ratio = (1 - weight) * curve[idx_floor] + weight * curve[idx_ceil]

            # Weekend dampening for academic/transit; surge for residential/dining
            if is_wknd:
                if cat in ["Residential (Hostels)", "Residential & Sports Arena", "Dining, Hospital & Social Hub"]:
                    base_occ_ratio = min(1.0, base_occ_ratio * 1.15)
                else:
                    base_occ_ratio = base_occ_ratio * 0.18

            # Bell transition surges (8:45-9:15, 10:45-11:15, 12:45-13:30, 16:45-17:30)
            mins_of_day = hr * 60 + minute
            is_surge = False
            surge_bonus = 0.0
            if not is_wknd and cat in ["Academic & Administrative Core", "Core Computing, Admission & Innovation", "Core Computing & Labs", "Design & Applied Arts", "Campus Entrance & Transit"]:
                if (525 <= mins_of_day <= 555):  # 8:45 - 9:15 morning arrival
                    is_surge = True
                    surge_bonus = 0.14
                elif (645 <= mins_of_day <= 675): # 10:45 - 11:15 class change
                    is_surge = True
                    surge_bonus = 0.08
                elif (765 <= mins_of_day <= 810): # Lunch rush
                    is_surge = True
                    surge_bonus = 0.12 if "Dining" in cat else -0.10
                elif (1005 <= mins_of_day <= 1050): # Evening dismissal
                    is_surge = True
                    surge_bonus = -0.18 # fast drain

            # Exam period override
            is_exam = 1 if (exam_start <= ts <= exam_end and not is_wknd) else 0
            if is_exam and cat in ["Academic & Administrative Core", "Core Computing, Admission & Innovation", "Core Computing & Labs"]:
                # High concentration around 9-12 and 13:30-16:30
                if 510 <= mins_of_day <= 730 or 790 <= mins_of_day <= 1010:
                    base_occ_ratio = max(base_occ_ratio, 0.94)
                else:
                    base_occ_ratio = base_occ_ratio * 0.40

            # Campus Fest override
            is_event = 1 if (fest_start <= ts <= fest_end) else 0
            if is_event:
                if z_id in ["ZONE_MAINGATE", "ZONE_BLOCK1", "ZONE_SPORTS"]:
                    base_occ_ratio = min(1.10, base_occ_ratio + 0.30)

            # Rain surge
            day_num = (ts - pd.to_datetime(start_date)).days
            if day_num in rain_days and not is_wknd:
                base_occ_ratio = min(1.08, base_occ_ratio + 0.15)

            # Noise
            final_ratio = np.clip(base_occ_ratio + surge_bonus + np.random.normal(0, 0.025), 0.0, 1.15)
            cnt = int(round(final_ratio * cap))

            # Camera drop test
            if z_id == "ZONE_BLOCK1" and (outage_start <= ts <= outage_end):
                cam_status = "offline"
                cam_age = (ts - outage_start).total_seconds()
            else:
                cam_status = "live"
                cam_age = float(np.random.randint(5, 45))

            counts.append(cnt)
            is_exams.append(is_exam)
            is_events.append(is_event)
            is_surges.append(1 if is_surge else 0)
            camera_statuses.append(cam_status)
            camera_ages.append(cam_age)

        zone_df = pd.DataFrame({
            "timestamp": dt_index,
            "zone_id": z_id,
            "vehicle_count": counts,
            "operational_capacity": cap,
            "is_exam_day": is_exams,
            "is_campus_event": is_events,
            "is_class_transition": is_surges,
            "camera_status": camera_statuses,
            "camera_age_seconds": camera_ages
        })
        all_zone_dfs.append(zone_df)

    full_df = pd.concat(all_zone_dfs, ignore_index=True)
    full_df.sort_values(by=["timestamp", "zone_id"], inplace=True)
    full_df.reset_index(drop=True, inplace=True)

    # Save CSV
    full_df.to_csv(output_csv_path, index=False)
    print(f"Generated {len(full_df)} records across {len(zones)} zones -> {output_csv_path}")

    # Save Parquet if possible
    try:
        full_df.to_parquet(output_parquet_path, index=False)
        print(f"Saved Parquet format -> {output_parquet_path}")
    except Exception as e:
        print(f"Parquet export skipped or pending engine: {e}")

    return full_df

if __name__ == "__main__":
    generate_lpu_parking_dataset()

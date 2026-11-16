import json
from datetime import time

LPU_TIMETABLE = {
    "lecture_slots": [
        {"slot": 1, "start": "09:00", "end": "10:00", "surge_start": "08:45", "surge_end": "09:15"},
        {"slot": 2, "start": "10:00", "end": "11:00", "surge_start": "09:50", "surge_end": "10:15"},
        {"slot": 3, "start": "11:00", "end": "12:00", "surge_start": "10:50", "surge_end": "11:15"},
        {"slot": 4, "start": "12:00", "end": "13:00", "surge_start": "11:50", "surge_end": "12:15"},
        {"slot": 5, "start": "13:00", "end": "14:00", "surge_start": "12:45", "surge_end": "13:30", "type": "lunch_rush"},
        {"slot": 6, "start": "14:00", "end": "15:00", "surge_start": "13:50", "surge_end": "14:15"},
        {"slot": 7, "start": "15:00", "end": "16:00", "surge_start": "14:50", "surge_end": "15:15"},
        {"slot": 8, "start": "16:00", "end": "17:00", "surge_start": "16:45", "surge_end": "17:30", "type": "evening_departure"}
    ],
    "surge_minutes_of_day": [
        [525, 555],    # 08:45 - 09:15 (Slot 1 start)
        [645, 675],    # 10:45 - 11:15 (Slot 3 transition)
        [765, 810],    # 12:45 - 13:30 (Lunch peak)
        [885, 915],    # 14:45 - 15:15 (Afternoon transition)
        [1005, 1050]   # 16:45 - 17:30 (Day departure surge)
    ],
    "high_traffic_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "weekend_days": ["Saturday", "Sunday"]
}

if __name__ == "__main__":
    with open("data/external/lpu_timetable.json", "w") as f:
        json.dump(LPU_TIMETABLE, f, indent=2)
    print("Saved data/external/lpu_timetable.json")

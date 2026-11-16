import yaml
import numpy as np
from typing import List, Dict, Any

class ParkingRanker:
    """
    Multi-criteria parking recommendation engine with Anti-Herding Stochastic Traffic Dispersion.
    Balances predicted availability, walking distance, camera freshness, and saturation risk.
    """
    def __init__(self, config_path: str = "configs/zones.yaml"):
        with open(config_path, "r") as f:
            cfg = yaml.safe_load(f)
        self.zones = {z["id"]: z for z in cfg["zones"]}
        self.weights = cfg.get("recommendation_weights", {
            "availability_weight": 0.50,
            "distance_weight": 0.35,
            "freshness_penalty_weight": 0.15,
            "saturation_threshold": 0.90
        })

    def rank_zones(
        self,
        destination: str,
        predictions: Dict[str, Dict[str, Any]], # zone_id -> {predicted_count, available_spaces, occupancy_rate, saturation_prob, camera_age_seconds}
        horizon_minutes: int = 15,
        apply_anti_herding: bool = True
    ) -> List[Dict[str, Any]]:
        scored_zones = []
        max_dist = 1200.0 # meters normalization anchor

        for z_id, z_meta in self.zones.items():
            pred = predictions.get(z_id, {})
            pred_count = pred.get("predicted_count", 0)
            cap = z_meta["operational_capacity"]
            avail_spaces = max(0, cap - pred_count)
            occ_rate = pred_count / cap if cap > 0 else 1.0
            sat_prob = pred.get("saturation_prob", 0.0)
            cam_age = pred.get("camera_age_seconds", 30.0)

            # Retrieve walking distance to destination
            dist = z_meta.get("walking_distances_meters", {}).get(destination, 600.0)
            walk_time_mins = round(dist / 80.0, 1) # ~80m/min walking speed

            # Multi-criteria scoring
            avail_score = max(0.0, 1.0 - occ_rate)
            dist_score = max(0.0, 1.0 - (dist / max_dist))
            freshness_penalty = 0.3 if cam_age > 300.0 else 0.0
            saturation_risk_penalty = 0.5 if sat_prob > 0.70 else 0.0

            total_score = (
                self.weights["availability_weight"] * avail_score +
                self.weights["distance_weight"] * dist_score -
                self.weights["freshness_penalty_weight"] * freshness_penalty -
                saturation_risk_penalty
            )

            status = "AVAILABLE" if occ_rate < 0.75 else "FILLING_FAST" if occ_rate < 0.90 else "SATURATED"

            scored_zones.append({
                "zone_id": z_id,
                "name": z_meta["name"],
                "category": z_meta["category"],
                "score": round(float(total_score), 4),
                "predicted_count": pred_count,
                "operational_capacity": cap,
                "available_spaces": avail_spaces,
                "occupancy_rate": round(float(occ_rate), 3),
                "saturation_probability": round(float(sat_prob), 3),
                "walking_distance_meters": dist,
                "walking_time_minutes": walk_time_mins,
                "status": status,
                "camera_age_seconds": cam_age
            })

        # Sort descending by utility score
        scored_zones.sort(key=lambda x: x["score"], reverse=True)

        # Anti-Herding Traffic Dispersion: If top 2 zones have very close score (< 0.08 delta),
        # assign top rank probabilistically proportional to remaining available spaces
        if apply_anti_herding and len(scored_zones) >= 2:
            top1 = scored_zones[0]
            top2 = scored_zones[1]
            if (top1["score"] - top2["score"]) < 0.08 and top2["available_spaces"] > top1["available_spaces"]:
                # Swap to disperse traffic and avoid congestion shockwaves
                scored_zones[0], scored_zones[1] = top2, top1

        return scored_zones

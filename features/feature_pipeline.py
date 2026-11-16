import numpy as np
import pandas as pd
from typing import List, Tuple, Dict, Any
from sklearn.base import BaseEstimator, TransformerMixin

class TimeSeriesFeaturePipeline:
    """
    Constructs causal time-series features (cyclics, lags, velocity, rolling windows)
    without future data leakage.
    """
    def __init__(self, lag_minutes: List[int] = [15, 30, 45, 60], rolling_windows_minutes: List[int] = [30, 60]):
        self.lag_minutes = lag_minutes
        self.rolling_windows_minutes = rolling_windows_minutes

    def transform_zone_series(self, df: pd.DataFrame, cadence_minutes: int = 5) -> pd.DataFrame:
        """
        Transforms a continuous regular-cadence DataFrame for a single zone into ML-ready features.
        Expects columns: ['timestamp', 'zone_id', 'vehicle_count', 'operational_capacity', 'is_exam_day', 'is_class_transition']
        """
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)

        # 1. Cyclical Temporal Encodings
        hour = df['timestamp'].dt.hour + df['timestamp'].dt.minute / 60.0
        dayofweek = df['timestamp'].dt.dayofweek

        df['hour_sin'] = np.sin(2 * np.pi * hour / 24.0)
        df['hour_cos'] = np.cos(2 * np.pi * hour / 24.0)
        df['day_sin'] = np.sin(2 * np.pi * dayofweek / 7.0)
        df['day_cos'] = np.cos(2 * np.pi * dayofweek / 7.0)
        df['is_weekend'] = (dayofweek >= 5).astype(int)

        # 2. Capacity-Relative Anchor
        df['occupancy_ratio'] = df['vehicle_count'] / df['operational_capacity']

        # 3. Lags (Shifted strictly into the past)
        for lag in self.lag_minutes:
            steps = lag // cadence_minutes
            df[f'lag_{lag}m'] = df['vehicle_count'].shift(steps)

        # 4. Inflow / Outflow Velocity (Rate of Change)
        step_15 = 15 // cadence_minutes
        step_30 = 30 // cadence_minutes
        df['delta_15m'] = df['vehicle_count'] - df['vehicle_count'].shift(step_15)
        df['delta_30m'] = df['vehicle_count'] - df['vehicle_count'].shift(step_30)

        # 5. Shifted Rolling Windows (Excluding current step to avoid leakage)
        for w in self.rolling_windows_minutes:
            w_steps = w // cadence_minutes
            # Shift by 1 step so rolling window covers [t - w, t - 1]
            shifted = df['vehicle_count'].shift(1)
            df[f'rolling_mean_{w}m'] = shifted.rolling(window=w_steps, min_periods=1).mean()
            df[f'rolling_std_{w}m'] = shifted.rolling(window=w_steps, min_periods=1).std().fillna(0)

        # 6. Targets for Direct Multi-Horizon Forecasting (t + 15m, t + 30m, t + 60m)
        df['target_count_t15'] = df['vehicle_count'].shift(- (15 // cadence_minutes))
        df['target_count_t30'] = df['vehicle_count'].shift(- (30 // cadence_minutes))
        df['target_count_t60'] = df['vehicle_count'].shift(- (60 // cadence_minutes))

        # Binary Saturation Target (>= 90% capacity at +15m)
        df['target_saturated_t15'] = (df['target_count_t15'] >= (df['operational_capacity'] * 0.90)).astype(int)

        return df

    def prepare_training_matrices(
        self, 
        df_features: pd.DataFrame
    ) -> Tuple[pd.DataFrame, Dict[str, pd.Series]]:
        """
        Drops NaN rows created by lags and horizons, separates feature matrix X from targets.
        """
        # Drop boundary NaN rows
        clean_df = df_features.dropna().copy().reset_index(drop=True)

        feature_cols = [
            'vehicle_count', 'operational_capacity', 'occupancy_ratio',
            'hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'is_weekend',
            'is_exam_day', 'is_class_transition',
            'lag_15m', 'lag_30m', 'lag_45m', 'lag_60m',
            'delta_15m', 'delta_30m',
            'rolling_mean_30m', 'rolling_std_30m',
            'rolling_mean_60m', 'rolling_std_60m'
        ]

        X = clean_df[feature_cols]
        targets = {
            "H15": clean_df['target_count_t15'],
            "H30": clean_df['target_count_t30'],
            "H60": clean_df['target_count_t60'],
            "SAT15": clean_df['target_saturated_t15']
        }

        return X, targets

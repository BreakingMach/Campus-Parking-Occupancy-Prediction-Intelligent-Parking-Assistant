import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple

class PersistenceForecaster:
    """
    Naive Baseline: y_hat(t+H) = y(t).
    Essential lower-bound required by course rubric to quantify the value-add of ML models.
    """
    def __init__(self):
        pass

    def fit(self, X: pd.DataFrame, y: pd.Series):
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return X['vehicle_count'].values

class SeasonalHistoricalMeanForecaster:
    """
    Seasonal Baseline: y_hat(t+H) = mean(y | zone, day_of_week, hour_bin).
    Estimates typical weekly diurnal profile in absence of live camera inertia.
    """
    def __init__(self):
        self.lookup_table: Dict[Tuple[int, int], float] = {}

    def fit(self, X: pd.DataFrame, y: pd.Series):
        df = X.copy()
        df['target'] = y.values
        # Reconstruct hour and day from sin/cos or time
        df['hour_approx'] = np.round((np.arctan2(df['hour_sin'], df['hour_cos']) / (2 * np.pi) * 24) % 24).astype(int)
        df['day_approx'] = np.round((np.arctan2(df['day_sin'], df['day_cos']) / (2 * np.pi) * 7) % 7).astype(int)

        grouped = df.groupby(['day_approx', 'hour_approx'])['target'].mean()
        self.lookup_table = grouped.to_dict()
        self.global_mean = float(y.mean())
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        df = X.copy()
        df['hour_approx'] = np.round((np.arctan2(df['hour_sin'], df['hour_cos']) / (2 * np.pi) * 24) % 24).astype(int)
        df['day_approx'] = np.round((np.arctan2(df['day_sin'], df['day_cos']) / (2 * np.pi) * 7) % 7).astype(int)

        # Vectorised lookup — eliminates O(n) iterrows() loop
        keys = list(zip(df['day_approx'].tolist(), df['hour_approx'].tolist()))
        preds = np.array([self.lookup_table.get(k, self.global_mean) for k in keys])
        return preds

import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
import xgboost as xgb
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, average_precision_score

class SaturationClassifier:
    """
    Dual-Head Secondary Guard: Predicts P(Occupancy >= 90% Capacity at t+H).
    Handles class imbalance using scale_pos_weight or SMOTE inside training folds.
    """
    def __init__(self, n_estimators: int = 150, max_depth: int = 5, learning_rate: float = 0.05):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.model = None

    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        # Calculate class imbalance ratio
        pos_count = (y_train == 1).sum()
        neg_count = (y_train == 0).sum()
        scale_pos_weight = float(neg_count / max(1, pos_count))

        self.model = xgb.XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            scale_pos_weight=scale_pos_weight,
            objective="binary:logistic",
            eval_metric="aucpr",
            random_state=42
        )
        self.model.fit(X_train, y_train)
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict(X)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict_proba(X)[:, 1]

    @staticmethod
    def evaluate(y_true: pd.Series, y_pred: np.ndarray, y_proba: np.ndarray) -> Dict[str, float]:
        return {
            "Accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
            "Precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "Recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "F1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
            "PR_AUC": round(float(average_precision_score(y_true, y_proba)), 4) if len(np.unique(y_true)) > 1 else 0.0
        }

"""Layer 3 (optional ML ranking) of the AI architecture.

A hybrid approach:
  Layer 1  – Hard eligibility rules          (eligibility_engine.py)
  Layer 2  – Compatibility scoring           (eligibility_engine.py)
  Layer 3  – ML ranking                      (this module)
  Layer 4  – Explainability                  (explanation_service.py)

The ML layer is a *booster*, not a replacement for the rule engine. When
scikit-learn is unavailable (or there is too little historical data) the
system falls back to pure rule-based ranking. AI assists decision-making;
it never makes legally binding eligibility decisions.
"""

import logging

logger = logging.getLogger("sakshamai.ml")

try:
    import numpy as np
    from sklearn.ensemble import GradientBoostingRegressor

    SKLEARN_AVAILABLE = True
except Exception:  # pragma: no cover - environment without sklearn
    np = None
    SKLEARN_AVAILABLE = False

from models.activity import Recommendation

CATEGORY_INDEX = {"micro_finance": 0, "term_loan": 1, "educational": 2, "other": 3}


class MLRanker:
    def __init__(self) -> None:
        self.available = SKLEARN_AVAILABLE
        self.model = None
        self.fitted = False

    def _fit(self, history_rows: list) -> bool:
        """Train a small model on historical recommendation outcomes.

        Features per scheme-row: user income band, project cost band, purpose id,
        scheme category id, loan ratio, income fit, score. Target: the historical
        eligibility score (a proxy for scheme-user fit).
        """
        if not self.available or not history_rows:
            return False
        try:
            X, y = [], []
            for row in history_rows:
                snap = row.input_snapshot or {}
                income = snap.get("income") or 0
                cost = snap.get("project_cost") or 0
                purpose = snap.get("purpose") or "other"
                # One row per recorded alternative so the model sees positive and
                # negative examples.
                scheme_ids = [snap.get("recommended_scheme_id")]
                scheme_ids += (snap.get("alternative_scheme_ids") or [])
                for sid in scheme_ids:
                    if sid is None:
                        continue
                    scheme = next((s for s in snap.get("_schemes", []) if s.get("id") == sid), None)
                    if scheme is None:
                        continue
                    feat = [
                        min(income / 1_000_000, 5.0),
                        min(cost / 1_000_000, 5.0),
                        hash(purpose) % 10,
                        CATEGORY_INDEX.get(scheme.get("category"), 3),
                        min((cost + 1) / (scheme.get("maximum_loan") or 1), 5.0),
                        1.0 if (not scheme.get("maximum_income") or income <= scheme["maximum_income"]) else 0.0,
                    ]
                    X.append(feat)
                    y.append(0.75 if sid == snap.get("recommended_scheme_id") else 0.4)
            if len(X) < 6:
                return False
            self.model = GradientBoostingRegressor(n_estimators=40, max_depth=2, random_state=42)
            self.model.fit(np.array(X, dtype=float), np.array(y, dtype=float))
            self.fitted = True
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("ML ranker fit failed, falling back to rule-based ranking: %s", exc)
            return False

    def rank(self, history_rows: list, schemes: list[dict], profile: dict) -> dict[int, float]:
        """Return {scheme_id: ml_boost} where boost is 0.0 when ML is unavailable."""
        if not self._fit(history_rows):
            return {}
        try:
            income = profile.get("income") or 0
            cost = profile.get("project_cost") or 0
            purpose = profile.get("purpose") or "other"
            boosts: dict[int, float] = {}
            for scheme in schemes:
                feat = [[
                    min(income / 1_000_000, 5.0),
                    min(cost / 1_000_000, 5.0),
                    hash(purpose) % 10,
                    CATEGORY_INDEX.get(scheme.get("category"), 3),
                    min((cost + 1) / (scheme.get("maximum_loan") or 1), 5.0),
                    1.0 if (not scheme.get("maximum_income") or income <= scheme["maximum_income"]) else 0.0,
                ]]
                pred = float(self.model.predict(np.array(feat, dtype=float))[0])
                boosts[scheme["id"]] = max(0.0, min(1.0, pred))
            return boosts
        except Exception as exc:  # pragma: no cover
            logger.warning("ML ranker inference failed: %s", exc)
            return {}
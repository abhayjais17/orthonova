"""
Load trained model and predict OA risk level from feature vector.

Also generates plain-language explanations based on which features drove the prediction.
"""

import numpy as np
import joblib
from pathlib import Path
from typing import Dict, List, Tuple

# Feature order must match training
FEATURE_NAMES = [
    # Shoe (4 features)
    "heel_strike_peak_left",
    "heel_strike_peak_right",
    "heel_strike_flatness",
    "lateral_spike_count",
    # Knee IMU (4 features)
    "max_knee_flexion",
    "avg_knee_flexion",
    "micro_shock_frequency",
    "micro_shock_magnitude",
    # Vision pose landmarks (5 features)
    "max_knee_bending",
    "avg_knee_bending",
    "avg_stride_length",
    "gait_symmetry",
    "posture_sway",
    # Intake questionnaire (4 features)
    "age",
    "morning_stiffness_minutes",
    "pain_severity",
    "pain_duration_encoded",
]

# Thresholds for risk levels (based on model probability)
RISK_THRESHOLDS = {
    "Low": 0.33,
    "Moderate": 0.67,
}

# Feature descriptions for explanations
FEATURE_DESCRIPTIONS = {
    "heel_strike_peak_left": "left heel impact force",
    "heel_strike_peak_right": "right heel impact force",
    "heel_strike_flatness": "heel-strike pattern flatness",
    "lateral_spike_count": "lateral weight shifting",
    "max_knee_flexion": "maximum knee bending (IMU)",
    "avg_knee_flexion": "average knee bending (IMU)",
    "micro_shock_frequency": "knee micro-shocks",
    "micro_shock_magnitude": "knee shock intensity",
    "max_knee_bending": "maximum knee bending",
    "avg_knee_bending": "average knee bending",
    "avg_stride_length": "stride length",
    "gait_symmetry": "left-right symmetry",
    "posture_sway": "posture instability",
    "age": "age",
    "morning_stiffness_minutes": "morning stiffness duration",
    "pain_severity": "pain severity",
    "pain_duration_encoded": "pain duration",
}

# Normal vs OA-like thresholds for each feature (for generating explanations)
FEATURE_THRESHOLDS = {
    "heel_strike_peak_left": {"normal": 700, "oa": 400},
    "heel_strike_peak_right": {"normal": 700, "oa": 400},
    "heel_strike_flatness": {"normal": 100, "oa": 50},  # Lower flatness = more OA
    "lateral_spike_count": {"normal": 5, "oa": 20},
    "max_knee_flexion": {"normal": 50, "oa": 35},  # Degrees (from IMU)
    "avg_knee_flexion": {"normal": 40, "oa": 25},
    "micro_shock_frequency": {"normal": 10, "oa": 30},
    "micro_shock_magnitude": {"normal": 0.3, "oa": 0.7},
    "max_knee_bending": {"normal": 60, "oa": 30},  # Degrees (from pose landmarks)
    "avg_knee_bending": {"normal": 40, "oa": 20},
    "avg_stride_length": {"normal": 0.15, "oa": 0.08},  # Normalized units
    "gait_symmetry": {"normal": 0.9, "oa": 0.7},  # Ratio (higher = more symmetric)
    "posture_sway": {"normal": 0.02, "oa": 0.05},  # Normalized units
    "age": {"normal": 55, "oa": 65},  # Years
    "morning_stiffness_minutes": {"normal": 5, "oa": 30},
    "pain_severity": {"normal": 2, "oa": 7},  # 0-10 scale
    "pain_duration_encoded": {"normal": 0, "oa": 1},  # 0=weeks, 1=months, 2=years
}


class RiskPredictor:
    """Loads trained model and provides prediction and explanation."""

    def __init__(self, model_path: str = None):
        """Load model from file."""
        if model_path is None:
            model_path = Path(__file__).parent / "model.pkl"

        try:
            self.model = joblib.load(model_path)
            print(f"Loaded model from {model_path}")
        except FileNotFoundError:
            print(f"Model not found at {model_path}")
            print("Please run 'python -m app.ml.train_model' first.")
            self.model = None

    def predict(self, feature_vector: np.ndarray) -> Tuple[str, float, np.ndarray]:
        """
        Predict risk level from feature vector.

        Args:
            feature_vector: Array of 15 features

        Returns:
            risk_level: "Low", "Moderate", or "High"
            risk_score: Probability of being OA/high risk (0.0-1.0)
            class_probabilities: Array of probabilities for each class
        """
        if self.model is None:
            return "Error", 0.0, np.array([0.33, 0.33, 0.34])

        # Get class probabilities
        class_probs = self.model.predict_proba(feature_vector.reshape(1, -1))[0]

        # Classes are: 0=Low, 1=Moderate, 2=High
        # For the "risk score", we use the probability of High risk (class 2)
        risk_score = float(class_probs[2])

        # Determine risk level based on thresholds
        if risk_score < RISK_THRESHOLDS["Low"]:
            risk_level = "Low"
        elif risk_score < RISK_THRESHOLDS["Moderate"]:
            risk_level = "Moderate"
        else:
            risk_level = "High"

        return risk_level, risk_score, class_probs

    def explain(self, feature_vector: np.ndarray, class_probs: np.ndarray) -> Tuple[str, List[str]]:
        """
        Generate plain-language explanation for the prediction.

        Args:
            feature_vector: Array of 15 features
            class_probs: Class probabilities from model

        Returns:
            explanation: Brief overall explanation
            contributing_factors: List of key factors that drove the prediction
        """
        # Get feature importance from model
        if self.model is None:
            return "Could not generate explanation", ["Model not loaded"]

        feature_importance = self.model.feature_importances_

        # Identify top contributing features (highest importance)
        importance_scores = list(enumerate(feature_importance))
        importance_scores.sort(key=lambda x: x[1], reverse=True)
        top_features_idx = [idx for idx, _ in importance_scores[:5]]  # Top 5 features

        # Build explanation based on top features
        explanation_parts = []
        contributing_factors = []

        for idx in top_features_idx:
            feature_name = FEATURE_NAMES[idx]
            feature_value = feature_vector[idx]

            # Compare to thresholds to determine if value indicates OA-like pattern
            thresholds = FEATURE_THRESHOLDS.get(feature_name, {"normal": 0, "oa": 0})

            if feature_name in ["heel_strike_peak_left", "heel_strike_peak_right"]:
                if feature_value < thresholds["oa"]:
                    explanation_parts.append(f"reduced {FEATURE_DESCRIPTIONS[feature_name]}")
                    contributing_factors.append(f"{FEATURE_DESCRIPTIONS[feature_name]}: {feature_value:.1f} (low)")
            elif feature_name in ["heel_strike_flatness"]:
                if feature_value < thresholds["oa"]:
                    explanation_parts.append(f"flattened heel-strike pattern")
                    contributing_factors.append(f"heel-strike flatness: {feature_value:.1f} (flat)")
            elif feature_name in ["lateral_spike_count", "micro_shock_frequency", "micro_shock_magnitude", "posture_sway"]:
                if feature_value > thresholds["oa"]:
                    description = FEATURE_DESCRIPTIONS[feature_name]
                    explanation_parts.append(f"increased {description}")
                    contributing_factors.append(f"{description}: {feature_value:.1f} (elevated)")
            elif feature_name in ["max_knee_flexion", "avg_knee_flexion", "max_knee_bending", "avg_knee_bending", "gait_symmetry", "avg_stride_length"]:
                if feature_value < thresholds["oa"]:
                    description = FEATURE_DESCRIPTIONS[feature_name]
                    explanation_parts.append(f"limited {description}")
                    contributing_factors.append(f"{description}: {feature_value:.1f} (low)")
            elif feature_name in ["age", "morning_stiffness_minutes", "pain_severity", "pain_duration_encoded"]:
                if feature_value > thresholds["oa"]:
                    description = FEATURE_DESCRIPTIONS[feature_name]
                    explanation_parts.append(f"{description} out of expected range")
                    contributing_factors.append(f"{description}: {feature_value:.1f}")

        # Build final explanation
        if not explanation_parts:
            explanation = "Patterns appear within normal ranges for your age group."
        else:
            # Take first 3 explanation parts
            used_parts = explanation_parts[:3]
            if len(used_parts) == 1:
                explanation = f"Primary finding: {used_parts[0]}."
            else:
                explanation = f"Primary findings: {', '.join(used_parts[:-1])}, and {used_parts[-1]}."

        return explanation, contributing_factors

    def predict_with_explanation(self, feature_vector: np.ndarray) -> Dict:
        """
        Complete prediction with explanation.

        Args:
            feature_vector: Array of 15 features

        Returns:
            Dict with risk_level, risk_score, explanation, contributing_factors
        """
        risk_level, risk_score, class_probs = self.predict(feature_vector)
        explanation, contributing_factors = self.explain(feature_vector, class_probs)

        return {
            "risk_level": risk_level,
            "risk_score": round(risk_score, 3),
            "explanation": explanation,
            "contributing_factors": contributing_factors,
        }


# Singleton instance for the API to use
_predictor = None


def get_predictor() -> RiskPredictor:
    """Get singleton predictor instance."""
    global _predictor
    if _predictor is None:
        _predictor = RiskPredictor()
    return _predictor


if __name__ == "__main__":
    # Test the predictor
    print("Testing risk predictor...")

    # Create a test feature vector (normal profile)
    normal_features = np.array([
        850,  # heel_strike_peak_left
        820,  # heel_strike_peak_right
        120,  # heel_strike_flatness
        3,    # lateral_spike_count
        58,   # max_knee_flexion
        42,   # avg_knee_flexion
        8,    # micro_shock_frequency
        0.2,  # micro_shock_magnitude
        0.18, # avg_stride_length
        0.92, # gait_symmetry
        0.015, # posture_sway
        55,   # age
        5,    # morning_stiffness_minutes
        2,    # pain_severity
        0,    # pain_duration_encoded
    ])

    predictor = RiskPredictor()
    result = predictor.predict_with_explanation(normal_features)
    print(f"\nNormal profile prediction:")
    print(f"  Risk level: {result['risk_level']}")
    print(f"  Risk score: {result['risk_score']}")
    print(f"  Explanation: {result['explanation']}")
    print(f"  Contributing factors: {result['contributing_factors']}")

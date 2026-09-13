"""
Train baseline ML model on simulated data.

Generates a large dataset of simulated sessions with labeled outcomes,
trains a Random Forest classifier, and saves the model for use by the API.

Random Forest is chosen because:
1. Interpretable (can extract feature importance)
2. Handles non-linear relationships well
3. No need for feature scaling
4. Works well with small-medium datasets
5. Provides probability estimates for risk scoring
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import joblib
import os
from pathlib import Path

# Import our data generator and feature extraction
import sys
sys.path.append(str(Path(__file__).parent.parent))

from app.simulate.data_generator import DataGenerator
from app.features.feature_extraction import extract_all_features, features_to_array


def generate_training_dataset(n_normal: int = 300, n_oa: int = 300):
    """
    Generate simulated training data.

    Args:
        n_normal: Number of "normal" gait sessions to generate
        n_oa: Number of "OA-like" gait sessions to generate

    Returns:
        X: Feature matrix (n_samples, 15)
        y: Labels (0=Low risk/normal, 1=Moderate risk, 2=High risk/OA)
        feature_names: List of feature names
    """
    print(f"Generating {n_normal} normal and {n_oa} OA-like sessions...")

    X_list = []
    y_list = []

    # Generate normal sessions (Low risk, label=0)
    for i in range(n_normal):
        if i % 50 == 0:
            print(f"  Normal sessions: {i}/{n_normal}")

        # Create mock session object with normal profile questionnaire
        class MockSession:
            def __init__(self):
                self.age = np.random.randint(40, 75)
                self.morning_stiffness_minutes = np.random.randint(0, 10)  # Minimal stiffness
                self.pain_severity = np.random.randint(0, 3)  # Low pain
                self.pain_duration_category = np.random.choice(["weeks", "months"])

        session = MockSession()

        # Generate sensor data
        gen = DataGenerator(profile="normal", duration_seconds=10.0, sample_rate_hz=50.0)
        shoe_data, knee_data, vision_data = gen.generate_all()

        # Extract features
        features = extract_all_features(session, shoe_data, knee_data, vision_data)
        X_list.append(features_to_array(features))
        y_list.append(0)  # Low risk

    # Generate OA-like sessions
    # Mix of Moderate (label=1) and High (label=2) risk
    for i in range(n_oa):
        if i % 50 == 0:
            print(f"  OA-like sessions: {i}/{n_oa}")

        class MockSession:
            def __init__(self):
                self.age = np.random.randint(55, 85)
                self.morning_stiffness_minutes = np.random.randint(10, 60)
                self.pain_severity = np.random.randint(4, 10)
                self.pain_duration_category = np.random.choice(["months", "years"])

        session = MockSession()

        # Generate OA-like sensor data
        gen = DataGenerator(profile="oa", duration_seconds=10.0, sample_rate_hz=50.0)
        shoe_data, knee_data, vision_data = gen.generate_all()

        # Extract features
        features = extract_all_features(session, shoe_data, knee_data, vision_data)
        X_list.append(features_to_array(features))

        # Assign risk level based on severity indicators
        # High risk: severe pain + long duration + older age
        if session.pain_severity >= 7 and session.pain_duration_category == "years" and session.age >= 65:
            y_list.append(2)  # High risk
        else:
            y_list.append(1)  # Moderate risk

    X = np.array(X_list)
    y = np.array(y_list)

    feature_names = [
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

    print(f"\nDataset generated: {X.shape[0]} samples, {X.shape[1]} features")
    print(f"Label distribution: Low={np.sum(y==0)}, Moderate={np.sum(y==1)}, High={np.sum(y==2)}")

    return X, y, feature_names


def train_model(X, y, feature_names):
    """
    Train Random Forest classifier.

    Returns:
        model: Trained classifier
        metrics: Dict of performance metrics
    """
    print("\nSplitting data (80% train, 20% test)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("Training Random Forest classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        class_weight="balanced",  # Handle class imbalance
    )

    model.fit(X_train, y_train)

    # Evaluate
    print("\nEvaluating model...")
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"\nTest Set Accuracy: {accuracy:.3f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Low Risk", "Moderate Risk", "High Risk"]))

    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Cross-validation score
    cv_scores = cross_val_score(model, X_train, y_train, cv=5)
    print(f"\n5-Fold Cross-Validation Accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\nTop 10 Most Important Features:")
    print(feature_importance.head(10).to_string(index=False))

    metrics = {
        "test_accuracy": accuracy,
        "cv_mean": cv_scores.mean(),
        "cv_std": cv_scores.std(),
        "feature_importance": feature_importance.to_dict('records'),
    }

    return model, metrics


def save_model(model, metrics):
    """Save trained model and metadata."""
    model_dir = Path(__file__).parent
    model_path = model_dir / "model.pkl"

    print(f"\nSaving model to {model_path}...")
    joblib.dump(model, model_path)

    # Save metadata
    metadata_path = model_dir / "model_metadata.txt"
    with open(metadata_path, "w") as f:
        f.write("Orthonova Baseline Model\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Test Accuracy: {metrics['test_accuracy']:.3f}\n")
        f.write(f"Cross-Validation: {metrics['cv_mean']:.3f} (+/- {metrics['cv_std']:.3f})\n\n")
        f.write("Feature Importance:\n")
        for item in metrics['feature_importance']:
            f.write(f"  {item['feature']:<30} {item['importance']:.4f}\n")

    print(f"Model metadata saved to {metadata_path}")
    print("\nModel training complete!")


if __name__ == "__main__":
    print("=" * 60)
    print("Orthonova ML Model Training")
    print("=" * 60)

    # Generate dataset
    X, y, feature_names = generate_training_dataset(n_normal=300, n_oa=300)

    # Train model
    model, metrics = train_model(X, y, feature_names)

    # Save model
    save_model(model, metrics)

    print("\n" + "=" * 60)
    print("Ready to use! The API will load model.pkl automatically.")
    print("=" * 60)

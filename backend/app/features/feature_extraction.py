"""
Feature extraction from raw sensor data.

Takes raw time-series data from shoe FSR, knee IMU, and vision/gait sensors
and extracts a fixed-length feature vector per session for ML model input.

Feature vector (15 features total):

FROM SHOE DATA (4 features):
1. heel_strike_peak_left: Peak force during heel strike (g)
2. heel_strike_peak_right: Peak force during heel strike (g)
3. heel_strike_flatness: Variance/flatness of heel-strike peaks (lower = flatter)
4. lateral_spike_count: Count of irregular lateral sensor spikes

FROM KNEE DATA (4 features):
5. max_knee_flexion: Maximum knee flexion angle (degrees)
6. avg_knee_flexion: Average knee flexion angle (degrees)
7. micro_shock_frequency: Count of high-frequency micro-shocks
8. micro_shock_magnitude: Average magnitude of micro-shocks (m/s²)

FROM VISION DATA (3 features):
9. avg_stride_length: Average stride length (normalized units)
10. gait_symmetry: Left-right gait symmetry ratio (1.0 = perfect symmetry)
11. posture_sway: Posture sway magnitude (normalized)

FROM QUESTIONNAIRE (4 features):
12. age: Patient age (years)
13. morning_stiffness_minutes: Morning stiffness duration
14. pain_severity: Pain level (0-10 scale)
15. pain_duration_encoded: Encoded pain duration (0=weeks, 1=months, 2=years)

Expected ranges:
- Normal: heel peaks 800-1000, knee flexion 60-70°, symmetric stride, low sway
- OA-like: heel peaks 300-600, knee flexion 25-35°, asymmetric stride, high sway
"""

import numpy as np
from typing import List, Dict
from scipy.signal import find_peaks


def extract_shoe_features(shoe_data: List[Dict]) -> Dict[str, float]:
    """
    Extract features from shoe FSR sensor data.

    Returns dict with:
    - heel_strike_peak_left
    - heel_strike_peak_right
    - heel_strike_flatness
    - lateral_spike_count
    """
    if not shoe_data:
        return {
            "heel_strike_peak_left": 0.0,
            "heel_strike_peak_right": 0.0,
            "heel_strike_flatness": 0.0,
            "lateral_spike_count": 0.0,
        }

    # Extract time series
    left_heel = np.array([d["left_heel"] for d in shoe_data])
    right_heel = np.array([d["right_heel"] for d in shoe_data])

    # 1-2. Heel-strike peak force (find peaks in the signal)
    left_peaks, _ = find_peaks(left_heel, height=300, distance=20)
    right_peaks, _ = find_peaks(right_heel, height=300, distance=20)

    heel_strike_peak_left = np.mean(left_heel[left_peaks]) if len(left_peaks) > 0 else 0.0
    heel_strike_peak_right = np.mean(right_heel[right_peaks]) if len(right_peaks) > 0 else 0.0

    # 3. Heel-strike flatness (variance of peak heights - lower = flatter/more OA-like)
    all_peak_values = np.concatenate([left_heel[left_peaks], right_heel[right_peaks]])
    heel_strike_flatness = np.std(all_peak_values) if len(all_peak_values) > 2 else 0.0

    # 4. Lateral spike count (sudden pressure increases, indicating weight shifting)
    left_diff = np.abs(np.diff(left_heel))
    right_diff = np.abs(np.diff(right_heel))
    spike_threshold = 150  # ADC units change per sample
    lateral_spike_count = float(np.sum(left_diff > spike_threshold) + np.sum(right_diff > spike_threshold))

    return {
        "heel_strike_peak_left": round(heel_strike_peak_left, 2),
        "heel_strike_peak_right": round(heel_strike_peak_right, 2),
        "heel_strike_flatness": round(heel_strike_flatness, 2),
        "lateral_spike_count": lateral_spike_count,
    }


def extract_knee_features(knee_data: List[Dict]) -> Dict[str, float]:
    """
    Extract features from knee IMU data.

    Returns dict with:
    - max_knee_flexion
    - avg_knee_flexion
    - micro_shock_frequency
    - micro_shock_magnitude
    """
    if not knee_data:
        return {
            "max_knee_flexion": 0.0,
            "avg_knee_flexion": 0.0,
            "micro_shock_frequency": 0.0,
            "micro_shock_magnitude": 0.0,
        }

    # Extract accelerometer data (used for micro-shock detection)
    thigh_accel_x = np.array([d["thigh_accel"][0] for d in knee_data])
    thigh_accel_y = np.array([d["thigh_accel"][1] for d in knee_data])
    thigh_accel_z = np.array([d["thigh_accel"][2] for d in knee_data])

    shin_accel_x = np.array([d["shin_accel"][0] for d in knee_data])
    shin_accel_y = np.array([d["shin_accel"][1] for d in knee_data])
    shin_accel_z = np.array([d["shin_accel"][2] for d in knee_data])

    # Simplified knee flexion angle estimation (normally would use quaternion integration)
    # Here we approximate from relative thigh-shin acceleration patterns
    # Real implementation would use Madgwick/Mahony filter on gyro+accel
    # For simulated data, we extract the flexion range from the signal amplitude
    thigh_mag = np.sqrt(thigh_accel_x**2 + thigh_accel_y**2 + thigh_accel_z**2)
    shin_mag = np.sqrt(shin_accel_x**2 + shin_accel_y**2 + shin_accel_z**2)

    # Knee flexion proxy: variance in relative acceleration (higher = more movement = more flexion)
    relative_accel = np.abs(thigh_mag - shin_mag)

    max_knee_flexion = float(np.percentile(relative_accel, 95) * 10)  # Top 5% = max flexion
    avg_knee_flexion = float(np.mean(relative_accel) * 10)

    # 7-8. Micro-shock detection (high-frequency jerks in accelerometer)
    # Jerk = derivative of acceleration
    thigh_jerk = np.sqrt(np.diff(thigh_accel_x)**2 + np.diff(thigh_accel_y)**2 + np.diff(thigh_accel_z)**2)
    shin_jerk = np.sqrt(np.diff(shin_accel_x)**2 + np.diff(shin_accel_y)**2 + np.diff(shin_accel_z)**2)

    all_jerk = np.concatenate([thigh_jerk, shin_jerk])
    shock_threshold = 0.5  # m/s² per sample

    micro_shock_frequency = float(np.sum(all_jerk > shock_threshold))
    micro_shock_magnitude = float(np.mean(all_jerk[all_jerk > shock_threshold])) if np.any(all_jerk > shock_threshold) else 0.0

    return {
        "max_knee_flexion": round(max_knee_flexion, 2),
        "avg_knee_flexion": round(avg_knee_flexion, 2),
        "micro_shock_frequency": micro_shock_frequency,
        "micro_shock_magnitude": round(micro_shock_magnitude, 3),
    }


def extract_vision_features(vision_data: List[Dict]) -> Dict[str, float]:
    """
    Extract features from vision/gait pose data.

    Returns dict with:
    - max_knee_bending (knee flexion angle in degrees from pose landmarks)
    - avg_knee_bending (average knee flexion angle in degrees)
    - avg_stride_length
    - gait_symmetry
    - posture_sway
    """
    if not vision_data:
        return {
            "max_knee_bending": 0.0,
            "avg_knee_bending": 0.0,
            "avg_stride_length": 0.0,
            "gait_symmetry": 1.0,
            "posture_sway": 0.0,
        }

    # Extract joint positions
    left_hip_x = np.array([d["left_hip_x"] for d in vision_data])
    left_hip_y = np.array([d["left_hip_y"] for d in vision_data])
    right_hip_x = np.array([d["right_hip_x"] for d in vision_data])
    right_hip_y = np.array([d["right_hip_y"] for d in vision_data])

    left_knee_x = np.array([d["left_knee_x"] for d in vision_data])
    left_knee_y = np.array([d["left_knee_y"] for d in vision_data])
    right_knee_x = np.array([d["right_knee_x"] for d in vision_data])
    right_knee_y = np.array([d["right_knee_y"] for d in vision_data])

    left_ankle_x = np.array([d["left_ankle_x"] for d in vision_data])
    left_ankle_y = np.array([d["left_ankle_y"] for d in vision_data])
    right_ankle_x = np.array([d["right_ankle_x"] for d in vision_data])
    right_ankle_y = np.array([d["right_ankle_y"] for d in vision_data])

    # Calculate knee flexion angle from pose landmarks
    # Knee angle = angle at knee joint between hip-knee and knee-ankle vectors
    # angle = arccos(dot(v1, v2) / (mag(v1) * mag(v2)))
    def calculate_knee_angle(hip_x, hip_y, knee_x, knee_y, ankle_x, ankle_y):
        """Calculate knee flexion angle in degrees for a single frame."""
        # Vector from hip to knee
        v1_x = knee_x - hip_x
        v1_y = knee_y - hip_y
        # Vector from ankle to knee
        v2_x = knee_x - ankle_x
        v2_y = knee_y - ankle_y

        # Magnitudes
        mag1 = np.sqrt(v1_x**2 + v1_y**2)
        mag2 = np.sqrt(v2_x**2 + v2_y**2)

        # Avoid division by zero
        if mag1 < 1e-6 or mag2 < 1e-6:
            return 0.0

        # Dot product
        dot = v1_x * v2_x + v1_y * v2_y

        # Cosine of angle
        cos_angle = dot / (mag1 * mag2)
        # Clamp to [-1, 1] to avoid numerical errors with arccos
        cos_angle = np.clip(cos_angle, -1.0, 1.0)

        # Angle in radians, then convert to degrees
        angle_rad = np.arccos(cos_angle)
        angle_deg = np.degrees(angle_rad)

        # The angle calculated is the exterior angle; knee flexion is 180 - this angle
        # (when the knee is straight, cos_angle = -1, angle = 180°, flexion = 0°)
        # (when the knee is bent, cos_angle > -1, angle < 180°, flexion > 0°)
        knee_flexion = 180.0 - angle_deg
        return knee_flexion

    # Calculate knee angles for all frames
    left_knee_angles = np.array([
        calculate_knee_angle(left_hip_x[i], left_hip_y[i],
                           left_knee_x[i], left_knee_y[i],
                           left_ankle_x[i], left_ankle_y[i])
        for i in range(len(vision_data))
    ])

    right_knee_angles = np.array([
        calculate_knee_angle(right_hip_x[i], right_hip_y[i],
                           right_knee_x[i], right_knee_y[i],
                           right_ankle_x[i], right_ankle_y[i])
        for i in range(len(vision_data))
    ])

    # Combine both legs' angles
    all_knee_angles = np.concatenate([left_knee_angles, right_knee_angles])
    all_knee_angles = all_knee_angles[all_knee_angles > 0]  # Filter out invalid (negative) angles

    # Max and average knee bending
    max_knee_bending = float(np.max(all_knee_angles)) if len(all_knee_angles) > 0 else 0.0
    avg_knee_bending = float(np.mean(all_knee_angles)) if len(all_knee_angles) > 0 else 0.0

    # Extract stride length from ankle positions
    left_ankle_x_vals = np.array([d["left_ankle_x"] for d in vision_data])
    right_ankle_x_vals = np.array([d["right_ankle_x"] for d in vision_data])

    # 9. Average stride length (range of ankle x-position movement)
    left_stride = np.ptp(left_ankle_x_vals)  # Peak-to-peak (max - min)
    right_stride = np.ptp(right_ankle_x_vals)
    avg_stride_length = float((left_stride + right_stride) / 2)

    # 10. Gait symmetry (ratio of left/right stride length, 1.0 = perfect)
    if right_stride > 0:
        gait_symmetry = float(min(left_stride, right_stride) / max(left_stride, right_stride))
    else:
        gait_symmetry = 1.0

    # 11. Posture sway (variance in hip center position)
    hip_center_x = (left_hip_x + right_hip_x) / 2
    hip_center_y = (left_hip_y + right_hip_y) / 2
    posture_sway = float(np.std(hip_center_x) + np.std(hip_center_y))

    return {
        "max_knee_bending": round(max_knee_bending, 2),
        "avg_knee_bending": round(avg_knee_bending, 2),
        "avg_stride_length": round(avg_stride_length, 4),
        "gait_symmetry": round(gait_symmetry, 4),
        "posture_sway": round(posture_sway, 4),
    }


def extract_intake_features(session) -> Dict[str, float]:
    """
    Extract features from questionnaire/intake data.

    Returns dict with:
    - age
    - morning_stiffness_minutes
    - pain_severity
    - pain_duration_encoded
    """
    # Encode pain duration category
    pain_duration_map = {
        "weeks": 0,
        "months": 1,
        "years": 2,
    }

    pain_duration_encoded = pain_duration_map.get(session.pain_duration_category, 0)

    return {
        "age": float(session.age or 0),
        "morning_stiffness_minutes": float(session.morning_stiffness_minutes or 0),
        "pain_severity": float(session.pain_severity or 0),
        "pain_duration_encoded": float(pain_duration_encoded),
    }


def extract_all_features(session, shoe_data: List[Dict], knee_data: List[Dict], vision_data: List[Dict]) -> Dict[str, float]:
    """
    Extract complete feature vector from all data sources.

    Returns dict with 15 features (keys match feature names).
    """
    shoe_features = extract_shoe_features(shoe_data)
    knee_features = extract_knee_features(knee_data)
    vision_features = extract_vision_features(vision_data)
    intake_features = extract_intake_features(session)

    # Combine all features
    all_features = {
        **shoe_features,
        **knee_features,
        **vision_features,
        **intake_features,
    }

    return all_features


def features_to_array(features: Dict[str, float]) -> np.ndarray:
    """
    Convert feature dict to numpy array in consistent order for ML model.

    Feature order:
    0-3: shoe (heel_strike_peak_left, heel_strike_peak_right, heel_strike_flatness, lateral_spike_count)
    4-7: knee (max_knee_flexion, avg_knee_flexion, micro_shock_frequency, micro_shock_magnitude)
    8-10: vision (max_knee_bending, avg_knee_bending, avg_stride_length, gait_symmetry, posture_sway)
    11-14: intake (age, morning_stiffness_minutes, pain_severity, pain_duration_encoded)
    """
    feature_order = [
        # Shoe
        "heel_strike_peak_left",
        "heel_strike_peak_right",
        "heel_strike_flatness",
        "lateral_spike_count",
        # Knee IMU
        "max_knee_flexion",
        "avg_knee_flexion",
        "micro_shock_frequency",
        "micro_shock_magnitude",
        # Vision (pose landmarks)
        "max_knee_bending",
        "avg_knee_bending",
        "avg_stride_length",
        "gait_symmetry",
        "posture_sway",
        # Intake
        "age",
        "morning_stiffness_minutes",
        "pain_severity",
        "pain_duration_encoded",
    ]

    return np.array([features.get(k, 0.0) for k in feature_order])

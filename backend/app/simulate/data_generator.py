"""
Simulated sensor data generator for testing the Orthonova pipeline.

Generates realistic "normal gait" vs "OA-like gait" profiles based on the signal
characteristics described in the project spec:

NORMAL GAIT:
- Sharp heel-strike peaks (800-1000g force)
- Smooth knee flexion 60-70 degrees
- Minimal micro-shocks in accelerometer
- Symmetric stride length
- Low posture sway

OA-LIKE GAIT:
- Flattened/reduced heel-strike peaks (patient avoids heel impact)
- Erratic lateral sensor spikes (weight shifting due to pain)
- Limited knee flexion ~25-30 degrees
- Frequent high-frequency micro-shocks/jerks
- Asymmetric/shorter stride length
- Increased posture sway

This module will be replaced with real ESP32/camera data ingestion later,
but feature extraction and ML model will remain unchanged.
"""

import numpy as np
from typing import List, Dict, Tuple


class DataGenerator:
    """Generates simulated sensor data for one walk test session."""

    def __init__(self, profile: str = "normal", duration_seconds: float = 10.0, sample_rate_hz: float = 50.0):
        """
        Args:
            profile: "normal" or "oa" (osteoarthritis-like)
            duration_seconds: Length of the simulated walk test
            sample_rate_hz: Sampling frequency for sensors
        """
        assert profile in ["normal", "oa"], "Profile must be 'normal' or 'oa'"
        self.profile = profile
        self.duration = duration_seconds
        self.sample_rate = sample_rate_hz
        self.num_samples = int(duration_seconds * sample_rate_hz)
        self.timestamps = np.linspace(0, duration_seconds, self.num_samples)

    def generate_shoe_data(self) -> List[Dict]:
        """
        Generate FSR force sensor data (4 sensors per foot: heel + toe on each side).
        Returns list of readings with timestamp and 4 force values (0-1023 ADC range).

        Normal: sharp heel-strike peaks, smooth toe-off
        OA: flattened heel-strike, irregular lateral spikes
        """
        data = []

        # Simulate gait cycle frequency (steps per second)
        step_freq = 1.5 if self.profile == "normal" else 1.0  # OA patients walk slower

        for i, t in enumerate(self.timestamps):
            # Simulate gait cycle phase (0 to 2π per step)
            phase = 2 * np.pi * step_freq * t

            if self.profile == "normal":
                # Normal gait: sharp heel-strike peaks
                left_heel = 500 + 450 * np.abs(np.sin(phase)) + np.random.normal(0, 30)
                right_heel = 500 + 450 * np.abs(np.sin(phase + np.pi)) + np.random.normal(0, 30)

                # Toe-off follows heel-strike smoothly
                left_toe = 400 + 300 * np.abs(np.sin(phase + 0.5)) + np.random.normal(0, 25)
                right_toe = 400 + 300 * np.abs(np.sin(phase + np.pi + 0.5)) + np.random.normal(0, 25)

            else:  # OA profile
                # Flattened heel-strike peaks (patient avoids heel impact)
                left_heel = 350 + 250 * np.abs(np.sin(phase)) + np.random.normal(0, 50)
                right_heel = 350 + 250 * np.abs(np.sin(phase + np.pi)) + np.random.normal(0, 50)

                # Erratic lateral pressure spikes (weight shifting due to pain)
                if np.random.random() < 0.15:  # 15% chance of spike
                    left_heel += np.random.uniform(100, 200)
                if np.random.random() < 0.15:
                    right_heel += np.random.uniform(100, 200)

                # Irregular toe-off
                left_toe = 300 + 200 * np.abs(np.sin(phase + 0.5)) + np.random.normal(0, 40)
                right_toe = 300 + 200 * np.abs(np.sin(phase + np.pi + 0.5)) + np.random.normal(0, 40)

            # Clamp to ADC range
            data.append({
                "timestamp": t,
                "left_heel": int(np.clip(left_heel, 0, 1023)),
                "left_toe": int(np.clip(left_toe, 0, 1023)),
                "right_heel": int(np.clip(right_heel, 0, 1023)),
                "right_toe": int(np.clip(right_toe, 0, 1023)),
            })

        return data

    def generate_knee_data(self) -> List[Dict]:
        """
        Generate IMU data from thigh and shin sensors (MPU-6050).
        Returns list of readings with timestamp, accel (x,y,z), gyro (x,y,z) for both segments.

        Normal: smooth ~60-70° knee flexion, minimal jerk
        OA: limited ~25-30° knee flexion, high-frequency micro-shocks
        """
        data = []
        step_freq = 1.5 if self.profile == "normal" else 1.0

        for i, t in enumerate(self.timestamps):
            phase = 2 * np.pi * step_freq * t

            if self.profile == "normal":
                # Normal knee flexion angle (radians)
                knee_angle = np.radians(65) * np.abs(np.sin(phase))  # 0-65° flexion

                # Smooth accelerometer readings (mostly gravity + minor gait motion)
                thigh_accel = [
                    0.2 + 0.3 * np.sin(phase) + np.random.normal(0, 0.05),
                    9.8 + 0.5 * np.cos(phase) + np.random.normal(0, 0.1),
                    0.1 + np.random.normal(0, 0.05)
                ]
                shin_accel = [
                    0.3 + 0.4 * np.sin(phase + 0.3) + np.random.normal(0, 0.05),
                    9.7 + 0.6 * np.cos(phase + 0.3) + np.random.normal(0, 0.1),
                    0.15 + np.random.normal(0, 0.05)
                ]

                # Smooth gyroscope readings (angular velocity)
                thigh_gyro = [
                    0.05 * np.sin(2 * phase) + np.random.normal(0, 0.01),
                    0.02 + np.random.normal(0, 0.005),
                    0.01 + np.random.normal(0, 0.005)
                ]
                shin_gyro = [
                    0.06 * np.sin(2 * phase + 0.3) + np.random.normal(0, 0.01),
                    0.03 + np.random.normal(0, 0.005),
                    0.02 + np.random.normal(0, 0.005)
                ]

            else:  # OA profile
                # Limited knee flexion
                knee_angle = np.radians(28) * np.abs(np.sin(phase))  # 0-28° flexion

                # High-frequency micro-shocks (jerk in accelerometer)
                shock = 0.0
                if np.random.random() < 0.2:  # 20% chance of micro-shock
                    shock = np.random.uniform(1.5, 3.0)

                thigh_accel = [
                    0.2 + 0.3 * np.sin(phase) + shock + np.random.normal(0, 0.15),
                    9.8 + 0.5 * np.cos(phase) + np.random.normal(0, 0.2),
                    0.1 + np.random.normal(0, 0.1)
                ]
                shin_accel = [
                    0.3 + 0.4 * np.sin(phase + 0.3) + shock + np.random.normal(0, 0.15),
                    9.7 + 0.6 * np.cos(phase + 0.3) + np.random.normal(0, 0.2),
                    0.15 + np.random.normal(0, 0.1)
                ]

                # More erratic gyro readings
                thigh_gyro = [
                    0.08 * np.sin(2 * phase) + np.random.normal(0, 0.02),
                    0.04 + np.random.normal(0, 0.015),
                    0.03 + np.random.normal(0, 0.015)
                ]
                shin_gyro = [
                    0.1 * np.sin(2 * phase + 0.3) + np.random.normal(0, 0.02),
                    0.05 + np.random.normal(0, 0.015),
                    0.04 + np.random.normal(0, 0.015)
                ]

            data.append({
                "timestamp": t,
                "thigh_accel": [round(x, 3) for x in thigh_accel],
                "thigh_gyro": [round(x, 4) for x in thigh_gyro],
                "shin_accel": [round(x, 3) for x in shin_accel],
                "shin_gyro": [round(x, 4) for x in shin_gyro],
            })

        return data

    def generate_vision_data(self) -> List[Dict]:
        """
        Generate simulated pose landmark data (mocking MediaPipe output).
        Returns list of readings with timestamp and key joint positions.

        Normal: symmetric stride, minimal sway
        OA: asymmetric/shorter stride, increased sway
        """
        data = []
        step_freq = 1.5 if self.profile == "normal" else 1.0

        # Simulated camera viewport (normalized 0-1 coordinates)
        center_x, center_y = 0.5, 0.5

        for i, t in enumerate(self.timestamps):
            phase = 2 * np.pi * step_freq * t

            if self.profile == "normal":
                # Symmetric stride length
                stride_offset = 0.15 * np.sin(phase)
                left_stride = stride_offset
                right_stride = -stride_offset

                # Minimal posture sway
                sway_x = 0.02 * np.sin(0.5 * phase)
                sway_y = 0.01 * np.cos(0.5 * phase)

            else:  # OA profile
                # Asymmetric, shorter stride
                stride_offset = 0.08 * np.sin(phase)
                left_stride = stride_offset * 0.7  # Left leg weaker
                right_stride = -stride_offset

                # Increased posture sway (instability)
                sway_x = 0.06 * np.sin(0.5 * phase) + np.random.normal(0, 0.02)
                sway_y = 0.04 * np.cos(0.5 * phase) + np.random.normal(0, 0.015)

            # Hip positions (relatively stable)
            left_hip = [center_x - 0.1 + sway_x, center_y + 0.1 + sway_y]
            right_hip = [center_x + 0.1 + sway_x, center_y + 0.1 + sway_y]

            # Knee positions (move with gait)
            left_knee = [center_x - 0.1 + left_stride + sway_x, center_y + 0.3]
            right_knee = [center_x + 0.1 + right_stride + sway_x, center_y + 0.3]

            # Ankle positions
            left_ankle = [center_x - 0.1 + left_stride * 1.2 + sway_x, center_y + 0.5]
            right_ankle = [center_x + 0.1 + right_stride * 1.2 + sway_x, center_y + 0.5]

            data.append({
                "timestamp": t,
                "left_hip_x": round(left_hip[0], 4),
                "left_hip_y": round(left_hip[1], 4),
                "right_hip_x": round(right_hip[0], 4),
                "right_hip_y": round(right_hip[1], 4),
                "left_knee_x": round(left_knee[0], 4),
                "left_knee_y": round(left_knee[1], 4),
                "right_knee_x": round(right_knee[0], 4),
                "right_knee_y": round(right_knee[1], 4),
                "left_ankle_x": round(left_ankle[0], 4),
                "left_ankle_y": round(left_ankle[1], 4),
                "right_ankle_x": round(right_ankle[0], 4),
                "right_ankle_y": round(right_ankle[1], 4),
            })

        return data

    def generate_all(self) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """Generate all sensor data for this session."""
        return (
            self.generate_shoe_data(),
            self.generate_knee_data(),
            self.generate_vision_data()
        )

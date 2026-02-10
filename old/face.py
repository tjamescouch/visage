"""Face model: components, expressions, and style system."""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional
import numpy as np


@dataclass
class FaceStyle:
    bg_color: Tuple[int, int, int] = (15, 15, 25)
    face_color: Tuple[int, int, int] = (200, 200, 220)
    eye_color: Tuple[int, int, int] = (80, 180, 255)
    pupil_color: Tuple[int, int, int] = (20, 20, 30)
    mouth_color: Tuple[int, int, int] = (200, 100, 120)
    brow_color: Tuple[int, int, int] = (160, 160, 180)

    face_width: float = 0.55
    face_height: float = 0.7
    eye_rx: float = 0.08
    eye_ry: float = 0.06
    eye_spacing: float = 0.18
    eye_y: float = 0.42
    pupil_radius: float = 0.025
    mouth_y: float = 0.65
    mouth_width: float = 0.12
    brow_width: float = 0.09
    brow_y_offset: float = -0.07
    line_width: int = 3


# Param order for vectorization (must be stable)
PARAM_NAMES = [
    "left_eye_rx", "left_eye_ry", "left_eye_openness",
    "right_eye_rx", "right_eye_ry", "right_eye_openness",
    "left_pupil_dx", "left_pupil_dy",
    "right_pupil_dx", "right_pupil_dy",
    "mouth_width", "mouth_curve", "mouth_openness",
    "left_brow_angle", "left_brow_height",
    "right_brow_angle", "right_brow_height",
    "face_scale",
]

PARAM_DIM = len(PARAM_NAMES)

# Expression states: param overrides relative to defaults
_DEFAULTS = {
    "left_eye_rx": 0.0, "left_eye_ry": 0.0, "left_eye_openness": 1.0,
    "right_eye_rx": 0.0, "right_eye_ry": 0.0, "right_eye_openness": 1.0,
    "left_pupil_dx": 0.0, "left_pupil_dy": 0.0,
    "right_pupil_dx": 0.0, "right_pupil_dy": 0.0,
    "mouth_width": 0.0, "mouth_curve": 0.0, "mouth_openness": 0.0,
    "left_brow_angle": 0.0, "left_brow_height": 0.0,
    "right_brow_angle": 0.0, "right_brow_height": 0.0,
    "face_scale": 1.0,
}

EXPRESSIONS = {
    "idle": {},
    "thinking": {
        "left_eye_openness": 0.7, "right_eye_openness": 0.7,
        "left_pupil_dx": 0.02, "left_pupil_dy": -0.01,
        "right_pupil_dx": 0.02, "right_pupil_dy": -0.01,
        "mouth_curve": -0.08,
        "left_brow_angle": 0.12, "left_brow_height": 0.03,
        "right_brow_angle": -0.04, "right_brow_height": 0.01,
    },
    "talking": {
        "mouth_openness": 0.35, "mouth_curve": 0.03,
    },
    "happy": {
        "left_eye_openness": 0.85, "right_eye_openness": 0.85,
        "left_eye_ry": -0.015, "right_eye_ry": -0.015,
        "mouth_width": 0.04, "mouth_curve": 0.25, "mouth_openness": 0.08,
    },
    "sad": {
        "left_eye_openness": 0.6, "right_eye_openness": 0.6,
        "mouth_curve": -0.25,
        "left_brow_angle": -0.12, "left_brow_height": -0.02,
        "right_brow_angle": 0.12, "right_brow_height": -0.02,
    },
    "surprised": {
        "left_eye_openness": 1.3, "right_eye_openness": 1.3,
        "left_eye_ry": 0.02, "right_eye_ry": 0.02,
        "mouth_openness": 0.45, "mouth_width": -0.03,
        "left_brow_height": 0.06, "right_brow_height": 0.06,
    },
    "confused": {
        "left_eye_openness": 0.8, "right_eye_openness": 0.6,
        "left_pupil_dx": -0.01, "right_pupil_dx": 0.01,
        "mouth_curve": -0.12, "mouth_openness": 0.04,
        "left_brow_angle": 0.18, "left_brow_height": 0.04,
        "right_brow_angle": -0.12, "right_brow_height": -0.01,
    },
}


class FaceModel:
    def __init__(self, style: Optional[FaceStyle] = None):
        self.style = style or FaceStyle()
        self.params = np.array([_DEFAULTS[n] for n in PARAM_NAMES], dtype=np.float64)
        self.target = self.params.copy()
        self.expression = "idle"

    def set_expression(self, expression: str, intensity: float = 1.0):
        if expression not in EXPRESSIONS:
            return
        self.expression = expression
        overrides = EXPRESSIONS[expression]
        for i, name in enumerate(PARAM_NAMES):
            base = _DEFAULTS[name]
            if name in overrides:
                self.target[i] = base + (overrides[name] - base) * intensity
            else:
                self.target[i] = base

    def get_params(self) -> np.ndarray:
        return self.params.copy()

    def get_target(self) -> np.ndarray:
        return self.target.copy()

    def set_params(self, vec: np.ndarray):
        self.params[:] = vec

    def p(self, name: str) -> float:
        return float(self.params[PARAM_NAMES.index(name)])

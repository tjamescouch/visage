"""Face style definitions — colors, proportions, face pack data."""

import json
from dataclasses import dataclass, field

# "Another World" default palette
ANOTHER_WORLD = {
    "bg": (8, 10, 22),
    "skin_lit": (198, 156, 109),
    "skin_shadow": (132, 92, 64),
    "eye_white": (180, 185, 190),
    "iris": (52, 100, 140),
    "pupil": (12, 14, 20),
    "mouth": (145, 82, 72),
    "mouth_interior": (42, 18, 22),
    "brow": (92, 64, 48),
    "highlight": (220, 200, 170),

    # Proportions (fractions of window dims)
    "face_width": 0.40,
    "face_height": 0.55,
    "eye_spacing": 0.12,
    "eye_y": 0.40,           # vertical position (fraction of face height from top)
    "eye_rx": 0.045,         # eye horizontal radius
    "eye_ry": 0.028,         # eye vertical radius
    "pupil_radius": 0.016,
    "mouth_y": 0.68,         # mouth vertical position
    "mouth_width": 0.08,
    "brow_width": 0.055,
    "brow_y_offset": -0.05,
}


def load_style(path: str) -> dict:
    """Load a style from JSON, merged with defaults."""
    style = dict(ANOTHER_WORLD)
    with open(path) as f:
        overrides = json.load(f)
    for k, v in overrides.items():
        if isinstance(v, list):
            style[k] = tuple(v)
        else:
            style[k] = v
    return style


def default_style() -> dict:
    return dict(ANOTHER_WORLD)

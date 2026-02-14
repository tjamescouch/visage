"""Emote vector -> MocapFrame mapping.

The repo has two related concepts:
- *emotion/emote vector*: high-level affect signals (valence/arousal + named emotions)
- *MocapFrame*: low-level continuous face control points consumed by renderers/relays

This module provides a small, explicit mapping from an emote vector to a `pts` dict.
It's intentionally simple and deterministic; you can iterate on it later.
"""

from __future__ import annotations

from dataclasses import dataclass


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


@dataclass
class EmoteVector:
    """High-level affect.

    Fields are expected in ranges:
    - valence: [-1, 1]
    - arousal: [0, 1]
    - emotions: [0, 1]
    """

    valence: float = 0.0
    arousal: float = 0.2

    happy: float = 0.0
    sad: float = 0.0
    angry: float = 0.0
    fear: float = 0.0
    surprise: float = 0.0
    thinking: float = 0.0


def emote_to_pts(ev: EmoteVector) -> dict:
    """Map EmoteVector to MocapFrame `pts` fields used by Visage.

    This is not ARKit 52; it's the repo's internal minimal face control set.
    """

    v = max(-1.0, min(1.0, ev.valence))
    a = _clamp(ev.arousal)

    happy = _clamp(ev.happy)
    sad = _clamp(ev.sad)
    angry = _clamp(ev.angry)
    fear = _clamp(ev.fear)
    surprise = _clamp(ev.surprise)
    thinking = _clamp(ev.thinking)

    # Eyes: arousal opens eyes; sadness droops; anger narrows; surprise widens.
    eye_open = 0.65 + 0.25 * a + 0.15 * surprise - 0.20 * sad - 0.25 * angry
    eye_open = _clamp(eye_open, 0.15, 1.0)

    # Brows: sadness raises inner brow (height), anger lowers and tilts.
    brow_height = -0.03 * angry + 0.05 * sad + 0.03 * surprise
    brow_angle = 0.06 * angry - 0.02 * sad + 0.03 * thinking

    # Mouth: valence -> smile; sadness -> frown (reduce smile); anger -> tight mouth.
    mouth_smile = 0.45 * max(0.0, v) + 0.35 * happy - 0.55 * sad - 0.25 * angry
    mouth_smile = _clamp(mouth_smile, 0.0, 1.0)

    # Mouth open: arousal and surprise open mouth; fear opens slightly.
    mouth_open = 0.10 + 0.35 * surprise + 0.20 * a + 0.10 * fear
    mouth_open = _clamp(mouth_open, 0.0, 1.0)

    # Jaw open follows mouth open.
    jaw_open = _clamp(0.85 * mouth_open)

    # Mouth width: happy widens; anger tightens.
    mouth_wide = 0.10 + 0.25 * happy + 0.10 * max(0.0, v) - 0.20 * angry
    mouth_wide = _clamp(mouth_wide)

    # Head micro-motions: arousal adds a bit of roll/yaw.
    head_yaw = 0.04 * (happy - angry)  # subtle
    head_pitch = 0.03 * (sad - surprise)
    head_roll = 0.03 * (thinking - fear)

    return {
        "left_eye_open": eye_open,
        "right_eye_open": eye_open,
        "left_pupil_x": 0.0,
        "left_pupil_y": 0.0,
        "right_pupil_x": 0.0,
        "right_pupil_y": 0.0,
        "left_brow_height": brow_height,
        "left_brow_angle": brow_angle,
        "right_brow_height": brow_height,
        "right_brow_angle": brow_angle,
        "mouth_open": mouth_open,
        "mouth_wide": mouth_wide,
        "mouth_smile": mouth_smile,
        "jaw_open": jaw_open,
        "face_scale": 1.0,
        "head_pitch": head_pitch,
        "head_yaw": head_yaw,
        "head_roll": head_roll,
    }

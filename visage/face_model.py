"""Face model — translates MocapFrame points into renderable polygon geometry.

Computes pixel coordinates for an angular, "Another World"-style face
from abstract mocap control points and a style dict.
"""

import math


def compute(pts: dict, size: tuple[int, int], style: dict) -> dict:
    """Compute drawable geometry from mocap points.

    Args:
        pts: MocapFrame points dict (18 named floats).
        size: (width, height) of the render target.
        style: Face style dict (colors + proportions).

    Returns:
        Geometry dict with resolved pixel coordinates for each face part.
    """
    w, h = size
    cx, cy = w // 2, h // 2

    scale = pts.get("face_scale", 1.0)
    fw = style["face_width"] * w * scale
    fh = style["face_height"] * h * scale

    geo = {}

    # --- Face polygon (angular hexagon-ish shape) ---
    # Points: top-center, top-right, mid-right, jaw-right, chin, jaw-left, mid-left, top-left
    top_w = fw * 0.42
    mid_w = fw * 0.50
    jaw_w = fw * 0.38
    chin_w = fw * 0.05

    top_y = cy - fh * 0.48
    mid_y = cy - fh * 0.05
    jaw_y = cy + fh * 0.28
    chin_y = cy + fh * 0.48

    face_pts = [
        (cx, top_y),                          # top center
        (cx + top_w, top_y + fh * 0.08),      # top right
        (cx + mid_w, mid_y),                   # mid right
        (cx + jaw_w, jaw_y),                   # jaw right
        (cx + chin_w, chin_y),                 # chin right
        (cx - chin_w, chin_y),                 # chin left
        (cx - jaw_w, jaw_y),                   # jaw left
        (cx - mid_w, mid_y),                   # mid left
        (cx - top_w, top_y + fh * 0.08),      # top left
    ]
    geo["face_lit"] = [(int(x), int(y)) for x, y in face_pts]

    # Shadow polygon — right half of face, slightly inset
    shadow_pts = [
        (cx + 2, top_y),
        (cx + top_w, top_y + fh * 0.08),
        (cx + mid_w, mid_y),
        (cx + jaw_w, jaw_y),
        (cx + chin_w, chin_y),
        (cx, chin_y + 2),
        (cx + 2, mid_y),
    ]
    geo["face_shadow"] = [(int(x), int(y)) for x, y in shadow_pts]

    # --- Eyes ---
    eye_y_pos = cy - (0.5 - style["eye_y"]) * fh
    for prefix, side in [("left", -1), ("right", 1)]:
        ex = cx + int(side * style["eye_spacing"] * w)
        ey = int(eye_y_pos)

        openness = pts.get(f"{prefix}_eye_open", 1.0)
        erx = style["eye_rx"] * w
        ery = style["eye_ry"] * h * max(0.08, openness)

        # Almond-shaped polygon (6 points)
        eye_polygon = [
            (ex - erx, ey),                           # left point
            (ex - erx * 0.5, ey - ery),               # upper-left
            (ex + erx * 0.5, ey - ery * 0.9),         # upper-right
            (ex + erx, ey),                            # right point
            (ex + erx * 0.5, ey + ery * 0.9),         # lower-right
            (ex - erx * 0.5, ey + ery),               # lower-left
        ]
        geo[f"{prefix}_eye"] = [(int(x), int(y)) for x, y in eye_polygon]

        # Iris and pupil
        pdx = pts.get(f"{prefix}_pupil_x", 0.0) * w
        pdy = pts.get(f"{prefix}_pupil_y", 0.0) * h
        iris_r = int(style["pupil_radius"] * 1.6 * min(w, h))
        pupil_r = int(style["pupil_radius"] * min(w, h))

        geo[f"{prefix}_iris"] = ((int(ex + pdx), int(ey + pdy)), iris_r)
        geo[f"{prefix}_pupil"] = ((int(ex + pdx), int(ey + pdy)), pupil_r)

        # Highlight
        hr = max(2, pupil_r // 3)
        geo[f"{prefix}_highlight"] = (
            (int(ex + pdx - pupil_r * 0.35), int(ey + pdy - pupil_r * 0.35)),
            hr,
        )

    # --- Brows ---
    for prefix, side in [("left", -1), ("right", 1)]:
        bx = cx + int(side * style["eye_spacing"] * w)
        by = int(eye_y_pos + style["brow_y_offset"] * h)
        by += int(pts.get(f"{prefix}_brow_height", 0.0) * h)
        angle = pts.get(f"{prefix}_brow_angle", 0.0)
        bw = style["brow_width"] * w
        dx = math.cos(angle) * bw
        dy = math.sin(angle) * bw
        geo[f"{prefix}_brow"] = (
            (int(bx - dx), int(by - dy)),
            (int(bx + dx), int(by + dy)),
        )

    # --- Mouth ---
    mx = cx
    my = cy + int((style["mouth_y"] - 0.5) * fh)
    mw = (style["mouth_width"] + pts.get("mouth_wide", 0.0)) * w
    smile = pts.get("mouth_smile", 0.0)
    openness = pts.get("mouth_open", 0.0)

    # Upper lip — angular trapezoid
    lip_curve = smile * h * 0.08
    upper_lip = [
        (int(mx - mw), int(my)),
        (int(mx - mw * 0.3), int(my - lip_curve)),
        (int(mx + mw * 0.3), int(my - lip_curve)),
        (int(mx + mw), int(my)),
    ]
    geo["mouth_upper"] = upper_lip

    # Lower lip
    lower_lip = [
        (int(mx - mw), int(my)),
        (int(mx - mw * 0.3), int(my + lip_curve * 0.3)),
        (int(mx + mw * 0.3), int(my + lip_curve * 0.3)),
        (int(mx + mw), int(my)),
    ]
    geo["mouth_lower"] = lower_lip

    # Mouth interior (when open)
    if openness > 0.02:
        mouth_h = openness * h * 0.12
        interior = [
            (int(mx - mw * 0.8), int(my)),
            (int(mx + mw * 0.8), int(my)),
            (int(mx + mw * 0.5), int(my + mouth_h)),
            (int(mx - mw * 0.5), int(my + mouth_h)),
        ]
        geo["mouth_interior"] = interior
    else:
        geo["mouth_interior"] = None

    return geo

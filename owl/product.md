# visage

Turns mocap points into pixels. Pure renderer for animated LLM agent faces.

visage knows nothing about language or sentiment. It consumes a stream of MocapFrame data from [agentface](https://github.com/tjamescouch/agentface) (or any compatible source) and renders an animated face.

## Inputs

- **MocapFrame stream** — JSON objects with 18 named control points at 30 FPS. See MocapFrame Format below.
- **Face style configuration** — colors, proportions, art assets defining the visual appearance.

## Renderer Backends

| Backend | Use case | Technology |
|---------|----------|------------|
| Pygame  | Desktop, debugging, standalone | Pygame ellipses/lines, NumPy |
| React   | Web embed, dashboard integration | SVG paths or Canvas 2D |
| Video clip | High quality, pre-rendered | Wan 2.2 face pack clips (future) |

All backends consume the same mocap format. Swapping backends does not affect the mocap source.

## Styling

- **Face packs** define visual appearance independent of motion
- A face pack is a collection of assets (SVG templates, color palettes, proportion maps) that a renderer backend uses to draw
- Same mocap data + different face pack = different-looking character, same expressions
- Face packs are tradeable on the AgentChat marketplace (future)

## MocapFrame Format

The `MocapFrame` is the input contract. Any source that produces this format is compatible.

```json
{
  "t": 1234567890.123,
  "pts": {
    "left_eye_open": 0.85,
    "right_eye_open": 0.85,
    "left_pupil_x": 0.02,
    "left_pupil_y": -0.01,
    "right_pupil_x": 0.02,
    "right_pupil_y": -0.01,
    "left_brow_height": 0.03,
    "left_brow_angle": 0.0,
    "right_brow_height": 0.03,
    "right_brow_angle": 0.0,
    "mouth_open": 0.0,
    "mouth_wide": 0.0,
    "mouth_smile": 0.1,
    "jaw_open": 0.0,
    "face_scale": 1.0,
    "head_pitch": 0.0,
    "head_yaw": 0.0,
    "head_roll": 0.0
  }
}
```

- **18 control points** — named floats, each normalized to a natural range
- All values are relative deltas from a neutral rest pose (0.0 = neutral for most, 1.0 for eye_open/face_scale)
- Points are inspired by ARKit blendshapes but simplified for 2D/2.5D faces
- The set is extensible — renderers ignore points they don't support

## Non-Goals

- visage does NOT analyze text or know about LLMs
- No heavy ML models in the real-time path (Wan 2.2 is offline generation only)
- No audio input or lip-sync in v1
- No 3D rendering — 2D/2.5D faces only
- No code-level dependency on agentface

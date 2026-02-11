# visage-web

browser-based face renderer for LLM agents. Express server serves a Canvas 2D face that animates from MocapFrame data pushed over WebSocket.

## components

- [server](components/server.md) - Express app serving static files and WebSocket relay
- [renderer](components/renderer.md) - Canvas 2D face renderer in the browser
- [receiver](components/receiver.md) - WebSocket client receiving MocapFrame data

## constraints

see [constraints.md](constraints.md)

## MocapFrame Format

the input contract. any source producing this format is compatible.

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

- 18 control points, named floats, normalized to natural ranges
- all values are deltas from neutral rest pose (0.0 = neutral for most, 1.0 for eye_open/face_scale)
- the set is extensible; renderers ignore unknown points

## non-goals

- no text analysis or LLM awareness
- no heavy ML in the real-time path
- no audio input or lip-sync in v1
- no 3D rendering

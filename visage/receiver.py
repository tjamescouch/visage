"""MocapFrame receiver — reads frames from stdin, WebSocket, or direct push."""

import json
import sys
import threading
from dataclasses import dataclass, field

# Neutral rest pose — used when no data has arrived yet
NEUTRAL_PTS = {
    "left_eye_open": 1.0, "right_eye_open": 1.0,
    "left_pupil_x": 0.0, "left_pupil_y": 0.0,
    "right_pupil_x": 0.0, "right_pupil_y": 0.0,
    "left_brow_height": 0.0, "left_brow_angle": 0.0,
    "right_brow_height": 0.0, "right_brow_angle": 0.0,
    "mouth_open": 0.0, "mouth_wide": 0.0, "mouth_smile": 0.0,
    "jaw_open": 0.0, "face_scale": 1.0,
    "head_pitch": 0.0, "head_yaw": 0.0, "head_roll": 0.0,
}


@dataclass
class MocapFrame:
    t: float = 0.0
    pts: dict = field(default_factory=lambda: dict(NEUTRAL_PTS))


class MocapReceiver:
    """Thread-safe MocapFrame receiver."""

    def __init__(self):
        self._latest = MocapFrame()
        self._lock = threading.Lock()
        self._running = False

    def start(self):
        """Start background stdin reader."""
        self._running = True
        t = threading.Thread(target=self._read_stdin, daemon=True)
        t.start()

    def stop(self):
        self._running = False

    def push(self, frame: MocapFrame):
        """Programmatic frame injection."""
        with self._lock:
            self._latest = frame

    def latest(self) -> MocapFrame:
        """Get the most recent frame (thread-safe)."""
        with self._lock:
            return self._latest

    def _read_stdin(self):
        while self._running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                data = json.loads(line)
                frame = MocapFrame(
                    t=data.get("t", 0.0),
                    pts={**NEUTRAL_PTS, **data.get("pts", {})},
                )
                with self._lock:
                    self._latest = frame
            except (json.JSONDecodeError, KeyError, ValueError):
                pass

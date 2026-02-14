"""MocapFrame receiver.

Thread-safe receiver for MocapFrame data.

Transports supported:
- stdin JSON lines (default)
- optional WebSocket client input (requires `websockets`)

A MocapFrame is JSON of the form:

    {"t": 1234.5, "pts": {"mouth_open": 0.2, ...}}

"""

import json
import sys
import threading
from dataclasses import dataclass, field

try:
    import asyncio
    import websockets  # type: ignore
except Exception:  # pragma: no cover
    asyncio = None
    websockets = None


# Neutral rest pose — used when no data has arrived yet
NEUTRAL_PTS = {
    "left_eye_open": 1.0,
    "right_eye_open": 1.0,
    "left_pupil_x": 0.0,
    "left_pupil_y": 0.0,
    "right_pupil_x": 0.0,
    "right_pupil_y": 0.0,
    "left_brow_height": 0.0,
    "left_brow_angle": 0.0,
    "right_brow_height": 0.0,
    "right_brow_angle": 0.0,
    "mouth_open": 0.0,
    "mouth_wide": 0.0,
    "mouth_smile": 0.0,
    "jaw_open": 0.0,
    "face_scale": 1.0,
    "head_pitch": 0.0,
    "head_yaw": 0.0,
    "head_roll": 0.0,
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

        self._ws_thread: threading.Thread | None = None
        self._ws_stop: threading.Event | None = None

    def start(self, ws_url: str | None = None):
        """Start background readers.

        Args:
            ws_url: Optional WebSocket URL to consume MocapFrames from.
                If set, the receiver connects as a `viewer` to a Visage relay.
        """

        self._running = True

        t = threading.Thread(target=self._read_stdin, daemon=True)
        t.start()

        if ws_url:
            if websockets is None or asyncio is None:
                raise RuntimeError("websocket input requires optional dependency 'websockets'")
            self._start_ws(ws_url)

    def stop(self):
        self._running = False
        if self._ws_stop is not None:
            self._ws_stop.set()

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

    def _start_ws(self, ws_url: str):
        self._ws_stop = threading.Event()

        def run():
            asyncio.run(self._ws_loop(ws_url, self._ws_stop))

        self._ws_thread = threading.Thread(target=run, daemon=True)
        self._ws_thread.start()

    async def _ws_loop(self, ws_url: str, stop_evt: threading.Event):
        backoff_s = 1.0
        while self._running and not stop_evt.is_set():
            try:
                async with websockets.connect(ws_url) as ws:
                    await ws.send(json.dumps({"role": "viewer"}))
                    backoff_s = 1.0

                    while self._running and not stop_evt.is_set():
                        msg = await ws.recv()
                        try:
                            data = json.loads(msg)
                            frame = MocapFrame(
                                t=data.get("t", 0.0),
                                pts={**NEUTRAL_PTS, **data.get("pts", {})},
                            )
                            with self._lock:
                                self._latest = frame
                        except Exception:
                            continue
            except Exception:
                await asyncio.sleep(min(5.0, backoff_s))
                backoff_s = min(5.0, backoff_s * 1.5)

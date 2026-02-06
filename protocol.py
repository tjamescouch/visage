"""Signal protocol: watch token streams and expression commands."""

import os
import sys
import json
import time
import queue
import threading
from dataclasses import dataclass
from typing import Optional


@dataclass
class VisageEvent:
    expression: str
    intensity: float = 1.0
    text: Optional[str] = None


@dataclass
class TextChunk:
    text: str
    timestamp: float


class SignalListener:
    """Listens for expression commands via stdin JSON lines."""

    def __init__(self):
        self.queue: queue.Queue[VisageEvent] = queue.Queue()
        self._running = False

    def start(self):
        self._running = True
        t = threading.Thread(target=self._listen_stdin, daemon=True)
        t.start()

    def poll(self) -> Optional[VisageEvent]:
        try:
            return self.queue.get_nowait()
        except queue.Empty:
            return None

    def _listen_stdin(self):
        while self._running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                data = json.loads(line)
                if "name" in data and "arguments" in data:
                    data = data["arguments"]
                self.queue.put(VisageEvent(
                    expression=data.get("expression", "idle"),
                    intensity=float(data.get("intensity", 1.0)),
                    text=data.get("text"),
                ))
            except (json.JSONDecodeError, KeyError, ValueError):
                pass

    def stop(self):
        self._running = False


class TokenStreamWatcher:
    """Watches a file for new text content (tail -f style)."""

    def __init__(self, path: str):
        self.path = path
        self.queue: queue.Queue[TextChunk] = queue.Queue()
        self._running = False
        self._pos = 0

    def start(self):
        self._running = True
        # Start from end of file if it exists
        if os.path.exists(self.path):
            self._pos = os.path.getsize(self.path)
        t = threading.Thread(target=self._watch, daemon=True)
        t.start()

    def poll(self) -> Optional[TextChunk]:
        try:
            return self.queue.get_nowait()
        except queue.Empty:
            return None

    def poll_all(self) -> list[TextChunk]:
        """Drain all available chunks."""
        chunks = []
        while True:
            try:
                chunks.append(self.queue.get_nowait())
            except queue.Empty:
                break
        return chunks

    def _watch(self):
        while self._running:
            try:
                if os.path.exists(self.path):
                    size = os.path.getsize(self.path)
                    if size > self._pos:
                        with open(self.path, 'r') as f:
                            f.seek(self._pos)
                            new_text = f.read()
                            self._pos = f.tell()
                        if new_text.strip():
                            self.queue.put(TextChunk(
                                text=new_text,
                                timestamp=time.time()
                            ))
                    elif size < self._pos:
                        # File was truncated (new conversation)
                        self._pos = 0
            except (IOError, OSError):
                pass
            time.sleep(0.05)  # 50ms poll interval

    def stop(self):
        self._running = False

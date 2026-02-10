"""Small brain: reads token stream and produces continuous emotion signals."""

import re
import math
from collections import deque
from dataclasses import dataclass


@dataclass
class Emotion:
    valence: float = 0.0   # -1 (negative) to +1 (positive)
    arousal: float = 0.0   # 0 (calm) to 1 (excited)
    talking: bool = False   # tokens are actively flowing


# Keyword lexicons with (valence, arousal) contributions
_POSITIVE = {
    "good": (0.3, 0.1), "great": (0.5, 0.3), "excellent": (0.6, 0.3),
    "perfect": (0.6, 0.3), "love": (0.5, 0.4), "beautiful": (0.4, 0.2),
    "happy": (0.5, 0.3), "wonderful": (0.5, 0.3), "awesome": (0.5, 0.4),
    "fantastic": (0.5, 0.4), "yes": (0.2, 0.1), "nice": (0.3, 0.1),
    "thanks": (0.3, 0.1), "brilliant": (0.5, 0.4), "fun": (0.4, 0.3),
    "exciting": (0.4, 0.5), "cool": (0.3, 0.2), "elegant": (0.4, 0.2),
    "clever": (0.3, 0.2), "simple": (0.2, 0.0), "clean": (0.2, 0.0),
    "solved": (0.4, 0.3), "works": (0.3, 0.2), "done": (0.3, 0.2),
    "exactly": (0.3, 0.2), "right": (0.2, 0.1), "correct": (0.3, 0.1),
}

_NEGATIVE = {
    "error": (-0.4, 0.4), "fail": (-0.4, 0.3), "failed": (-0.4, 0.3),
    "bug": (-0.3, 0.3), "wrong": (-0.3, 0.2), "bad": (-0.3, 0.2),
    "broken": (-0.4, 0.3), "crash": (-0.5, 0.5), "problem": (-0.3, 0.3),
    "issue": (-0.2, 0.2), "unfortunately": (-0.3, 0.1), "sorry": (-0.2, 0.1),
    "warning": (-0.2, 0.3), "danger": (-0.4, 0.5), "no": (-0.1, 0.1),
    "not": (-0.1, 0.0), "can't": (-0.2, 0.1), "cannot": (-0.2, 0.1),
    "stuck": (-0.3, 0.2), "confused": (-0.2, 0.2), "hard": (-0.1, 0.2),
    "slow": (-0.2, 0.1), "ugly": (-0.3, 0.2), "mess": (-0.3, 0.3),
    "hack": (-0.2, 0.2), "terrible": (-0.5, 0.3), "awful": (-0.5, 0.3),
}

_THINKING = {
    "hmm": (0.0, 0.2), "let me": (0.0, 0.2), "consider": (0.0, 0.2),
    "perhaps": (0.0, 0.1), "maybe": (0.0, 0.1), "if": (0.0, 0.1),
    "analyzing": (0.0, 0.3), "investigating": (0.0, 0.3),
    "looking": (0.0, 0.2), "checking": (0.0, 0.2), "searching": (0.0, 0.2),
    "reading": (0.0, 0.1), "understanding": (0.0, 0.2),
}

_SURPRISE = {
    "!": (0.1, 0.5), "wow": (0.3, 0.6), "whoa": (0.2, 0.5),
    "interesting": (0.2, 0.4), "unexpected": (0.0, 0.5),
    "actually": (0.1, 0.3), "wait": (0.0, 0.4), "oh": (0.1, 0.3),
    "huh": (0.0, 0.3), "really": (0.1, 0.3),
}


class SentimentBrain:
    """Lightweight sentiment analyzer on a sliding window of text."""

    def __init__(self, window_size: int = 200, decay: float = 0.92):
        self.window = deque(maxlen=window_size)
        self.decay = decay  # per-step decay for running emotion
        self.emotion = Emotion()
        self._last_token_time = 0.0
        self._token_count = 0
        self._silence_time = 0.0

    def feed(self, text: str, timestamp: float):
        """Feed new text (can be partial tokens or full chunks)."""
        self.window.append(text.lower())
        self._last_token_time = timestamp
        self._token_count += 1
        self._silence_time = 0.0
        self._analyze()

    def step(self, dt: float, timestamp: float):
        """Called every frame to update emotion state with time-based effects."""
        self._silence_time = timestamp - self._last_token_time

        # Talking detection: tokens arrived recently
        self.emotion.talking = self._silence_time < 0.5

        # Decay emotion toward neutral during silence
        if self._silence_time > 1.0:
            decay_factor = self.decay ** (dt * 3)  # faster decay in silence
            self.emotion.valence *= decay_factor
            self.emotion.arousal *= decay_factor
        else:
            # Slow decay even while talking (keeps it fresh)
            decay_factor = self.decay ** dt
            self.emotion.valence *= decay_factor
            self.emotion.arousal *= decay_factor

    def _analyze(self):
        """Run sentiment on the recent window."""
        text = " ".join(self.window)
        words = re.findall(r"[a-z'!?]+", text)

        v_sum = 0.0
        a_sum = 0.0
        hits = 0

        # Weight recent words more (exponential recency)
        n = len(words)
        for i, word in enumerate(words):
            recency = math.exp(-0.02 * (n - i))  # recent words weighted higher

            for lexicon in [_POSITIVE, _NEGATIVE, _THINKING, _SURPRISE]:
                if word in lexicon:
                    v, a = lexicon[word]
                    v_sum += v * recency
                    a_sum += a * recency
                    hits += recency

        if hits > 0:
            # Blend new signal with existing emotion
            new_v = v_sum / max(hits, 1.0)
            new_a = a_sum / max(hits, 1.0)
            blend = min(0.6, hits * 0.15)  # stronger signal = more influence
            self.emotion.valence += (new_v - self.emotion.valence) * blend
            self.emotion.arousal += (new_a - self.emotion.arousal) * blend

        # Clamp
        self.emotion.valence = max(-1.0, min(1.0, self.emotion.valence))
        self.emotion.arousal = max(0.0, min(1.0, self.emotion.arousal))

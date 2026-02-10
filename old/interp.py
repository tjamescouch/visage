"""Animation blending system with decay, resting states, and idle life."""

import math
import random
import numpy as np
from face import PARAM_NAMES, PARAM_DIM, _DEFAULTS, EXPRESSIONS


class AnimationLayer:
    """A single animation contribution that can be blended with others."""

    def __init__(self, name: str, params: np.ndarray, weight: float = 1.0,
                 decay_rate: float = 0.0):
        self.name = name
        self.params = params.copy()
        self.weight = weight
        self.decay_rate = decay_rate  # weight units per second (0 = no decay)
        self.age = 0.0

    def step(self, dt: float):
        self.age += dt
        if self.decay_rate > 0:
            self.weight = max(0.0, self.weight - self.decay_rate * dt)

    @property
    def alive(self) -> bool:
        return self.weight > 0.001


class AnimationBlender:
    """Blends multiple animation layers with decay and smooth transitions."""

    def __init__(self):
        self.layers: list[AnimationLayer] = []
        self.current = np.array([_DEFAULTS[n] for n in PARAM_NAMES], dtype=np.float64)
        self.smoothing = 8.0  # exponential smoothing rate (higher = faster)

    def push_expression(self, expression: str, intensity: float = 1.0,
                        decay_rate: float = 0.15):
        """Push a new expression. It will decay over time back to resting."""
        if expression not in EXPRESSIONS:
            return
        overrides = EXPRESSIONS[expression]
        params = np.array([_DEFAULTS[n] for n in PARAM_NAMES], dtype=np.float64)
        for i, name in enumerate(PARAM_NAMES):
            if name in overrides:
                base = _DEFAULTS[name]
                params[i] = base + (overrides[name] - base) * intensity
        # Remove any existing layer with same name
        self.layers = [l for l in self.layers if l.name != expression]
        self.layers.append(AnimationLayer(
            name=expression, params=params,
            weight=intensity, decay_rate=decay_rate
        ))

    def push_sentiment(self, valence: float, arousal: float, decay_rate: float = 0.08):
        """Push a sentiment-derived expression. Valence [-1,1], arousal [0,1]."""
        params = np.array([_DEFAULTS[n] for n in PARAM_NAMES], dtype=np.float64)
        i_mc = PARAM_NAMES.index("mouth_curve")
        i_mo = PARAM_NAMES.index("mouth_openness")
        i_leo = PARAM_NAMES.index("left_eye_openness")
        i_reo = PARAM_NAMES.index("right_eye_openness")
        i_lba = PARAM_NAMES.index("left_brow_angle")
        i_rba = PARAM_NAMES.index("right_brow_angle")
        i_lbh = PARAM_NAMES.index("left_brow_height")
        i_rbh = PARAM_NAMES.index("right_brow_height")

        # Valence drives mouth curve and eye shape
        params[i_mc] = valence * 0.25
        params[i_mo] = max(0, arousal * 0.15)
        # Arousal drives eye openness and brow height
        eye_open = 1.0 + arousal * 0.2 * (1 if valence > 0 else -0.5)
        params[i_leo] = eye_open
        params[i_reo] = eye_open
        params[i_lbh] = arousal * 0.03 + valence * 0.02
        params[i_rbh] = arousal * 0.03 + valence * 0.02
        # Negative valence tilts brows inward
        if valence < 0:
            params[i_lba] = valence * -0.1
            params[i_rba] = valence * 0.1

        self.layers = [l for l in self.layers if l.name != "sentiment"]
        weight = max(abs(valence), arousal) * 0.8
        if weight > 0.05:
            self.layers.append(AnimationLayer(
                name="sentiment", params=params,
                weight=weight, decay_rate=decay_rate
            ))

    def step(self, dt: float) -> np.ndarray:
        """Advance all layers and blend. Returns blended param vector."""
        # Step and prune dead layers
        for layer in self.layers:
            layer.step(dt)
        self.layers = [l for l in self.layers if l.alive]

        # Compute blend target: weighted average over resting + active layers
        resting = np.array([_DEFAULTS[n] for n in PARAM_NAMES], dtype=np.float64)
        total_weight = 0.3  # resting always has base weight
        blended = resting * 0.3

        for layer in self.layers:
            blended += layer.params * layer.weight
            total_weight += layer.weight

        if total_weight > 0:
            blended /= total_weight

        # Exponential smoothing toward blend target
        alpha = 1.0 - math.exp(-self.smoothing * dt)
        self.current += (blended - self.current) * alpha

        return self.current.copy()


class IdleAnimator:
    """Adds breathing, blinking, eye drift — always running."""

    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.time = 0.0
        self.next_blink = 2.0 + self.rng.random() * 3.0
        self.blinking = False
        self.blink_t = 0.0
        self.blink_duration = 0.15
        self.is_talking = False

    def step(self, params: np.ndarray, dt: float) -> np.ndarray:
        self.time += dt
        result = params.copy()

        le_open = PARAM_NAMES.index("left_eye_openness")
        re_open = PARAM_NAMES.index("right_eye_openness")
        lp_dx = PARAM_NAMES.index("left_pupil_dx")
        lp_dy = PARAM_NAMES.index("left_pupil_dy")
        rp_dx = PARAM_NAMES.index("right_pupil_dx")
        rp_dy = PARAM_NAMES.index("right_pupil_dy")
        mouth_open = PARAM_NAMES.index("mouth_openness")
        face_scale = PARAM_NAMES.index("face_scale")

        # Breathing
        result[face_scale] += 0.008 * math.sin(self.time * 1.5)

        # Blinking
        self.next_blink -= dt
        if self.next_blink <= 0 and not self.blinking:
            self.blinking = True
            self.blink_t = 0.0
            self.next_blink = 2.0 + self.rng.random() * 4.0

        if self.blinking:
            self.blink_t += dt
            if self.blink_t < self.blink_duration:
                blink = math.sin(self.blink_t / self.blink_duration * math.pi)
                result[le_open] *= (1.0 - blink * 0.95)
                result[re_open] *= (1.0 - blink * 0.95)
            else:
                self.blinking = False

        # Eye drift
        result[lp_dx] += 0.008 * math.sin(self.time * 0.7 + 1.3)
        result[lp_dy] += 0.005 * math.sin(self.time * 0.5 + 2.7)
        result[rp_dx] += 0.008 * math.sin(self.time * 0.7 + 1.3)
        result[rp_dy] += 0.005 * math.sin(self.time * 0.5 + 2.7)

        # Talking oscillation
        if self.is_talking:
            osc = 0.15 * abs(math.sin(self.time * 5.0 * math.pi))
            result[mouth_open] += osc

        return result

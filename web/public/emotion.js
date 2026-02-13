// Emotion-to-MocapFrame Expression Mapper
// Converts state vectors (@@joy:0.6,anger:0.2@@) to MocapFrame control points
// via weighted blending of hand-authored expression presets.
//
// Architecture: deltas from neutral. Each preset defines offsets from the
// resting face. Blend = neutral + Σ(weight_i × preset_i), clamped to valid ranges.

// --- Neutral pose (resting face, no emotion) ---

const NEUTRAL = {
  left_eye_open: 1.0, right_eye_open: 1.0,
  left_pupil_x: 0.0, left_pupil_y: 0.0,
  right_pupil_x: 0.0, right_pupil_y: 0.0,
  left_brow_height: 0.0, left_brow_angle: 0.0,
  right_brow_height: 0.0, right_brow_angle: 0.0,
  mouth_open: 0.0, mouth_wide: 0.0, mouth_smile: 0.0,
  jaw_open: 0.0, face_scale: 1.0,
  head_pitch: 0.0, head_yaw: 0.0, head_roll: 0.0,
};

// --- Valid ranges for clamping ---

const RANGES = {
  left_eye_open:    [0.0, 1.0],
  right_eye_open:   [0.0, 1.0],
  left_pupil_x:     [-0.1, 0.1],
  left_pupil_y:     [-0.1, 0.1],
  right_pupil_x:    [-0.1, 0.1],
  right_pupil_y:    [-0.1, 0.1],
  left_brow_height: [-1.0, 1.0],
  left_brow_angle:  [-0.5, 0.5],
  right_brow_height:[-1.0, 1.0],
  right_brow_angle: [-0.5, 0.5],
  mouth_open:       [0.0, 1.0],
  mouth_wide:       [0.0, 1.0],
  mouth_smile:      [-0.5, 0.5],
  jaw_open:         [0.0, 1.0],
  face_scale:       [0.5, 1.5],
  head_pitch:       [-0.1, 0.1],
  head_yaw:         [-0.1, 0.1],
  head_roll:        [-0.1, 0.1],
};

// --- Expression presets (deltas from neutral) ---
// Each key maps an emotion dimension to its MocapFrame offsets.
// Only non-zero deltas listed — unlisted points stay at 0.

const PRESETS = {
  // Core emotions
  joy: {
    mouth_smile: 0.45,
    left_eye_open: -0.2,
    right_eye_open: -0.2,
    left_brow_height: 0.1,
    right_brow_height: 0.1,
  },
  sadness: {
    mouth_smile: -0.35,
    left_brow_height: 0.15,
    right_brow_height: 0.15,
    left_brow_angle: 0.15,
    right_brow_angle: -0.15,
    left_eye_open: -0.3,
    right_eye_open: -0.3,
  },
  anger: {
    mouth_smile: -0.25,
    left_brow_height: -0.3,
    right_brow_height: -0.3,
    left_brow_angle: -0.2,
    right_brow_angle: 0.2,
    jaw_open: 0.1,
    left_eye_open: -0.1,
    right_eye_open: -0.1,
  },
  fear: {
    left_eye_open: 0.0,   // already at 1.0 neutral, no delta
    right_eye_open: 0.0,
    left_brow_height: 0.4,
    right_brow_height: 0.4,
    left_brow_angle: 0.1,
    right_brow_angle: -0.1,
    mouth_open: 0.3,
    jaw_open: 0.2,
  },
  surprise: {
    left_eye_open: 0.0,
    right_eye_open: 0.0,
    left_brow_height: 0.5,
    right_brow_height: 0.5,
    mouth_open: 0.5,
    jaw_open: 0.3,
  },
  disgust: {
    mouth_smile: -0.2,
    left_brow_height: -0.15,
    right_brow_height: 0.1,
    left_eye_open: -0.15,
    right_eye_open: -0.25,
    mouth_wide: 0.15,
  },

  // Epistemic / cognitive states
  confidence: {
    mouth_smile: 0.12,
    left_eye_open: -0.15,
    right_eye_open: -0.15,
    head_pitch: -0.02,
    left_brow_height: -0.05,
    right_brow_height: -0.05,
  },
  uncertainty: {
    left_brow_height: 0.2,
    right_brow_height: -0.1,
    mouth_smile: -0.05,
    head_roll: 0.03,
    head_yaw: 0.02,
  },
  thinking: {
    left_brow_height: 0.05,
    right_brow_height: -0.1,
    left_eye_open: -0.15,
    right_eye_open: -0.2,
    mouth_smile: -0.05,
    left_pupil_x: 0.04,
    right_pupil_x: 0.04,
    left_pupil_y: -0.03,
    right_pupil_y: -0.03,
  },

  // Energy states
  excitement: {
    mouth_open: 0.2,
    mouth_smile: 0.2,
    left_brow_height: 0.3,
    right_brow_height: 0.3,
    mouth_wide: 0.15,
  },
  calm: {
    left_eye_open: -0.25,
    right_eye_open: -0.25,
    mouth_smile: 0.05,
    left_brow_height: -0.05,
    right_brow_height: -0.05,
  },
  urgency: {
    left_eye_open: 0.0,
    right_eye_open: 0.0,
    left_brow_height: 0.15,
    right_brow_height: 0.15,
    mouth_open: 0.1,
    jaw_open: 0.05,
    head_pitch: 0.02,
  },

  // Social
  reverence: {
    head_pitch: 0.04,
    left_eye_open: -0.2,
    right_eye_open: -0.2,
    mouth_smile: 0.08,
    left_brow_height: 0.1,
    right_brow_height: 0.1,
  },
};

// --- Blend function ---

/**
 * Blend a state vector into a MocapFrame.
 * @param {Record<string, number>} stateVector - Emotion weights, e.g. {joy: 0.6, anger: 0.2}
 * @param {Record<string, Record<string, number>>} [presets] - Custom presets (optional, defaults to PRESETS)
 * @returns {Record<string, number>} MocapFrame control points
 */
function blend(stateVector, presets = PRESETS) {
  // Start from neutral
  const frame = { ...NEUTRAL };

  // Accumulate weighted deltas
  for (const [emotion, weight] of Object.entries(stateVector)) {
    const preset = presets[emotion];
    if (!preset || typeof weight !== 'number') continue;

    // Clamp weight to [0, 1]
    const w = Math.max(0, Math.min(1, weight));

    for (const [point, delta] of Object.entries(preset)) {
      if (point in frame) {
        frame[point] += w * delta;
      }
    }
  }

  // Clamp all values to valid ranges
  for (const [point, [min, max]] of Object.entries(RANGES)) {
    if (point in frame) {
      frame[point] = Math.max(min, Math.min(max, frame[point]));
    }
  }

  return frame;
}

// --- Interpolator ---

/**
 * Lerp between two MocapFrames.
 * @param {Record<string, number>} from - Current frame
 * @param {Record<string, number>} to - Target frame
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {Record<string, number>} Interpolated frame
 */
function lerp(from, to, t) {
  const result = {};
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const key of keys) {
    const a = from[key] ?? NEUTRAL[key] ?? 0;
    const b = to[key] ?? NEUTRAL[key] ?? 0;
    result[key] = a + (b - a) * t;
  }
  return result;
}

/**
 * Stateful interpolator that smoothly transitions between emotion states.
 * Call update() each frame with the target state vector.
 * Call frame() to get the current interpolated MocapFrame.
 */
class EmotionDriver {
  /**
   * @param {object} [opts]
   * @param {number} [opts.transitionMs=200] - Transition duration in ms
   * @param {number} [opts.decayRate=0.02] - Per-frame decay toward neutral when no input
   * @param {Record<string, Record<string, number>>} [opts.presets] - Custom presets
   */
  constructor(opts = {}) {
    this.transitionMs = opts.transitionMs ?? 200;
    this.decayRate = opts.decayRate ?? 0.02;
    this.presets = opts.presets ?? PRESETS;

    this._current = { ...NEUTRAL };
    this._target = { ...NEUTRAL };
    this._transitionStart = 0;
    this._transitioning = false;
    this._lastUpdateTime = 0;
  }

  /**
   * Set a new emotion target. Triggers smooth transition.
   * @param {Record<string, number>} stateVector - e.g. {joy: 0.6, anger: 0.2}
   */
  update(stateVector) {
    this._target = blend(stateVector, this.presets);
    this._transitionStart = performance.now();
    this._transitioning = true;
    this._lastUpdateTime = performance.now();
  }

  /**
   * Get the current interpolated MocapFrame.
   * Call this every render frame.
   * @returns {Record<string, number>}
   */
  frame() {
    const now = performance.now();

    if (this._transitioning) {
      const elapsed = now - this._transitionStart;
      const t = Math.min(1, elapsed / this.transitionMs);

      // Ease-out cubic for natural feel
      const eased = 1 - Math.pow(1 - t, 3);

      this._current = lerp(this._current, this._target, eased);

      if (t >= 1) {
        this._current = { ...this._target };
        this._transitioning = false;
      }
    } else {
      // Decay toward neutral when no recent updates
      const timeSinceUpdate = now - this._lastUpdateTime;
      if (timeSinceUpdate > 2000) {
        // Start decaying after 2s of no input
        this._current = lerp(this._current, NEUTRAL, this.decayRate);
      }
    }

    return this._current;
  }

  /**
   * Get current frame as a MocapFrame-shaped object for the renderer.
   * @returns {{ t: number, pts: Record<string, number> }}
   */
  mocapFrame() {
    return {
      t: performance.now() / 1000,
      pts: this.frame(),
    };
  }
}

// --- Export ---
// Dual-format: ES module for React/Vite, window global for standalone use.

export { NEUTRAL, RANGES, PRESETS, blend, lerp, EmotionDriver };

if (typeof window !== 'undefined') {
  window.VisageEmotion = { NEUTRAL, RANGES, PRESETS, blend, lerp, EmotionDriver };
}

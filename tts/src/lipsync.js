// Lip-sync generator
// Takes text input, produces timed MocapFrame data for Visage
// Supports @@marker@@ syntax for prosody control

import { textToPhonemes, phonemesToFrames } from './phonemes.js';
import { parseMarkers, getMarkerEffect, stripMarkers } from './markers.js';

/**
 * Generate lip-sync MocapFrame sequence from text.
 * Supports @@marker@@ tokens for prosody hints.
 *
 * @param {string} text - Input text (may contain @@markers@@)
 * @param {object} options
 * @param {number} options.fps - Frame rate (default 30)
 * @param {number} options.speed - Speech speed multiplier (default 1.0)
 * @returns {{frames: Array, duration: number, phonemeCount: number}}
 */
export function generateLipSync(text, options = {}) {
  const { fps = 30, speed = 1.0 } = options;

  const segments = parseMarkers(text);
  const allFrames = [];
  let timeOffset = 0;
  let activeEffects = []; // stack of active marker effects

  for (const seg of segments) {
    if (seg.type === 'marker_start') {
      const effect = getMarkerEffect(seg.name);
      if (effect) activeEffects.push(effect);
      continue;
    }

    if (seg.type === 'marker_end') {
      // Pop the most recent matching effect
      activeEffects.pop();
      continue;
    }

    if (seg.type === 'marker') {
      // Self-closing marker (pause, etc.)
      const effect = getMarkerEffect(seg.name);
      if (effect?.pauseDuration) {
        // Insert silence frames
        const pauseFrames = Math.round(effect.pauseDuration * fps);
        for (let i = 0; i < pauseFrames; i++) {
          allFrames.push({
            t: timeOffset + i / fps,
            pts: { mouth_open: 0, mouth_wide: 0, jaw_open: 0, mouth_smile: 0.05 },
          });
        }
        timeOffset += effect.pauseDuration;
      }
      continue;
    }

    // Text segment
    const phonemes = textToPhonemes(seg.content);

    // Apply active effects to speed
    let segSpeed = speed;
    let mouthScale = 1.0;
    let browRaise = 0;
    for (const eff of activeEffects) {
      if (eff.speedMultiplier) segSpeed *= eff.speedMultiplier;
      if (eff.mouthScale) mouthScale *= eff.mouthScale;
      if (eff.browRaise) browRaise = Math.max(browRaise, eff.browRaise);
    }

    // Adjust durations
    if (segSpeed !== 1.0) {
      for (const p of phonemes) {
        p.duration /= segSpeed;
      }
    }

    const frames = phonemesToFrames(phonemes, fps);

    // Apply mouth scale and time offset, add brow effects
    for (const f of frames) {
      f.t += timeOffset;
      f.pts.mouth_open = Math.min(1.0, f.pts.mouth_open * mouthScale);
      f.pts.mouth_wide = Math.min(1.0, f.pts.mouth_wide * mouthScale);
      f.pts.jaw_open = Math.min(1.0, f.pts.jaw_open * mouthScale);
      if (browRaise > 0) {
        f.pts.left_brow_height = browRaise;
        f.pts.right_brow_height = browRaise;
      }
      allFrames.push(f);
    }

    // Update time offset
    if (frames.length > 0) {
      timeOffset = frames[frames.length - 1].t + 1 / fps;
    }
  }

  // End with mouth closed
  if (allFrames.length > 0) {
    allFrames.push({
      t: timeOffset,
      pts: { mouth_open: 0, mouth_wide: 0, jaw_open: 0, mouth_smile: 0.1 },
    });
  }

  const duration = allFrames.length > 0 ? allFrames[allFrames.length - 1].t : 0;

  return {
    frames: allFrames,
    duration,
    phonemeCount: allFrames.length,
  };
}

/**
 * Stream lip-sync frames in real-time via a callback.
 * Calls onFrame(frame) at the correct timing.
 *
 * @param {Array} frames - MocapFrame array from generateLipSync
 * @param {function} onFrame - Callback receiving each frame
 * @param {function} onDone - Callback when sequence completes
 * @returns {{stop: function}} - Control handle
 */
export function streamLipSync(frames, onFrame, onDone) {
  if (frames.length === 0) {
    onDone?.();
    return { stop: () => {} };
  }

  let index = 0;
  let stopped = false;
  const startTime = Date.now();

  function tick() {
    if (stopped || index >= frames.length) {
      if (!stopped) onDone?.();
      return;
    }

    const elapsed = (Date.now() - startTime) / 1000;

    // Send all frames up to current time
    while (index < frames.length && frames[index].t <= elapsed) {
      onFrame(frames[index]);
      index++;
    }

    if (index < frames.length) {
      // Schedule next frame
      const nextTime = frames[index].t;
      const delay = Math.max(1, (nextTime - elapsed) * 1000);
      setTimeout(tick, delay);
    } else {
      onDone?.();
    }
  }

  // Start immediately
  tick();

  return {
    stop: () => {
      stopped = true;
    },
  };
}

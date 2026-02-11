# constraints

## stack

- runtime: node.js (ES modules)
- server: express
- transport: ws for WebSocket (compatible with Visage server)
- TTS engine: pluggable — starts with espeak/piper subprocess, falls back to phoneme-only mode
- no build step

## ports

- HTTP server on 3001 (avoids conflict with Visage on 3000)
- WebSocket on same port

## audio

- output format: WAV (16-bit PCM, 22050 Hz mono)
- served as static files from /audio/ directory
- cleaned up after configurable TTL

## lipsync

- generates MocapFrame-compatible data at 30 FPS
- phoneme-to-viseme mapping for mouth shapes
- output is array of timed MocapFrame deltas (mouth/jaw points only)
- streamed via WebSocket to Visage producer endpoint

## dependencies

- express, ws
- optional: piper-tts binary (if available on system)
- fallback: phoneme-based timing without audio (visual-only lip movement)

## style

- ES modules
- plain JavaScript (no TypeScript)
- matches Visage conventions

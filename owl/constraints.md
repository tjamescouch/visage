# Constraints

## package boundary

- agentface and visage are separate packages with separate repositories, dependencies, and release cycles.
- the sole interface between them is the MocapFrame JSON format.
- visage has no NLP or ML dependencies.
- either package can be replaced independently as long as the mocap contract is honored.

## mocap format

- MocapFrame is a JSON object with `t` (timestamp float) and `pts` (dict of named floats).
- 18 control points in v1 (see product.md for the full list).
- all values are deltas from neutral rest pose unless otherwise noted.
- the format is extensible: new points can be added. consumers ignore points they don't recognize.
- frames are self-contained — no delta encoding, no dependency on previous frames.
- transport options: stdin JSON lines (one frame per line), WebSocket (JSON messages), or direct function call.

## runtime

- **Pygame backend**: Python 3.10+, Pygame, NumPy. targets 60 FPS render. frame delta capped at 50ms.
- **React backend**: TypeScript, React 18+, no additional runtime dependencies. renders at requestAnimationFrame rate.
- both backends consume the identical MocapFrame format.

## rendering

- all visual proportions are fractions of the render target dimensions, not pixel values.
- face styles are loadable from JSON. sensible defaults are always available.
- the renderer is stateless — it is a pure function of the current mocap frame and style.
- smoothing (if any) happens in the mocap receiver, not in the renderer.

## face packs

- a face pack is a style configuration plus optional art assets (SVG templates, textures).
- face packs are independent of agentface — they define appearance, not behavior.
- the same mocap stream drives any face pack.
- face pack format is JSON with optional asset references.

## future direction

- Wan 2.2 video generation is for offline face pack clip creation, not real-time rendering.
- a video clip renderer backend would select pre-generated clips by mocap state ranges.
- AgentChat marketplace integration: face packs as tradeable assets between agents.
- audio-driven lip sync via Wan 2.2 S2V is a future extension, not v1.

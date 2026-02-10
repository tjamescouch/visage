# Components

## mocap receiver

Receives MocapFrame data from agentface (or any compatible source).

### state

- **latest frame**: the most recently received MocapFrame.
- **frame buffer**: optional short buffer for smoothing.
- **connection state**: connected/disconnected status.

### capabilities

- accepts MocapFrame data from stdin JSON lines, WebSocket, or direct function call.
- stores the latest frame for the renderer to read each tick.
- optionally smooths between frames using exponential interpolation (for jitter reduction).
- detects connection loss and holds the last known frame (face freezes rather than disappears).

### interfaces

- **start(source)**: begins listening for frames from the specified source.
- **latest() -> MocapFrame**: returns the most recent frame.
- **stop()**: disconnects.

### invariants

- always has a valid frame available (defaults to neutral rest pose if no data received).
- smoothing never introduces more than one frame of latency.

---

## face model

Translates mocap points into renderable geometry for a specific face style.

### state

- **face style**: colors, proportions, line widths, art assets.
- **current points**: the active mocap point values after smoothing.

### capabilities

- maps abstract mocap point values (mouth_smile, left_eye_open, etc.) to concrete drawing coordinates.
- scales all geometry proportionally to the render target dimensions.
- loads face styles from JSON configuration files.
- provides sensible defaults for all style fields.

### interfaces

- **apply(mocap_frame)**: updates internal geometry from a mocap frame.
- **geometry()**: returns computed drawing coordinates for the renderer.
- **load_style(path)**: loads a face style from JSON.

### invariants

- all coordinates are relative to render target dimensions (no pixel values in the style).
- unknown mocap points are silently ignored — the face model renders what it understands.
- a valid default style is always available; external style files are optional.

---

## pygame renderer

Desktop renderer using Pygame.

### state

- **screen surface**: Pygame display surface.
- **clock**: frame rate controller.
- **debug mode**: flag to show/hide the debug overlay.

### capabilities

- draws face outline, eyes (white + iris + pupil + highlight), brows, and mouth from face model geometry.
- renders a debug overlay showing mocap point values and frame timing.
- handles window resize, keyboard shortcuts, and mouse events.
- targets 60 FPS render loop.

### interfaces

- **render(geometry, style)**: draws one frame.
- **handle_events()**: processes Pygame events.

### invariants

- the renderer is purely a function of the current geometry and style; it holds no animation state.
- all drawing scales proportionally to window dimensions.
- 60 FPS target; frame delta capped at 50ms to prevent physics jumps.

---

## react renderer

Web renderer as an embeddable React component.

### state

- **SVG or Canvas ref**: the render target DOM element.
- **animation frame ID**: requestAnimationFrame handle.

### capabilities

- draws face geometry using SVG paths or Canvas 2D API.
- accepts mocap frames as props or via a WebSocket connection.
- re-renders on each animation frame when mocap data updates.
- supports CSS-based styling for colors and layout.
- exports as a self-contained React component with TypeScript types.

### interfaces

- **`<Visage src={ws_url} style={faceStyle} />`**: React component API.
- **props.onFrame(frame)**: optional callback exposing each frame to the parent.

### invariants

- the component is pure — same props + same mocap frame = same render output.
- unmounting cleans up WebSocket connections and animation frames.
- renders at the browser's native refresh rate (requestAnimationFrame).

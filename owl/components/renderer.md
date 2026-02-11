# renderer

Canvas 2D face renderer running in the browser.

## state

- canvas element reference
- current face style (colors, proportions, line widths)
- current MocapFrame point values
- animation frame ID

## capabilities

- draws a face on a Canvas 2D context: head outline, eyes (white + iris + pupil + highlight), eyebrows, mouth, jaw
- maps abstract mocap point values to concrete canvas drawing coordinates
- scales all geometry proportionally to canvas dimensions
- handles window resize — canvas fills the viewport
- loads face styles from a JSON object; provides sensible defaults
- renders a debug overlay (toggled with 'd' key) showing current mocap point values and FPS
- draws a "no signal" indicator when no MocapFrame data has been received

## interfaces

- **render(frame, style)** - draws one frame to the canvas
- receives MocapFrame data from the receiver module

depends on:
- receiver component for mocap data

## invariants

- the renderer is a pure function of the current frame and style — no animation state
- all coordinates are fractions of canvas dimensions
- unknown mocap points are silently ignored
- a valid default style is always available
- renders at requestAnimationFrame rate

# constraints

## runtime

- use Python 3.10 or later.
- use Pygame for the built-in face renderer and window management.
- use NumPy for parameter vector operations and blending math.
- maintain 60 frames per second in the main render loop.
- cap the frame delta time at 50 milliseconds to prevent physics jumps after stalls.

## architecture

- keep the sentiment brain, face model, animation system, signal protocol, and renderer as separate modules with no circular dependencies.
- the main loop is single-threaded; only input adapters (stdin listener, file watcher) run on background threads.
- use thread-safe queues for all communication between background threads and the main loop.
- the parameter vector is the sole interface between the animation system and the renderer. the renderer never inspects animation layers or emotion state directly.

## animation

- expressions blend via weighted layers, never by discrete switching.
- the idle animator (breathing, blinking, eye drift) is always active and additive on top of expression layers.
- the resting baseline always participates in blending with nonzero weight so the face returns to neutral when all layers decay.

## input protocol

- accept expression commands as JSON lines on stdin with at minimum an "expression" field.
- accept tool-call-wrapped JSON transparently (objects with "name" and "arguments" fields).
- the file watcher polls at 50 millisecond intervals.
- handle file truncation by resetting the read position to the beginning.

## style

- all visual proportions (positions, sizes) are specified as fractions of window dimensions, not pixel values.
- custom styles are loadable from JSON files matching the FaceStyle fields.
- provide sensible defaults for all style fields so the face renders without any configuration.

## future direction

- the Pygame oval renderer is the current implementation. pivot the renderer to use Wan 2.2 video generation for face rendering via pre-generated face pack clips.
- integrate with AgentChat marketplace to register and trade face packs.
- the animation system and sentiment brain must remain renderer-agnostic to support this pivot.

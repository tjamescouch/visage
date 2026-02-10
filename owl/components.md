# components

## sentiment brain

The sentiment brain converts a stream of text into a continuous emotion signal.

### state

- **emotion**: a valence/arousal pair. valence ranges from -1 (negative) to +1 (positive). arousal ranges from 0 (calm) to 1 (excited).
- **talking flag**: true when tokens have arrived recently, false during silence.
- **text window**: a bounded sliding window of recent text used for analysis.
- **silence timer**: tracks elapsed time since the last token arrived.

### capabilities

- accepts partial or complete text chunks with timestamps.
- scores text against keyword lexicons for positive, negative, thinking, and surprise sentiment.
- applies exponential recency weighting so newer words influence the signal more than older ones.
- blends new sentiment signals into the running emotion state proportional to signal strength.
- decays emotion toward neutral during silence, with faster decay the longer the silence persists.
- detects whether the LLM is actively producing tokens (talking detection).

### interfaces

- **feed(text, timestamp)**: ingests a chunk of text from the token stream.
- **step(dt, timestamp)**: advances the emotion state by one frame interval.
- **emotion**: exposes the current valence, arousal, and talking state.

### invariants

- valence is always clamped to [-1, +1].
- arousal is always clamped to [0, 1].
- emotion decays toward neutral when no tokens arrive; it never drifts unbounded.
- the talking flag reflects token recency, not sentiment content.

---

## face model

The face model holds the geometric state of the face and defines the expression vocabulary.

### state

- **parameter vector**: an ordered array of floats representing every controllable facial dimension (eye openness, pupil position, mouth curve, brow angle, face scale, and others).
- **style**: a collection of visual properties (colors, proportions, line widths) that define the face's appearance.
- **expression name**: the currently active named expression.

### capabilities

- stores default parameter values for the neutral resting face.
- defines named expressions as parameter overrides relative to defaults (idle, thinking, talking, happy, sad, surprised, confused).
- applies an expression at a given intensity by interpolating between defaults and overrides.
- accepts a raw parameter vector from the animation system.
- provides named access to individual parameters for the renderer.

### interfaces

- **set_expression(expression, intensity)**: applies a named expression.
- **set_params(vector)**: sets the full parameter vector from the animation system.
- **p(name)**: returns the current value of a single named parameter.
- **style**: exposes the visual style configuration.

### invariants

- the parameter vector length is always equal to the number of defined parameter names.
- unknown expression names are silently ignored; the face never enters an undefined state.
- the parameter vector and parameter name list remain in stable, consistent order.

---

## animation system

The animation system blends multiple expression layers and adds autonomous idle behaviors.

### state

- **layers**: a list of active animation layers, each with a name, parameter vector, weight, decay rate, and age.
- **current output**: the smoothed parameter vector sent to the face model each frame.
- **idle state**: internal timers for breathing phase, blink scheduling, eye drift, and talking oscillation.

### capabilities

- accepts named expression pushes with intensity and decay rate. each push creates a weighted layer that fades over time.
- accepts sentiment-derived pushes that map valence/arousal to facial parameter offsets.
- blends all active layers using weighted averaging with a constant-weight resting baseline.
- applies exponential smoothing to the blended result for fluid transitions.
- prunes layers whose weight has decayed below a threshold.
- replaces any existing layer with the same name to prevent stacking duplicates.
- overlays idle behaviors on top of the blended output: breathing (face scale oscillation), periodic blinking, slow eye drift, and mouth oscillation during talking.

### interfaces

- **push_expression(expression, intensity, decay_rate)**: adds or replaces an expression layer.
- **push_sentiment(valence, arousal, decay_rate)**: adds or replaces a sentiment-derived layer.
- **step(dt)**: advances all layers and returns the blended parameter vector.
- **idle step(params, dt)**: applies idle overlays to a parameter vector and returns the modified result.

### invariants

- dead layers (weight below threshold) are removed every frame; the layer list does not grow unbounded.
- the resting baseline always participates in blending with a fixed minimum weight.
- idle behaviors are additive and always active; they never override expression layers, only augment them.
- blink timing is randomized within a bounded range; it never produces unrealistically rapid or slow blinks.

---

## signal protocol

The signal protocol provides input adapters that feed data into the system from external sources.

### state

- **stdin listener**: a background thread reading JSON lines from standard input.
- **file watcher**: a background thread tailing a file for new text content.
- **event queues**: thread-safe queues buffering incoming events and text chunks.

### capabilities

- reads JSON-formatted expression commands from stdin (expression name and intensity).
- handles tool-call-style JSON (with name/arguments wrapping) transparently.
- watches a file for appended text content using polling, similar to tail -f.
- detects file truncation (new conversation) and resets the read position.
- buffers all incoming data in thread-safe queues for polling by the main loop.

### interfaces

- **start()**: begins background listening threads.
- **stop()**: signals background threads to terminate.
- **poll()**: returns the next queued event or text chunk, or nothing if empty.
- **poll_all()**: drains all queued text chunks at once.

### invariants

- background threads are daemon threads; they do not prevent application shutdown.
- queue reads are non-blocking in the main loop; input never stalls rendering.
- the file watcher handles missing files and IO errors gracefully without crashing.

---

## renderer

The renderer draws the face to the screen each frame using the current parameter vector and style.

### state

- **screen surface**: the display target at the current window dimensions.
- **clock**: the frame rate controller.

### capabilities

- draws the face outline as an ellipse scaled by face dimensions and the face_scale parameter.
- draws each eye as a white ellipse modulated by openness, with an iris and pupil positioned by pupil offset parameters, plus a specular highlight.
- draws eyebrows as angled line segments positioned by brow height and angle parameters.
- draws the mouth as a curved line whose curvature and width are driven by parameters, with an open mouth polygon when openness exceeds a threshold.
- renders a debug overlay showing the current emotion values and active animation layers.
- handles window resize events.

### interfaces

- reads the face model's parameter vector and style each frame.
- accepts Pygame events for window management and keyboard input.

### invariants

- the renderer targets 60 frames per second.
- the renderer is purely a function of the current parameter vector and style; it holds no animation state.
- all drawing coordinates scale proportionally to window dimensions.

---

## face pack system

The face pack system provides alternative face renderers beyond the built-in Pygame oval renderer. This component is planned but not yet implemented.

### state

- **face pack library**: a collection of named face packs, each containing pre-generated video clips for expression ranges.

### capabilities

- generates short video clips for ranges of expression parameters using a video generation model.
- selects and composites the appropriate clip frame based on the current parameter vector.
- registers face packs for agents in the AgentChat marketplace.

### interfaces

- accepts the same parameter vector as the built-in renderer.
- provides face pack metadata for marketplace listing.

### invariants

- face packs are interchangeable with the built-in renderer; the animation system and sentiment brain are agnostic to which renderer is active.
- a face pack covers the full expression parameter range so there are no gaps in expression coverage.

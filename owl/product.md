# visage

Visage is an animated avatar that gives LLM agents an emotive, real-time face driven by sentiment analysis of their token stream.

## components

- [sentiment brain](components.md#sentiment-brain)
- [face model](components.md#face-model)
- [animation system](components.md#animation-system)
- [signal protocol](components.md#signal-protocol)
- [renderer](components.md#renderer)
- [face pack system](components.md#face-pack-system)

## behaviors

- the system reads an LLM token stream in real time via file watch or stdin.
- the sentiment brain converts incoming text into a continuous emotion signal (valence and arousal).
- the animation system blends multiple weighted expression layers with configurable decay.
- the idle animator adds autonomous life behaviors (breathing, blinking, eye drift) that run continuously underneath all other expressions.
- expressions stack and blend rather than switching discretely.
- the face reacts continuously to emotion changes at 60 frames per second.
- keyboard input triggers expression overrides for testing and manual control.
- custom visual styles are loadable from external JSON files.

## constraints

- [constraints](constraints.md)

# Visage

Animated face for LLMs. Gives AI agents an emotive, real-time avatar driven by sentiment analysis of their token stream.

> **Experimental** — under active development. Not stable.

## What it does

Visage renders a face in a Pygame window that reacts to what an LLM is saying. It reads a token stream (via file watch or stdin), runs lightweight sentiment analysis, and maps the emotional signal to facial expressions — all at 60fps.

**Pipeline:** Token stream → Sentiment brain → Emotion (valence/arousal) → Animation blender → Face renderer

### Expressions

The face supports layered, blendable expressions that decay naturally over time:

- **idle** — neutral resting state with breathing and eye drift
- **thinking** — narrowed eyes, asymmetric brows, slight frown
- **talking** — mouth oscillation synced to token flow
- **happy** — smile curve, squinted eyes
- **sad** — downturn mouth, inner brow raise
- **surprised** — wide eyes, open mouth, raised brows
- **confused** — asymmetric eyes and brows, slight frown

Expressions stack and blend via weighted layers with configurable decay rates.

### Sentiment brain

A keyword lexicon approach with recency-weighted scoring. Picks up on positive words (great, solved, elegant), negative (error, crash, broken), thinking (analyzing, considering), and surprise (wow, unexpected). The emotion signal (valence + arousal) drives the face continuously — no discrete emotion switching.

## Architecture

```
visage.py     — Main app loop, Pygame rendering (eyes, brows, mouth, face outline)
face.py       — Face model, style system, expression parameter definitions
brain.py      — SentimentBrain: token stream → valence/arousal emotion signal
interp.py     — AnimationBlender (weighted layer decay) + IdleAnimator (breathing, blinking, eye drift)
protocol.py   — SignalListener (stdin JSON) + TokenStreamWatcher (file tail)
```

## Usage

```bash
# Basic — opens face window, control with keyboard (1-7 for expressions, 0 to reset)
python visage.py

# Watch a token stream file (tail -f style)
python visage.py --watch /path/to/token_output.txt

# Custom style
python visage.py --style my_style.json

# Custom window size
python visage.py --width 800 --height 800
```

### Keyboard controls

| Key | Expression |
|-----|-----------|
| 1 | idle |
| 2 | thinking |
| 3 | talking |
| 4 | happy |
| 5 | sad |
| 6 | surprised |
| 7 | confused |
| 0 | reset |

### Piping expression commands

Send JSON lines to stdin:

```bash
echo '{"expression": "happy", "intensity": 0.8}' | python visage.py
```

### Custom styles

Create a JSON file with any `FaceStyle` fields:

```json
{
  "bg_color": [15, 15, 25],
  "face_color": [200, 200, 220],
  "eye_color": [80, 180, 255],
  "mouth_color": [200, 100, 120],
  "face_width": 0.55,
  "face_height": 0.7
}
```

## Dependencies

- Python 3.10+
- pygame
- numpy

## License

MIT

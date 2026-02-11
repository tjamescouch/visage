# tts-service

Lightweight text-to-speech service for Visage agents. Accepts text, produces audio and synchronized lip-sync MocapFrame data.

## components

- [server](components/server.md) - Express HTTP + WebSocket server
- [synth](components/synth.md) - TTS synthesis engine abstraction
- [lipsync](components/lipsync.md) - Audio-to-MocapFrame lip-sync generator
- [pipeline](components/pipeline.md) - Orchestrates text -> audio -> lipsync -> output

## architecture

```
POST /api/speak {"text": "Hello world"}
       |
       v
   [pipeline]
       |
       +---> [synth] ---> audio (WAV/PCM)
       |        |
       |        v
       +---> [lipsync] ---> MocapFrame[] (timed mouth/jaw data)
       |
       v
   Response: audio URL + WebSocket stream of MocapFrames to Visage
```

## MocapFrame lip-sync points

Maps to the existing Visage MocapFrame format:

- `mouth_open` (0.0 - 1.0) - how open the mouth is
- `mouth_wide` (0.0 - 1.0) - horizontal stretch
- `mouth_smile` (-0.5 - 0.5) - smile/frown
- `jaw_open` (0.0 - 1.0) - jaw displacement

## constraints

see [constraints.md](constraints.md)

## non-goals (v1)

- no real-time streaming synthesis (batch only for now)
- no voice cloning
- no multi-language (English only in v1)
- no emotion detection from text (prosody hints via @@markers@@ are stretch)

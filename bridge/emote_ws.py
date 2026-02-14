"""Emote WS -> Visage MocapFrame producer.

Connects to a WebSocket that emits *emote vectors* and publishes mapped MocapFrames
into a Visage relay server (web/server.js) over WebSocket.

Input message schema (JSON):
{
  "t": 1730000000.123,           # optional (seconds); defaults to now
  "valence": 0.2,                # optional [-1,1]
  "arousal": 0.7,                # optional [0,1]
  "happy": 0.1, "sad": 0.0, ...  # optional [0,1]
}

Output message schema (JSON):
{"t": <seconds>, "pts": {...}}

Usage:
  python -m bridge.emote_ws --in ws://localhost:7777 --out ws://localhost:3000

"""

from __future__ import annotations

import argparse
import asyncio
import json
import time

import websockets

from visage.emote import EmoteVector, emote_to_pts


def _to_float(x, default=0.0):
    try:
        return float(x)
    except Exception:
        return default


def parse_emote(msg: dict) -> EmoteVector:
    return EmoteVector(
        valence=_to_float(msg.get("valence", 0.0)),
        arousal=_to_float(msg.get("arousal", 0.2)),
        happy=_to_float(msg.get("happy", 0.0)),
        sad=_to_float(msg.get("sad", 0.0)),
        angry=_to_float(msg.get("anger", msg.get("angry", 0.0))),
        fear=_to_float(msg.get("fear", 0.0)),
        surprise=_to_float(msg.get("surprise", 0.0)),
        thinking=_to_float(msg.get("thinking", 0.0)),
    )


async def run(in_url: str, out_url: str):
    async with websockets.connect(out_url) as out_ws:
        await out_ws.send(json.dumps({"role": "producer"}))

        async with websockets.connect(in_url) as in_ws:
            while True:
                raw = await in_ws.recv()
                try:
                    data = json.loads(raw)
                except Exception:
                    continue

                ev = parse_emote(data)
                t = data.get("t")
                t = _to_float(t, default=time.time())

                frame = {"t": t, "pts": emote_to_pts(ev)}
                await out_ws.send(json.dumps(frame))


def main():
    ap = argparse.ArgumentParser(description="emote websocket -> visage mocap producer")
    ap.add_argument("--in", dest="in_url", required=True, help="emote WS URL")
    ap.add_argument(
        "--out",
        dest="out_url",
        default="ws://localhost:3000",
        help="visage WS URL (default: ws://localhost:3000)",
    )
    args = ap.parse_args()

    asyncio.run(run(args.in_url, args.out_url))


if __name__ == "__main__":
    main()

# server

Express app that serves the face renderer and relays MocapFrame data via WebSocket.

## state

- set of connected WebSocket clients
- latest MocapFrame received (for late-joining clients)

## capabilities

- serves static files from a `public/` directory (the renderer HTML/JS/CSS)
- accepts WebSocket connections on the same port via upgrade
- two WebSocket roles: **producer** (sends mocap frames) and **viewer** (receives them)
- relays incoming MocapFrame from any producer to all connected viewers
- sends the latest cached frame to newly connected viewers so they don't start with a blank face
- provides a `/api/health` endpoint returning server status
- provides a `/api/demo` endpoint that starts a built-in demo animation loop (sine-wave driven mocap frames for testing without a real producer)

## interfaces

exposes:
- `GET /` - serves the renderer page
- `GET /api/health` - health check
- `POST /api/demo` - start/stop demo animation
- `ws://` - WebSocket endpoint; clients send `{"role":"producer"}` or `{"role":"viewer"}` on connect

depends on:
- nothing external — self-contained

## invariants

- the server never modifies MocapFrame data; it relays verbatim
- if no producer is connected, viewers receive no frames (or the last cached frame)
- WebSocket messages that aren't valid JSON are silently dropped
- the demo endpoint generates valid MocapFrame data at 30 FPS

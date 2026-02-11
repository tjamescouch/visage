# constraints

## stack

- backend: node, express
- frontend: vanilla js, canvas 2d api (no framework)
- transport: ws (npm package) for websocket
- no build step for frontend — plain html/js served statically

## ports

- express server on 3000
- websocket on same port (upgrade from http)

## rendering

- all visual proportions are fractions of canvas dimensions, not pixel values
- face styles loadable from JSON; sensible defaults always available
- renderer is stateless — pure function of current mocap frame and style
- targets requestAnimationFrame rate (60 FPS)

## mocap format

- MocapFrame is a JSON object with `t` (timestamp float) and `pts` (dict of named floats)
- 18 control points in v1
- frames are self-contained — no delta encoding
- transport: WebSocket JSON messages

## dependencies

- minimal. express, ws, and nothing else on the server
- zero dependencies on the client (vanilla js)

## style

- es modules throughout
- no typescript for v1 — plain javascript
- clean separation: server knows nothing about rendering, client knows nothing about frame sourcing

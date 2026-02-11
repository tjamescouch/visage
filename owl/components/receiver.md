# receiver

WebSocket client that connects to the server and receives MocapFrame data.

## state

- WebSocket connection instance
- latest received MocapFrame
- connection status (connecting, connected, disconnected)
- reconnect timer

## capabilities

- connects to the server WebSocket as a viewer
- parses incoming JSON messages as MocapFrame data
- stores the latest frame for the renderer to read each animation tick
- auto-reconnects on disconnect with exponential backoff (1s, 2s, 4s, max 10s)
- exposes connection status for the UI to display
- calls a registered callback on each new frame

## interfaces

- **connect(url)** - opens WebSocket connection as viewer
- **onFrame(callback)** - registers frame callback
- **latest()** - returns the most recent frame
- **status()** - returns connection state
- **disconnect()** - closes connection

## invariants

- always has a valid frame available (defaults to neutral rest pose if no data received)
- reconnects automatically — viewer never stays disconnected permanently
- invalid JSON messages are silently dropped

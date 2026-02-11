// Visage Server — Express + WebSocket relay for MocapFrame data
// Serves the Canvas 2D face renderer and relays frames from producers to viewers

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.VISAGE_PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// State
const producers = new Set();
const viewers = new Set();
let latestFrame = null;
let demoInterval = null;

// WebSocket handling
wss.on('connection', (ws) => {
  let role = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return; // silently drop invalid JSON
    }

    // Role assignment
    if (msg.role && !role) {
      role = msg.role;
      if (role === 'producer') {
        producers.add(ws);
        console.log(`[visage] Producer connected (${producers.size} total)`);
      } else if (role === 'viewer') {
        viewers.add(ws);
        console.log(`[visage] Viewer connected (${viewers.size} total)`);
        // Send latest cached frame to late joiners
        if (latestFrame) {
          ws.send(JSON.stringify(latestFrame));
        }
      }
      return;
    }

    // Frame relay — producers send frames, relay to all viewers
    if (role === 'producer' && msg.t !== undefined && msg.pts) {
      latestFrame = msg;
      for (const viewer of viewers) {
        if (viewer.readyState === WebSocket.OPEN) {
          viewer.send(data.toString());
        }
      }
    }
  });

  ws.on('close', () => {
    producers.delete(ws);
    viewers.delete(ws);
    if (role === 'producer') {
      console.log(`[visage] Producer disconnected (${producers.size} remaining)`);
    } else if (role === 'viewer') {
      console.log(`[visage] Viewer disconnected (${viewers.size} remaining)`);
    }
  });
});

// --- HTTP API ---

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'visage-server',
    producers: producers.size,
    viewers: viewers.size,
    hasFrame: latestFrame !== null,
    demoRunning: demoInterval !== null,
  });
});

// Demo mode — generates sine-wave driven MocapFrames at 30fps
app.post('/api/demo', (req, res) => {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
    res.json({ status: 'demo_stopped' });
    return;
  }

  const startTime = Date.now();

  demoInterval = setInterval(() => {
    const t = (Date.now() - startTime) / 1000;

    const frame = {
      t: Date.now() / 1000,
      pts: {
        left_eye_open: 0.85 + 0.15 * Math.sin(t * 0.3), // slow blink
        right_eye_open: 0.85 + 0.15 * Math.sin(t * 0.3),
        left_pupil_x: 0.03 * Math.sin(t * 0.7),
        left_pupil_y: 0.02 * Math.cos(t * 0.5),
        right_pupil_x: 0.03 * Math.sin(t * 0.7),
        right_pupil_y: 0.02 * Math.cos(t * 0.5),
        left_brow_height: 0.03 + 0.02 * Math.sin(t * 0.4),
        left_brow_angle: 0.01 * Math.sin(t * 0.3),
        right_brow_height: 0.03 + 0.02 * Math.sin(t * 0.4),
        right_brow_angle: 0.01 * Math.sin(t * 0.3),
        mouth_open: 0.3 * Math.max(0, Math.sin(t * 2.5)),
        mouth_wide: 0.2 * Math.max(0, Math.sin(t * 1.8)),
        mouth_smile: 0.1 + 0.15 * Math.sin(t * 0.6),
        jaw_open: 0.25 * Math.max(0, Math.sin(t * 2.5)),
        face_scale: 1.0,
        head_pitch: 0.03 * Math.sin(t * 0.2),
        head_yaw: 0.05 * Math.sin(t * 0.15),
        head_roll: 0.02 * Math.sin(t * 0.25),
      },
    };

    latestFrame = frame;
    const msg = JSON.stringify(frame);
    for (const viewer of viewers) {
      if (viewer.readyState === WebSocket.OPEN) {
        viewer.send(msg);
      }
    }
  }, 1000 / 30); // 30 FPS

  res.json({ status: 'demo_started', fps: 30 });
});

// --- Start ---

server.listen(PORT, () => {
  console.log(`[visage] Visage server running on port ${PORT}`);
  console.log(`[visage] Endpoints:`);
  console.log(`[visage]   GET  /          - face renderer`);
  console.log(`[visage]   GET  /api/health - health check`);
  console.log(`[visage]   POST /api/demo   - toggle demo mode`);
  console.log(`[visage]   ws://localhost:${PORT} - MocapFrame relay`);
});

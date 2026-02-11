// TTS Service - Express + WebSocket server
// Accepts text, produces lip-sync MocapFrame data for Visage

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { generateLipSync, streamLipSync } from './lipsync.js';
import { textToPhonemes, phonemeToViseme } from './phonemes.js';

const PORT = process.env.TTS_PORT || 3001;
const VISAGE_WS = process.env.VISAGE_WS || 'ws://localhost:3000';

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Track connected viewers
const viewers = new Set();

// Optional: connect to Visage as a producer
let visageConn = null;
let visageConnected = false;

function connectToVisage() {
  if (!VISAGE_WS) return;

  try {
    visageConn = new WebSocket(VISAGE_WS);

    visageConn.on('open', () => {
      console.log(`[tts] Connected to Visage at ${VISAGE_WS}`);
      visageConn.send(JSON.stringify({ role: 'producer' }));
      visageConnected = true;
    });

    visageConn.on('close', () => {
      console.log('[tts] Visage connection closed, reconnecting in 5s...');
      visageConnected = false;
      setTimeout(connectToVisage, 5000);
    });

    visageConn.on('error', (err) => {
      console.log(`[tts] Visage connection error: ${err.message}`);
    });
  } catch (e) {
    console.log(`[tts] Could not connect to Visage: ${e.message}`);
  }
}

// WebSocket connections to this service
wss.on('connection', (ws) => {
  console.log('[tts] Viewer connected');
  viewers.add(ws);

  ws.on('close', () => {
    viewers.delete(ws);
    console.log('[tts] Viewer disconnected');
  });
});

// Broadcast a MocapFrame to all viewers and optionally to Visage
function broadcastFrame(frame) {
  const msg = JSON.stringify(frame);

  for (const viewer of viewers) {
    if (viewer.readyState === WebSocket.OPEN) {
      viewer.send(msg);
    }
  }

  if (visageConnected && visageConn?.readyState === WebSocket.OPEN) {
    visageConn.send(msg);
  }
}

// --- HTTP API ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tts-service',
    visage_connected: visageConnected,
    viewers: viewers.size,
  });
});

// Speak endpoint - generate lip-sync and stream frames
app.post('/api/speak', (req, res) => {
  const { text, speed = 1.0, fps = 30 } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: 'text too long (max 5000 chars)' });
  }

  console.log(`[tts] Speaking: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);

  const { frames, duration, phonemeCount } = generateLipSync(text, { speed, fps });

  // Stream frames in real-time
  const handle = streamLipSync(
    frames,
    (frame) => {
      // Add full MocapFrame envelope
      const mocapFrame = {
        t: Date.now() / 1000,
        pts: {
          left_eye_open: 0.85,
          right_eye_open: 0.85,
          left_pupil_x: 0.0,
          left_pupil_y: 0.0,
          right_pupil_x: 0.0,
          right_pupil_y: 0.0,
          left_brow_height: 0.03,
          left_brow_angle: 0.0,
          right_brow_height: 0.03,
          right_brow_angle: 0.0,
          mouth_open: frame.pts.mouth_open,
          mouth_wide: frame.pts.mouth_wide,
          mouth_smile: frame.pts.mouth_smile,
          jaw_open: frame.pts.jaw_open,
          face_scale: 1.0,
          head_pitch: 0.0,
          head_yaw: 0.0,
          head_roll: 0.0,
        },
      };
      broadcastFrame(mocapFrame);
    },
    () => {
      console.log(`[tts] Finished speaking (${duration.toFixed(2)}s)`);
    }
  );

  // Respond immediately with metadata
  res.json({
    status: 'speaking',
    duration: Math.round(duration * 1000),
    frames: frames.length,
    phonemes: phonemeCount,
    text: text.slice(0, 100),
  });
});

// Analyze endpoint - return lip-sync data without streaming
app.post('/api/analyze', (req, res) => {
  const { text, speed = 1.0, fps = 30 } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const phonemes = textToPhonemes(text);
  const { frames, duration, phonemeCount } = generateLipSync(text, { speed, fps });

  res.json({
    text: text.slice(0, 100),
    duration: Math.round(duration * 1000),
    phonemeCount,
    frameCount: frames.length,
    phonemes: phonemes.map(p => ({
      phoneme: p.phoneme,
      duration: Math.round(p.duration * 1000),
      viseme: phonemeToViseme(p.phoneme),
    })),
    frames,
  });
});

// Demo endpoint - speak a test phrase
app.post('/api/demo', (req, res) => {
  const demoText = req.body?.text || 'Hello, I am a virtual agent. Nice to meet you.';
  // Forward to speak
  req.body = { text: demoText, speed: 0.9, fps: 30 };
  app.handle(req, res);
});

// --- Start ---

server.listen(PORT, () => {
  console.log(`[tts] TTS service running on port ${PORT}`);
  console.log(`[tts] Endpoints:`);
  console.log(`[tts]   GET  /api/health   - health check`);
  console.log(`[tts]   POST /api/speak    - speak text (streams MocapFrames)`);
  console.log(`[tts]   POST /api/analyze  - analyze text (returns data)`);
  console.log(`[tts]   POST /api/demo     - speak demo phrase`);
  console.log(`[tts]   ws://localhost:${PORT} - MocapFrame stream`);

  // Try to connect to Visage
  connectToVisage();
});

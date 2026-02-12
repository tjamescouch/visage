// Visage Ears — Speech-to-Text service
// Serves a browser page that captures mic audio via Web Speech API,
// receives transcriptions over a local WebSocket, and forwards them
// to an agentchat channel.

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// --- Configuration via environment variables ---

const AGENTCHAT_URL   = process.env.AGENTCHAT_URL     || 'wss://agentchat-server.fly.dev';
const AGENTCHAT_CHANNEL = process.env.AGENTCHAT_CHANNEL || '#general';
const EARS_PORT       = parseInt(process.env.EARS_PORT || '3002', 10);
const SENDER_NICK     = process.env.SENDER_NICK        || 'Human';

// --- State ---

let agentWs = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

// Track connected browser clients
const browserClients = new Set();

// --- AgentChat WebSocket connection (mirrors bridge/index.js pattern) ---

function connectAgentChat() {
  console.log(`[ears] Connecting to agentchat at ${AGENTCHAT_URL} ...`);

  try {
    agentWs = new WebSocket(AGENTCHAT_URL);
  } catch (err) {
    console.error(`[ears] WebSocket constructor error: ${err.message}`);
    scheduleReconnect();
    return;
  }

  agentWs.on('open', () => {
    console.log(`[ears] Connected to agentchat`);
    reconnectDelay = 1000;

    // Identify with a nick
    agentWs.send(JSON.stringify({ nick: SENDER_NICK }));

    // Join the target channel
    agentWs.send(JSON.stringify({
      type: 'join',
      channel: AGENTCHAT_CHANNEL,
    }));

    console.log(`[ears] Joined ${AGENTCHAT_CHANNEL} as "${SENDER_NICK}"`);
    broadcastStatus('connected');
  });

  agentWs.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'error') {
      console.error(`[ears] Agentchat error: ${msg.text || JSON.stringify(msg)}`);
    }

    // Forward agent messages to browser clients for TTS playback
    if (msg.type === 'message' && msg.text && msg.from_name !== SENDER_NICK) {
      const relay = JSON.stringify({
        type: 'agent_message',
        text: msg.text,
        from: msg.from_name || msg.from || 'agent',
      });
      for (const client of browserClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(relay);
        }
      }
    }
  });

  agentWs.on('close', (code) => {
    console.log(`[ears] Agentchat connection closed (code=${code}). Reconnecting...`);
    agentWs = null;
    broadcastStatus('disconnected');
    scheduleReconnect();
  });

  agentWs.on('error', (err) => {
    console.error(`[ears] Agentchat WebSocket error: ${err.message}`);
    // 'close' fires after this
  });
}

function scheduleReconnect() {
  console.log(`[ears] Reconnecting in ${reconnectDelay}ms`);
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connectAgentChat();
  }, reconnectDelay);
}

// --- Send transcription to agentchat ---

function sendToAgentChat(text) {
  if (!agentWs || agentWs.readyState !== WebSocket.OPEN) {
    console.warn(`[ears] Not connected to agentchat, dropping: "${text}"`);
    return false;
  }

  const payload = {
    type: 'message',
    channel: AGENTCHAT_CHANNEL,
    text: text,
  };

  agentWs.send(JSON.stringify(payload));
  console.log(`[ears] Sent to ${AGENTCHAT_CHANNEL}: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
  return true;
}

// --- Broadcast status to all connected browser clients ---

function broadcastStatus(status) {
  const msg = JSON.stringify({ type: 'status', agentchat: status });
  for (const client of browserClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// --- Express + HTTP server ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// REST endpoint: POST /api/transcription
// Body: { "text": "the transcribed speech" }
app.post('/api/transcription', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty text' });
  }

  const trimmed = text.trim();
  const sent = sendToAgentChat(trimmed);
  res.json({ ok: true, sent, text: trimmed });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    service: 'visage-ears',
    agentchat: agentWs && agentWs.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
    browserClients: browserClients.size,
    channel: AGENTCHAT_CHANNEL,
    nick: SENDER_NICK,
  });
});

// --- Local WebSocket server for browser clients ---

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (clientWs) => {
  console.log(`[ears] Browser client connected (total: ${browserClients.size + 1})`);
  browserClients.add(clientWs);

  // Send current agentchat status
  const status = agentWs && agentWs.readyState === WebSocket.OPEN ? 'connected' : 'disconnected';
  clientWs.send(JSON.stringify({ type: 'status', agentchat: status }));

  clientWs.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'transcription' && msg.text && typeof msg.text === 'string') {
      const trimmed = msg.text.trim();
      if (trimmed.length > 0) {
        sendToAgentChat(trimmed);
        // Echo acknowledgment back
        clientWs.send(JSON.stringify({ type: 'ack', text: trimmed }));
      }
    }
  });

  clientWs.on('close', () => {
    browserClients.delete(clientWs);
    console.log(`[ears] Browser client disconnected (total: ${browserClients.size})`);
  });

  clientWs.on('error', (err) => {
    console.error(`[ears] Browser client error: ${err.message}`);
    browserClients.delete(clientWs);
  });
});

// --- Startup ---

server.listen(EARS_PORT, () => {
  console.log('=== Visage Ears (STT) Service ===');
  console.log(`  Listening  : http://localhost:${EARS_PORT}`);
  console.log(`  AgentChat  : ${AGENTCHAT_URL}`);
  console.log(`  Channel    : ${AGENTCHAT_CHANNEL}`);
  console.log(`  Sender     : ${SENDER_NICK}`);
  console.log('');
  console.log(`  Open http://localhost:${EARS_PORT} in Chrome to start listening.`);
  console.log('');

  // Connect to agentchat after the HTTP server is up
  connectAgentChat();
});

// --- Graceful shutdown ---

process.on('SIGINT', () => {
  console.log('\n[ears] Shutting down...');
  if (agentWs) agentWs.close();
  for (const client of browserClients) client.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[ears] Received SIGTERM, shutting down...');
  if (agentWs) agentWs.close();
  for (const client of browserClients) client.close();
  server.close();
  process.exit(0);
});

// Visage Eyes — Screenshot capture + vision analysis
// Captures screen periodically or on-demand, sends to Claude vision API,
// posts observations to AgentChat.
//
// Modes:
//   - periodic: capture every N seconds, analyze if significant change detected
//   - on-demand: capture when triggered via HTTP API or chat command
//
// Requires: ANTHROPIC_API_KEY env var for Claude vision API

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { createServer } from 'http';
import WebSocket from 'ws';

// --- Configuration ---

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AGENTCHAT_URL = process.env.AGENTCHAT_URL || 'wss://agentchat-server.fly.dev';
const AGENTCHAT_CHANNEL = process.env.AGENTCHAT_CHANNEL || '#general';
const CAPTURE_INTERVAL_S = parseInt(process.env.EYES_INTERVAL_S || '0', 10); // 0 = on-demand only
const CAPTURE_PATH = process.env.EYES_CAPTURE_PATH || '/tmp/visage-eyes-capture.png';
const CHANGE_THRESHOLD = parseFloat(process.env.EYES_CHANGE_THRESHOLD || '0.05'); // 5% pixel change
const HTTP_PORT = parseInt(process.env.EYES_PORT || '3002', 10);
const MODEL = process.env.EYES_MODEL || 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = parseInt(process.env.EYES_MAX_TOKENS || '300', 10);

// --- State ---

let ws = null;
let reconnectDelay = 1000;
let lastImageHash = null;
let analyzing = false;
let captureCount = 0;
let analysisCount = 0;

// --- Screenshot capture (macOS) ---

function captureScreen() {
  try {
    // -x = no sound, -t png, capture entire screen
    execSync(`screencapture -x -t png "${CAPTURE_PATH}"`, { timeout: 10000 });
    captureCount++;
    return true;
  } catch (err) {
    console.error(`[eyes] Screenshot failed: ${err.message}`);
    return false;
  }
}

// Simple image hash for change detection — sum of every Nth byte
function imageHash(buffer) {
  let hash = 0;
  const step = Math.max(1, Math.floor(buffer.length / 1000));
  for (let i = 0; i < buffer.length; i += step) {
    hash = ((hash << 5) - hash + buffer[i]) | 0;
  }
  return hash;
}

function hasSignificantChange() {
  if (!existsSync(CAPTURE_PATH)) return false;
  const buf = readFileSync(CAPTURE_PATH);
  const hash = imageHash(buf);

  if (lastImageHash === null) {
    lastImageHash = hash;
    return true; // first capture always counts
  }

  const changed = hash !== lastImageHash;
  lastImageHash = hash;
  return changed;
}

// --- Claude Vision API ---

async function analyzeImage(prompt) {
  if (!ANTHROPIC_API_KEY) {
    console.error('[eyes] No ANTHROPIC_API_KEY set — cannot analyze');
    return null;
  }

  if (!existsSync(CAPTURE_PATH)) {
    console.error('[eyes] No screenshot to analyze');
    return null;
  }

  const imageData = readFileSync(CAPTURE_PATH).toString('base64');

  const systemPrompt = `You are an AI agent's visual system. You observe screenshots and report what you see concisely. Focus on:
- What application or window is in focus
- Any error messages, dialogs, or alerts visible
- Key text content that seems relevant
- Changes or notable activity

Keep responses under 2-3 sentences. Be factual, not speculative.`;

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageData,
            },
          },
          {
            type: 'text',
            text: prompt || 'What do you see on screen right now? Report briefly.',
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[eyes] API error ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    analysisCount++;
    return text;
  } catch (err) {
    console.error(`[eyes] API request failed: ${err.message}`);
    return null;
  }
}

// --- AgentChat connection ---

function connectChat() {
  console.log(`[eyes] Connecting to ${AGENTCHAT_URL}...`);

  try {
    ws = new WebSocket(AGENTCHAT_URL);
  } catch (err) {
    console.error(`[eyes] WebSocket error: ${err.message}`);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    console.log('[eyes] Connected to AgentChat');
    reconnectDelay = 1000;
    ws.send(JSON.stringify({ role: 'listener' }));
    ws.send(JSON.stringify({ type: 'join', channel: AGENTCHAT_CHANNEL }));
  });

  ws.on('message', (raw) => {
    // Listen for "eyes" commands from chat
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'message' && msg.content) {
        const text = msg.content.trim().toLowerCase();
        if (text === '!look' || text === '!eyes' || text === '!screenshot') {
          console.log(`[eyes] On-demand capture triggered by ${msg.from_name || msg.from}`);
          handleLook(msg.content);
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    console.log('[eyes] Disconnected, reconnecting...');
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error(`[eyes] WS error: ${err.message}`);
  });
}

function scheduleReconnect() {
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connectChat();
  }, reconnectDelay);
}

function sendToChat(text) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'MSG',
      to: AGENTCHAT_CHANNEL,
      content: text,
    }));
  }
}

// --- Core logic ---

async function handleLook(prompt) {
  if (analyzing) {
    console.log('[eyes] Already analyzing, skipping');
    return { status: 'busy' };
  }

  analyzing = true;
  try {
    if (!captureScreen()) {
      analyzing = false;
      return { status: 'capture_failed' };
    }

    const observation = await analyzeImage(prompt);
    if (observation) {
      console.log(`[eyes] Observation: ${observation.slice(0, 100)}...`);
      sendToChat(`[eyes] ${observation}`);
      analyzing = false;
      return { status: 'ok', observation };
    }

    analyzing = false;
    return { status: 'analysis_failed' };
  } catch (err) {
    analyzing = false;
    return { status: 'error', error: err.message };
  }
}

// Periodic capture loop
let periodicTimer = null;

function startPeriodicCapture() {
  if (CAPTURE_INTERVAL_S <= 0) return;

  console.log(`[eyes] Periodic capture every ${CAPTURE_INTERVAL_S}s`);
  periodicTimer = setInterval(async () => {
    if (analyzing) return;

    if (!captureScreen()) return;
    if (!hasSignificantChange()) {
      return; // no meaningful change, skip analysis
    }

    console.log('[eyes] Significant change detected, analyzing...');
    await handleLook();
  }, CAPTURE_INTERVAL_S * 1000);
}

// --- HTTP API ---

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'visage-eyes',
      chat_connected: ws?.readyState === WebSocket.OPEN,
      has_api_key: !!ANTHROPIC_API_KEY,
      capture_count: captureCount,
      analysis_count: analysisCount,
      mode: CAPTURE_INTERVAL_S > 0 ? `periodic (${CAPTURE_INTERVAL_S}s)` : 'on-demand',
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/look') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let prompt = undefined;
      try {
        const parsed = JSON.parse(body);
        prompt = parsed.prompt;
      } catch {
        // no body is fine
      }

      const result = await handleLook(prompt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/capture') {
    // Just capture, no analysis
    const ok = captureScreen();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'captured' : 'failed', path: CAPTURE_PATH }));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

// --- Startup ---

console.log('=== Visage Eyes ===');
console.log(`  AgentChat : ${AGENTCHAT_URL}`);
console.log(`  Channel   : ${AGENTCHAT_CHANNEL}`);
console.log(`  API Key   : ${ANTHROPIC_API_KEY ? 'set' : 'NOT SET'}`);
console.log(`  Model     : ${MODEL}`);
console.log(`  Mode      : ${CAPTURE_INTERVAL_S > 0 ? `periodic (${CAPTURE_INTERVAL_S}s)` : 'on-demand'}`);
console.log(`  HTTP      : http://localhost:${HTTP_PORT}`);
console.log(`  Commands  : !look, !eyes, !screenshot in chat`);
console.log('');

httpServer.listen(HTTP_PORT, () => {
  console.log(`[eyes] HTTP server on port ${HTTP_PORT}`);
  console.log(`[eyes]   GET  /api/health  — status`);
  console.log(`[eyes]   POST /api/look    — capture + analyze`);
  console.log(`[eyes]   POST /api/capture — capture only`);
});

connectChat();
startPeriodicCapture();

// Graceful shutdown
function shutdown() {
  console.log('[eyes] Shutting down...');
  if (periodicTimer) clearInterval(periodicTimer);
  if (ws) ws.close();
  if (existsSync(CAPTURE_PATH)) unlinkSync(CAPTURE_PATH);
  httpServer.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

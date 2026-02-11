// Visage AgentChat Bridge
// Connects to agentchat WebSocket, forwards messages to the TTS service.

import WebSocket from 'ws';

// --- Configuration via environment variables ---

const AGENTCHAT_URL = process.env.AGENTCHAT_URL || 'wss://agentchat-server.fly.dev';
const AGENTCHAT_CHANNEL = process.env.AGENTCHAT_CHANNEL || '#general';
const TTS_URL = process.env.TTS_URL || 'http://localhost:3001/api/speak';
const TTS_SPEED = parseFloat(process.env.TTS_SPEED) || 1.0;

// --- State ---

let ws = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

// TTS queue: array of { text, sender }
const queue = [];
let speaking = false;
let speakingUntil = 0; // timestamp (ms) when the current utterance finishes

// --- TTS ---

async function speak(text) {
  speaking = true;
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed: TTS_SPEED }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[bridge] TTS error ${res.status}: ${body}`);
      speaking = false;
      drainQueue();
      return;
    }

    const data = await res.json();
    const duration = data.duration || 0; // milliseconds

    console.log(`[bridge] TTS speaking for ${duration}ms: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);

    // Wait for the TTS to finish streaming frames before sending the next message.
    // The TTS service returns `duration` in ms (how long the lip-sync animation lasts).
    // Add a small buffer so frames finish broadcasting.
    speakingUntil = Date.now() + duration + 200;

    setTimeout(() => {
      speaking = false;
      drainQueue();
    }, duration + 200);
  } catch (err) {
    console.error(`[bridge] TTS fetch failed: ${err.message}`);
    speaking = false;
    // Retry after a short pause so we don't spin on a down TTS service
    setTimeout(drainQueue, 2000);
  }
}

function enqueue(text, sender) {
  // Collapse the queue if it gets too long (keep most recent messages)
  if (queue.length >= 20) {
    const dropped = queue.length - 10;
    queue.splice(0, dropped);
    console.warn(`[bridge] Queue overflow, dropped ${dropped} oldest messages`);
  }

  queue.push({ text, sender });
  console.log(`[bridge] Queued (depth=${queue.length}): [${sender}] "${text.slice(0, 60)}..."`);
  drainQueue();
}

function drainQueue() {
  if (speaking || queue.length === 0) return;
  const { text } = queue.shift();
  speak(text);
}

// --- AgentChat WebSocket ---

function connect() {
  console.log(`[bridge] Connecting to ${AGENTCHAT_URL} ...`);

  try {
    ws = new WebSocket(AGENTCHAT_URL);
  } catch (err) {
    console.error(`[bridge] WebSocket constructor error: ${err.message}`);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    console.log(`[bridge] Connected to agentchat`);
    reconnectDelay = 1000;

    // Identify as a listener and join the target channel
    ws.send(JSON.stringify({ role: 'listener' }));

    // Join the configured channel
    ws.send(JSON.stringify({
      type: 'join',
      channel: AGENTCHAT_CHANNEL,
    }));

    console.log(`[bridge] Joined ${AGENTCHAT_CHANNEL}`);
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // not JSON, ignore
    }

    handleMessage(msg);
  });

  ws.on('close', (code, reason) => {
    console.log(`[bridge] Connection closed (code=${code}). Reconnecting...`);
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error(`[bridge] WebSocket error: ${err.message}`);
    // 'close' will fire after this
  });
}

function scheduleReconnect() {
  console.log(`[bridge] Reconnecting in ${reconnectDelay}ms`);
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

// --- Message handling ---

function handleMessage(msg) {
  // AgentChat message format:
  //   { type: 'message', channel: '#general', from: 'agent-id', nick: 'Agent', text: '...' }
  // There are also system messages (type: 'system', 'join', 'leave', etc.) which we skip.

  if (msg.type === 'error') {
    console.error(`[bridge] Server error: ${msg.text || JSON.stringify(msg)}`);
    return;
  }

  // Only forward actual chat messages
  if (msg.type !== 'message') return;

  // Only forward from the configured channel
  if (msg.channel && msg.channel !== AGENTCHAT_CHANNEL) return;

  const text = msg.text || msg.message || msg.content;
  if (!text || typeof text !== 'string') return;

  // Skip empty or very short messages
  const trimmed = text.trim();
  if (trimmed.length < 2) return;

  // Skip messages that look like commands or metadata
  if (trimmed.startsWith('/') || trimmed.startsWith('{')) return;

  // Limit individual message length for TTS (the TTS service caps at 5000)
  const capped = trimmed.length > 4000 ? trimmed.slice(0, 4000) + '...' : trimmed;

  const sender = msg.nick || msg.from || 'unknown';
  console.log(`[bridge] Received from [${sender}]: "${capped.slice(0, 80)}${capped.length > 80 ? '...' : ''}"`);

  enqueue(capped, sender);
}

// --- Startup ---

console.log('=== Visage AgentChat Bridge ===');
console.log(`  AgentChat : ${AGENTCHAT_URL}`);
console.log(`  Channel   : ${AGENTCHAT_CHANNEL}`);
console.log(`  TTS       : ${TTS_URL}`);
console.log(`  Speed     : ${TTS_SPEED}`);
console.log('');

connect();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[bridge] Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[bridge] Received SIGTERM, shutting down...');
  if (ws) ws.close();
  process.exit(0);
});

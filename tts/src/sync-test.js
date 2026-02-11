// Synchronization test — measures timing accuracy of TTS→Visage frame delivery
import WebSocket from 'ws';

const VISAGE_WS = 'ws://localhost:3000';
const TTS_API = 'http://localhost:3001/api/speak';

async function runSyncTest() {
  console.log('--- TTS→Visage Sync Test ---\n');

  // Connect as viewer to Visage
  const ws = new WebSocket(VISAGE_WS);
  const frames = [];
  let connected = false;

  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ role: 'viewer' }));
      connected = true;
      console.log('  Connected to Visage as viewer');
      resolve();
    });
    ws.on('error', reject);
  });

  ws.on('message', (data) => {
    try {
      const frame = JSON.parse(data);
      if (frame.t && frame.pts) {
        frames.push({
          received: Date.now(),
          frame,
        });
      }
    } catch {}
  });

  // Trigger TTS
  console.log('  Sending speak request...');
  const speakStart = Date.now();

  const res = await fetch(TTS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello world, testing synchronization.' }),
  });
  const meta = await res.json();
  const apiLatency = Date.now() - speakStart;

  console.log(`  API response: ${JSON.stringify(meta)}`);
  console.log(`  API latency: ${apiLatency}ms`);
  console.log(`  Expected duration: ${meta.duration}ms`);
  console.log(`  Waiting for frames...\n`);

  // Wait for all frames to arrive
  await new Promise(r => setTimeout(r, meta.duration + 500));

  ws.close();

  // Analyze
  console.log(`  Frames received: ${frames.length} (expected ~${meta.frames})`);

  if (frames.length === 0) {
    console.log('  ERROR: No frames received!');
    process.exit(1);
  }

  // Check inter-frame timing
  const gaps = [];
  for (let i = 1; i < frames.length; i++) {
    gaps.push(frames[i].received - frames[i - 1].received);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const maxGap = Math.max(...gaps);
  const minGap = Math.min(...gaps);
  const expectedGap = 1000 / 30; // 33.3ms at 30fps

  console.log(`\n  Inter-frame timing:`);
  console.log(`    Expected: ${expectedGap.toFixed(1)}ms`);
  console.log(`    Average:  ${avgGap.toFixed(1)}ms`);
  console.log(`    Min:      ${minGap}ms`);
  console.log(`    Max:      ${maxGap}ms`);

  // Check mouth movement
  const mouthValues = frames.map(f => f.frame.pts.mouth_open);
  const maxMouth = Math.max(...mouthValues);
  const hasMovement = maxMouth > 0.1;

  console.log(`\n  Mouth movement:`);
  console.log(`    Max mouth_open: ${maxMouth.toFixed(3)}`);
  console.log(`    Has movement: ${hasMovement}`);

  // Total delivery time
  const totalTime = frames[frames.length - 1].received - frames[0].received;
  console.log(`\n  Total delivery time: ${totalTime}ms (expected ~${meta.duration}ms)`);
  const drift = Math.abs(totalTime - meta.duration);
  console.log(`  Drift: ${drift}ms (${(drift / meta.duration * 100).toFixed(1)}%)`);

  // Verdict
  const frameMatch = frames.length >= meta.frames * 0.9;
  const timingOk = drift < meta.duration * 0.15;
  const pass = frameMatch && timingOk && hasMovement;

  console.log(`\n  --- ${pass ? 'PASS' : 'FAIL'} ---`);
  if (!frameMatch) console.log(`  Frame count off: got ${frames.length}, expected ~${meta.frames}`);
  if (!timingOk) console.log(`  Timing drift too high: ${drift}ms`);
  if (!hasMovement) console.log(`  No mouth movement detected`);

  process.exit(pass ? 0 : 1);
}

runSyncTest().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});

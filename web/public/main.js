// Main — wires receiver to renderer, handles resize and debug overlay

const canvas = document.getElementById('face');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug');

let showDebug = false;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let hasSignal = false;

// Resize canvas to fill viewport
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Toggle debug with 'd' key
document.addEventListener('keydown', (e) => {
  if (e.key === 'd') {
    showDebug = !showDebug;
    debugEl.style.display = showDebug ? 'block' : 'none';
  }
});

// Connect receiver
const receiver = new Receiver();
const wsUrl = `ws://${location.host}`;
receiver.connect(wsUrl);

receiver.onStatus((status) => {
  statusEl.textContent = status;
  statusEl.className = status === 'connected' ? 'connected' : '';
});

receiver.onFrame(() => {
  hasSignal = true;
});

// Render loop
function loop() {
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.fillStyle = VisageRenderer.DEFAULT_STYLE.bgColor;
  ctx.fillRect(0, 0, w, h);

  if (hasSignal) {
    const frame = receiver.latest();
    VisageRenderer.render(ctx, w, h, frame);
  } else {
    VisageRenderer.renderNoSignal(ctx, w, h);
  }

  // FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = now;
  }

  // Debug overlay
  if (showDebug) {
    const frame = receiver.latest();
    const lines = [
      `FPS: ${fps}`,
      `Status: ${receiver.status()}`,
      `Signal: ${hasSignal}`,
      '',
      ...Object.entries(frame.pts).map(([k, v]) =>
        `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`
      ),
    ];
    debugEl.textContent = lines.join('\n');
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

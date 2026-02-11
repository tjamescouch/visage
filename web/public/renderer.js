// Canvas 2D Face Renderer
// Pure function of MocapFrame + style → canvas drawing
// All coordinates are fractions of canvas dimensions

const DEFAULT_STYLE = {
  // Head
  headColor: '#2a2a3a',
  headOutline: '#444466',
  headOutlineWidth: 0.003,
  headRadiusX: 0.28,
  headRadiusY: 0.38,

  // Eyes
  eyeWhiteColor: '#e8e8ee',
  irisColor: '#4488bb',
  pupilColor: '#111122',
  highlightColor: '#ffffff',
  eyeOutline: '#333355',
  eyeSpacingX: 0.12,
  eyeY: -0.06,
  eyeRadiusX: 0.055,
  eyeRadiusY: 0.04,
  irisRadius: 0.025,
  pupilRadius: 0.013,
  highlightRadius: 0.005,

  // Eyebrows
  browColor: '#333355',
  browWidth: 0.002,
  browLength: 0.08,
  browY: -0.14,

  // Mouth
  mouthColor: '#cc4455',
  mouthInnerColor: '#661122',
  mouthOutline: '#993344',
  mouthY: 0.16,
  mouthBaseWidth: 0.08,

  // Nose (subtle)
  noseColor: '#3a3a4a',
  noseY: 0.04,

  // Background
  bgColor: '#111111',
};

function render(ctx, w, h, frame, style = DEFAULT_STYLE) {
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h); // scale unit
  const pts = frame.pts;

  // Helper: convert fractional coords to canvas coords
  const fx = (frac) => cx + frac * s;
  const fy = (frac) => cy + frac * s;
  const fs = (frac) => frac * s;

  // Apply head transforms
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pts.head_roll || 0);
  ctx.translate(-(pts.head_yaw || 0) * s * 0.1, (pts.head_pitch || 0) * s * 0.1);
  ctx.translate(-cx, -cy);

  // --- Head ---
  ctx.beginPath();
  ctx.ellipse(cx, cy, fs(style.headRadiusX), fs(style.headRadiusY), 0, 0, Math.PI * 2);
  ctx.fillStyle = style.headColor;
  ctx.fill();
  ctx.strokeStyle = style.headOutline;
  ctx.lineWidth = fs(style.headOutlineWidth);
  ctx.stroke();

  // --- Nose (subtle line) ---
  const noseX = cx;
  const noseY = fy(style.noseY);
  ctx.beginPath();
  ctx.moveTo(noseX, noseY - fs(0.015));
  ctx.quadraticCurveTo(noseX + fs(0.01), noseY + fs(0.01), noseX, noseY + fs(0.015));
  ctx.strokeStyle = style.noseColor;
  ctx.lineWidth = fs(0.002);
  ctx.stroke();

  // --- Eyes ---
  const drawEye = (side) => {
    const sign = side === 'left' ? -1 : 1;
    const ex = cx + sign * fs(style.eyeSpacingX);
    const ey = fy(style.eyeY);

    const openAmount = pts[`${side}_eye_open`] ?? 0.85;
    const pupilDx = (pts[`${side}_pupil_x`] || 0) * fs(0.015);
    const pupilDy = (pts[`${side}_pupil_y`] || 0) * fs(0.015);

    // Clipping for eyelid (eye opening)
    ctx.save();
    const eyeH = fs(style.eyeRadiusY) * Math.max(0.05, openAmount);
    ctx.beginPath();
    ctx.ellipse(ex, ey, fs(style.eyeRadiusX), eyeH, 0, 0, Math.PI * 2);
    ctx.clip();

    // Eye white
    ctx.beginPath();
    ctx.ellipse(ex, ey, fs(style.eyeRadiusX), fs(style.eyeRadiusY), 0, 0, Math.PI * 2);
    ctx.fillStyle = style.eyeWhiteColor;
    ctx.fill();

    // Iris
    ctx.beginPath();
    ctx.arc(ex + pupilDx, ey + pupilDy, fs(style.irisRadius), 0, Math.PI * 2);
    ctx.fillStyle = style.irisColor;
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(ex + pupilDx, ey + pupilDy, fs(style.pupilRadius), 0, Math.PI * 2);
    ctx.fillStyle = style.pupilColor;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(
      ex + pupilDx + fs(0.008),
      ey + pupilDy - fs(0.008),
      fs(style.highlightRadius),
      0, Math.PI * 2
    );
    ctx.fillStyle = style.highlightColor;
    ctx.fill();

    ctx.restore();

    // Eye outline
    ctx.beginPath();
    ctx.ellipse(ex, ey, fs(style.eyeRadiusX), eyeH, 0, 0, Math.PI * 2);
    ctx.strokeStyle = style.eyeOutline;
    ctx.lineWidth = fs(0.002);
    ctx.stroke();
  };

  drawEye('left');
  drawEye('right');

  // --- Eyebrows ---
  const drawBrow = (side) => {
    const sign = side === 'left' ? -1 : 1;
    const bx = cx + sign * fs(style.eyeSpacingX);
    const by = fy(style.browY) - (pts[`${side}_brow_height`] || 0.03) * s;
    const angle = (pts[`${side}_brow_angle`] || 0) * sign;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-fs(style.browLength / 2), 0);
    ctx.quadraticCurveTo(0, -fs(0.008), fs(style.browLength / 2), fs(0.003));
    ctx.strokeStyle = style.browColor;
    ctx.lineWidth = fs(style.browWidth);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  };

  drawBrow('left');
  drawBrow('right');

  // --- Mouth ---
  const mouthOpen = pts.mouth_open || 0;
  const mouthWide = pts.mouth_wide || 0;
  const mouthSmile = pts.mouth_smile || 0;
  const jawOpen = pts.jaw_open || 0;

  const mx = cx;
  const my = fy(style.mouthY) + jawOpen * fs(0.03);
  const mw = fs(style.mouthBaseWidth) + mouthWide * fs(0.04);
  const mh = mouthOpen * fs(0.04) + jawOpen * fs(0.02);
  const smileCurve = mouthSmile * fs(0.02);

  if (mouthOpen > 0.02 || jawOpen > 0.02) {
    // Open mouth
    ctx.beginPath();
    ctx.moveTo(mx - mw, my);
    // Upper lip
    ctx.quadraticCurveTo(mx, my - fs(0.01) - smileCurve, mx + mw, my);
    // Lower lip
    ctx.quadraticCurveTo(mx, my + mh + smileCurve, mx - mw, my);
    ctx.closePath();

    // Inner mouth (dark)
    ctx.fillStyle = style.mouthInnerColor;
    ctx.fill();

    // Lip outline
    ctx.strokeStyle = style.mouthOutline;
    ctx.lineWidth = fs(0.002);
    ctx.stroke();

    // Upper lip color
    ctx.beginPath();
    ctx.moveTo(mx - mw, my);
    ctx.quadraticCurveTo(mx, my - fs(0.01) - smileCurve, mx + mw, my);
    ctx.quadraticCurveTo(mx, my + fs(0.005), mx - mw, my);
    ctx.fillStyle = style.mouthColor;
    ctx.fill();
  } else {
    // Closed mouth — just a line with smile curve
    ctx.beginPath();
    ctx.moveTo(mx - mw, my + smileCurve);
    ctx.quadraticCurveTo(mx, my - smileCurve * 2, mx + mw, my + smileCurve);
    ctx.strokeStyle = style.mouthColor;
    ctx.lineWidth = fs(0.003);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.restore(); // head transform
}

function renderNoSignal(ctx, w, h) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#444';
  ctx.font = `${Math.min(w, h) * 0.03}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('no signal', w / 2, h / 2);
}

window.VisageRenderer = { render, renderNoSignal, DEFAULT_STYLE };

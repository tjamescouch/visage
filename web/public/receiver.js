// WebSocket receiver — connects to Visage server as a viewer
// Stores latest MocapFrame for the renderer

const NEUTRAL_FRAME = {
  t: 0,
  pts: {
    left_eye_open: 0.85, right_eye_open: 0.85,
    left_pupil_x: 0, left_pupil_y: 0,
    right_pupil_x: 0, right_pupil_y: 0,
    left_brow_height: 0.03, left_brow_angle: 0,
    right_brow_height: 0.03, right_brow_angle: 0,
    mouth_open: 0, mouth_wide: 0, mouth_smile: 0.1,
    jaw_open: 0, face_scale: 1.0,
    head_pitch: 0, head_yaw: 0, head_roll: 0,
  },
};

class Receiver {
  constructor() {
    this._frame = { ...NEUTRAL_FRAME, pts: { ...NEUTRAL_FRAME.pts } };
    this._status = 'disconnected';
    this._ws = null;
    this._reconnectDelay = 1000;
    this._callbacks = [];
    this._statusCallbacks = [];
  }

  connect(url) {
    this._setStatus('connecting');

    try {
      this._ws = new WebSocket(url);
    } catch (e) {
      this._setStatus('disconnected');
      this._scheduleReconnect(url);
      return;
    }

    this._ws.onopen = () => {
      this._ws.send(JSON.stringify({ role: 'viewer' }));
      this._setStatus('connected');
      this._reconnectDelay = 1000;
    };

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.t !== undefined && msg.pts) {
          this._frame = msg;
          for (const cb of this._callbacks) cb(msg);
        }
      } catch {
        // silently drop
      }
    };

    this._ws.onclose = () => {
      this._setStatus('disconnected');
      this._scheduleReconnect(url);
    };

    this._ws.onerror = () => {
      // onclose will fire after this
    };
  }

  _scheduleReconnect(url) {
    setTimeout(() => {
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, 10000);
      this.connect(url);
    }, this._reconnectDelay);
  }

  _setStatus(s) {
    this._status = s;
    for (const cb of this._statusCallbacks) cb(s);
  }

  onFrame(cb) { this._callbacks.push(cb); }
  onStatus(cb) { this._statusCallbacks.push(cb); }
  latest() { return this._frame; }
  status() { return this._status; }

  disconnect() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}

window.Receiver = Receiver;
window.NEUTRAL_FRAME = NEUTRAL_FRAME;

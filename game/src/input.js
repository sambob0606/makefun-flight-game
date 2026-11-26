// Controls: keyboard (arrows/WASD, Shift/Ctrl throttle, Space brake), mouse steer while
// held, and touch drag with on-screen throttle zones. One poll() returns the control state
// the flight model consumes; discrete keys (start, pause, restart, mute) are edge events.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = null;
    this.touch = null;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('pointerdown', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      this.pressed.add('pointer');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.mouse) this.mouse = { x: e.clientX, y: e.clientY };
    });
    const release = () => { this.mouse = null; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  /** True once per press of a discrete key (enter, p, r, m, escape, pointer). */
  take(name) {
    if (!this.pressed.has(name)) return false;
    this.pressed.delete(name);
    return true;
  }

  poll(w, h) {
    const k = this.keys;
    let pitch = 0;
    let roll = 0;
    let throttleDelta = 0;
    if (k.has('arrowup') || k.has('w')) pitch += 1;
    if (k.has('arrowdown') || k.has('s')) pitch -= 1;
    if (k.has('arrowright') || k.has('d')) roll += 1;
    if (k.has('arrowleft') || k.has('a')) roll -= 1;
    if (k.has('shift')) throttleDelta += 0.55;
    if (k.has('control')) throttleDelta -= 0.55;
    if (k.has('=')) throttleDelta += 0.55;
    if (k.has('-')) throttleDelta -= 0.55;
    if (this.mouse) {
      // Steer toward the pointer: right of centre banks right, above centre climbs.
      roll += clampUnit((this.mouse.x - w / 2) / (w * 0.28));
      pitch += clampUnit((h * 0.55 - this.mouse.y) / (h * 0.3));
      if (this.mouse.y > h * 0.82) throttleDelta += this.mouse.x > w / 2 ? 0.5 : -0.5;
    }
    return {
      pitch: clampUnit(pitch),
      roll: clampUnit(roll),
      throttleDelta,
      brake: k.has(' '),
    };
  }
}

function clampUnit(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

// Sound, all synthesised in code: a piston engine whose note follows the throttle, wind
// that rises with speed, and short chimes for rings, landings and trouble. No audio files.

export class Sound {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this.windGain = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.05;
    osc.connect(filter); sub.connect(filter);
    filter.connect(this.engineGain); this.engineGain.connect(this.master);
    osc.start(); sub.start();
    this.engine = { osc, sub, filter };

    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) { last = last * 0.92 + (Math.random() * 2 - 1) * 0.08; data[i] = last * 3; }
    const wind = ctx.createBufferSource();
    wind.buffer = buffer; wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 700;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.02;
    wind.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.master);
    wind.start();
  }

  update(p) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    const rpm = 55 + p.throttle * 95 + p.speed * 0.35;
    this.engine.osc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engine.sub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(300 + p.throttle * 700, t, 0.1);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.03 + p.throttle * 0.075, t, 0.1);
    this.windGain.gain.setTargetAtTime(this.muted ? 0 : 0.01 + (p.speed / 96) * 0.09, t, 0.15);
  }

  tone(freq, when, dur, type = 'sine', gain = 0.16) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  ring() { this.tone(880, 0, 0.18); this.tone(1318, 0.07, 0.24); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.11, 0.3, 'triangle', 0.2)); }
  thud() { this.tone(72, 0, 0.32, 'sine', 0.4); this.tone(48, 0.02, 0.4, 'triangle', 0.3); }
  stall() { this.tone(1175, 0, 0.12, 'square', 0.06); }
  click() { this.tone(660, 0, 0.06, 'triangle', 0.1); }
}

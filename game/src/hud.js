// The instrument panel: lit tapes for speed and altitude, a compass ribbon, an artificial
// horizon, throttle/fuel/hull gauges and the mission readout. Drawn in amber and cyan on
// dark glass so the cockpit reads at a glance in flight and in screenshots.

import { clamp, headingDeg } from './flight.js';

const AMBER = '#ffc95e';
const CYAN = '#5ed1ff';
const GLASS = 'rgba(8,18,28,0.62)';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = GLASS;
  ctx.strokeStyle = 'rgba(94,209,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function tape(ctx, x, y, w, h, value, step, fmt, label, dangerBelow) {
  panel(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const mid = y + h / 2;
  const first = Math.floor((value - step * 4) / step) * step;
  for (let v = first; v < value + step * 4.5; v += step) {
    if (v < 0) continue;
    const yy = mid - ((v - value) / step) * 26;
    ctx.fillStyle = dangerBelow !== null && v < dangerBelow ? '#ff7a6b' : 'rgba(230,240,248,0.85)';
    ctx.fillText(fmt(v), x + w / 2, yy + 4);
    ctx.fillRect(x + 4, yy, 8, 1.5);
    ctx.fillRect(x + w - 12, yy, 8, 1.5);
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(x - 2, mid); ctx.lineTo(x + 8, mid - 7); ctx.lineTo(x + 8, mid + 7);
  ctx.closePath(); ctx.fill();
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(fmt(Math.round(value)), x + w / 2, y + h + 18);
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillStyle = CYAN;
  ctx.fillText(label, x + w / 2, y - 6);
}

function compass(ctx, w, p, targetHeading) {
  const cw = Math.min(460, w * 0.5);
  const x = (w - cw) / 2;
  const y = 14;
  panel(ctx, x, y, cw, 34);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, cw, 34); ctx.clip();
  const deg = headingDeg(p);
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = -70; d <= 70; d += 5) {
    const hd = ((Math.round((deg + d) / 5) * 5) % 360 + 360) % 360;
    const xx = x + cw / 2 + (hd - deg > 180 ? hd - deg - 360 : hd - deg < -180 ? hd - deg + 360 : hd - deg) * (cw / 130);
    if (xx < x || xx > x + cw) continue;
    ctx.fillStyle = 'rgba(230,240,248,0.9)';
    if (hd % 45 === 0) ctx.fillText(names[hd], xx, y + 21);
    else if (hd % 15 === 0) ctx.fillText(String(hd / 10), xx, y + 21);
    else ctx.fillRect(xx, y + 24, 1.5, 6);
  }
  if (targetHeading !== null) {
    let rel = targetHeading - deg;
    if (rel > 180) rel -= 360;
    if (rel < -180) rel += 360;
    const tx = x + cw / 2 + clamp(rel, -64, 64) * (cw / 130);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(tx, y + 28); ctx.lineTo(tx - 6, y + 18); ctx.lineTo(tx + 6, y + 18);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.fillRect(x + cw / 2 - 1, y + 2, 2, 10);
}

function horizon(ctx, x, y, r, p) {
  panel(ctx, x - r - 8, y - r - 8, (r + 8) * 2, (r + 8) * 2);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-p.roll);
  const pitchPx = clamp(p.pitch * 90, -r, r);
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r * 1.6, -r * 1.6 + pitchPx, r * 3.2, r * 1.6);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  for (const off of [-30, -15, 15, 30]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, pitchPx + off * 1.4);
    ctx.lineTo(r * 0.4, pitchPx + off * 1.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y); ctx.lineTo(x - 8, y); ctx.lineTo(x, y + 6); ctx.lineTo(x + 8, y); ctx.lineTo(x + r * 0.55, y);
  ctx.stroke();
}

function gauge(ctx, x, y, w, label, frac, color) {
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillStyle = CYAN;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 3);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = frac < 0.22 ? '#ff7a6b' : color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), 9);
}

/** Draw every instrument for the current flight state. */
export function drawHud(ctx, w, h, p, mission) {
  const knots = p.speed * 1.944;
  const feet = Math.max(0, p.y * 3.281);
  tape(ctx, 16, h * 0.3, 64, 190, knots, 20, (v) => String(v), 'KNOTS', 42);
  tape(ctx, w - 80, h * 0.3, 64, 190, feet, 200, (v) => String(v), 'FEET', null);
  compass(ctx, w, p, mission.targetHeadingDeg);
  horizon(ctx, 86, h - 86, 46, p);

  panel(ctx, w - 190, h - 128, 174, 112);
  gauge(ctx, w - 174, h - 96, 142, 'THROTTLE', p.throttle, AMBER);
  gauge(ctx, w - 174, h - 66, 142, 'FUEL', p.fuel / 100, CYAN);
  gauge(ctx, w - 174, h - 36, 142, 'HULL', p.hull / 100, '#7be495');

  // Mission readout, top-left; score, top-right.
  panel(ctx, 16, 14, 252, 74);
  ctx.textAlign = 'left';
  ctx.fillStyle = AMBER;
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(mission.title, 28, 38);
  ctx.fillStyle = '#e8f2f8';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(mission.line, 28, 60);
  ctx.fillStyle = CYAN;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(mission.sub, 28, 78);

  panel(ctx, w - 168, 14, 152, 74);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText(String(mission.score), w - 28, 46);
  ctx.fillStyle = CYAN;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(`SCORE · ${mission.clock}`, w - 28, 66);
  ctx.fillStyle = 'rgba(232,242,248,0.8)';
  ctx.fillText(`G ${p.gForce.toFixed(1)} · VS ${Math.round(p.vspeed * 196)}`, w - 28, 82);

  // Centre reticle and stall warning.
  ctx.strokeStyle = 'rgba(255,201,94,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2 - 24, h / 2); ctx.lineTo(w / 2 - 15, h / 2);
  ctx.moveTo(w / 2 + 15, h / 2); ctx.lineTo(w / 2 + 24, h / 2);
  ctx.stroke();
  if (p.stalled) {
    ctx.fillStyle = '#ff7a6b';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, ADD POWER', w / 2, h * 0.3);
  }
  if (mission.banner) {
    ctx.fillStyle = 'rgba(8,18,28,0.55)';
    ctx.fillRect(0, h * 0.36, w, 64);
    ctx.fillStyle = '#fff';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mission.banner, w / 2, h * 0.36 + 42);
  }
}

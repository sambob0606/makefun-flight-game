// Chase-view renderer: a hand-rolled perspective projection over the heightfield.
// Terrain is drawn as shaded quads in distance bands (fine near, coarse far), then the
// runway, rings, clouds and the aeroplane itself, banked with the pilot's roll.

import { terrainHeight, WORLD } from './world.js';
import { clamp } from './flight.js';

const FOV = 1.9; // focal length in units of half the canvas height

export function makeCamera(p, t) {
  const back = 26;
  const up = 7.5;
  const cx = p.x - Math.sin(p.heading) * back;
  const cz = p.z - Math.cos(p.heading) * back;
  const cy = Math.max(p.y + up, terrainHeight(cx, cz) + 6);
  return {
    x: cx, y: cy, z: cz,
    heading: p.heading,
    pitch: p.pitch * 0.55 - 0.06,
    roll: p.roll * 0.55,
    t,
  };
}

/** Project a world point; returns {x, y, d} in canvas pixels, or null behind the camera. */
export function project(cam, w, h, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const sh = Math.sin(cam.heading);
  const ch = Math.cos(cam.heading);
  const fwd = dx * sh + dz * ch;
  if (fwd < 2) return null;
  const right = dx * ch - dz * sh;
  const sp = Math.sin(cam.pitch);
  const cp = Math.cos(cam.pitch);
  const upv = dy * cp - fwd * sp;
  const depth = dy * sp + fwd * cp;
  if (depth < 2) return null;
  const focal = (h / 2) * FOV;
  let sx = right / depth;
  let sy = upv / depth;
  const sr = Math.sin(cam.roll);
  const cr = Math.cos(cam.roll);
  const rx = sx * cr - sy * sr;
  const ry = sx * sr + sy * cr;
  return { x: w / 2 + rx * focal, y: h / 2 - ry * focal, d: depth };
}

function shade(hgt, slope, dist) {
  // Golden-hour palette by height, darkened on steep faces, hazed with distance.
  let r; let g; let b;
  if (hgt < 6) { r = 196; g = 172; b = 112; } // shore sand
  else if (hgt < 70) { r = 96; g = 142; b = 74; } // meadow
  else if (hgt < 160) { r = 74; g = 116; b = 70; } // pine slopes
  else if (hgt < 260) { r = 122; g = 104; b = 88; } // rock
  else { r = 226; g = 228; b = 232; } // snow
  const light = clamp(1 - slope * 0.55, 0.55, 1.08);
  const haze = clamp(dist / 3400, 0, 0.72);
  r = r * light + (168 - r * light) * haze;
  g = g * light + (186 - g * light) * haze;
  b = b * light + (205 - b * light) * haze;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawTerrain(ctx, cam, w, h) {
  const bands = [
    { step: 40, radius: 700 },
    { step: 90, radius: 1500 },
    { step: 200, radius: 3400 },
  ];
  const cells = [];
  for (const band of bands) {
    const x0 = Math.floor((cam.x - band.radius) / band.step) * band.step;
    const z0 = Math.floor((cam.z - band.radius) / band.step) * band.step;
    for (let gx = x0; gx < cam.x + band.radius; gx += band.step) {
      for (let gz = z0; gz < cam.z + band.radius; gz += band.step) {
        const mx = gx + band.step / 2;
        const mz = gz + band.step / 2;
        const dist = Math.hypot(mx - cam.x, mz - cam.z);
        if (dist > band.radius) continue;
        if (band.step > 40 && dist < 640) continue;
        if (band.step > 90 && dist < 1400) continue;
        cells.push({ gx, gz, step: band.step, dist });
      }
    }
  }
  cells.sort((a, b) => b.dist - a.dist);
  for (const c of cells) {
    const s = c.step;
    const h00 = terrainHeight(c.gx, c.gz);
    const h10 = terrainHeight(c.gx + s, c.gz);
    const h01 = terrainHeight(c.gx, c.gz + s);
    const h11 = terrainHeight(c.gx + s, c.gz + s);
    const pts = [
      project(cam, w, h, c.gx, h00, c.gz),
      project(cam, w, h, c.gx + s, h10, c.gz),
      project(cam, w, h, c.gx + s, h11, c.gz + s),
      project(cam, w, h, c.gx, h01, c.gz + s),
    ];
    if (pts.some((q) => q === null)) continue;
    const midH = (h00 + h10 + h01 + h11) / 4;
    const slope = (Math.abs(h10 - h00) + Math.abs(h01 - h00)) / s;
    ctx.fillStyle = midH <= WORLD.waterLevel + 1 ? waterShade(c.dist, cam.t) : shade(midH, slope, c.dist);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function waterShade(dist, t) {
  const shimmer = 8 * Math.sin(t * 1.6 + dist * 0.01);
  const haze = clamp(dist / 3400, 0, 0.6);
  const r = 52 + shimmer + 110 * haze;
  const g = 110 + shimmer + 70 * haze;
  const b = 152 + 50 * haze;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawRunway(ctx, cam, w, h) {
  const rw = WORLD.runway;
  const y = rw.height + 0.4;
  const corners = [
    project(cam, w, h, rw.x - rw.halfWidth, y, rw.z0),
    project(cam, w, h, rw.x + rw.halfWidth, y, rw.z0),
    project(cam, w, h, rw.x + rw.halfWidth, y, rw.z1),
    project(cam, w, h, rw.x - rw.halfWidth, y, rw.z1),
  ];
  if (corners.some((q) => q === null)) return;
  ctx.fillStyle = '#3c4148';
  poly(ctx, corners);
  // Centreline dashes and threshold bars.
  ctx.strokeStyle = 'rgba(240,244,248,0.9)';
  for (let z = rw.z0 + 30; z < rw.z1 - 20; z += 46) {
    const a = project(cam, w, h, rw.x, y, z);
    const b = project(cam, w, h, rw.x, y, z + 22);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(1, 900 / a.d);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Edge lights, lit amber.
  ctx.fillStyle = '#ffc95e';
  for (let z = rw.z0; z <= rw.z1; z += 40) {
    for (const side of [-1, 1]) {
      const q = project(cam, w, h, rw.x + side * (rw.halfWidth + 3), y + 1, z);
      if (!q) continue;
      const r = clamp(160 / q.d, 1, 5);
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The big "09" at the near threshold.
  const nine = project(cam, w, h, rw.x, y, rw.z1 - 60);
  if (nine && nine.d < 900) {
    ctx.fillStyle = 'rgba(240,244,248,0.85)';
    ctx.font = `bold ${clamp(9000 / nine.d, 8, 60)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('09', nine.x, nine.y);
  }
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx, cam, w, h, ring, active, t) {
  const seg = 26;
  const pts = [];
  const right = { x: Math.cos(ring.heading), z: -Math.sin(ring.heading) };
  for (let i = 0; i <= seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    const lx = Math.cos(a) * ring.radius;
    const ly = Math.sin(a) * ring.radius;
    const q = project(cam, w, h, ring.x + right.x * lx, ring.y + ly, ring.z + right.z * lx);
    if (!q) return;
    pts.push(q);
  }
  const pulse = active ? 0.75 + 0.25 * Math.sin(t * 4) : 0.55;
  ctx.strokeStyle = ring.passed ? 'rgba(120,220,150,0.5)' : active ? `rgba(255,201,94,${pulse})` : 'rgba(94,209,255,0.6)';
  ctx.lineWidth = clamp(2400 / pts[0].d, 2, 14);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  if (active) {
    // A column of light so the next ring can be found across the valley.
    const top = project(cam, w, h, ring.x, ring.y + 260, ring.z);
    const bot = project(cam, w, h, ring.x, terrainHeight(ring.x, ring.z), ring.z);
    if (top && bot) {
      const grad = ctx.createLinearGradient(bot.x, bot.y, top.x, top.y);
      grad.addColorStop(0, 'rgba(255,201,94,0.30)');
      grad.addColorStop(1, 'rgba(255,201,94,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = clamp(3000 / pts[0].d, 3, 26);
      ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    }
  }
}

const CLOUDS = [];
for (let i = 0; i < 26; i += 1) {
  CLOUDS.push({
    x: -2400 + ((i * 733) % 4800),
    z: -2400 + ((i * 1187) % 4800),
    y: 330 + ((i * 97) % 180),
    r: 90 + ((i * 61) % 130),
  });
}

function drawClouds(ctx, cam, w, h) {
  for (const c of CLOUDS) {
    const q = project(cam, w, h, c.x, c.y, c.z);
    if (!q || q.d > 3200) continue;
    const r = (c.r * (h / 2) * FOV) / q.d;
    if (r < 4) continue;
    ctx.fillStyle = 'rgba(255,250,242,0.75)';
    for (const [ox, oy, s] of [[0, 0, 1], [-0.6, 0.12, 0.7], [0.62, 0.1, 0.75], [0.1, -0.22, 0.6]]) {
      ctx.beginPath();
      ctx.ellipse(q.x + ox * r, q.y + oy * r, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The courier plane seen from behind-above, banking and pitching with the pilot. */
function drawPlane(ctx, w, h, p, t) {
  const cx = w / 2;
  const cy = h * 0.62 + Math.sin(t * 2.1) * 2 + p.shake * (Math.sin(t * 47) * 4);
  const s = Math.min(w, h) / 340;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.roll * 0.85);
  ctx.scale(s, s * (1 - Math.abs(p.pitch) * 0.18));
  // Shadow-side wing, fuselage, tail: a built little aeroplane, not a triangle.
  ctx.fillStyle = '#b8433a';
  wing(ctx, -1);
  wing(ctx, 1);
  ctx.fillStyle = '#d6534a';
  ctx.beginPath(); // fuselage
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(9, -10, 8, 16);
  ctx.quadraticCurveTo(6, 34, 0, 40);
  ctx.quadraticCurveTo(-6, 34, -8, 16);
  ctx.quadraticCurveTo(-9, -10, 0, -34);
  ctx.fill();
  ctx.fillStyle = '#f2e3c9'; // cream stripe
  ctx.fillRect(-8, 6, 16, 5);
  ctx.fillStyle = '#274b63'; // canopy glass, lit from inside
  ctx.beginPath();
  ctx.ellipse(0, -6, 5.4, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8433a'; // tailplane and fin
  ctx.beginPath();
  ctx.moveTo(-20, 36); ctx.lineTo(20, 36); ctx.lineTo(14, 44); ctx.lineTo(-14, 44);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 30); ctx.lineTo(3, 46); ctx.lineTo(-3, 46);
  ctx.closePath(); ctx.fill();
  // Propeller blur disc at the nose.
  ctx.fillStyle = 'rgba(230,235,240,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -36, 17, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#333a42';
  ctx.beginPath(); ctx.arc(0, -36, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function wing(ctx, side) {
  ctx.beginPath();
  ctx.moveTo(side * 6, -4);
  ctx.lineTo(side * 58, 8);
  ctx.lineTo(side * 58, 15);
  ctx.lineTo(side * 6, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2e3c9';
  ctx.fillRect(side > 0 ? 48 : -58, 9, 10, 5);
  ctx.fillStyle = '#b8433a';
}

function drawShadow(ctx, cam, w, h, p) {
  const g = terrainHeight(p.x, p.z);
  const q = project(cam, w, h, p.x, g + 0.5, p.z);
  if (!q) return;
  const alt = p.y - g;
  const r = clamp(2600 / q.d, 3, 40) * clamp(1 - alt / 500, 0.3, 1);
  ctx.fillStyle = `rgba(10,18,24,${clamp(0.4 - alt / 900, 0.05, 0.4)})`;
  ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
}

/** Draw the whole 3D scene (sky, terrain, runway, rings, plane) for one frame. */
export function drawScene(ctx, w, h, p, rings, activeRing, t) {
  const cam = makeCamera(p, t);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2d5a8a');
  sky.addColorStop(0.45, '#7fb0d8');
  sky.addColorStop(0.72, '#f4c98b');
  sky.addColorStop(1, '#e8a56b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Low sun ahead-left.
  const sun = project(cam, w, h, cam.x - 2600, 420, cam.z - 2600);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 190);
    glow.addColorStop(0, 'rgba(255,236,190,0.95)');
    glow.addColorStop(0.25, 'rgba(255,205,130,0.55)');
    glow.addColorStop(1, 'rgba(255,205,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 200, sun.y - 200, 400, 400);
  }
  drawTerrain(ctx, cam, w, h);
  drawRunway(ctx, cam, w, h);
  drawShadow(ctx, cam, w, h, p);
  for (let i = 0; i < rings.length; i += 1) drawRing(ctx, cam, w, h, rings[i], i === activeRing, t);
  drawClouds(ctx, cam, w, h);
  drawPlane(ctx, w, h, p, t);
  return cam;
}

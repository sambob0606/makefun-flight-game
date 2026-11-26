// The valley the courier flies: a deterministic heightfield with a runway plateau, a lake,
// and named peaks, plus the ring courses for each sortie. Everything is a pure function of
// position, so the terrain is identical on every load and in every screenshot.

export const WORLD = {
  size: 5200, // metres, square, centred on the origin
  waterLevel: 4,
  runway: { x: 0, z0: -320, z1: 320, halfWidth: 26, height: 8, heading: 0 },
};

const PEAKS = [
  { x: -1500, z: -900, h: 330, r: 620 },
  { x: 1350, z: -1250, h: 390, r: 700 },
  { x: 1750, z: 650, h: 300, r: 560 },
  { x: -1750, z: 1150, h: 280, r: 540 },
  { x: 350, z: -1900, h: 350, r: 640 },
  { x: -450, z: 1850, h: 260, r: 520 },
  { x: 1050, z: 1550, h: 210, r: 430 },
  { x: -1150, z: -1750, h: 230, r: 470 },
];

function ridge(x, z) {
  let h = 26
    + 17 * Math.sin(x * 0.0031 + 1.7) * Math.cos(z * 0.0026 - 0.6)
    + 11 * Math.sin(x * 0.0079 - 0.4) * Math.sin(z * 0.0063 + 2.1)
    + 5 * Math.sin(x * 0.021 + z * 0.017);
  for (const p of PEAKS) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = (dx * dx + dz * dz) / (p.r * p.r);
    if (d2 < 4) h += p.h * Math.exp(-d2 * 1.6);
  }
  // A lake basin in the south-west.
  const lx = x + 950;
  const lz = z - 800;
  const ld = Math.sqrt(lx * lx + lz * lz);
  if (ld < 620) h = Math.min(h, 1 + (ld / 620) * 14);
  return h;
}

/** Terrain height in metres at world (x, z); flattened to the runway plateau near the strip. */
export function terrainHeight(x, z) {
  let h = ridge(x, z);
  const rw = WORLD.runway;
  const dx = Math.abs(x - rw.x);
  const dz = Math.max(rw.z0 - z, z - rw.z1, 0);
  const d = Math.max(dx - rw.halfWidth - 30, dz);
  if (d < 160) {
    const t = Math.max(0, d / 160);
    const smooth = t * t * (3 - 2 * t);
    h = rw.height + (h - rw.height) * smooth;
  }
  return h;
}

/** True when (x, z) is on the runway surface itself. */
export function onRunway(x, z) {
  const rw = WORLD.runway;
  return Math.abs(x - rw.x) <= rw.halfWidth && z >= rw.z0 && z <= rw.z1;
}

/** The ring course for a sortie: positions, headings to fly through them, and radii. */
export function ringCourse(sortie) {
  if (sortie === 1) {
    return [
      ring(0, 130, 620, 0, 26),
      ring(-420, 170, 1150, -0.5, 26),
      ring(-950, 150, 900, -1.2, 24),
      ring(-1150, 200, 150, -1.9, 24),
      ring(-700, 260, -420, -2.6, 24),
      ring(-80, 300, -820, 3.1, 24),
      ring(560, 240, -620, 2.4, 24),
      ring(420, 160, 60, 1.7, 26),
    ];
  }
  return [
    ring(0, 110, 560, 0, 22),
    ring(520, 90, 1050, 0.7, 20),
    ring(1150, 130, 800, 1.5, 20),
    ring(1450, 90, 60, 2.2, 19),
    ring(900, 70, -650, 2.9, 19),
    ring(150, 120, -1050, -3.0, 19),
    ring(-650, 80, -800, -2.3, 18),
    ring(-1250, 110, -250, -1.6, 18),
    ring(-1050, 70, 450, -0.8, 18),
    ring(-350, 100, 800, -0.2, 20),
  ];
}

function ring(x, y, z, heading, radius) {
  return { x, y, z, heading, radius, passed: false };
}

/** The approach gate and touchdown aim point for the landing sortie. */
export const APPROACH = {
  gate: { x: 0, y: 95, z: 1150, heading: Math.PI, radius: 30 },
  aimZ: 140, // ideal touchdown point on the strip, flying toward -z
};

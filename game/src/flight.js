// Flight model: a forgiving arcade aeroplane with real consequences. Throttle sets a target
// speed, pitch trades speed for height, bank turns the nose, and flying too slowly stalls
// the wing. Fuel burns with throttle; hard arrivals bend the airframe.

import { terrainHeight, onRunway, WORLD } from './world.js';

export const LIMITS = {
  maxSpeed: 96, // m/s at full throttle, level
  stallSpeed: 21,
  maxPitch: 0.62,
  maxRoll: 1.05,
  ceiling: 900,
};

export function newPlane() {
  return {
    x: 0, y: 150, z: 900,
    heading: Math.PI, // flying toward -z, down the valley toward the strip
    pitch: 0, roll: 0,
    speed: 52, throttle: 0.62,
    fuel: 100, hull: 100,
    stalled: false, grounded: false,
    vspeed: 0, gForce: 1,
    shake: 0, landed: false,
  };
}

/**
 * Advance the plane one step. `ctl` carries pitch (-1..1, + climbs), roll (-1..1, + banks
 * right), throttleDelta, and brake. Returns event flags: 'stall', 'crash', 'touchdown',
 * 'grounded', 'fuel-empty'.
 */
export function stepPlane(p, ctl, dt, wind) {
  const events = [];
  if (p.grounded) {
    p.speed = Math.max(0, p.speed - 14 * dt);
    p.pitch *= 0.8;
    p.roll *= 0.8;
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.y = terrainHeight(p.x, p.z) + 2;
    if (p.speed < 0.5) events.push('stopped');
    return events;
  }

  p.throttle = clamp(p.throttle + ctl.throttleDelta * dt, 0, 1);
  const pitchTarget = ctl.pitch * LIMITS.maxPitch;
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 3.2);
  const rollTarget = ctl.roll * LIMITS.maxRoll;
  p.roll += (rollTarget - p.roll) * Math.min(1, dt * 4.2);

  const fuelBurn = p.fuel > 0 ? p.throttle : 0;
  p.fuel = Math.max(0, p.fuel - (0.25 + fuelBurn * 1.15) * dt * 0.55);
  if (p.fuel === 0) events.push('fuel-empty');

  // Speed chases the throttle setting, helped by diving and hurt by climbing.
  const target = fuelBurn * LIMITS.maxSpeed - Math.sin(p.pitch) * 34 - (ctl.brake ? 26 : 0);
  p.speed += (Math.max(0, target) - p.speed) * Math.min(1, dt * 0.55);
  p.speed = Math.max(0, p.speed);

  const wasStalled = p.stalled;
  p.stalled = p.speed < LIMITS.stallSpeed;
  if (p.stalled && !wasStalled) events.push('stall');
  if (p.stalled) {
    p.pitch -= dt * 0.9; // the nose drops until speed returns
    p.shake = Math.min(1, p.shake + dt * 3);
  } else {
    p.shake = Math.max(0, p.shake - dt * 2);
  }

  const turnAuthority = clamp(p.speed / 40, 0.25, 1.15);
  p.heading += Math.sin(p.roll) * 0.85 * turnAuthority * dt;
  p.gForce = 1 / Math.max(0.35, Math.cos(p.roll)) + Math.max(0, p.pitch) * 0.4;

  const lift = p.stalled ? 0.25 : 1;
  p.vspeed = Math.sin(p.pitch) * p.speed * lift - (p.stalled ? 9 : 0);
  const gust = wind ? wind.gust(p) : 0;
  p.x += (Math.sin(p.heading) * p.speed + gust) * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  p.y += p.vspeed * dt;
  if (p.y > LIMITS.ceiling) { p.y = LIMITS.ceiling; p.pitch = Math.min(p.pitch, 0); }

  const half = WORLD.size / 2 - 60;
  p.x = clamp(p.x, -half, half);
  p.z = clamp(p.z, -half, half);

  const ground = terrainHeight(p.x, p.z);
  if (p.y <= ground + 2.2) {
    p.y = ground + 2.2;
    const gentle = p.vspeed > -6.5 && Math.abs(p.roll) < 0.35 && p.speed < 62;
    if (onRunway(p.x, p.z) && gentle) {
      p.grounded = true;
      p.landed = true;
      events.push('touchdown');
    } else if (gentle && p.speed < 40) {
      p.grounded = true;
      events.push('grounded');
    } else {
      const damage = clamp((-p.vspeed - 4) * 4 + Math.max(0, p.speed - 45) * 0.8, 6, 60);
      p.hull = Math.max(0, p.hull - damage);
      p.speed *= 0.45;
      p.pitch = Math.max(p.pitch, 0.12);
      p.y = ground + 14;
      p.shake = 1;
      events.push('crash');
    }
  }
  return events;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Heading normalised to 0..2π for the compass. */
export function headingDeg(p) {
  const deg = (p.heading * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

// Screenshot scenes behind ?shot=ring|landing|canyon|title. Each one flies the real flight
// model with a simple autopilot (steer for the target, hold its height, keep cruise speed)
// for a fixed number of steps, so the frame is what playing the game really looks like.

import { newPlane, stepPlane, clamp } from './flight.js';
import { Mission } from './missions.js';

const STEP = 1 / 60;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function autopilot(p, tx, ty, tz, cruise) {
  const desired = Math.atan2(tx - p.x, tz - p.z);
  const err = wrapAngle(desired - p.heading);
  return {
    pitch: clamp((ty - p.y) / 90, -0.7, 0.7),
    roll: clamp(err * 1.1, -1, 1),
    throttleDelta: p.speed < cruise ? 0.5 : p.speed > cruise + 14 ? -0.5 : 0,
    brake: false,
  };
}

function fly(p, mission, seconds, steer) {
  for (let t = 0; t < seconds; t += STEP) {
    const ctl = steer(p, t);
    const events = stepPlane(p, ctl, STEP, mission ? mission.wind() : null);
    if (mission) mission.update(p, STEP, events, null);
  }
}

/**
 * Stage a named scene. Returns { plane, mission, screen } where screen is 'play' or
 * 'title', ready for one render at time `t`.
 */
export function stageShot(name) {
  if (name === 'landing') {
    const p = newPlane();
    p.x = 6; p.y = 150; p.z = 980; p.heading = Math.PI; p.speed = 46; p.throttle = 0.4;
    const mission = new Mission(3);
    mission.next = 1; // gate already flown
    mission.rings[0].passed = true;
    fly(p, mission, 5.2, (q) => autopilot(q, 0, 26, 60, 38));
    return { plane: p, mission, screen: 'play' };
  }
  if (name === 'canyon') {
    const p = newPlane();
    p.x = 1180; p.y = 120; p.z = 260; p.heading = 2.5; p.speed = 58; p.throttle = 0.7;
    const mission = new Mission(2);
    mission.next = 4;
    for (let i = 0; i < 4; i += 1) mission.rings[i].passed = true;
    mission.score = 640;
    fly(p, mission, 3.4, (q) => autopilot(q, 900, 78, -650, 56));
    return { plane: p, mission, screen: 'play' };
  }
  if (name === 'title') {
    const p = newPlane();
    p.x = -700; p.y = 230; p.z = 500; p.heading = 0.8; p.speed = 55; p.throttle = 0.65;
    fly(p, null, 4, (q, t) => {
      const a = t * 0.12 + 2.2;
      return autopilot(q, Math.sin(a) * 950, 230, Math.cos(a) * 950, 55);
    });
    return { plane: p, mission: new Mission(1), screen: 'title' };
  }
  // ring: the cover scene — sortie 1, closing on the first gold ring.
  const p = newPlane();
  p.x = -30; p.y = 138; p.z = 900; p.heading = Math.PI; p.speed = 54; p.throttle = 0.62;
  const mission = new Mission(1);
  fly(p, mission, 3.2, (q) => autopilot(q, 0, 130, 620, 54));
  return { plane: p, mission, screen: 'play' };
}

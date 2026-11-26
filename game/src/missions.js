// The courier campaign: three sorties with different jobs. Sortie 1 teaches the rings,
// sortie 2 threads a tighter course in gusting wind on a fuel budget, and sortie 3 is a
// precision landing scored on touchdown point, speed and alignment.

import { ringCourse, APPROACH, terrainHeight } from './world.js';
import { clamp } from './flight.js';

export const SORTIES = [
  { id: 1, title: 'SORTIE 1 · RING RUNNER', brief: 'Fly through all 8 rings in order' },
  { id: 2, title: 'SORTIE 2 · VALLEY COURIER', brief: '10 tighter rings, gusting wind, mind the fuel' },
  { id: 3, title: 'SORTIE 3 · FINAL APPROACH', brief: 'Through the gate, then land on runway 09' },
];

export class Mission {
  constructor(sortieId) {
    this.sortie = SORTIES[sortieId - 1];
    this.rings = sortieId === 3 ? [{ ...APPROACH.gate, passed: false }] : ringCourse(sortieId);
    this.next = 0;
    this.time = 0;
    this.score = 0;
    this.done = false;
    this.failed = false;
    this.banner = '';
    this.bannerUntil = 0;
    this.landingGrade = null;
    this.prevSide = null;
  }

  get activeRing() {
    return this.next < this.rings.length ? this.next : -1;
  }

  target(p) {
    if (this.sortie.id === 3 && this.next >= this.rings.length) {
      return { x: 0, y: 10, z: APPROACH.aimZ, label: 'RUNWAY 09' };
    }
    const r = this.rings[this.next];
    if (!r) return null;
    return { x: r.x, y: r.y, z: r.z, label: `RING ${this.next + 1}/${this.rings.length}` };
  }

  /** Side of the active ring's plane the plane is on; a sign change inside the hoop scores. */
  ringSide(p, r) {
    const nx = Math.sin(r.heading);
    const nz = Math.cos(r.heading);
    return (p.x - r.x) * nx + (p.z - r.z) * nz;
  }

  update(p, dt, events, sound) {
    this.time += dt;
    if (this.banner && this.time > this.bannerUntil) this.banner = '';
    if (this.done || this.failed) return;
    const r = this.rings[this.next];
    if (r) {
      const side = this.ringSide(p, r);
      if (this.prevSide !== null && Math.sign(side) !== Math.sign(this.prevSide) && side !== 0) {
        const right = { x: Math.cos(r.heading), z: -Math.sin(r.heading) };
        const lateral = (p.x - r.x) * right.x + (p.z - r.z) * right.z;
        const vertical = p.y - r.y;
        const off = Math.hypot(lateral, vertical);
        if (off <= r.radius) {
          r.passed = true;
          const centred = 1 - off / r.radius;
          const points = 100 + Math.round(centred * 100);
          this.score += points;
          this.next += 1;
          this.prevSide = null;
          this.say(`RING ${this.next}/${this.rings.length} · +${points}`);
          if (sound) sound.ring();
          if (this.sortie.id !== 3 && this.next >= this.rings.length) this.complete(sound);
        } else {
          this.say('MISSED — CIRCLE BACK');
        }
      } else {
        this.prevSide = side;
      }
    }
    if (events.includes('touchdown')) {
      if (this.sortie.id === 3 && this.next >= this.rings.length) {
        this.gradeLanding(p);
        this.complete(sound);
      } else {
        this.say('LANDED — TAKE OFF AGAIN (FULL THROTTLE)');
        p.grounded = false;
        p.speed = 30;
        p.y = terrainHeight(p.x, p.z) + 8;
        p.fuel = Math.min(100, p.fuel + 35);
      }
    }
    if (events.includes('grounded')) {
      this.say('OFF-STRIP STOP — POWER UP TO FLY OUT');
      p.grounded = false;
      p.speed = 26;
      p.y = terrainHeight(p.x, p.z) + 10;
    }
    if (p.hull <= 0) { this.failed = true; this.say('AIRFRAME WRITTEN OFF'); }
    if (events.includes('fuel-empty') && p.speed < 5) { this.failed = true; this.say('OUT OF FUEL'); }
  }

  gradeLanding(p) {
    const along = clamp(1 - Math.abs(p.z - APPROACH.aimZ) / 260, 0, 1);
    const speedScore = clamp(1 - Math.abs(p.speed - 34) / 40, 0, 1);
    const align = clamp(1 - Math.abs(p.x) / 26, 0, 1);
    const total = Math.round((along * 0.45 + speedScore * 0.3 + align * 0.25) * 500);
    this.score += total;
    this.landingGrade = total >= 420 ? 'GREASED IT' : total >= 320 ? 'SMOOTH' : total >= 200 ? 'FIRM' : 'ROUGH';
    this.say(`TOUCHDOWN · ${this.landingGrade} · +${total}`);
  }

  complete(sound) {
    this.done = true;
    const timeBonus = Math.max(0, Math.round(600 - this.time * 2));
    this.score += timeBonus;
    if (sound) sound.fanfare();
  }

  say(text) {
    this.banner = text;
    this.bannerUntil = this.time + 2.4;
  }

  /** Wind for sortie 2: a slow gusting crosswind that pushes the plane sideways. */
  wind() {
    if (this.sortie.id !== 2) return null;
    return {
      gust: (p) => Math.sin(this.time * 0.35 + p.z * 0.002) * 5.5,
    };
  }

  hudState(p) {
    const t = this.target(p);
    let targetHeadingDeg = null;
    let sub = '';
    if (t) {
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      targetHeadingDeg = ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360;
      const dist = Math.round(Math.hypot(dx, dz, t.y - p.y));
      sub = `${t.label} · ${dist} m`;
    }
    const mm = Math.floor(this.time / 60);
    const ss = String(Math.floor(this.time % 60)).padStart(2, '0');
    return {
      title: this.sortie.title,
      line: this.done ? 'SORTIE COMPLETE' : this.sortie.brief,
      sub,
      score: this.score,
      clock: `${mm}:${ss}`,
      banner: this.banner,
      targetHeadingDeg,
    };
  }
}

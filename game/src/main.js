// Skyline Courier: fly a little red mail plane around a golden-hour valley. Three sorties —
// a ring course, a gusty valley run on a fuel budget, and a precision landing on runway 09 —
// with lit instruments, synthesised engine sound, and keyboard, mouse and touch controls.

import { newPlane, stepPlane } from './flight.js';
import { Mission, SORTIES } from './missions.js';
import { drawScene } from './render.js';
import { drawHud } from './hud.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const input = new Input(canvas);
const sound = new Sound();

let W = 0;
let H = 0;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

let screen = 'title'; // title | play | pause | complete | over | campaign
let plane = newPlane();
let mission = new Mission(1);
let campaignScore = 0;
let elapsed = 0;
let stallBeepAt = 0;

function startSortie(id) {
  plane = newPlane();
  mission = new Mission(id);
  screen = 'play';
  status.textContent = `${mission.sortie.title}. ${mission.sortie.brief}.`;
}

function startCampaign() {
  campaignScore = 0;
  startSortie(1);
}

function update(dt) {
  elapsed += dt;
  if (screen === 'title') {
    // A scenic autopilot circle behind the title.
    const a = elapsed * 0.1 + 2.2;
    const tx = Math.sin(a) * 950;
    const tz = Math.cos(a) * 950;
    const desired = Math.atan2(tx - plane.x, tz - plane.z);
    let err = desired - plane.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    stepPlane(plane, {
      pitch: Math.max(-0.5, Math.min(0.5, (230 - plane.y) / 120)),
      roll: Math.max(-1, Math.min(1, err)),
      throttleDelta: plane.speed < 55 ? 0.4 : 0,
      brake: false,
    }, dt, null);
    if (input.take('enter') || input.take('pointer')) { sound.start(); sound.click(); startCampaign(); }
    return;
  }
  if (screen === 'pause') {
    if (input.take('p') || input.take('escape') || input.take('enter')) screen = 'play';
    return;
  }
  if (screen === 'complete' || screen === 'over' || screen === 'campaign') {
    if (input.take('enter') || input.take('pointer') || input.take('r')) {
      if (screen === 'complete') {
        campaignScore += mission.score;
        if (mission.sortie.id < 3) startSortie(mission.sortie.id + 1);
        else screen = 'campaign';
      } else {
        startCampaign();
      }
    }
    return;
  }
  // play
  if (input.take('p') || input.take('escape')) { screen = 'pause'; return; }
  if (input.take('m')) sound.muted = !sound.muted;
  if (input.take('r')) { startSortie(mission.sortie.id); return; }
  const ctl = input.poll(W, H);
  const events = stepPlane(plane, ctl, dt, mission.wind());
  mission.update(plane, dt, events, sound);
  if (events.includes('crash')) sound.thud();
  if (events.includes('stall')) sound.stall();
  if (plane.stalled && elapsed - stallBeepAt > 0.7) { sound.stall(); stallBeepAt = elapsed; }
  sound.update(plane);
  if (mission.done) screen = 'complete';
  else if (mission.failed) screen = 'over';
}

function drawTitle() {
  ctx.fillStyle = 'rgba(6,14,24,0.42)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc95e';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText('SKYLINE COURIER', W / 2, H * 0.3);
  ctx.fillStyle = '#e8f2f8';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Three sorties over one golden valley: rings, gusts, and a landing to grease.', W / 2, H * 0.3 + 38);
  ctx.font = '500 16px system-ui, sans-serif';
  const lines = [
    'Fly:  Arrow keys or WASD  ·  Throttle:  Shift / Ctrl  ·  Brake:  Space',
    'Or hold the mouse (or a finger) and steer toward it',
    'Pause: P  ·  Restart sortie: R  ·  Mute: M',
    'Mind the stall: too slow and the nose drops. Land gently, or not at all.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.52 + i * 26));
  ctx.fillStyle = '#ffc95e';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER TO FLY', W / 2, H * 0.52 + lines.length * 26 + 36);
}

function drawEndPanel(title, lines, prompt) {
  ctx.fillStyle = 'rgba(6,14,24,0.55)';
  ctx.fillRect(0, 0, W, H);
  const pw = Math.min(560, W * 0.86);
  const ph = 120 + lines.length * 30;
  const x = (W - pw) / 2;
  const y = (H - ph) / 2;
  ctx.fillStyle = 'rgba(8,18,28,0.88)';
  ctx.strokeStyle = 'rgba(255,201,94,0.6)';
  ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 14); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc95e';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText(title, W / 2, y + 52);
  ctx.fillStyle = '#e8f2f8';
  ctx.font = '600 18px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, y + 96 + i * 30));
  ctx.fillStyle = '#5ed1ff';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(prompt, W / 2, y + ph - 22);
}

function draw() {
  drawScene(ctx, W, H, plane, mission.rings, mission.activeRing, elapsed);
  if (screen === 'title') { drawTitle(); return; }
  drawHud(ctx, W, H, plane, mission.hudState(plane));
  if (screen === 'pause') {
    drawEndPanel('PAUSED', ['The valley waits.'], 'P OR ENTER TO RESUME');
  } else if (screen === 'complete') {
    const lines = [
      `${mission.sortie.title} complete`,
      `Sortie score: ${mission.score}   ·   Time: ${mission.hudState(plane).clock}`,
      `Hull: ${Math.round(plane.hull)}%   ·   Fuel left: ${Math.round(plane.fuel)}%`,
    ];
    if (mission.landingGrade) lines.push(`Landing: ${mission.landingGrade}`);
    drawEndPanel('SORTIE COMPLETE', lines, mission.sortie.id < 3 ? 'ENTER FOR THE NEXT SORTIE' : 'ENTER FOR YOUR GRADE');
  } else if (screen === 'over') {
    drawEndPanel('SORTIE LOST', [mission.banner || 'The courier run ends here.', `Score: ${mission.score}`], 'ENTER TO FLY THE CAMPAIGN AGAIN');
  } else if (screen === 'campaign') {
    const total = campaignScore;
    const grade = total >= 3200 ? 'S — ACE COURIER' : total >= 2600 ? 'A' : total >= 2000 ? 'B' : total >= 1400 ? 'C' : 'D';
    drawEndPanel('CAMPAIGN COMPLETE', [
      `Total score: ${total}`,
      `Courier grade: ${grade}`,
      'The valley mail is delivered. Every letter, on time.',
    ], 'ENTER TO FLY AGAIN');
  }
}

if (shotName) {
  const staged = stageShot(shotName);
  plane = staged.plane;
  mission = staged.mission;
  screen = staged.screen;
  elapsed = 12.5;
  const frame = () => { draw(); window.__shotReady = true; requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

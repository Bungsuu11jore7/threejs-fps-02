// WHITEOUT — Aurora Station. Bootstrap, input, the fixed-step loop and the
// camera. The simulation runs at 60 Hz apart from rendering; the renderer
// only reads state, never writes it.
import * as THREE from 'three';
import { createState, WEAPONS } from './state.js';
import { buildWorld, updateSnow } from './world.js';
import { createPlayer, stepPlayer, eyePos, aimDir } from './player.js';
import { fireWeapon, startReload, finishReload, buyWeapon, switchWeapon, throwGrenade, stepGrenades } from './weapons.js';
import { spawnBots, stepBot, syncRig, clearBots } from './bots.js';
import { resetMatch, stepRounds } from './rounds.js';
import { initHud, updateHud, showOverlay, showBanner, hideBanner } from './hud.js';
import { initAudio, shotSound, drySound, reloadSound, hitSound, hurtSound, plantBeep, explodeSound, roundSound, clickSound } from './audio.js';
import { setupShot } from './shots.js';
import { mulberry32 } from './rng.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);

const S = createState(seed);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 300);
scene.add(camera);

const world = buildWorld(scene);
resetMatch(S, scene);
// The match waits on the menu until the player deploys; deploy() starts
// round 1 fresh.
S.phase = 'menu';
S.phaseT = 0;

// --- Viewmodel: a low-poly rifle built from boxes, parented to the camera.
const viewmodel = new THREE.Group();
const vmDark = new THREE.MeshStandardMaterial({ color: 0x1c232c, roughness: 0.45, metalness: 0.6 });
const vmAccent = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.5, metalness: 0.3, emissive: 0xffa726, emissiveIntensity: 0.25 });
function vmBox(w, h, d, x, y, z, mat = vmDark) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  viewmodel.add(m);
  return m;
}
vmBox(0.09, 0.13, 0.62, 0, 0, 0);
vmBox(0.07, 0.1, 0.3, 0, 0.02, -0.42);
vmBox(0.05, 0.16, 0.1, 0, -0.1, 0.08);
vmBox(0.1, 0.06, 0.2, 0, -0.05, 0.22, vmAccent);
vmBox(0.02, 0.08, 0.02, 0, 0.1, -0.28);
const muzzle = new THREE.Mesh(
  new THREE.PlaneGeometry(0.22, 0.22),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
);
muzzle.position.set(0, 0.02, -0.62);
viewmodel.add(muzzle);
viewmodel.position.set(0.28, -0.26, -0.5);
camera.add(viewmodel);

// --- Tracers: one LineSegments rebuilt from S.tracers each frame.
const TRACER_MAX = 24;
const tracerGeo = new THREE.BufferGeometry();
const tracerPos = new Float32Array(TRACER_MAX * 6);
tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
const tracerLines = new THREE.LineSegments(
  tracerGeo,
  new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }),
);
tracerLines.frustumCulled = false;
scene.add(tracerLines);

// --- Grenade meshes (pooled) and the planted charge.
const grenadePool = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x2e3844, roughness: 0.4, metalness: 0.7 }),
  );
  m.visible = false;
  scene.add(m);
  grenadePool.push(m);
}
const charge = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.3, 0.34),
  new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff5a3c, emissiveIntensity: 0.9, roughness: 0.5 }),
);
charge.visible = false;
scene.add(charge);

// --- Input ---------------------------------------------------------------
const keys = {};
let mouseDown = false;
let locked = false;
let scoped = false;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'KeyB') toggleBuy();
  if (e.code === 'KeyG') tryGrenade();
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    const id = Object.values(WEAPONS).find((w) => w.slot === n);
    if (id) switchWeapon(S, id.id);
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) scoped = S.player.weapon === 'marksman';
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) scoped = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('mousemove', (e) => {
  if (!locked || !S.player.alive) return;
  S.player.yaw -= e.movementX * 0.0021;
  S.player.pitch -= e.movementY * 0.0021;
  S.player.pitch = Math.max(-1.45, Math.min(1.45, S.player.pitch));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Actions --------------------------------------------------------------
function tryReload() {
  if (S.phase !== 'live' || !S.player.alive) return;
  const before = S.player.ammo[S.player.weapon].mag;
  startReload(S, S.player);
  if (S.player.reloading > 0 && before < WEAPONS[S.player.weapon].mag) reloadSound();
}

function toggleBuy() {
  if (S.phase !== 'buy') return;
  document.exitPointerLock();
}

function tryGrenade() {
  if (S.phase !== 'live' || !S.player.alive) return;
  if (throwGrenade(S, S.player)) clickSound();
}

function deploy() {
  initAudio();
  if (S.phase === 'menu') {
    resetMatch(S, scene);
    showOverlay(S);
  }
  renderer.domElement.requestPointerLock();
}

window.__whiteoutBuy = (id) => {
  if (buyWeapon(S, id)) {
    clickSound();
    switchWeapon(S, id);
    showOverlay(S);
  }
};

initHud(S, {
  onDeploy: deploy,
  onAgain: () => { resetMatch(S, scene); showOverlay(S); deploy(); },
  onNext: () => { deploy(); },
  onBuy: (id) => window.__whiteoutBuy(id),
  onBuyClose: () => { renderer.domElement.requestPointerLock(); },
});

// --- Fixed-step simulation ------------------------------------------------
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let lastPhase = S.phase;
let bobPhase = 0;

const _eye = new THREE.Vector3();
const _dir = new THREE.Vector3();

function playerInput() {
  return {
    f: (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0),
    b: 0,
    l: (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0),
    r: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
    jump: !!keys.Space,
    crouch: !!(keys.ControlLeft || keys.ControlRight),
    slow: !!keys.ShiftLeft,
  };
}

function tryFire() {
  const p = S.player;
  if (!p.alive || S.phase !== 'live' || p.reloading > 0) return;
  const w = WEAPONS[p.weapon];
  const interval = 60 / w.rpm;
  if (S.time - p.lastShot < interval) return;
  const ammo = p.ammo[p.weapon];
  if (!ammo || ammo.mag <= 0) {
    drySound();
    tryReload();
    return;
  }
  const hit = fireWeapon(S, world, p);
  shotSound(p.weapon);
  muzzle.material.opacity = 0.95;
  viewmodel.position.z = -0.44;
  if (hit) {
    hitSound(hit.part === 'head');
    const hm = document.getElementById('hitmarker');
    hm.classList.remove('on');
    void hm.offsetWidth;
    hm.classList.add('on');
    setTimeout(() => hm.classList.remove('on'), 120);
  }
}

function step(dt) {
  S.time += dt;
  const p = S.player;
  // Reload timer.
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) finishReload(p);
  }
  // Defuse: hold E near a planted charge.
  if (S.phase === 'live' && S.bomb.state === 'planted' && p.alive) {
    const site = S.bomb.site === 'A' ? { x: -18, z: -6 } : { x: 18, z: -8 };
    const d = Math.hypot(site.x - p.pos.x, site.z - p.pos.z);
    if (keys.KeyE && d < 2.4) {
      p.defusing += dt;
      if (p.defusing >= 5) {
        S.bomb.state = 'defused';
        S.money += 300;
        S.stats.defuses += 1;
      }
    } else {
      p.defusing = 0;
    }
  } else {
    p.defusing = 0;
  }
  // Firing (hold for autos, click for semis).
  if (mouseDown && locked) tryFire();
  // Movement + bots + grenades + rounds.
  stepPlayer(S, world, playerInput(), dt);
  for (const b of S.allies) stepBot(S, world, b, dt);
  for (const b of S.enemies) stepBot(S, world, b, dt);
  stepGrenades(S, world, dt);
  stepRounds(S, scene, dt);
  // Tracer fade.
  for (const t of S.tracers) t.t += dt;
  S.tracers = S.tracers.filter((t) => t.t < 0.14);
  // Phase changes: overlays, banners, sounds.
  if (S.phase !== lastPhase) {
    if (S.phase === 'buy') {
      showBanner(`ROUND ${S.round}`, 'Buy phase — spend your credits (B)');
      document.exitPointerLock();
    }
    if (S.phase === 'live') hideBanner();
    if (S.phase === 'roundEnd') {
      roundSound(S.roundWinner === 'sen');
      showBanner(S.roundWinner === 'sen' ? 'ROUND WON' : 'ROUND LOST', S.roundReason);
    }
    if (S.phase === 'matchEnd') {
      roundSound(S.matchWinner === 'sen');
      showBanner(S.matchWinner === 'sen' ? 'STATION HELD' : 'STATION LOST', `Final score ${S.score.sen} — ${S.score.jac}`);
    }
    showOverlay(S);
    lastPhase = S.phase;
  }
  if (S.bomb.state === 'planted' && Math.floor(S.bomb.fuse * 2) !== Math.floor((S.bomb.fuse + dt) * 2)) plantBeep();
}

// --- Render ---------------------------------------------------------------
function render() {
  const p = S.player;
  if (p.alive) {
    eyePos(p, _eye);
    camera.position.copy(_eye);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(p.yaw);
    camera.rotateX(p.pitch + p.recoil * 0.045);
    camera.rotation.z = 0;
  } else {
    const ally = S.allies.find((a) => a.alive);
    if (ally) {
      eyePos(ally, _eye);
      camera.position.copy(_eye);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(ally.yaw);
    }
  }
  const targetFov = scoped && p.weapon === 'marksman' ? 75 / 2.2 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * 0.35;
    camera.updateProjectionMatrix();
  }
  // Viewmodel bob and recoil recovery.
  if (p.moving && p.alive) bobPhase += 0.11 * p.speed2d * 0.16;
  viewmodel.position.y = -0.26 + Math.sin(bobPhase * 2) * 0.008;
  viewmodel.position.x = 0.28 + Math.cos(bobPhase) * 0.006;
  viewmodel.position.z += (-0.5 - viewmodel.position.z) * 0.25;
  muzzle.material.opacity *= 0.6;
  // Tracers.
  let n = 0;
  for (const t of S.tracers) {
    if (n >= TRACER_MAX) break;
    tracerPos[n * 6] = t.from.x;
    tracerPos[n * 6 + 1] = t.from.y;
    tracerPos[n * 6 + 2] = t.from.z;
    tracerPos[n * 6 + 3] = t.to.x;
    tracerPos[n * 6 + 4] = t.to.y;
    tracerPos[n * 6 + 5] = t.to.z;
    n += 1;
  }
  tracerGeo.setDrawRange(0, n * 2);
  tracerGeo.attributes.position.needsUpdate = true;
  // Grenades.
  for (let i = 0; i < grenadePool.length; i++) {
    const g = S.grenades[i];
    const m = grenadePool[i];
    if (g && !g.boom) {
      m.visible = true;
      m.position.copy(g.pos);
    } else {
      m.visible = false;
    }
  }
  // Planted charge blinks at its site.
  if (S.bomb.state === 'planted') {
    const site = S.bomb.site === 'A' ? { x: -18, z: -6 } : { x: 18, z: -8 };
    charge.visible = true;
    charge.position.set(site.x, 0.35, site.z);
    charge.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(S.time * 9);
  } else {
    charge.visible = false;
  }
  // Rigs follow their bodies.
  for (const b of S.allies) syncRig(b, S.time);
  for (const b of S.enemies) syncRig(b, S.time);
  if (!S.frozen) updateSnow(world, 1 / 60, S.time);
  updateHud(S);
  renderer.render(scene, camera);
}

// --- Main loop ------------------------------------------------------------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!S.frozen && S.phase !== 'menu') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      step(STEP);
      acc -= STEP;
      n += 1;
    }
    if (n === 5) acc = 0;
  }
  render();
}

// --- Shot mode: deterministic setups for the dossier screenshots. --------
if (shotName) {
  S.rng = mulberry32(1);
  setupShot(S, shotName);
  showOverlay(S);
  updateHud(S);
  render();
  S.frozen = true;
  window.__ready = true;
  requestAnimationFrame(frame);
} else {
  showOverlay(S);
  requestAnimationFrame(frame);
}

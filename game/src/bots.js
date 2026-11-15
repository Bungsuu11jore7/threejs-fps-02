// Bots: two Sentinel teammates who hold angles and rotate toward gunfire,
// and four Jackals who run a lane, plant the charge and guard it. A bot is
// a rig of boxes with a state machine on top; it sees, reacts, bursts and
// strafes, and it hears shots and turns toward them.
import * as THREE from 'three';
import { PAL } from './palette.js';
import { WAYPOINTS, ROUTES, hasSight, resolveCircle, rayWorld } from './world.js';
import { WEAPONS, ECONOMY } from './state.js';
import { rayBodies, damageEntity } from './weapons.js';
import { pick, range } from './rng.js';

const BOT_SPEED = 4.3;
const BOT_RADIUS = 0.42;
const REACT_MIN = 0.35;
const REACT_MAX = 0.65;

const JACKAL_NAMES = ['V. Marsh', 'D. Kessler', 'T. Novak', 'R. Hale'];
const SENTINEL_NAMES = ['M. Ivers', 'J. Osei'];

function makeRig(scene, team) {
  const color = team === 'sen' ? PAL.sentinel : PAL.jackal;
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 10), suit);
  body.position.y = 0.75;
  group.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.4), accent);
  vest.position.y = 1.05;
  group.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), suit);
  head.position.y = 1.5;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.1), accent);
  visor.position.set(0, 1.52, 0.2);
  group.add(visor);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.85), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.6 }));
  gun.position.set(0.28, 1.12, 0.3);
  group.add(gun);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.24), suit);
  legL.position.set(-0.16, 0.25, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  scene.add(group);
  return { group, body, head, gun, legL, legR };
}

export function createBot(scene, team, name, x, z, role) {
  const rig = makeRig(scene, team);
  return {
    kind: 'bot',
    team,
    name,
    role,
    pos: new THREE.Vector3(x, 0, z),
    yaw: 0,
    hp: 100,
    alive: true,
    eyeH: 1.5,
    rig,
    weapon: team === 'jac' ? 'rifle' : 'rifle',
    ammo: { rifle: { mag: 30, reserve: 90 } },
    reloading: 0,
    lastShot: -9,
    bloom: 0,
    recoil: 0,
    crouched: false,
    moving: false,
    speed2d: 0,
    route: [],
    routeIdx: 0,
    holdAt: null,
    holdT: 0,
    target: null,
    seenAt: -9,
    reactAt: 0,
    burstLeft: 0,
    burstT: 0,
    strafe: 1,
    strafeT: 0,
    plantT: 0,
    defuseT: 0,
    walkPhase: 0,
  };
}

export function spawnBots(S, scene, rng) {
  S.allies = [];
  S.enemies = [];
  const senSpots = [{ x: -8, z: 14 }, { x: 8, z: 14 }];
  for (let i = 0; i < 2; i++) {
    const b = createBot(scene, 'sen', SENTINEL_NAMES[i], senSpots[i].x, senSpots[i].z, 'holder');
    b.holdAt = i === 0 ? 'S1' : 'S2';
    S.allies.push(b);
  }
  const site = pick(rng, ['A', 'B']);
  S.bomb.site = site;
  const routeKey = pick(rng, site === 'A' ? ['A', 'Aw'] : ['B', 'Be']);
  const route = ROUTES[routeKey];
  const jacSpots = [{ x: -2, z: -19 }, { x: 0, z: -19 }, { x: 2, z: -19 }, { x: 0, z: -17 }];
  for (let i = 0; i < 4; i++) {
    const b = createBot(scene, 'jac', JACKAL_NAMES[i], jacSpots[i].x, jacSpots[i].z, i === 0 ? 'carrier' : 'rusher');
    b.route = route.slice();
    b.routeIdx = 1;
    b.weapon = i === 3 ? 'smg' : 'rifle';
    if (b.weapon === 'smg') b.ammo = { smg: { mag: 32, reserve: 96 } };
    S.enemies.push(b);
  }
  S.bomb.carrier = S.enemies[0];
  S.bomb.state = 'carried';
}

// --- Sensing ------------------------------------------------------------
function nearestVisible(S, world, bot) {
  const foes = bot.team === 'sen' ? S.enemies : [S.player, ...S.allies];
  let best = null;
  let bestD = 42;
  for (const f of foes) {
    if (!f.alive) continue;
    const dx = f.pos.x - bot.pos.x;
    const dz = f.pos.z - bot.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const ey = f.pos.y + 1.5;
    if (hasSight(world.colliders, bot.pos.x, bot.pos.y + 1.5, bot.pos.z, f.pos.x, ey, f.pos.z)) {
      best = f;
      bestD = d;
    }
  }
  return best;
}

function faceToward(bot, tx, tz, dt) {
  const want = Math.atan2(-(tx - bot.pos.x), -(tz - bot.pos.z));
  let diff = want - bot.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  bot.yaw += Math.max(-dt * 7, Math.min(dt * 7, diff));
}

// --- Shooting -----------------------------------------------------------
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

function botFire(S, world, bot) {
  const w = WEAPONS[bot.weapon];
  const ammo = bot.ammo[bot.weapon];
  if (!ammo || ammo.mag <= 0 || bot.reloading > 0) return;
  ammo.mag -= 1;
  bot.lastShot = S.time;
  const target = bot.target;
  _o.set(bot.pos.x, bot.pos.y + 1.45, bot.pos.z);
  const dx = target.pos.x - _o.x;
  const dy = (target.pos.y + 1.3) - _o.y;
  const dz = target.pos.z - _o.z;
  const len = Math.hypot(dx, dy, dz);
  _d.set(dx / len, dy / len, dz / len);
  const dist = len;
  const errDeg = (1.4 + dist * 0.06 + bot.bloom * 1.2) * Math.PI / 180;
  _d.x += (Math.random() - 0.5) * 2 * errDeg;
  _d.y += (Math.random() - 0.5) * 2 * errDeg;
  _d.normalize();
  S.lastShotAt = { x: bot.pos.x, z: bot.pos.z, t: S.time };
  const foes = bot.team === 'sen' ? S.enemies : [S.player, ...S.allies];
  const hit = rayBodies(_o, _d, foes.filter((e) => e !== bot));
  const wallT = rayWorld(world.colliders, _o, _d);
  if (hit && hit.t < wallT) {
    const dmg = w.damage * (hit.part === 'head' ? w.headMult : 1);
    damageEntity(S, hit.entity, dmg, bot, hit.part === 'head');
  }
}

// --- Step ---------------------------------------------------------------
export function stepBot(S, world, bot, dt) {
  if (!bot.alive) return;
  if (bot.reloading > 0) {
    bot.reloading -= dt;
    if (bot.reloading <= 0) {
      const w = WEAPONS[bot.weapon];
      const ammo = bot.ammo[bot.weapon];
      const take = Math.min(w.mag - ammo.mag, ammo.reserve);
      ammo.mag += take;
      ammo.reserve -= take;
      bot.reloading = 0;
    }
  }
  const seen = nearestVisible(S, world, bot);
  if (seen) {
    if (bot.target !== seen) {
      bot.target = seen;
      bot.seenAt = S.time;
      bot.reactAt = S.time + 0.35 + Math.random() * 0.3;
      bot.burstLeft = 0;
    }
  } else if (bot.target && S.time - bot.seenAt > 1.2) {
    bot.target = null;
  }

  let moveX = 0;
  let moveZ = 0;
  let speed = BOT_SPEED;

  if (bot.target && S.time >= bot.reactAt) {
    // Engage: face the target, strafe, fire in bursts of three.
    faceToward(bot, bot.target.pos.x, bot.target.pos.z, dt);
    bot.strafeT -= dt;
    if (bot.strafeT <= 0) {
      bot.strafe = Math.random() < 0.5 ? -1 : 1;
      bot.strafeT = 0.7 + Math.random() * 0.9;
    }
    const dist = Math.hypot(bot.target.pos.x - bot.pos.x, bot.target.pos.z - bot.pos.z);
    if (dist > 14) {
      moveX = -Math.sin(bot.yaw);
      moveZ = -Math.cos(bot.yaw);
    } else if (dist < 5) {
      moveX = Math.sin(bot.yaw);
      moveZ = Math.cos(bot.yaw);
    } else {
      moveX = Math.cos(bot.yaw) * bot.strafe;
      moveZ = -Math.sin(bot.yaw) * bot.strafe;
    }
    speed = BOT_SPEED * 0.55;
    bot.burstT -= dt;
    if (bot.burstLeft > 0 && bot.burstT <= 0) {
      botFire(S, world, bot);
      bot.burstLeft -= 1;
      bot.burstT = 0.12;
    } else if (bot.burstLeft === 0 && bot.burstT <= -0.55) {
      bot.burstLeft = 3;
      bot.burstT = 0;
    }
    bot.bloom = Math.min(1, bot.bloom + dt * 0.4);
  } else {
    bot.bloom = Math.max(0, bot.bloom - dt * 0.8);
    // A dropped charge is recovered by the nearest Jackal on the way.
    if (bot.team === 'jac' && S.bomb.state === 'dropped') {
      const dx = S.bomb.x - bot.pos.x;
      const dz = S.bomb.z - bot.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      if (len < 1.2) {
        S.bomb.state = 'carried';
        S.bomb.carrier = bot;
      } else {
        moveX = dx / len;
        moveZ = dz / len;
        bot.yaw = Math.atan2(-moveX, -moveZ);
      }
    }
    // Bomb duty first: the carrier plants, defenders defuse.
    if (bot.team === 'jac' && S.bomb.carrier === bot && S.bomb.state === 'carried') {
      const site = { A: { x: -18, z: -6 }, B: { x: 18, z: -8 } }[S.bomb.site];
      const d = Math.hypot(site.x - bot.pos.x, site.z - bot.pos.z);
      if (d < 3.2) {
        bot.plantT += dt;
        faceToward(bot, site.x, site.z, dt);
        if (bot.plantT >= 3) {
          S.bomb.state = 'planted';
          S.bomb.fuse = 35;
          S.bomb.carrier = null;
          S.money += ECONOMY.plant;
          S.stats.plants += 1;
          bot.plantT = 0;
        }
        moveX = 0;
        moveZ = 0;
      }
    }
    if (bot.team === 'sen' && S.bomb.state === 'planted') {
      const site = { A: { x: -18, z: -6 }, B: { x: 18, z: -8 } }[S.bomb.site];
      const d = Math.hypot(site.x - bot.pos.x, site.z - bot.pos.z);
      if (d < 2.2) {
        bot.defuseT += dt;
        faceToward(bot, site.x, site.z, dt);
        if (bot.defuseT >= 5) {
          S.bomb.state = 'defused';
          S.money += ECONOMY.defuse;
          S.stats.defuses += 1;
        }
        moveX = 0;
        moveZ = 0;
      } else {
        const wp = site;
        const dx = wp.x - bot.pos.x;
        const dz = wp.z - bot.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        moveX = dx / len;
        moveZ = dz / len;
        bot.yaw = Math.atan2(-moveX, -moveZ);
      }
    }
    if (moveX === 0 && moveZ === 0) {
      // Walk the route, or hold, or rotate toward heard gunfire.
      let goal = null;
      if (bot.team === 'jac' && bot.route.length > 0) {
        const next = WAYPOINTS[bot.route[bot.routeIdx]];
        if (next) {
          goal = next;
          if (Math.hypot(next.x - bot.pos.x, next.z - bot.pos.z) < 1.2) {
            bot.routeIdx = Math.min(bot.routeIdx + 1, bot.route.length - 1);
          }
        }
      } else if (bot.team === 'sen') {
        if (S.lastShotAt && S.time - S.lastShotAt.t < 6) {
          const d = Math.hypot(S.lastShotAt.x - bot.pos.x, S.lastShotAt.z - bot.pos.z);
          if (d > 6 && d < 34) goal = S.lastShotAt;
        }
        if (!goal && bot.holdAt) goal = WAYPOINTS[bot.holdAt];
      }
      if (goal) {
        const dx = goal.x - bot.pos.x;
        const dz = goal.z - bot.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        if (len > 0.6) {
          moveX = dx / len;
          moveZ = dz / len;
          bot.yaw = Math.atan2(-moveX, -moveZ);
        }
      }
    }
  }

  bot.moving = Math.hypot(moveX, moveZ) > 0.01;
  if (bot.moving) {
    bot.pos.x += moveX * speed * dt;
    bot.pos.z += moveZ * speed * dt;
    bot.walkPhase += dt * 9;
  }
  resolveCircle(world.colliders, bot.pos, BOT_RADIUS);
  bot.speed2d = bot.moving ? speed : 0;
  const ammo = bot.ammo[bot.weapon];
  if (ammo && ammo.mag === 0 && bot.reloading <= 0 && ammo.reserve > 0) {
    bot.reloading = 2.0;
  }
}

// --- Rig sync -----------------------------------------------------------
export function syncRig(bot, time) {
  const r = bot.rig;
  r.group.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
  r.group.rotation.y = bot.yaw;
  if (!bot.alive) {
    r.group.rotation.x = -Math.PI / 2;
    r.group.position.y = 0.25;
    return;
  }
  const bob = bot.moving ? Math.sin(bot.walkPhase) * 0.06 : 0;
  r.legL.position.z = bob;
  r.legR.position.z = -bob;
  r.group.rotation.x = 0;
  void time;
}

export function clearBots(S, scene) {
  for (const b of [...S.allies, ...S.enemies]) scene.remove(b.rig.group);
  S.allies = [];
  S.enemies = [];
}

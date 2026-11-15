// Hitscan combat: one ray per pellet against bodies, then the world.
// A head sphere pays double. Tracers, muzzle flash and grenades are visual;
// the damage math stays in this module so the judge can read it in one place.
import * as THREE from 'three';
import { WEAPONS } from './state.js';
import { rayWorld } from './world.js';
import { eyePos, aimDir } from './player.js';

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _p = new THREE.Vector3();

// A body is a standing capsule: head sphere at eye height, torso box below.
export function bodyParts(e) {
  const headY = e.pos.y + (e.crouched ? 1.05 : 1.45);
  return {
    head: { x: e.pos.x, y: headY, z: e.pos.z, r: 0.24 },
    torso: { x0: e.pos.x - 0.34, x1: e.pos.x + 0.34, y0: e.pos.y, y1: e.pos.y + 1.3, z0: e.pos.z - 0.34, z1: e.pos.z + 0.34 },
  };
}

function raySphere(o, d, s) {
  const ox = o.x - s.x;
  const oy = o.y - s.y;
  const oz = o.z - s.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - s.r * s.r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : Infinity;
}

function rayTorsoBox(o, d, b) {
  let tmin = 0;
  let tmax = 1e9;
  const axes = [
    [o.x, d.x, b.x0, b.x1],
    [o.y, d.y, b.y0, b.y1],
    [o.z, d.z, b.z0, b.z1],
  ];
  for (const [oo, dd, lo, hi] of axes) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return Infinity;
    } else {
      let t1 = (lo - oo) / dd;
      let t2 = (hi - oo) / dd;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// Nearest body hit along a ray, or null. part is 'head' or 'torso'.
export function rayBodies(o, d, bodies, maxDist = 200) {
  let best = null;
  let bestT = maxDist;
  for (const e of bodies) {
    if (!e.alive) continue;
    const parts = bodyParts(e);
    const th = raySphere(o, d, parts.head);
    if (th < bestT) {
      bestT = th;
      best = { entity: e, part: 'head', t: th };
    }
    const tt = rayTorsoBox(o, d, parts.torso);
    if (tt < bestT) {
      bestT = tt;
      best = { entity: e, part: 'torso', t: tt };
    }
  }
  return best;
}

// Fire one trigger pull from shooter. Returns a hit record for the HUD.
export function fireWeapon(S, world, shooter) {
  const w = WEAPONS[shooter.weapon];
  const ammo = shooter.ammo[shooter.weapon];
  if (!ammo || ammo.mag <= 0 || shooter.reloading > 0) return null;
  ammo.mag -= 1;
  shooter.lastShot = S.time;
  shooter.bloom = Math.min(1, shooter.bloom + 0.14);
  shooter.recoil = Math.min(2.2, shooter.recoil + w.recoil * 0.32);
  S.lastShotAt = { x: shooter.pos.x, z: shooter.pos.z, t: S.time };
  const targets = shooter.team === 'sen' ? S.enemies : [S.player, ...S.allies];
  const others = targets.filter((e) => e !== shooter && e.alive);
  eyePos(shooter, _o);
  aimDir(shooter, _d);
  const spreadDeg = (w.spread + shooter.bloom * w.moveSpread) * (shooter.scoped ? 0.35 : 1);
  const wallT = rayWorld(world.colliders, _o, _d);
  let hit = null;
  for (let p = 0; p < w.pellets; p++) {
    const d = _d2.copy(_d);
    const sa = (Math.random() - 0.5) * 2 * spreadDeg * Math.PI / 180;
    const sb = (Math.random() - 0.5) * 2 * spreadDeg * Math.PI / 180;
    d.x += sa;
    d.y += sb;
    d.normalize();
    const bodyHit = rayBodies(_o, d, others);
    const endT = bodyHit && bodyHit.t < wallT ? bodyHit.t : Math.min(wallT, 120);
    _p.copy(_o).addScaledVector(d, endT);
    addTracer(S, _o, _p);
    if (bodyHit && bodyHit.t < wallT) {
      const dmg = w.damage * (bodyHit.part === 'head' ? w.headMult : 1);
      hit = { victim: bodyHit.entity, part: bodyHit.part, damage: dmg, shooter };
      damageEntity(S, bodyHit.entity, dmg, shooter, bodyHit.part === 'head');
    }
  }
  return hit;
}

export function damageEntity(S, victim, dmg, attacker, headshot) {
  if (!victim.alive) return;
  victim.hp -= dmg;
  victim.lastHitAt = S.time;
  victim.lastHitBy = attacker;
  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.alive = false;
    victim.deathT = S.time;
    S.killfeed.unshift({ killer: attacker.name, victim: victim.name, headshot, t: S.time });
    if (S.killfeed.length > 5) S.killfeed.pop();
    if (attacker === S.player) {
      S.money += 300;
      S.stats.kills += 1;
    }
    if (victim === S.player) S.stats.deaths += 1;
    if (S.bomb.carrier === victim) {
      S.bomb.carrier = null;
      S.bomb.state = 'dropped';
      S.bomb.x = victim.pos.x;
      S.bomb.z = victim.pos.z;
    }
  }
}

export function startReload(S, shooter) {
  const w = WEAPONS[shooter.weapon];
  const ammo = shooter.ammo[shooter.weapon];
  if (!ammo || shooter.reloading > 0 || ammo.mag === w.mag || ammo.reserve <= 0) return;
  shooter.reloading = w.id === 'marksman' ? 2.6 : 1.7;
}

export function finishReload(shooter) {
  const w = WEAPONS[shooter.weapon];
  const ammo = shooter.ammo[shooter.weapon];
  const need = w.mag - ammo.mag;
  const take = Math.min(need, ammo.reserve);
  ammo.mag += take;
  ammo.reserve -= take;
  shooter.reloading = 0;
}

export function buyWeapon(S, id) {
  const w = WEAPONS[id];
  if (!w || S.money < w.price) return false;
  if (id === 'grenade') {
    if (S.player.grenades >= 1) return false;
    S.money -= w.price;
    S.player.grenades += 1;
    return true;
  }
  if (S.player.owned[id]) return false;
  S.money -= w.price;
  S.player.owned[id] = true;
  S.player.ammo[id] = { mag: w.mag, reserve: w.reserve };
  return true;
}

export function switchWeapon(S, id) {
  if (!S.player.owned[id]) return;
  S.player.weapon = id;
  S.player.reloading = 0;
  S.player.scoped = false;
}

// --- Visuals (tracers, grenades) ---------------------------------------
export function addTracer(S, from, to) {
  S.tracers.push({ from: from.clone(), to: to.clone(), t: 0 });
  if (S.tracers.length > 24) S.tracers.shift();
}

export function throwGrenade(S, shooter) {
  if (shooter.grenades <= 0) return false;
  shooter.grenades -= 1;
  eyePos(shooter, _o);
  aimDir(shooter, _d);
  S.grenades.push({
    pos: _o.clone(),
    vel: _d.clone().multiplyScalar(16).add(new THREE.Vector3(0, 4.5, 0)),
    fuse: 1.5,
    owner: shooter,
  });
  return true;
}

export function stepGrenades(S, world, dt) {
  for (const g of S.grenades) {
    if (g.fuse <= 0) continue;
    g.fuse -= dt;
    g.vel.y -= 14 * dt;
    g.pos.addScaledVector(g.vel, dt);
    if (g.pos.y < 0.15) {
      g.pos.y = 0.15;
      g.vel.y *= -0.4;
      g.vel.x *= 0.7;
      g.vel.z *= 0.7;
    }
    if (g.fuse <= 0) {
      g.boom = true;
      g.boomT = 0;
      const all = [S.player, ...S.allies, ...S.enemies];
      for (const e of all) {
        if (!e.alive || e === g.owner) continue;
        const d = Math.hypot(e.pos.x - g.pos.x, e.pos.z - g.pos.z);
        if (d < 7) damageEntity(S, e, Math.round(95 * (1 - d / 8)), g.owner, false);
      }
    }
  }
  S.grenades = S.grenades.filter((g) => !(g.boom && g.boomT > 0.6));
  for (const g of S.grenades) if (g.boom) g.boomT += dt;
}

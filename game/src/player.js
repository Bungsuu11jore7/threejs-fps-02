// The player: a capsule with acceleration, friction, crouch, jump and
// AABB collision. Movement is fixed-step; the camera reads the capsule.
import * as THREE from 'three';
import { resolveCircle } from './world.js';

const EYE_STAND = 1.62;
const EYE_CROUCH = 1.12;
const RADIUS = 0.42;
const WALK_SPEED = 5.4;
const CROUCH_SPEED = 2.6;
const SLOW_SPEED = 2.9;
const ACCEL = 42;
const FRICTION = 11;
const GRAVITY = 17;
const JUMP_VEL = 6.2;

export function createPlayer(spawn) {
  return {
    kind: 'player',
    team: 'sen',
    name: 'R. Calloway',
    pos: new THREE.Vector3(spawn.x, 0, spawn.z),
    vel: new THREE.Vector3(),
    yaw: spawn.yaw,
    pitch: 0,
    hp: 100,
    alive: true,
    crouched: false,
    onGround: true,
    eyeH: EYE_STAND,
    weapon: 'rifle',
    owned: { pistol: true, rifle: true },
    ammo: { pistol: { mag: 12, reserve: 48 }, rifle: { mag: 30, reserve: 90 } },
    grenades: 0,
    reloading: 0,
    lastShot: -9,
    bloom: 0,
    recoil: 0,
    defusing: 0,
    kills: 0,
  };
}

// input: {f, b, l, r, jump, crouch, slow} in -1..1 / booleans.
export function stepPlayer(S, world, input, dt) {
  const p = S.player;
  if (!p.alive) return;
  const speed = p.crouched ? CROUCH_SPEED : input.slow ? SLOW_SPEED : WALK_SPEED;
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // Forward is -Z rotated by yaw; right is +X rotated by yaw.
  let wx = (-sin * input.f + cos * input.r) * speed;
  let wz = (-cos * input.f - sin * input.r) * speed;
  const moving = Math.hypot(wx, wz) > 0.01;
  if (moving) {
    const len = Math.hypot(wx, wz);
    wx /= len;
    wz /= len;
    p.vel.x += wx * ACCEL * dt;
    p.vel.z += wz * ACCEL * dt;
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (hs > speed) {
      p.vel.x *= speed / hs;
      p.vel.z *= speed / hs;
    }
  } else {
    const f = Math.max(0, 1 - FRICTION * dt);
    p.vel.x *= f;
    p.vel.z *= f;
  }
  p.vel.y -= GRAVITY * dt;
  if (input.jump && p.onGround) {
    p.vel.y = JUMP_VEL;
    p.onGround = false;
  }
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= 0) {
    p.pos.y = 0;
    p.vel.y = 0;
    p.onGround = true;
  }
  resolveCircle(world.colliders, p.pos, RADIUS);
  p.crouched = input.crouch;
  const targetEye = p.crouched ? EYE_CROUCH : EYE_STAND;
  p.eyeH += (targetEye - p.eyeH) * Math.min(1, dt * 12);
  // Bloom grows while moving or firing, settles when still and aimed.
  const targetBloom = moving ? 1 : 0;
  p.bloom += (targetBloom - p.bloom) * Math.min(1, dt * 6);
  p.recoil = Math.max(0, p.recoil - dt * 3.2);
  p.moving = moving;
  p.speed2d = Math.hypot(p.vel.x, p.vel.z);
}

export function eyePos(p, out) {
  out.set(p.pos.x, p.pos.y + p.eyeH, p.pos.z);
  return out;
}

// Aim direction from yaw/pitch plus current recoil kick.
export function aimDir(p, out) {
  const pitch = p.pitch + p.recoil * 0.045;
  const cp = Math.cos(pitch);
  out.set(-Math.sin(p.yaw) * cp, Math.sin(pitch), -Math.cos(p.yaw) * cp);
  return out;
}

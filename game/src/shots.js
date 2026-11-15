// Deterministic screenshot setups. Each one places the player and the bots
// by hand (no RNG), so the same ?shot= URL renders the same frame every
// time. The main loop freezes the sim after a few settle steps.
import * as THREE from 'three';
import { SITES } from './world.js';

function placeBot(bot, x, z, yawDeg) {
  bot.pos.set(x, 0, z);
  bot.yaw = (yawDeg * Math.PI) / 180;
  bot.alive = true;
  bot.hp = 100;
}

export function setupShot(S, name) {
  S.shotMode = name;
  const p = S.player;
  if (name === 'cover') {
    // Mid-round firefight: the player holds mid-plaza on site A, two
    // Jackals push the west lane, one Sentinel covers the east.
    S.phase = 'live';
    S.phaseT = 64;
    S.round = 3;
    S.score = { sen: 2, jac: 1 };
    p.pos.set(0, 0, 8);
    p.yaw = 0.3;
    p.pitch = 0.0;
    p.hp = 82;
    p.weapon = 'rifle';
    placeBot(S.enemies[0], -8, -4, 165);
    placeBot(S.enemies[1], -13, -9, 150);
    placeBot(S.enemies[2], 6, -14, 195);
    placeBot(S.enemies[3], 22, -12, 210);
    placeBot(S.allies[0], 9, 8, 345);
    placeBot(S.allies[1], -4, 13, 15);
    S.bomb.site = 'A';
    S.bomb.state = 'carried';
    S.bomb.carrier = S.enemies[0];
    S.tracers.push({
      from: new THREE.Vector3(0, 1.55, 8),
      to: new THREE.Vector3(-7.2, 1.4, -3.4),
      t: 0,
    });
    S.killfeed.unshift({ killer: 'R. Calloway', victim: 'T. Novak', headshot: true, t: 0 });
  } else if (name === 'buy') {
    // Buy phase at the Sentinel spawn, menu open.
    S.phase = 'buy';
    S.phaseT = 11;
    S.round = 2;
    S.score = { sen: 1, jac: 0 };
    S.money = 3200;
    p.pos.set(0, 0, 18);
    p.yaw = 0;
    p.pitch = 0;
    p.hp = 100;
    p.weapon = 'rifle';
    placeBot(S.allies[0], -8, 14, 20);
    placeBot(S.allies[1], 8, 14, 340);
    placeBot(S.enemies[0], 0, -19, 180);
    placeBot(S.enemies[1], -2, -19, 180);
    placeBot(S.enemies[2], 2, -19, 180);
    placeBot(S.enemies[3], 0, -17, 180);
    S.bomb.site = 'B';
    S.bomb.state = 'carried';
    S.bomb.carrier = S.enemies[0];
  } else if (name === 'plant') {
    // The charge is down at the Reactor Hall; the player pushes in to
    // defuse while a Jackal guards the column.
    S.phase = 'live';
    S.phaseT = 41;
    S.round = 4;
    S.score = { sen: 2, jac: 2 };
    S.bomb.site = 'A';
    S.bomb.state = 'planted';
    S.bomb.fuse = 22;
    S.bomb.carrier = null;
    p.pos.set(-8, 0, 2);
    p.yaw = 0.85;
    p.pitch = 0.02;
    p.hp = 64;
    p.weapon = 'rifle';
    placeBot(S.enemies[0], -15, -4, 120);
    placeBot(S.enemies[1], -21, -9, 60);
    placeBot(S.enemies[2], -6, -12, 200);
    placeBot(S.enemies[3], 12, -10, 230);
    placeBot(S.allies[0], -2, 8, 350);
    placeBot(S.allies[1], 6, 4, 10);
    S.killfeed.unshift({ killer: 'V. Marsh', victim: 'J. Osei', headshot: false, t: 0 });
  } else if (name === 'end') {
    // Round won: the station holds, scoreboard up.
    S.phase = 'roundEnd';
    S.phaseT = 3.5;
    S.round = 5;
    S.score = { sen: 3, jac: 2 };
    S.roundWinner = 'sen';
    S.roundReason = 'Jackal squad eliminated.';
    p.pos.set(0, 0, 8);
    p.yaw = 0.15;
    p.pitch = -0.02;
    p.hp = 45;
    p.weapon = 'rifle';
    placeBot(S.enemies[0], -8, -4, 165);
    S.enemies[1].alive = false;
    S.enemies[1].pos.set(-13, 0, -9);
    S.enemies[2].alive = false;
    S.enemies[2].pos.set(6, 0, -14);
    S.enemies[3].alive = false;
    S.enemies[3].pos.set(22, 0, -12);
    placeBot(S.allies[0], 9, 8, 345);
    placeBot(S.allies[1], -4, 13, 15);
    S.bomb.site = 'A';
    S.bomb.state = 'none';
  }
  void SITES;
}

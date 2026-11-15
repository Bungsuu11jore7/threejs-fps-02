// Round lifecycle: buy phase, live play, bomb fuse, elimination, and the
// match end at five rounds. The economy pays out here, in one place.
import { ROUND_TIME, BUY_TIME, WIN_ROUNDS, ECONOMY } from './state.js';
import { spawnBots, clearBots } from './bots.js';
import { createPlayer } from './player.js';
import { SPAWNS } from './world.js';

export function resetMatch(S, scene) {
  S.score = { sen: 0, jac: 0 };
  S.round = 1;
  S.money = 800;
  S.matchWinner = null;
  S.stats = { kills: 0, deaths: 0, plants: 0, defuses: 0 };
  startRound(S, scene);
}

export function startRound(S, scene) {
  clearBots(S, scene);
  S.player = createPlayer(SPAWNS.sen);
  S.bomb = { state: 'none', site: null, fuse: 0, carrier: null, planter: null, plantT: 0, defuser: null, defuseT: 0 };
  S.tracers = [];
  S.grenades = [];
  S.lastShotAt = null;
  spawnBots(S, scene, S.rng);
  S.phase = 'buy';
  S.phaseT = BUY_TIME;
  S.roundWinner = null;
  S.roundReason = '';
}

export function endRound(S, winner, reason) {
  if (S.phase === 'roundEnd' || S.phase === 'matchEnd') return;
  S.phase = 'roundEnd';
  S.phaseT = 4;
  S.roundWinner = winner;
  S.roundReason = reason;
  S.score[winner] += 1;
  if (winner === 'sen') {
    S.money += ECONOMY.roundWin;
  } else {
    S.money += ECONOMY.roundLoss;
  }
  if (S.score[winner] >= WIN_ROUNDS) {
    S.phase = 'matchEnd';
    S.phaseT = 999;
    S.matchWinner = winner;
  }
}

// Called every fixed step while live: timers and win checks.
export function stepRounds(S, scene, dt) {
  if (S.phase === 'buy') {
    S.phaseT -= dt;
    if (S.phaseT <= 0) {
      S.phase = 'live';
      S.phaseT = ROUND_TIME;
    }
    return;
  }
  if (S.phase === 'roundEnd') {
    S.phaseT -= dt;
    if (S.phaseT <= 0 && !S.matchWinner) {
      S.round += 1;
      // Carry the player's wallet and arsenal into the next round.
      const keepMoney = S.money;
      const keepOwned = S.player.owned;
      const keepAmmo = S.player.ammo;
      const keepGrenades = S.player.grenades;
      const keepWeapon = S.player.weapon;
      startRound(S, scene);
      S.money = keepMoney;
      S.player.owned = keepOwned;
      S.player.ammo = keepAmmo;
      S.player.grenades = keepGrenades;
      S.player.weapon = keepOwned[keepWeapon] ? keepWeapon : 'rifle';
    }
    return;
  }
  if (S.phase !== 'live') return;
  S.phaseT -= dt;
  if (S.bomb.state === 'planted') {
    S.bomb.fuse -= dt;
    if (S.bomb.fuse <= 0) {
      endRound(S, 'jac', 'The charge detonated at the ' + siteName(S) + '.');
      return;
    }
  }
  if (S.bomb.state === 'defused') {
    endRound(S, 'sen', 'Charge defused at the ' + siteName(S) + '.');
    return;
  }
  const jacAlive = S.enemies.some((e) => e.alive);
  const senAlive = S.player.alive || S.allies.some((e) => e.alive);
  if (!jacAlive) {
    endRound(S, 'sen', 'Jackal squad eliminated.');
    return;
  }
  if (!senAlive) {
    if (S.bomb.state === 'planted') return; // fuse still decides it
    endRound(S, 'jac', 'Sentinel squad eliminated.');
    return;
  }
  if (S.phaseT <= 0) {
    if (S.bomb.state === 'planted') return; // fuse still decides it
    endRound(S, 'sen', 'Time expired — the station holds.');
  }
}

export function siteName(S) {
  return S.bomb.site === 'A' ? 'Reactor Hall' : 'Comms Dome';
}

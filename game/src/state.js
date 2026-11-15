// Central state: one object owns the match, so every module reads the same
// truth and the fixed-step loop can save or reset it in one place.
import { mulberry32 } from './rng.js';

export const ROUND_TIME = 100;
export const BUY_TIME = 15;
export const BOMB_FUSE = 35;
export const PLANT_TIME = 3;
export const DEFUSE_TIME = 5;
export const WIN_ROUNDS = 5;
export const START_MONEY = 800;

// Arsenal. damage is per hit (shotgun is per pellet), spread in degrees at
// rest, bloom adds while moving and firing, recoil kicks the pitch up.
export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P12 Frostbite', slot: 1, price: 0,
    damage: 26, headMult: 2, rpm: 320, mag: 12, reserve: 48,
    spread: 0.55, moveSpread: 1.6, recoil: 0.55, auto: false, pellets: 1, zoom: 1,
  },
  rifle: {
    id: 'rifle', name: 'AR-90 Northstar', slot: 2, price: 2700,
    damage: 33, headMult: 2, rpm: 600, mag: 30, reserve: 90,
    spread: 0.42, moveSpread: 1.4, recoil: 0.85, auto: true, pellets: 1, zoom: 1,
  },
  smg: {
    id: 'smg', name: 'VK-7 Blizzard', slot: 3, price: 1500,
    damage: 24, headMult: 2, rpm: 780, mag: 32, reserve: 96,
    spread: 0.8, moveSpread: 1.8, recoil: 0.5, auto: true, pellets: 1, zoom: 1,
  },
  shotgun: {
    id: 'shotgun', name: 'SG-9 Whiteout', slot: 4, price: 1100,
    damage: 12, headMult: 2, rpm: 72, mag: 6, reserve: 24,
    spread: 3.1, moveSpread: 2.4, recoil: 2.4, auto: false, pellets: 8, zoom: 1,
  },
  marksman: {
    id: 'marksman', name: 'LW-44 Longnight', slot: 5, price: 4750,
    damage: 88, headMult: 2, rpm: 48, mag: 5, reserve: 15,
    spread: 0.04, moveSpread: 2.8, recoil: 3.2, auto: false, pellets: 1, zoom: 2.2,
  },
  grenade: {
    id: 'grenade', name: 'F1 Frost Frag', slot: 6, price: 300,
    damage: 95, headMult: 1, rpm: 60, mag: 1, reserve: 0,
    spread: 0, moveSpread: 0, recoil: 0, auto: false, pellets: 1, zoom: 1,
  },
};

export const ECONOMY = {
  kill: 300,
  roundWin: 350,
  roundLoss: 175,
  defuse: 300,
  plant: 300,
};

export function createState(seed) {
  return {
    seed,
    rng: mulberry32(seed),
    time: 0,
    phase: 'menu', // menu | buy | live | roundEnd | matchEnd
    phaseT: 0,
    round: 1,
    score: { sen: 0, jac: 0 },
    money: START_MONEY,
    roundWinner: null,
    roundReason: '',
    matchWinner: null,
    bomb: { state: 'none', site: null, fuse: 0, carrier: null, planter: null, plantT: 0, defuser: null, defuseT: 0 },
    player: null,
    allies: [],
    enemies: [],
    tracers: [],
    grenades: [],
    killfeed: [],
    lastShotAt: null, // {x, z, t} — bots hear gunfire and rotate toward it
    shotMode: null,
    frozen: false,
    stats: { kills: 0, deaths: 0, plants: 0, defuses: 0 },
  };
}

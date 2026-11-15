# WHITEOUT — Aurora Station

A round-based tactical FPS in the style Counter-Strike made famous, built
from scratch on three.js 0.187.0. No copied maps, names, art or sounds:
everything here is original.

## The game

You are R. Calloway of the **Sentinels**, holding a snowbound arctic
research station — **Aurora Station** — against the **Jackals**. Two teams,
short rounds, and a charge to plant or defuse at site A (the Reactor Hall)
or site B (the Comms Dome).

- **Rounds**: 15 s buy phase, then a 100 s round. First team to 5 rounds
  takes the station. Win by eliminating the enemy squad, by stopping the
  plant, or by defusing the charge before its 35 s fuse runs out.
- **Economy**: $800 to start; $300 a kill, $350 a round win, $175 a loss,
  $300 for a defuse or a plant. Spend it in the buy menu (B) on five
  weapons and a frag grenade.
- **Gunplay**: hitscan against real bodies — headshots pay double. Recoil
  climbs, spread blooms while moving and firing, so stopping to aim pays.
  Crouch, walk slow, jump; collision is real AABB geometry. The marksman
  rifle scopes with right-click.
- **Bots**: four Jackals run waypoint lanes to a site, plant the charge,
  then guard it — and recover it if the carrier falls; two Sentinel
  teammates hold angles and rotate toward gunfire they hear. They see,
  react, burst-fire and strafe.
- **Arsenal**: P12 Frostbite sidearm, AR-90 Northstar rifle, VK-7 Blizzard
  SMG, SG-9 Whiteout shotgun, LW-44 Longnight marksman rifle, F1 Frost
  Frag grenade.

## Play

Serve `game/` with any static server and open `index.html` in desktop
Chrome (WebGL 2). Click **Deploy** to lock the pointer and play.
`WASD` move, mouse look, click fire, `R` reload, `Ctrl` crouch,
`Shift` walk slow, `Space` jump, `1–6` weapons, `G` grenade, `B` buy,
hold `E` to defuse.

Screenshot setups (deterministic, seeded): `?shot=cover`,
`?shot=buy`, `?shot=plant`, `?shot=end` — each with `&seed=1`.

## Layout

- `game/index.html` — page, HUD, import map for `three`
- `game/src/main.js` — bootstrap, fixed-step (60 Hz) loop, camera, viewmodel
- `game/src/state.js` — central state, weapon table, economy constants
- `game/src/world.js` — Aurora Station: colliders, waypoint graph, ray tests
- `game/src/player.js` — movement, collision, weapon input
- `game/src/weapons.js` — hitscan, recoil/spread, grenades, tracers
- `game/src/bots.js` — bot AI (routes, holds, engages, plants) + rigs
- `game/src/rounds.js` — round lifecycle, bomb, economy, match end
- `game/src/hud.js` — HUD, buy menu, banners, killfeed
- `game/src/audio.js` — synthesized WebAudio effects, no audio assets
- `game/src/palette.js` — blue-hour palette, canvas-made textures
- `game/src/rng.js` — seeded RNG (mulberry32)
- `game/src/shots.js` — deterministic setups for the dossier screenshots
- `game/vendor/three/` — three.js 0.187.0, byte for byte from the kit

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with
`vendor/makefun-threejs.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

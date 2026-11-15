// WHITEOUT — Aurora Station, a threejs-fps-02 entry (Node 22, standard
// library only). The game is this directory's game/ folder: plain static
// files the browser loads as ES modules, three.js 0.187.0 from an import
// map, no build step. This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve it locally first with any static server over game/ and open
// index.html in desktop Chrome (WebGL 2) to play it against the bots.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all: game/ counts beside /output's own 1000-entry cap,
// its screenshots/ and dossier.json).
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// buildDossier returns canonical JSON bytes (a Uint8Array), not a string:
// decode a copy to check the schema before the file lands.
const dossier = buildDossier(out, caps);
const parsed = JSON.parse(new TextDecoder().decode(dossier)) as { schema?: string };
if (parsed.schema !== 'makefun/dossier/v1') throw new Error(`unexpected dossier schema: ${parsed.schema}`);
writeFileSync(join(out, 'dossier.json'), dossier);

const shots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')) : [];
console.log(`WHITEOUT handed in: ${shots.length} screenshot(s), dossier ${dossier.length} bytes -> ${out}`);

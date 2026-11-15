// HUD: health, ammo, money, timer, score, bomb state, killfeed, and the
// overlays (menu, buy, round end). DOM writes are cached so the frame loop
// only touches a node when its text actually changes.
import { WEAPONS } from './state.js';
import { siteName } from './rounds.js';

const $ = (id) => document.getElementById(id);
const cache = new Map();

function setText(id, value) {
  if (cache.get(id) !== value) {
    cache.set(id, value);
    const el = $(id);
    if (el) el.textContent = value;
  }
}

function setShown(id, shown) {
  const el = $(id);
  if (!el) return;
  const hidden = !shown;
  if (el.hidden !== hidden) el.hidden = hidden;
}

export function initHud(S, cb) {
  $('deploy').addEventListener('click', () => cb.onDeploy());
  $('again').addEventListener('click', () => cb.onAgain());
  $('next-round').addEventListener('click', () => cb.onNext());
  document.querySelectorAll('#buy-list [data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => cb.onBuy(btn.dataset.buy));
  });
  $('buy-close').addEventListener('click', () => cb.onBuyClose());
}

export function showBanner(title, sub = '') {
  setText('banner-title', title);
  setText('banner-sub', sub);
  const b = $('banner');
  b.classList.remove('pop');
  void b.offsetWidth;
  b.classList.add('pop');
  setShown('banner', true);
}

export function hideBanner() {
  setShown('banner', false);
}

export function updateHud(S) {
  const p = S.player;
  // Crosshair spread grows with bloom, movement and recoil.
  const spread = 4 + (p ? p.bloom * 14 + p.recoil * 4 : 0);
  const ch = $('crosshair');
  if (ch) ch.style.setProperty('--spread', `${spread.toFixed(1)}px`);
  if (p) {
    setText('health-num', String(Math.max(0, Math.ceil(p.hp))));
    const hb = $('health-fill');
    if (hb) hb.style.width = `${Math.max(0, p.hp)}%`;
    const w = WEAPONS[p.weapon];
    setText('ammo-name', w.name);
    const ammo = p.ammo[p.weapon];
    setText('ammo-mag', ammo ? String(ammo.mag) : '—');
    setText('ammo-reserve', ammo ? `/ ${ammo.reserve}` : '');
    $('ammo').classList.toggle('empty', !ammo || ammo.mag === 0);
    setText('grenade-count', p.grenades > 0 ? `◉ ${p.grenades}` : '○ 0');
    setText('money', `$${S.money}`);
    setText('score-sen', String(S.score.sen));
    setText('score-jac', String(S.score.jac));
    setText('round-label', `ROUND ${S.round}`);
  }
  const t = Math.max(0, Math.ceil(S.phaseT));
  setText('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
  setText('timer-label', S.phase === 'buy' ? 'BUY' : S.phase === 'live' ? 'ROUND' : '—');
  // Bomb status line.
  let bombText = '';
  if (S.bomb.state === 'carried') bombText = `Charge carried — site ${S.bomb.site}`;
  else if (S.bomb.state === 'dropped') bombText = 'Charge dropped — recover it';
  else if (S.bomb.state === 'planted') bombText = `CHARGE PLANTED ${siteName(S)} — ${Math.max(0, S.bomb.fuse).toFixed(0)}s`;
  else if (S.bomb.state === 'defused') bombText = 'Charge defused';
  setText('bomb-status', bombText);
  $('bomb-status').classList.toggle('urgent', S.bomb.state === 'planted');
  // Killfeed.
  const kf = $('killfeed');
  if (kf) {
    const html = S.killfeed.slice(0, 5).map((k) => {
      const ago = Math.max(0, S.time - k.t);
      if (ago > 6) return '';
      return `<div><b>${k.killer}</b> ${k.headshot ? '◎' : '×'} <b>${k.victim}</b></div>`;
    }).join('');
    if (cache.get('killfeed') !== html) {
      cache.set('killfeed', html);
      kf.innerHTML = html;
    }
  }
  // Defuse / plant progress.
  const defuser = S.player.defusing > 0 ? S.player : S.allies.find((b) => b.defuseT > 0);
  const planter = S.enemies.find((b) => b.plantT > 0);
  const prog = defuser ? defuser.defuseT / 5 : planter ? planter.plantT / 3 : 0;
  const label = defuser ? 'DEFUSING' : planter ? 'PLANTING' : '';
  setText('action-label', label);
  const bar = $('action-fill');
  if (bar) bar.style.width = `${Math.round(prog * 100)}%`;
  setShown('action-bar', prog > 0);
}

// --- Overlays -----------------------------------------------------------
export function renderBuy(S) {
  const list = $('buy-list');
  if (!list) return;
  const rows = Object.values(WEAPONS).map((w) => {
    const owned = w.id === 'grenade' ? S.player.grenades > 0 : !!S.player.owned[w.id];
    const afford = S.money >= w.price;
    const tag = owned ? 'OWNED' : `$${w.price}`;
    const cls = owned ? 'owned' : afford ? '' : 'poor';
    const detail = w.id === 'grenade' ? 'Frag — 95 blast damage' :
      w.id === 'shotgun' ? `${w.pellets} pellets × ${w.damage} dmg` :
      `${w.damage} dmg · ${w.mag} rounds`;
    return `<button class="buy-item ${cls}" data-buy="${w.id}">
      <span class="buy-key">${w.slot}</span>
      <span class="buy-name">${w.name}</span>
      <span class="buy-detail">${detail}</span>
      <span class="buy-price">${tag}</span>
    </button>`;
  }).join('');
  if (cache.get('buy-list') !== rows) {
    cache.set('buy-list', rows);
    list.innerHTML = rows;
    list.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => window.__whiteoutBuy(btn.dataset.buy));
    });
  }
  setText('buy-money', `$${S.money}`);
}

export function showOverlay(S) {
  const phase = S.phase;
  setShown('overlay-menu', phase === 'menu');
  setShown('overlay-buy', phase === 'buy');
  setShown('overlay-end', phase === 'roundEnd' || phase === 'matchEnd');
  setShown('hud', phase === 'buy' || phase === 'live' || phase === 'roundEnd');
  if (phase === 'buy') renderBuy(S);
  if (phase === 'roundEnd' || phase === 'matchEnd') {
    const won = S.roundWinner === 'sen';
    const title = phase === 'matchEnd'
      ? (S.matchWinner === 'sen' ? 'STATION HELD — SENTINELS WIN' : 'STATION LOST — JACKALS WIN')
      : (won ? 'ROUND WON' : 'ROUND LOST');
    setText('end-title', title);
    setText('end-reason', S.roundReason || '');
    setText('end-score', `${S.score.sen} — ${S.score.jac}`);
    setText('next-round', phase === 'matchEnd' ? 'PLAY AGAIN' : 'NEXT ROUND');
  }
}

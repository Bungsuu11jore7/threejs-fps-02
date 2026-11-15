// Synthesized effects: no audio assets, everything is an oscillator or a
// burst of filtered noise. Created on the first user gesture; every call
// guards for a missing context so a silent browser still plays.
let ctx = null;
let master = null;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function noiseBurst(dur, freq, gain, type = 'lowpass') {
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filt).connect(g).connect(master);
  src.start();
}

function tone(freq, dur, gain, slideTo = null, type = 'square') {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export function shotSound(id) {
  if (id === 'shotgun') noiseBurst(0.22, 900, 0.9);
  else if (id === 'marksman') noiseBurst(0.3, 1400, 0.9);
  else if (id === 'smg') noiseBurst(0.09, 2200, 0.5);
  else noiseBurst(0.12, 1800, 0.65);
  tone(160, 0.08, 0.25, 60);
}

export function drySound() {
  tone(1200, 0.05, 0.15, 900, 'sine');
}

export function reloadSound() {
  tone(500, 0.06, 0.2, 700);
  setTimeout(() => tone(700, 0.06, 0.2, 900), 320);
}

export function hitSound(headshot) {
  tone(headshot ? 1400 : 1000, 0.06, 0.3, null, 'sine');
}

export function hurtSound() {
  tone(220, 0.15, 0.3, 110);
}

export function plantBeep() {
  tone(880, 0.09, 0.25, null, 'sine');
}

export function explodeSound() {
  noiseBurst(0.9, 300, 1.0);
  tone(70, 0.8, 0.5, 30);
}

export function roundSound(win) {
  tone(win ? 523 : 392, 0.18, 0.25, null, 'sine');
  setTimeout(() => tone(win ? 784 : 330, 0.25, 0.25, null, 'sine'), 180);
}

export function clickSound() {
  tone(900, 0.04, 0.18, null, 'sine');
}

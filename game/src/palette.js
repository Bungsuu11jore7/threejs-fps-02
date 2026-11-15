// WHITEOUT palette: a snowbound arctic station at blue hour. Cold steel and
// snow against warm amber hazard light, so the player reads the map at a
// glance and the two teams read apart in the dark.
import * as THREE from 'three';

export const PAL = {
  skyTop: 0x0d1b2e,
  skyBottom: 0x3a5a78,
  fog: 0x8fa8c4,
  snow: 0xe8eef4,
  snowShadow: 0xb9c8dc,
  steel: 0x2e3844,
  steelDark: 0x1c232c,
  steelLight: 0x4a5866,
  amber: 0xffa726,
  amberDim: 0x7a4d12,
  hazardYellow: 0xf2c200,
  sentinel: 0x35c4ff,
  jackal: 0xff5a3c,
  crate: 0x5d6b54,
  crateAlt: 0x6b5a44,
  dome: 0xd7dee8,
  reactor: 0x39434f,
};

function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Snow with wind-blown drifts and faint sparkle.
export function snowTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#e8eef4';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = (i * 37) % s;
      const y = (i * 91) % s;
      const v = 210 + ((i * 13) % 45);
      g.fillStyle = `rgb(${v},${v + 4},${Math.min(255, v + 12)})`;
      g.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 26; i++) {
      const x = (i * 53) % s;
      const y = (i * 29) % s;
      g.fillStyle = 'rgba(160,180,205,0.35)';
      g.beginPath();
      g.ellipse(x, y, 18 + (i % 14), 5 + (i % 4), (i % 3) * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  }, 8);
}

// Brushed dark steel panels with rivet seams.
export function steelTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#2e3844';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) {
      const x = (i * 41) % s;
      const y = (i * 17) % s;
      g.fillStyle = `rgba(255,255,255,${0.02 + (i % 5) * 0.008})`;
      g.fillRect(x, y, 3, 1);
    }
    g.strokeStyle = '#1c232c';
    g.lineWidth = 3;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.beginPath();
    g.moveTo(0, s / 2);
    g.lineTo(s, s / 2);
    g.stroke();
    g.fillStyle = '#4a5866';
    for (const [x, y] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14], [14, s / 2], [s - 14, s / 2]]) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  }, 2);
}

// Yellow-black hazard chevrons for site doors and the reactor base.
export function hazardTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#f2c200';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#14161a';
    for (let x = -s; x < s * 2; x += 32) {
      g.beginPath();
      g.moveTo(x, s);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 32, 0);
      g.lineTo(x + 16, s);
      g.closePath();
      g.fill();
    }
  }, 3);
}

// Stencilled supply crate: olive drab with a pale number.
export function crateTexture(label) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#5d6b54';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#3c4636';
    g.lineWidth = 6;
    g.strokeRect(4, 4, s - 8, s - 8);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s, s);
    g.moveTo(s, 0);
    g.lineTo(0, s);
    g.stroke();
    g.fillStyle = 'rgba(232,238,244,0.85)';
    g.font = 'bold 64px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, s / 2, s / 2);
  });
}

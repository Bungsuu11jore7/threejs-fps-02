// Aurora Station: a snowbound arctic research yard, built from boxes,
// cylinders and canvas textures. Three lanes run north to south; site A is
// the Reactor Hall in the west, site B the Comms Dome in the east. Every
// solid gets an AABB collider, and every bot route is a waypoint graph.
import * as THREE from 'three';
import { PAL, snowTexture, steelTexture, hazardTexture, crateTexture } from './palette.js';

export const MAP = { x0: -32, x1: 32, z0: -22, z1: 22 };

export const SITES = {
  A: { name: 'Reactor Hall', x: -18, z: -6 },
  B: { name: 'Comms Dome', x: 18, z: -8 },
};

export const SPAWNS = {
  sen: { x: 0, z: 18, yaw: 0 },
  jac: { x: 0, z: -19, yaw: Math.PI },
};

// Waypoint graph: id -> {x, z, links:[ids]}. Bots walk it lane by lane.
export const WAYPOINTS = {
  J0: { x: 0, z: -19, links: ['A1', 'M1', 'B1'] },
  A1: { x: -25, z: -14, links: ['J0', 'A2'] },
  A2: { x: -21, z: -7, links: ['A1', 'M2', 'A3'] },
  A3: { x: -18, z: -6, links: ['A2'] },
  M1: { x: 0, z: -12, links: ['J0', 'M2', 'A2', 'B2'] },
  M2: { x: 0, z: -2, links: ['M1', 'M3', 'A2', 'B2'] },
  M3: { x: 0, z: 8, links: ['M2', 'S1', 'S2'] },
  B1: { x: 25, z: -14, links: ['J0', 'B2'] },
  B2: { x: 21, z: -9, links: ['B1', 'M2', 'B3'] },
  B3: { x: 18, z: -8, links: ['B2'] },
  S0: { x: 0, z: 18, links: ['S1', 'S2', 'M3'] },
  S1: { x: -10, z: 12, links: ['S0', 'S3', 'M3'] },
  S2: { x: 10, z: 12, links: ['S0', 'S4', 'M3'] },
  S3: { x: -14, z: 2, links: ['S1', 'A2', 'M2'] },
  S4: { x: 14, z: 2, links: ['S2', 'B2', 'M2'] },
};

export const ROUTES = {
  A: ['J0', 'M1', 'M2', 'A2', 'A3'],
  Aw: ['J0', 'A1', 'A2', 'A3'],
  B: ['J0', 'M1', 'M2', 'B2', 'B3'],
  Be: ['J0', 'B1', 'B2', 'B3'],
};

function box(scene, colliders, mat, x, y, z, w, h, d, collide = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  scene.add(m);
  if (collide) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
  return m;
}

export function buildWorld(scene) {
  const colliders = [];
  const snowTex = snowTexture();
  const steel = new THREE.MeshStandardMaterial({ map: steelTexture(), roughness: 0.85, metalness: 0.25 });
  const steelDark = new THREE.MeshStandardMaterial({ color: PAL.steelDark, roughness: 0.9, metalness: 0.2 });
  const steelLight = new THREE.MeshStandardMaterial({ color: PAL.steelLight, roughness: 0.7, metalness: 0.35 });
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.8 });
  const domeMat = new THREE.MeshStandardMaterial({ color: PAL.dome, roughness: 0.35, metalness: 0.5 });
  const reactorMat = new THREE.MeshStandardMaterial({ color: PAL.reactor, roughness: 0.8, metalness: 0.3 });
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture('07'), roughness: 0.9 });
  const crateMat2 = new THREE.MeshStandardMaterial({ map: crateTexture('12'), roughness: 0.9 });
  const amberMat = new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: PAL.amber, emissiveIntensity: 1.6 });

  // Ground: snow, slightly blue in shadow.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 70),
    new THREE.MeshStandardMaterial({ map: snowTex, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Perimeter walls.
  box(scene, colliders, steel, 0, 0, MAP.z1 + 1, 68, 4, 2);
  box(scene, colliders, steel, 0, 0, MAP.z0 - 1, 68, 4, 2);
  box(scene, colliders, steel, MAP.x0 - 1, 0, 0, 2, 4, 48);
  box(scene, colliders, steel, MAP.x1 + 1, 0, 0, 2, 4, 48);

  // Site A — Reactor Hall: a hall with two door gaps, hazard plinth at the
  // door, a reactor column inside that reads as the plant spot.
  box(scene, colliders, reactorMat, -18, 0, -12.5, 15, 5, 1);
  box(scene, colliders, reactorMat, -24.5, 0, -6, 1, 5, 12);
  box(scene, colliders, reactorMat, -18, 0, -1.5, 6, 5, 1);
  box(scene, colliders, reactorMat, -18, 0, -10.5, 6, 5, 1);
  box(scene, colliders, hazard, -18, 0, -0.9, 6, 0.4, 1.2);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 4.2, 12), steelLight);
  column.position.set(-18, 2.1, -6);
  scene.add(column);
  colliders.push({ x0: -19.9, x1: -16.1, z0: -7.9, z1: -4.1, h: 4.2 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4.4, 8), amberMat);
  core.position.set(-18, 2.2, -6);
  scene.add(core);

  // Site B — Comms Dome: a low dome on a drum base, dish on top.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 2.4, 20), domeMat);
  drum.position.set(18, 1.2, -8);
  scene.add(drum);
  colliders.push({ x0: 13.2, x1: 22.8, z0: -12.8, z1: -3.2, h: 2.4 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.set(18, 2.4, -8);
  scene.add(dome);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.8, 0.8, 12), steelLight);
  dish.position.set(18, 7.2, -8);
  dish.rotation.z = 0.5;
  scene.add(dish);

  // Mid plaza: crates, a container lane, a watchtower.
  box(scene, colliders, crateMat, -6, 0, -2, 2.4, 2.4, 2.4);
  box(scene, colliders, crateMat2, -6, 0, 1.5, 2.4, 2.4, 2.4);
  box(scene, colliders, crateMat, -6, 2.4, -0.2, 2.4, 2.4, 2.4);
  box(scene, colliders, crateMat2, 7, 0, 3, 2.4, 2.4, 2.4);
  box(scene, colliders, crateMat, 9.5, 0, 3, 2.4, 2.4, 2.4);
  box(scene, colliders, steelDark, 12, 0, -12, 6, 3, 1.2);
  box(scene, colliders, steelDark, -12, 0, 10, 6, 3, 1.2);
  box(scene, colliders, crateMat, -25, 0, 4, 2.4, 2.4, 2.4);
  box(scene, colliders, crateMat2, 25, 0, 6, 2.4, 2.4, 2.4);
  box(scene, colliders, steel, -2, 0, -16, 4, 2.6, 1.2);
  box(scene, colliders, steel, 3, 0, 14, 4, 2.6, 1.2);

  // Watchtower legs + cabin at mid-west, a sightline over the plaza.
  box(scene, colliders, steelDark, -14, 0, -14, 0.5, 5, 0.5);
  box(scene, colliders, steelDark, -11, 0, -14, 0.5, 5, 0.5);
  box(scene, colliders, steelDark, -14, 0, -11, 0.5, 5, 0.5);
  box(scene, colliders, steelDark, -11, 0, -11, 0.5, 5, 0.5);
  box(scene, colliders, steel, -12.5, 5, -12.5, 4, 2.4, 4, false);

  // Amber floodlight poles at the sites and mid.
  const polePositions = [[-18, -1], [18, -3], [0, 0], [-25, -14], [25, -14]];
  const poleLights = [];
  for (const [px, pz] of polePositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 8), steelDark);
    pole.position.set(px, 3, pz);
    scene.add(pole);
    colliders.push({ x0: px - 0.2, x1: px + 0.2, z0: pz - 0.2, z1: pz + 0.2, h: 6 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), amberMat);
    lamp.position.set(px, 6.1, pz);
    scene.add(lamp);
    const light = new THREE.PointLight(PAL.amber, 60, 26, 1.8);
    light.position.set(px, 5.8, pz);
    scene.add(light);
    poleLights.push(light);
  }

  // Sky: gradient dome + moon + falling snow.
  const skyGeo = new THREE.SphereGeometry(120, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(PAL.skyTop) }, bottom: { value: new THREE.Color(PAL.skyBottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false }));
  moon.position.set(-60, 55, -80);
  moon.lookAt(0, 0, 0);
  scene.add(moon);

  const flakeCount = 700;
  const flakePos = new Float32Array(flakeCount * 3);
  for (let i = 0; i < flakeCount; i++) {
    flakePos[i * 3] = (Math.random() - 0.5) * 90;
    flakePos[i * 3 + 1] = Math.random() * 24;
    flakePos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
  const snow = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85 }));
  scene.add(snow);

  scene.fog = new THREE.Fog(PAL.fog, 24, 95);
  const hemi = new THREE.HemisphereLight(0x9db8d6, 0x2a3138, 0.85);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xcfe0f5, 1.1);
  moonLight.position.set(-30, 40, -20);
  scene.add(moonLight);

  return { colliders, poleLights, snow, flakeCount };
}

// --- Collision and rays -------------------------------------------------
// A body is a circle in XZ with radius r standing on y = 0. Push it out of
// every AABB it overlaps, one axis at a time, so sliding along walls works.
export function resolveCircle(colliders, p, r) {
  for (const c of colliders) {
    if (p.x > c.x0 - r && p.x < c.x1 + r && p.z > c.z0 - r && p.z < c.z1 + r) {
      const dxl = p.x - (c.x0 - r);
      const dxr = (c.x1 + r) - p.x;
      const dzl = p.z - (c.z0 - r);
      const dzr = (c.z1 + r) - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = c.x0 - r;
      else if (m === dxr) p.x = c.x1 + r;
      else if (m === dzl) p.z = c.z0 - r;
      else p.z = c.z1 + r;
    }
  }
  p.x = Math.max(MAP.x0 + r, Math.min(MAP.x1 - r, p.x));
  p.z = Math.max(MAP.z0 + r, Math.min(MAP.z1 - r, p.z));
}

// Slab test: ray (o, d) against one AABB. Returns distance or Infinity.
export function rayBox(o, d, c) {
  let tmin = 0;
  let tmax = 1e9;
  const axes = [
    [o.x, d.x, c.x0, c.x1],
    [o.y, d.y, 0, c.h],
    [o.z, d.z, c.z0, c.z1],
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

// Nearest world hit along a ray, or Infinity when the sky takes it.
export function rayWorld(colliders, o, d, maxDist = 200) {
  let best = Infinity;
  for (const c of colliders) {
    const t = rayBox(o, d, c);
    if (t < best && t <= maxDist) best = t;
  }
  return best;
}

// Straight-line sight between two eye points: true when no wall is in the way.
export function hasSight(colliders, ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.001) return true;
  const t = rayWorld(colliders, { x: ax, y: ay, z: az }, { x: dx / len, y: dy / len, z: dz / len }, len);
  return t >= len - 0.05;
}

export function updateSnow(world, dt, time) {
  const pos = world.snow.geometry.attributes.position;
  for (let i = 0; i < world.flakeCount; i++) {
    let y = pos.getY(i) - dt * (0.9 + (i % 5) * 0.25);
    let x = pos.getX(i) + Math.sin(time * 0.6 + i) * dt * 0.35;
    if (y < 0) {
      y = 22 + Math.random() * 2;
      x = (Math.random() - 0.5) * 90;
      pos.setZ(i, (Math.random() - 0.5) * 70);
    }
    pos.setY(i, y);
    pos.setX(i, x);
  }
  pos.needsUpdate = true;
}

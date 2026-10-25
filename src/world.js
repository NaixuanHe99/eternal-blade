// Arena: procedural stone floor, pillars, braziers, lights, fog.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function stoneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4440'; g.fillRect(0, 0, 512, 512);
  const tile = 64;
  for (let y = 0; y < 512; y += tile) for (let x = 0; x < 512; x += tile) {
    const off = (y / tile) % 2 ? tile / 2 : 0;
    const l = 30 + Math.random() * 14;
    g.fillStyle = `hsl(28, 8%, ${l}%)`; g.fillRect(x + off + 2, y + 2, tile - 4, tile - 4);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(x + off + Math.random() * tile, y + Math.random() * tile, 3, 3); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x1a1622);
  scene.fog = new THREE.Fog(0x1a1622, 12, 38);

  const hemi = new THREE.HemisphereLight(0x8090c0, 0x302018, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2c0, 2.4);
  sun.position.set(-6, 14, 6); sun.castShadow = true;
  const s = CONFIG.fx.shadowMapSize; sun.shadow.mapSize.set(s, s);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 11, bottom: -5, near: 1, far: 40 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, -2); scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x6688ff, 1.3); rim.position.set(4, 6, -14); scene.add(rim);

  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // raised dais ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.25, 8, 64), new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.05, -2); ring.receiveShadow = true; scene.add(ring);

  // pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x6b625a, roughness: 0.85 });
  const pGeo = new THREE.CylinderGeometry(0.7, 0.85, 9, 10);
  const capGeo = new THREE.BoxGeometry(2, 0.5, 2);
  const braziers = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const x = Math.sin(a) * 13, z = -2 + Math.cos(a) * 13;
    if (z > 6) continue; // keep camera side open
    const p = new THREE.Mesh(pGeo, pillarMat); p.position.set(x, 4.5, z); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    const cap = new THREE.Mesh(capGeo, pillarMat); cap.position.set(x, 9.1, z); scene.add(cap);
    if (i % 2 === 0) braziers.push(new THREE.Vector3(x * 0.82, 0, z * 0.82 - 0.36));
  }
  // braziers with flickering fire (only 2 real point lights for performance)
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.6, roughness: 0.5 });
  const flames = [];
  braziers.forEach((b) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 8), bowlMat); stand.position.set(b.x, 0.7, b.z); scene.add(stand);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.4, 10), bowlMat); bowl.position.set(b.x, 1.5, b.z); scene.add(bowl);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 8), fireMat); fl.position.set(b.x, 2.1, b.z); scene.add(fl);
    flames.push(fl);
  });
  const fireLights = [];
  const sorted = [...braziers].sort((a, b) => a.z - b.z).slice(0, 2);
  sorted.forEach((b) => { const l = new THREE.PointLight(0xff8a3a, 30, 16, 1.6); l.position.set(b.x, 2.6, b.z); scene.add(l); fireLights.push(l); });

  // distant backdrop: giant gate silhouette
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 1 });
  const gate = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 1), gateMat);
  gate.position.set(0, 8, -22); scene.add(gate);
  const archMat = new THREE.MeshBasicMaterial({ color: 0xff9a50, fog: true });
  const arch = new THREE.Mesh(new THREE.CircleGeometry(4, 32, 0, Math.PI), archMat);
  arch.position.set(0, 6, -21.4); scene.add(arch);
  const archLow = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), archMat);
  archLow.position.set(0, 3, -21.4); scene.add(archLow);

  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x6a2030, roughness: 0.85 });
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 16), carpetMat);
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.03, -8); carpet.receiveShadow = true; carpet.visible = false; scene.add(carpet);

  const throne = new THREE.Group(); throne.position.set(0, 0, -16); throne.visible = false; scene.add(throne);
  const throneMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7, metalness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.6, roughness: 0.35 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 1.6), throneMat); seat.position.y = 1.2; throne.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 0.35), throneMat); back.position.set(0, 2.8, -0.7); throne.add(back);
  const step = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 3.2), pillarMat); step.position.set(0, 0.2, 1.1); throne.add(step);
  const finL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), gold); finL.position.set(-1.4, 4.7, -0.7); throne.add(finL);
  const finR = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), gold); finR.position.set(1.4, 4.7, -0.7); throne.add(finR);

  const hedges = new THREE.Group(); hedges.visible = false; scene.add(hedges);
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2f5a38, roughness: 0.95 });
  for (const x of [-4.2, 4.2]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 6), hedgeMat);
    h.position.set(x, 0.55, -6); h.castShadow = true; hedges.add(h);
  }

  const themes = {
    gate: {
      bg: 0x1a1622, fog: 0x1a1622, near: 12, far: 38,
      sky: 0x8090c0, ground: 0x302018, hemi: 0.9, sun: 0xffe2c0, sunI: 2.4, rim: 0x6688ff, rimI: 1.3,
      floor: 0xffffff, pillar: 0x6b625a, flame: 0xffa040, light: 0xff8a3a, fireBase: 26,
      gate: 0x2a2630, arch: 0xff9a50, carpet: false, throne: false, hedges: false,
    },
    court: {
      bg: 0x1a2620, fog: 0x243028, near: 16, far: 48,
      sky: 0xc5ddd0, ground: 0x3a4030, hemi: 1.2, sun: 0xfff4d4, sunI: 2.9, rim: 0x88aa70, rimI: 0.7,
      floor: 0xd5e0cc, pillar: 0x8b907c, flame: 0xffe2a0, light: 0xffd090, fireBase: 18,
      gate: 0x3c463c, arch: 0xdfe8c0, carpet: false, throne: false, hedges: true,
    },
    hall: {
      bg: 0x100e18, fog: 0x14121c, near: 8, far: 26,
      sky: 0x405070, ground: 0x1c140e, hemi: 0.5, sun: 0xc9d4ff, sunI: 1.05, rim: 0x8060c0, rimI: 1.7,
      floor: 0xaeb4c8, pillar: 0x4a4558, flame: 0xffd090, light: 0xffc070, fireBase: 22,
      gate: 0x16141e, arch: 0x8a7340, carpet: true, throne: false, hedges: false,
    },
    throne: {
      bg: 0x14080c, fog: 0x1a0a0e, near: 9, far: 28,
      sky: 0x502028, ground: 0x200808, hemi: 0.55, sun: 0xffb090, sunI: 1.45, rim: 0xff3030, rimI: 2.1,
      floor: 0xd0a0a0, pillar: 0x4a3030, flame: 0xff4020, light: 0xff3018, fireBase: 30,
      gate: 0x1a0c10, arch: 0xffb040, carpet: true, throne: true, hedges: false,
    },
  };

  const api = {
    themeName: 'gate',
    sun,
    setTheme(name) {
      const th = themes[name] || themes.gate;
      api.themeName = themes[name] ? name : 'gate';
      scene.background.set(th.bg);
      scene.fog.color.set(th.fog); scene.fog.near = th.near; scene.fog.far = th.far;
      hemi.color.set(th.sky); hemi.groundColor.set(th.ground); hemi.intensity = th.hemi;
      sun.color.set(th.sun); sun.intensity = th.sunI;
      rim.color.set(th.rim); rim.intensity = th.rimI;
      floor.material.color.set(th.floor);
      pillarMat.color.set(th.pillar);
      fireMat.color.set(th.flame);
      gateMat.color.set(th.gate);
      archMat.color.set(th.arch);
      carpet.visible = th.carpet;
      throne.visible = th.throne;
      hedges.visible = th.hedges;
      fireLights.forEach((l) => l.color.set(th.light));
      api._fireBase = th.fireBase;
    },
    update(t) {
      const base = api._fireBase || 26;
      flames.forEach((f, i) => { const s = 1 + Math.sin(t * 13 + i * 2) * 0.12 + Math.sin(t * 29 + i) * 0.06; f.scale.set(1, s, 1); });
      fireLights.forEach((l, i) => { l.intensity = base + Math.sin(t * 11 + i * 3) * 4 + Math.sin(t * 23 + i) * 3; });
    },
  };
  api.setTheme('gate');
  return api;
}

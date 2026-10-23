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
  const gate = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 1), new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 1 }));
  gate.position.set(0, 8, -22); scene.add(gate);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(4, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xff9a50, fog: true }));
  arch.position.set(0, 6, -21.4); scene.add(arch);
  const archLow = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ color: 0xff9a50 }));
  archLow.position.set(0, 3, -21.4); scene.add(archLow);

  return {
    update(t) {
      flames.forEach((f, i) => { const s = 1 + Math.sin(t * 13 + i * 2) * 0.12 + Math.sin(t * 29 + i) * 0.06; f.scale.set(1, s, 1); });
      fireLights.forEach((l, i) => { l.intensity = 26 + Math.sin(t * 11 + i * 3) * 4 + Math.sin(t * 23 + i) * 3; });
    },
    sun,
  };
}

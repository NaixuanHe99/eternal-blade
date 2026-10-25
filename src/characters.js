// Procedural primitive-geometry characters: the knight (player) and the titan (enemy).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const easeOut = (t) => 1 - Math.pow(1 - t, 2.2);
const smooth = (t) => t * t * (3 - 2 * t);

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}

// ============================================================== PLAYER ======
export class Player {
  constructor(scene) {
    this.root = new THREE.Group(); scene.add(this.root);
    this.armorMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness: 0.55, roughness: 0.4 });
    this.helmMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness: 0.62, roughness: 0.32 });
    const armor = this.armorMat;
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.3, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x7a1c22, roughness: 0.9, side: THREE.DoubleSide });
    this.body = new THREE.Group(); this.root.add(this.body);
    mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), dark, -0.17, 0.43, 0, this.body);
    mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), dark, 0.17, 0.43, 0, this.body);
    mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), armor, 0, 1.2, 0, this.body);
    mesh(new THREE.BoxGeometry(0.5, 0.25, 0.32), dark, 0, 0.82, 0, this.body);
    const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), this.helmMat, 0, 1.75, 0, this.body);
    mesh(new THREE.ConeGeometry(0.05, 0.35, 6), cloth, 0, 0.25, 0.05, head); // plume
    mesh(new THREE.SphereGeometry(0.15, 10, 8), armor, -0.38, 1.48, 0, this.body);
    mesh(new THREE.SphereGeometry(0.15, 10, 8), armor, 0.38, 1.48, 0, this.body);
    const cape = mesh(new THREE.PlaneGeometry(0.6, 1.2, 1, 4), cloth, 0, 1.0, 0.2, this.body); cape.rotation.x = 0.12; this.cape = cape;
    // sword arm (upper arm drawn from shoulder to hand each frame)
    this.arm = mesh(new THREE.CylinderGeometry(0.07, 0.08, 1, 6), armor, 0, 0, 0, this.root);
    // shield
    this.shield = new THREE.Group(); this.root.add(this.shield);
    const sh = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0x5a3a20, metalness: 0.2, roughness: 0.7 }), 0, 0, 0, this.shield);
    sh.rotation.x = Math.PI / 2;
    const boss = mesh(new THREE.SphereGeometry(0.12, 10, 8), armor, 0, 0, -0.05, this.shield);
    const rimM = mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 24), armor, 0, 0, 0, this.shield);
    this.shieldMat = sh.material;
    // sword
    this.sword = new THREE.Group(); scene.add(this.sword);
    this.bladeMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.95, roughness: 0.18, emissive: 0x88aaff, emissiveIntensity: 0.15 });
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), dark, 0, -0.06, 0, this.sword);
    mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), armor, 0, 0.09, 0, this.sword);
    this.blade = mesh(new THREE.BoxGeometry(0.075, 1.55, 0.018), this.bladeMat, 0, 0.88, 0, this.sword);
    const tipG = new THREE.ConeGeometry(0.053, 0.16, 4); const tip = mesh(tipG, this.bladeMat, 0, 1.73, 0, this.sword); tip.rotation.y = Math.PI / 4; tip.scale.z = 0.34;
    this.bladeLen = 1.8;

    // state
    this.offsetX = 0; this.lunge = 0;
    this.swing = null;            // {dir:{x,y}, t, dur}
    this.recover = 1;             // 0→1 blend back to guard after a swing
    this.blockAmt = 0;
    this.hurtT = 0;
    this.hand = V(0, 0, 0); this.bladeDir = V(0, 1, 0); this.tip = V(); this.base = V();
    this._lastHand = V(); this._lastDir = V(0, 1, 0);
  }
  setSwordColors(color, glow) { this.bladeMat.color.set(color); this.bladeMat.emissive.set(glow); }
  setGearVisual(gear) {
    const g = gear || {};
    if (g.sword) this.setSwordColors(g.sword.color, g.sword.glow);
    else this.setSwordColors(0xc8ccd4, 0x88aaff);
    this.armorMat.color.set(g.armor ? g.armor.color : 0x9aa4b6);
    this.armorMat.emissive.set(g.armor ? g.armor.glow : 0x000000);
    this.armorMat.emissiveIntensity = g.armor ? 0.14 : 0;
    this.helmMat.color.set(g.helmet ? g.helmet.color : 0x9aa4b6);
    this.helmMat.emissive.set(g.helmet ? g.helmet.glow : 0x000000);
    this.helmMat.emissiveIntensity = g.helmet ? 0.2 : 0;
    this.shieldMat.color.set(g.shield ? g.shield.color : 0x5a3a20);
    this.shieldMat.emissive.set(g.shield ? g.shield.glow : 0x000000);
    this.shieldMat.emissiveIntensity = g.shield ? 0.16 : 0;
  }
  startSwing(dir, dur) { this.swing = { dir, t: 0, dur }; }
  get swingProgress() { return this.swing ? this.swing.t / this.swing.dur : 1; }

  update(dt, tNow, blocking) {
    this.blockAmt += ((blocking ? 1 : 0) - this.blockAmt) * Math.min(1, dt * 18);
    this.hurtT = Math.max(0, this.hurtT - dt);
    const fwd = V(0, 0, -1);
    const C = V(0.28 + this.offsetX, 1.45, -0.5);
    let hand, bdir;
    if (this.swing) {
      this.swing.t += dt;
      const p = Math.min(1, this.swing.t / this.swing.dur), e = easeOut(p);
      const u = THREE.MathUtils.lerp(-1, 1, e);
      const d = this.swing.dir; const dW = V(d.x, -d.y, 0).normalize();
      hand = C.clone().addScaledVector(dW, u * 0.62).addScaledVector(fwd, Math.sin(Math.PI * e) * 0.45);
      bdir = dW.clone().multiplyScalar(u * 1.25).add(fwd.clone().multiplyScalar(0.55 + Math.sin(Math.PI * e) * 0.7)).add(V(0, 0.15, 0)).normalize();
      this.lunge = Math.sin(Math.PI * p) * 0.35;
      if (p >= 1) { this.swing = null; this.recover = 0; this._lastHand.copy(hand); this._lastDir.copy(bdir); }
    } else {
      // guard pose (blends from last swing end)
      this.recover = Math.min(1, this.recover + dt * 7);
      const breath = Math.sin(tNow * 2.2) * 0.02;
      const gHand = V(0.42 + this.offsetX, 1.25 + breath, -0.35);
      const gDir = V(0.18, 0.92, -0.42).normalize();
      // while blocking: sword lowered
      gHand.lerp(V(0.45 + this.offsetX, 1.0, -0.2), this.blockAmt);
      gDir.lerp(V(0.6, 0.4, -0.7).normalize(), this.blockAmt).normalize();
      const k = smooth(this.recover);
      hand = this._lastHand.clone().lerp(gHand, k);
      bdir = this._lastDir.clone().lerp(gDir, k).normalize();
      this.lunge *= Math.exp(-dt * 10);
      if (this.recover >= 1) { this._lastHand.copy(hand); this._lastDir.copy(bdir); }
    }
    this.hand.copy(hand); this.bladeDir.copy(bdir);
    this.sword.position.copy(hand);
    this.sword.quaternion.setFromUnitVectors(V(0, 1, 0), bdir);
    this.base.copy(hand).addScaledVector(bdir, 0.2);
    this.tip.copy(hand).addScaledVector(bdir, this.bladeLen);

    // body
    const hurt = this.hurtT > 0 ? Math.sin(this.hurtT * 30) * 0.06 : 0;
    this.root.position.set(this.offsetX, 0, -this.lunge);
    this.body.rotation.set(-this.lunge * 0.3 + hurt + (this.hurtT > 0 ? 0.15 : 0), Math.sin(tNow * 1.3) * 0.02 - this.lunge * 0.4, -this.offsetX * 0.12);
    this.body.position.y = -Math.abs(this.offsetX) * 0.12 - this.blockAmt * 0.06;
    this.cape.rotation.x = 0.12 + this.lunge * 0.5 + Math.sin(tNow * 3) * 0.04;
    // arm from shoulder to hand
    const shoulder = V(0.38 + this.offsetX, 1.48 + this.body.position.y, -this.lunge);
    const mid = shoulder.clone().add(hand).multiplyScalar(0.5);
    const len = shoulder.distanceTo(hand);
    this.arm.position.copy(mid).sub(this.root.position);
    this.arm.scale.set(1, len, 1);
    this.arm.quaternion.setFromUnitVectors(V(0, 1, 0), hand.clone().sub(shoulder).normalize());
    // shield: side → front when blocking
    const sIdle = V(-0.5, 1.15, -0.15), sBlock = V(-0.05, 1.4, -0.75);
    this.shield.position.copy(sIdle.lerp(sBlock, this.blockAmt));
    this.shield.rotation.set(0, 0.9 * (1 - this.blockAmt), 0);
  }
}

// ============================================================== ENEMY =======
// Arm directions (enemy-local; +z points at the player, -x is the player's LEFT side of screen).
const D = (x, y, z) => V(x, y, z).normalize();
export const ATTACKS = {
  L: { key: [D(-1, 0.35, -0.5), D(0.15, -0.55, 1), D(1, -0.25, 0.25)], torso: [-0.55, 0.5], lean: [0, 0.15], glow: 0xffc040 },
  R: { key: [D(1, 0.45, -0.3), D(0.15, -0.55, 1), D(-1, -0.3, 0.3)], torso: [0.6, -0.45], lean: [0, 0.15], glow: 0xffc040 },
  O: { key: [D(0, 1, -0.45), D(0.15, -0.5, 1), D(0, -0.9, 0.5)], torso: [0.05, 0], lean: [-0.25, 0.35], glow: 0xffc040 },
  S: { key: [D(-1, -0.25, -0.35), D(0.15, -0.8, 1), D(1, -0.55, 0.2)], torso: [-0.6, 0.55], lean: [0.15, 0.25], glow: 0x40a0ff },
  H: { key: [D(0, 1, -0.7), D(0.15, -0.55, 1), D(0.1, -1, 0.35)], torso: [0, 0], lean: [-0.4, 0.5], glow: 0xff2020 },
};
const GUARD_DIR = D(0.45, 0.2, 1), STAGGER_DIR = D(-0.4, -1, 0.15), DOWN = V(0, -1, 0);

function disposeGroup(g) {
  const geos = new Set(), mats = new Set();
  g.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
  });
  geos.forEach((geo) => geo.dispose());
  mats.forEach((m) => m.dispose());
  g.clear();
}

function addEyes(self, parent, eyeM, spots) {
  self.eyeMats.push(eyeM);
  for (const p of spots) {
    const e = mesh(new THREE.BoxGeometry(p.w || 0.14, p.h || 0.08, 0.05), eyeM, p.x, p.y, p.z, parent);
    e.castShadow = false;
  }
}

// Weapon lives on local -Y so the swing solver (DOWN → armDir) still drives every silhouette.
function armWeapon(self, torso, shoulder, o) {
  const arm = new THREE.Group();
  arm.position.set(shoulder[0], shoulder[1], shoulder[2]);
  torso.add(arm);
  const upperL = o.upperL, foreL = o.foreL;
  mesh(new THREE.CylinderGeometry(o.upperR[0], o.upperR[1], upperL, 8), o.limb, 0, -upperL / 2, 0, arm);
  mesh(new THREE.CylinderGeometry(o.foreR[0], o.foreR[1], foreL, 8), o.fore, 0, -(upperL + foreL / 2), 0, arm);
  const handY = -(upperL + foreL);
  mesh(new THREE.SphereGeometry(o.hand, 8, 6), o.limb, 0, handY, 0, arm);
  const weaponMat = new THREE.MeshStandardMaterial({ color: o.weaponColor || 0x55555c, metalness: 0.85, roughness: 0.35, emissive: 0xffc040, emissiveIntensity: 0 });
  self.mats.push(weaponMat);
  self.weaponMat = weaponMat;
  const w = mesh(o.weaponGeo, weaponMat, 0, handY + o.weaponY, o.weaponZ || 0, arm);
  if (o.weaponRot) w.rotation.set(o.weaponRot[0], o.weaponRot[1], o.weaponRot[2]);
  if (o.extra) o.extra(arm, handY, weaponMat);
  const base = new THREE.Object3D(); base.position.set(0, handY + (o.baseOff ?? -0.15), 0); arm.add(base);
  const tip = new THREE.Object3D(); tip.position.set(0, handY + (o.tipOff ?? -2.2), 0); arm.add(tip);
  self.weaponBase = base; self.weaponTip = tip; self.arm = arm;
}

function buildWarden(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 2.1;
  self.chestLocal.set(0, 3.35, 0.7);
  mesh(new THREE.BoxGeometry(0.7, 2.1, 0.8), dark, -0.55, 1.05, 0, self.root);
  mesh(new THREE.BoxGeometry(0.7, 2.1, 0.8), dark, 0.55, 1.05, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(1.5, 0.7, 0.95), dark, 0, 0.3, 0, torso);
  mesh(new THREE.BoxGeometry(2.1, 1.6, 1.2), stone, 0, 1.25, 0, torso);
  mesh(new THREE.BoxGeometry(1.0, 0.45, 0.18), metal, 0, 1.35, 0.64, torso);
  const head = new THREE.Group(); head.position.y = 2.3; torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.78, 0.72, 0.78), stone, 0, 0, 0, head);
  addEyes(self, head, eyeM, [{ x: -0.18, y: 0.05, z: 0.4, w: 0.16 }, { x: 0.18, y: 0.05, z: 0.4, w: 0.16 }]);
  const horn = new THREE.ConeGeometry(0.11, 0.55, 6);
  mesh(horn, metal, -0.4, 0.38, 0, head).rotation.z = 0.55;
  mesh(horn, metal, 0.4, 0.38, 0, head).rotation.z = -0.55;
  mesh(new THREE.SphereGeometry(0.52, 10, 8), metal, -1.2, 1.8, 0, torso);
  mesh(new THREE.SphereGeometry(0.48, 10, 8), metal, 1.15, 1.8, 0, torso);
  armWeapon(self, torso, [-1.2, 1.75, 0], {
    limb: stone, fore: dark, upperR: [0.3, 0.26], upperL: 1.2, foreR: [0.28, 0.24], foreL: 1.1, hand: 0.28,
    weaponGeo: new THREE.BoxGeometry(0.16, 2.3, 0.55), weaponY: -1.7, weaponZ: 0.1, baseOff: -0.6, tipOff: -2.9,
  });
  const off = new THREE.Group(); off.position.set(1.15, 1.7, 0); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.9, 8), stone, 0, -0.95, 0, off);
  mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), metal, 0, -2.05, 0.05, off);
}

function buildSpear(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 2.45;
  self.chestLocal.set(0, 3.7, 0.45);
  mesh(new THREE.BoxGeometry(0.32, 2.45, 0.32), dark, -0.22, 1.22, 0, self.root);
  mesh(new THREE.BoxGeometry(0.32, 2.45, 0.32), dark, 0.22, 1.22, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), dark, 0, 0.15, 0, torso);
  mesh(new THREE.BoxGeometry(0.85, 1.35, 0.5), stone, 0, 0.95, 0, torso);
  mesh(new THREE.BoxGeometry(0.9, 0.12, 0.55), metal, 0, 1.55, 0, torso);
  const head = new THREE.Group(); head.position.y = 1.85; torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.38, 0.48, 0.4), stone, 0, 0, 0, head);
  mesh(new THREE.ConeGeometry(0.1, 0.45, 5), metal, 0, 0.4, 0, head);
  addEyes(self, head, eyeM, [{ x: -0.1, y: 0.02, z: 0.21, w: 0.08, h: 0.06 }, { x: 0.1, y: 0.02, z: 0.21, w: 0.08, h: 0.06 }]);
  armWeapon(self, torso, [-0.55, 1.35, 0], {
    limb: stone, fore: dark, upperR: [0.12, 0.1], upperL: 1.15, foreR: [0.1, 0.08], foreL: 1.15, hand: 0.12,
    weaponGeo: new THREE.BoxGeometry(0.07, 3.2, 0.07), weaponY: -1.85, weaponZ: 0.02, baseOff: -0.4, tipOff: -3.5,
    weaponColor: 0x8a9098,
  });
  const off = new THREE.Group(); off.position.set(0.5, 1.3, 0); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.1, 0.09, 1.8, 6), stone, 0, -0.9, 0, off);
}

function buildKnight(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 2.05;
  self.chestLocal.set(0, 3.45, 0.85);
  mesh(new THREE.BoxGeometry(0.55, 1.9, 0.6), dark, -0.4, 0.95, 0, self.root);
  mesh(new THREE.BoxGeometry(0.55, 1.9, 0.6), dark, 0.4, 0.95, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(1.35, 0.55, 0.8), dark, 0, 0.25, 0, torso);
  mesh(new THREE.BoxGeometry(1.7, 1.15, 0.95), stone, 0, 1.05, 0, torso);
  mesh(new THREE.BoxGeometry(1.15, 0.7, 0.35), metal, 0, 1.15, 0.55, torso);
  mesh(new THREE.BoxGeometry(1.9, 0.28, 0.7), metal, 0, 1.7, 0, torso);
  const head = new THREE.Group(); head.position.y = 1.95; torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.55, 0.62, 0.58), metal, 0, 0.05, 0, head);
  mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), eyeM, 0, 0.05, 0.3, head).castShadow = false;
  self.eyeMats.push(eyeM);
  mesh(new THREE.BoxGeometry(0.08, 0.4, 0.2), metal, 0, 0.45, 0, head);
  mesh(new THREE.BoxGeometry(0.7, 0.28, 0.28), metal, -1.05, 1.65, 0, torso);
  mesh(new THREE.BoxGeometry(0.7, 0.28, 0.28), metal, 1.05, 1.65, 0, torso);
  armWeapon(self, torso, [-1.05, 1.6, 0], {
    limb: metal, fore: dark, upperR: [0.22, 0.18], upperL: 1.05, foreR: [0.18, 0.16], foreL: 1.0, hand: 0.18,
    weaponGeo: new THREE.BoxGeometry(0.12, 2.5, 0.28), weaponY: -1.7, weaponZ: 0.05, baseOff: -0.45, tipOff: -3.05,
    weaponColor: 0xc8ccd4,
  });
  const off = new THREE.Group(); off.position.set(1.0, 1.5, 0.1); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.16, 0.14, 1.3, 6), metal, 0, -0.65, 0, off);
  const kite = mesh(new THREE.BoxGeometry(0.75, 1.15, 0.1), metal, 0.15, -1.45, 0.25, off);
  kite.rotation.z = -0.15;
}

function buildGolem(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 1.45;
  self.chestLocal.set(0, 3.05, 0.9);
  mesh(new THREE.BoxGeometry(0.9, 1.35, 0.9), dark, -0.85, 0.7, 0, self.root);
  mesh(new THREE.BoxGeometry(0.9, 1.35, 0.9), dark, 0.85, 0.7, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(2.8, 1.7, 1.5), stone, 0, 0.9, 0, torso);
  mesh(new THREE.BoxGeometry(1.5, 0.35, 0.3), metal, 0, 1.15, 0.78, torso);
  mesh(new THREE.BoxGeometry(3.1, 0.45, 1.2), stone, 0, 1.85, 0, torso);
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.35); torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.7, 0.45, 0.55), dark, 0, 0, 0, head);
  addEyes(self, head, eyeM, [{ x: -0.16, y: 0.02, z: 0.28, w: 0.12 }, { x: 0.16, y: 0.02, z: 0.28, w: 0.12 }]);
  armWeapon(self, torso, [-1.55, 1.5, 0], {
    limb: stone, fore: dark, upperR: [0.42, 0.38], upperL: 1.05, foreR: [0.4, 0.36], foreL: 0.95, hand: 0.4,
    weaponGeo: new THREE.BoxGeometry(0.28, 1.5, 0.28), weaponY: -1.15, weaponZ: 0, baseOff: -0.3, tipOff: -2.15,
    weaponColor: 0x6a6460,
    extra: (arm, handY, mat) => { mesh(new THREE.BoxGeometry(1.05, 0.7, 0.85), mat, 0, handY - 2.05, 0, arm); },
  });
  const off = new THREE.Group(); off.position.set(1.5, 1.45, 0); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.4, 0.36, 1.5, 8), stone, 0, -0.75, 0, off);
  mesh(new THREE.BoxGeometry(0.7, 0.55, 0.6), stone, 0, -1.6, 0.05, off);
}

function buildHound(self, def, ctx) {
  const { stone, dark, eyeM } = ctx;
  self.torsoBaseY = 0.85;
  self.chestLocal.set(0, 1.35, 0.85);
  const leg = new THREE.BoxGeometry(0.28, 0.75, 0.28);
  for (const [x, z] of [[-0.38, 0.55], [0.38, 0.55], [-0.38, -0.75], [0.38, -0.75]]) mesh(leg, dark, x, 0.38, z, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(0.95, 0.72, 2.15), stone, 0, 0.25, -0.15, torso);
  mesh(new THREE.BoxGeometry(0.2, 0.16, 0.7), dark, 0, 0.45, -1.25, torso);
  const head = new THREE.Group(); head.position.set(0, 0.55, 0.95); torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.55, 0.42, 0.62), stone, 0, 0, 0.1, head);
  mesh(new THREE.BoxGeometry(0.28, 0.2, 0.48), dark, 0, -0.08, 0.5, head);
  addEyes(self, head, eyeM, [{ x: -0.16, y: 0.06, z: 0.38, w: 0.1, h: 0.07 }, { x: 0.16, y: 0.06, z: 0.38, w: 0.1, h: 0.07 }]);
  mesh(new THREE.ConeGeometry(0.06, 0.28, 5), dark, -0.12, 0.22, 0.15, head).rotation.z = 0.4;
  mesh(new THREE.ConeGeometry(0.06, 0.28, 5), dark, 0.12, 0.22, 0.15, head).rotation.z = -0.4;
  armWeapon(self, torso, [-0.15, 0.45, 1.05], {
    limb: stone, fore: dark, upperR: [0.12, 0.1], upperL: 0.45, foreR: [0.1, 0.08], foreL: 0.4, hand: 0.12,
    weaponGeo: new THREE.ConeGeometry(0.16, 0.7, 5), weaponY: -0.55, weaponZ: 0.05, baseOff: -0.15, tipOff: -1.15,
    weaponColor: 0xd8d0c8, weaponRot: [Math.PI, 0, 0],
  });
  const off = new THREE.Group(); off.position.set(0.35, 0.15, 0.7); torso.add(off); self.offArm = off;
  mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), dark, 0, -0.2, 0.2, off);
}

function buildChanter(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 1.55;
  self.floatAmp = 0.16;
  self.chestLocal.set(0, 3.15, 0.4);
  mesh(new THREE.ConeGeometry(1.15, 2.5, 8), dark, 0, 1.15, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(0.7, 1.15, 0.45), stone, 0, 0.85, 0, torso);
  mesh(new THREE.BoxGeometry(1.25, 0.16, 0.7), dark, 0, 1.35, 0, torso);
  const head = new THREE.Group(); head.position.y = 1.65; torso.add(head); self.head = head;
  mesh(new THREE.SphereGeometry(0.32, 10, 8), stone, 0, 0, 0, head);
  mesh(new THREE.ConeGeometry(0.48, 0.55, 7), dark, 0, 0.28, 0, head);
  addEyes(self, head, eyeM, [{ x: -0.1, y: 0.02, z: 0.28, w: 0.08, h: 0.06 }, { x: 0.1, y: 0.02, z: 0.28, w: 0.08, h: 0.06 }]);
  armWeapon(self, torso, [-0.45, 1.15, 0], {
    limb: stone, fore: dark, upperR: [0.1, 0.09], upperL: 0.95, foreR: [0.09, 0.07], foreL: 0.95, hand: 0.1,
    weaponGeo: new THREE.CylinderGeometry(0.045, 0.045, 2.8, 6), weaponY: -1.55, weaponZ: 0, baseOff: -0.25, tipOff: -3.05,
    weaponColor: 0x6a5a40,
    extra: (arm, handY, mat) => { mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat, 0, handY - 2.95, 0, arm); },
  });
  const off = new THREE.Group(); off.position.set(0.42, 1.1, 0.05); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.08, 0.07, 1.2, 6), stone, 0, -0.6, 0, off);
  mesh(new THREE.BoxGeometry(0.28, 0.08, 0.36), metal, 0, -1.15, 0.05, off);
}

function buildShade(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 2.15;
  self.chestLocal.set(0, 3.4, 0.35);
  mesh(new THREE.BoxGeometry(0.22, 2.3, 0.22), dark, -0.16, 1.15, 0, self.root);
  mesh(new THREE.BoxGeometry(0.22, 2.3, 0.22), dark, 0.16, 1.15, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(0.55, 1.45, 0.32), stone, 0, 0.9, 0, torso);
  const wispMat = new THREE.MeshBasicMaterial({ color: 0x7040c0, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
  const w1 = mesh(new THREE.PlaneGeometry(0.9, 1.6), wispMat, 0, 0.8, -0.25, torso); w1.castShadow = false;
  const w2 = mesh(new THREE.PlaneGeometry(0.7, 1.3), wispMat, 0.35, 0.6, -0.1, torso); w2.rotation.y = 0.8; w2.castShadow = false;
  const head = new THREE.Group(); head.position.y = 1.85; torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.36, 0.48, 0.32), stone, 0, 0, 0, head);
  mesh(new THREE.ConeGeometry(0.06, 0.4, 5), metal, -0.16, 0.32, 0, head).rotation.z = 0.5;
  mesh(new THREE.ConeGeometry(0.06, 0.4, 5), metal, 0.16, 0.32, 0, head).rotation.z = -0.5;
  addEyes(self, head, eyeM, [{ x: -0.08, y: 0.02, z: 0.17, w: 0.07, h: 0.05 }, { x: 0.08, y: 0.02, z: 0.17, w: 0.07, h: 0.05 }]);
  armWeapon(self, torso, [-0.4, 1.35, 0], {
    limb: stone, fore: dark, upperR: [0.08, 0.07], upperL: 1.05, foreR: [0.07, 0.06], foreL: 1.0, hand: 0.08,
    weaponGeo: new THREE.BoxGeometry(0.06, 1.7, 0.16), weaponY: -1.15, weaponZ: 0.02, baseOff: -0.35, tipOff: -2.15,
    weaponColor: 0xb9a6e0,
  });
  const off = new THREE.Group(); off.position.set(0.38, 1.3, 0); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.07, 0.06, 1.5, 6), stone, 0, -0.75, 0, off);
  mesh(new THREE.BoxGeometry(0.05, 1.15, 0.14), metal, 0, -1.7, 0.05, off);
}

function buildSovereign(self, def, ctx) {
  const { stone, dark, metal, eyeM } = ctx;
  self.torsoBaseY = 2.2;
  self.chestLocal.set(0, 3.7, 0.8);
  mesh(new THREE.BoxGeometry(0.6, 2.15, 0.7), dark, -0.5, 1.08, 0, self.root);
  mesh(new THREE.BoxGeometry(0.6, 2.15, 0.7), dark, 0.5, 1.08, 0, self.root);
  const torso = new THREE.Group(); self.root.add(torso); self.torso = torso;
  mesh(new THREE.BoxGeometry(1.7, 0.6, 1.0), dark, 0, 0.3, 0, torso);
  mesh(new THREE.BoxGeometry(2.15, 1.55, 1.15), stone, 0, 1.25, 0, torso);
  mesh(new THREE.BoxGeometry(1.2, 0.7, 0.25), metal, 0, 1.3, 0.62, torso);
  const cape = mesh(new THREE.PlaneGeometry(1.8, 2.4), dark, 0, 0.9, -0.65, torso);
  cape.rotation.x = 0.08;
  mesh(new THREE.ConeGeometry(0.28, 0.7, 5), metal, -1.25, 2.15, 0, torso).rotation.z = 0.7;
  mesh(new THREE.ConeGeometry(0.28, 0.7, 5), metal, 1.25, 2.15, 0, torso).rotation.z = -0.7;
  const head = new THREE.Group(); head.position.y = 2.25; torso.add(head); self.head = head;
  mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), stone, 0, 0, 0, head);
  addEyes(self, head, eyeM, [{ x: -0.16, y: 0.05, z: 0.36, w: 0.12 }, { x: 0.16, y: 0.05, z: 0.36, w: 0.12 }]);
  mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.18, 8), metal, 0, 0.42, 0, head);
  for (let i = 0; i < 5; i++) {
    const a = -0.8 + i * 0.4;
    const sp = mesh(new THREE.ConeGeometry(0.06, 0.32, 4), metal, Math.sin(a) * 0.32, 0.68, Math.cos(a) * 0.1, head);
    sp.rotation.x = -0.4;
  }
  armWeapon(self, torso, [-1.25, 1.7, 0], {
    limb: stone, fore: dark, upperR: [0.28, 0.24], upperL: 1.2, foreR: [0.24, 0.2], foreL: 1.15, hand: 0.26,
    weaponGeo: new THREE.BoxGeometry(0.18, 2.7, 0.42), weaponY: -1.85, weaponZ: 0.08, baseOff: -0.55, tipOff: -3.3,
    weaponColor: 0xe6d7a4,
  });
  const off = new THREE.Group(); off.position.set(1.2, 1.65, 0); torso.add(off); self.offArm = off;
  mesh(new THREE.CylinderGeometry(0.24, 0.2, 1.8, 8), stone, 0, -0.9, 0, off);
  mesh(new THREE.BoxGeometry(0.45, 0.7, 0.12), metal, 0.05, -1.9, 0.15, off);
}

const BUILD = {
  warden: buildWarden, spear: buildSpear, knight: buildKnight, golem: buildGolem,
  hound: buildHound, chanter: buildChanter, shade: buildShade, sovereign: buildSovereign,
};

export class Enemy {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); scene.add(this.root);
    this.mats = []; this.eyeMats = [];
    this.flash = 0; this.glow = 0; this.glowColor = new THREE.Color(0xffc040);
    this.flinch = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, px: 0, vpx: 0 };
    this.pose = { torsoY: 0, lean: 0, armDir: GUARD_DIR.clone() };
    this.dead = 0; this.time = 0;
    this.tipW = V(); this.baseW = V();
    this.windowOpen = false; this.windowFlash = 0; this.windowColor = new THREE.Color(0xc8faff);
    this.torsoBaseY = 2.1; this.floatAmp = 0; this.enraged = false; this.phase = 1;
    this._rage = new THREE.Color(0xff3018);
    this.chestLocal = V(0, 3.3, 0.65);
    this.archetype = 'warden';
  }
  // parry / dodge window opened: weapon flashes and changes colour while it stays open
  openWindow(color) { this.windowOpen = true; this.windowFlash = 1; this.windowColor.set(color); }
  setPhase(n) {
    this.phase = n;
    this.enraged = n >= 2;
    if (this.enraged) for (const m of this.eyeMats) m.color.set(0xff2418);
  }
  build(def) {
    disposeGroup(this.root);
    this.mats = []; this.eyeMats = [];
    this.archetype = def.archetype || 'warden';
    this.enraged = false; this.phase = 1; this.dead = 0; this.flash = 0; this.glow = 0;
    this.windowOpen = false; this.windowFlash = 0; this.floatAmp = 0; this.torsoBaseY = 2.1;
    const f = this.flinch;
    f.x = f.z = f.y = f.vx = f.vz = f.vy = f.px = f.vpx = 0;
    const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.2, ...o }); this.mats.push(m); return m; };
    const stone = M(def.color), dark = M(new THREE.Color(def.color).multiplyScalar(0.55)), metal = M(0x3a3a40, { metalness: 0.8, roughness: 0.4 });
    const eyeM = new THREE.MeshBasicMaterial({ color: def.eye });
    const s = def.scale || 1;
    this.root.scale.setScalar(s);
    this.root.position.set(0, 0, -3.9 - (s - 1) * 1.2);
    this.root.rotation.set(0, 0, 0);
    (BUILD[this.archetype] || BUILD.warden)(this, def, { stone, dark, metal, eyeM });
    this.pose.armDir.copy(GUARD_DIR); this.pose.torsoY = 0; this.pose.lean = 0;
    if (!this.offArm) { this.offArm = new THREE.Group(); this.torso.add(this.offArm); }
    if (!this.head) { this.head = new THREE.Group(); this.torso.add(this.head); }
  }
  chestWorld(out = V()) { return out.copy(this.chestLocal).applyMatrix4(this.root.matrixWorld); }
  hitFlinch(dirW, strength) {
    const f = this.flinch;
    f.vz += -dirW.x * 3.2 * strength; f.vx += (-2.8 + dirW.y * 1.5) * strength; f.vy += dirW.x * 2.0 * strength; f.vpx += dirW.x * 1.3 * strength;
    this.flash = 1;
  }
  // targets: {mode, attack, phase, p}
  update(dt, st) {
    if (!this.arm) return;
    this.time += dt;
    const P = this.pose; let dir = GUARD_DIR, torsoY = 0, lean = 0, glow = 0;
    const breath = Math.sin(this.time * 1.6) * 0.03;
    if (st.mode === 'windup') {
      const A = ATTACKS[st.attack]; const p = smooth(Math.min(1, st.p));
      dir = GUARD_DIR.clone().lerp(A.key[0], p).normalize(); torsoY = A.torso[0] * p; lean = A.lean[0] * p;
      glow = p; this.glowColor.set(A.glow);
      // tremble just before the swing
      if (st.p > 0.75) { torsoY += Math.sin(this.time * 70) * 0.02; }
    } else if (st.mode === 'strike') {
      const A = ATTACKS[st.attack]; const p = Math.min(1, st.p);
      dir = p < 0.5 ? A.key[0].clone().lerp(A.key[1], p * 2).normalize() : A.key[1].clone().lerp(A.key[2], (p - 0.5) * 2).normalize();
      torsoY = THREE.MathUtils.lerp(A.torso[0], A.torso[1], p); lean = THREE.MathUtils.lerp(A.lean[0], A.lean[1], p);
      glow = 1; this.glowColor.set(A.glow);
    } else if (st.mode === 'recover') {
      const A = ATTACKS[st.attack] || ATTACKS.O; const p = smooth(Math.min(1, st.p));
      dir = A.key[2].clone().lerp(GUARD_DIR, p).normalize(); torsoY = A.torso[1] * (1 - p); lean = A.lean[1] * (1 - p);
    } else if (st.mode === 'open') {
      const A = ATTACKS[st.attack] || ATTACKS.O; dir = A.key[2]; torsoY = A.torso[1] * 0.8; lean = A.lean[1] * 0.8 + 0.05;
    } else if (st.mode === 'stagger') {
      dir = STAGGER_DIR; lean = -0.35 + Math.sin(this.time * 4) * 0.04; torsoY = 0.25;
    } else if (st.mode === 'dead') {
      dir = STAGGER_DIR; lean = -0.5;
    }
    if (this.enraged) this.glowColor.lerp(this._rage, 0.7);
    // smooth toward pose (fast during strike for snappy swings)
    const k = st.mode === 'strike' ? 1 : 1 - Math.exp(-dt * (st.mode === 'stagger' ? 10 : 9));
    P.armDir.lerp(dir, k).normalize(); P.torsoY += (torsoY - P.torsoY) * k; P.lean += (lean - P.lean) * k;
    // flinch spring
    const f = this.flinch, sk = 140, sd = 14;
    for (const [a, v] of [['x', 'vx'], ['z', 'vz'], ['y', 'vy'], ['px', 'vpx']]) { f[v] += (-f[a] * sk - f[v] * sd) * dt; f[a] += f[v] * dt; }
    this.arm.quaternion.setFromUnitVectors(DOWN, P.armDir);
    this.offArm.rotation.set(-0.3 + Math.sin(this.time * 1.6) * 0.05 - P.lean * 0.5, 0, 0.15);
    this.torso.rotation.set(P.lean + f.x * 0.25 + breath, P.torsoY + f.y * 0.2, f.z * 0.2);
    this.torso.position.set(f.px * 0.15, (this.torsoBaseY || 2.1) + breath * 0.5, 0);
    this.head.rotation.set(-P.lean * 0.4, -P.torsoY * 0.3, 0);
    if (st.mode === 'dead') {
      this.dead = Math.min(1, this.dead + dt * 0.9);
      const e = smooth(this.dead); this.root.rotation.x = -e * 1.35; this.root.position.y = -e * 0.4;
    } else {
      this.root.rotation.x = 0;
      this.root.position.y = this.floatAmp ? Math.sin(this.time * 2) * this.floatAmp : 0;
    }
    // flash & telegraph glow
    this.flash = Math.max(0, this.flash - dt * 9);
    this.glow += (glow - this.glow) * Math.min(1, dt * 10);
    const fl = this.flash * this.flash * 0.6; for (const m of this.mats) { m.emissive.setRGB(fl, fl * 0.85, fl * 0.7); }
    this.windowFlash = Math.max(0, this.windowFlash - dt * 3);
    if (this.windowOpen && (st.mode === 'windup' || st.mode === 'strike')) {
      this.weaponMat.emissive.copy(this.windowColor);
      this.weaponMat.emissiveIntensity = 2.2 + Math.sin(this.time * 40) * 0.5 + this.windowFlash * 4;
    } else {
      this.windowOpen = false;
      this.weaponMat.emissive.copy(this.glowColor);
      this.weaponMat.emissiveIntensity = this.glow * (1.2 + Math.sin(this.time * 30) * 0.3) + this.flash;
    }
    this.root.updateMatrixWorld(true);
    this.weaponTip.getWorldPosition(this.tipW); this.weaponBase.getWorldPosition(this.baseW);
  }
}

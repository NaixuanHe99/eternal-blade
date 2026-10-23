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
    const armor = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness: 0.55, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.3, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x7a1c22, roughness: 0.9, side: THREE.DoubleSide });
    this.body = new THREE.Group(); this.root.add(this.body);
    mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), dark, -0.17, 0.43, 0, this.body);
    mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), dark, 0.17, 0.43, 0, this.body);
    mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), armor, 0, 1.2, 0, this.body);
    mesh(new THREE.BoxGeometry(0.5, 0.25, 0.32), dark, 0, 0.82, 0, this.body);
    const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), armor, 0, 1.75, 0, this.body);
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

export class Enemy {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); scene.add(this.root);
    this.mats = [];
    this.flash = 0; this.glow = 0; this.glowColor = new THREE.Color(0xffc040);
    this.flinch = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, px: 0, vpx: 0 };
    this.pose = { torsoY: 0, lean: 0, armDir: GUARD_DIR.clone() };
    this.dead = 0; this.time = 0;
    this.tipW = V(); this.baseW = V();
    this.windowOpen = false; this.windowFlash = 0; this.windowColor = new THREE.Color(0xc8faff);
  }
  // parry / dodge window opened: weapon flashes and changes colour while it stays open
  openWindow(color) { this.windowOpen = true; this.windowFlash = 1; this.windowColor.set(color); }
  build(def) {
    this.root.clear(); this.mats = [];
    const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.2, ...o }); this.mats.push(m); return m; };
    const stone = M(def.color), dark = M(new THREE.Color(def.color).multiplyScalar(0.55)), metal = M(0x3a3a40, { metalness: 0.8, roughness: 0.4 });
    const eyeM = new THREE.MeshBasicMaterial({ color: def.eye });
    const s = def.scale; this.root.scale.setScalar(s); this.root.position.set(0, 0, -3.9 - (s - 1) * 1.2);
    this.root.rotation.set(0, 0, 0);
    this.legs = [mesh(new THREE.BoxGeometry(0.7, 2.1, 0.8), dark, -0.6, 1.05, 0, this.root), mesh(new THREE.BoxGeometry(0.7, 2.1, 0.8), dark, 0.6, 1.05, 0, this.root)];
    this.torso = new THREE.Group(); this.torso.position.y = 2.1; this.root.add(this.torso);
    mesh(new THREE.BoxGeometry(1.5, 0.7, 0.95), dark, 0, 0.3, 0, this.torso);
    mesh(new THREE.BoxGeometry(2.1, 1.6, 1.2), stone, 0, 1.25, 0, this.torso);
    mesh(new THREE.BoxGeometry(1.0, 0.5, 0.2), metal, 0, 1.4, 0.62, this.torso);
    this.head = new THREE.Group(); this.head.position.y = 2.35; this.torso.add(this.head);
    mesh(new THREE.BoxGeometry(0.8, 0.75, 0.8), stone, 0, 0, 0, this.head);
    mesh(new THREE.BoxGeometry(0.16, 0.08, 0.05), eyeM, -0.18, 0.05, 0.41, this.head).castShadow = false;
    mesh(new THREE.BoxGeometry(0.16, 0.08, 0.05), eyeM, 0.18, 0.05, 0.41, this.head).castShadow = false;
    const horn = new THREE.ConeGeometry(0.12, 0.6, 6);
    mesh(horn, metal, -0.42, 0.35, 0, this.head).rotation.z = 0.6; mesh(horn, metal, 0.42, 0.35, 0, this.head).rotation.z = -0.6;
    // shoulders
    mesh(new THREE.SphereGeometry(0.55, 10, 8), metal, -1.25, 1.85, 0, this.torso);
    mesh(new THREE.SphereGeometry(0.5, 10, 8), metal, 1.25, 1.85, 0, this.torso);
    // weapon arm
    this.arm = new THREE.Group(); this.arm.position.set(-1.25, 1.75, 0); this.torso.add(this.arm);
    mesh(new THREE.CylinderGeometry(0.3, 0.26, 1.2, 8), stone, 0, -0.6, 0, this.arm);
    mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.1, 8), dark, 0, -1.7, 0, this.arm);
    mesh(new THREE.SphereGeometry(0.3, 8, 6), stone, 0, -2.3, 0, this.arm);
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), metal, 0, -2.5, 0, this.arm);
    this.weaponMat = new THREE.MeshStandardMaterial({ color: 0x55555c, metalness: 0.85, roughness: 0.35, emissive: 0xffc040, emissiveIntensity: 0 });
    const blade = mesh(new THREE.BoxGeometry(0.16, 2.3, 0.7), this.weaponMat, 0, -4.0, 0.12, this.arm);
    this.weaponBase = new THREE.Object3D(); this.weaponBase.position.set(0, -2.9, 0); this.arm.add(this.weaponBase);
    this.weaponTip = new THREE.Object3D(); this.weaponTip.position.set(0, -5.2, 0); this.arm.add(this.weaponTip);
    // off arm
    this.offArm = new THREE.Group(); this.offArm.position.set(1.25, 1.75, 0); this.torso.add(this.offArm);
    mesh(new THREE.CylinderGeometry(0.28, 0.24, 2.0, 8), stone, 0, -1.0, 0, this.offArm);
    mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), metal, 0, -2.2, 0, this.offArm);
    this.dead = 0; this.pose.armDir.copy(GUARD_DIR); this.pose.torsoY = 0; this.pose.lean = 0;
    // chest point for hit placement
    this.chestLocal = V(0, 3.3, 0.65);
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
    // smooth toward pose (fast during strike for snappy swings)
    const k = st.mode === 'strike' ? 1 : 1 - Math.exp(-dt * (st.mode === 'stagger' ? 10 : 9));
    P.armDir.lerp(dir, k).normalize(); P.torsoY += (torsoY - P.torsoY) * k; P.lean += (lean - P.lean) * k;
    // flinch spring
    const f = this.flinch, sk = 140, sd = 14;
    for (const [a, v] of [['x', 'vx'], ['z', 'vz'], ['y', 'vy'], ['px', 'vpx']]) { f[v] += (-f[a] * sk - f[v] * sd) * dt; f[a] += f[v] * dt; }
    this.arm.quaternion.setFromUnitVectors(DOWN, P.armDir);
    this.offArm.rotation.set(-0.3 + Math.sin(this.time * 1.6) * 0.05 - P.lean * 0.5, 0, 0.15);
    this.torso.rotation.set(P.lean + f.x * 0.25 + breath, P.torsoY + f.y * 0.2, f.z * 0.2);
    this.torso.position.set(f.px * 0.15, 2.1 + breath * 0.5, 0);
    this.head.rotation.set(-P.lean * 0.4, -P.torsoY * 0.3, 0);
    if (st.mode === 'dead') {
      this.dead = Math.min(1, this.dead + dt * 0.9);
      const e = smooth(this.dead); this.root.rotation.x = -e * 1.35; this.root.position.y = -e * 0.4;
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

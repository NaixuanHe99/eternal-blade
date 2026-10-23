// Visual feedback systems: time control (hit-stop / slow-mo), camera shake & zoom
// punch, GPU particles, 3D blade trails, 2D finger trail, damage numbers, rings.
import * as THREE from 'three';
import { CONFIG } from './config.js';

// ------------------------------------------------------------ time control --
export const time = {
  hitStop: 0, slowScale: 1, slowTimer: 0, slowDur: 0,
  freeze(t) { this.hitStop = Math.max(this.hitStop, t); },
  slowmo(scale, dur) {
    // keep whichever is more dramatic
    if (this.slowTimer > 0 && scale > this.slowScale) return;
    this.slowScale = scale; this.slowTimer = dur; this.slowDur = dur;
  },
  // returns simulation dt from real dt
  step(realDt) {
    if (this.hitStop > 0) { this.hitStop -= realDt; return 0; }
    let s = 1;
    if (this.slowTimer > 0) {
      this.slowTimer -= realDt;
      const k = Math.max(0, this.slowTimer / this.slowDur);       // 1 → 0
      const ease = k > 0.35 ? 1 : k / 0.35;                         // hold, then ramp back
      s = THREE.MathUtils.lerp(1, this.slowScale, ease);
    }
    return realDt * s;
  },
  get scale() { return this.hitStop > 0 ? 0 : (this.slowTimer > 0 ? this.slowScale : 1); },
};

// ------------------------------------------------------------ camera rig ----
export class CameraRig {
  constructor(camera) {
    this.camera = camera; this.trauma = 0; this.zoom = 0; this.zoomVel = 0; this.t = 0;
    this.basePos = new THREE.Vector3(); this.lookAt = new THREE.Vector3(); this.baseFov = 55;
    this.follow = new THREE.Vector3(); this.kick = new THREE.Vector3();
  }
  addTrauma(a) { this.trauma = Math.min(1, this.trauma + a); }
  punch(deg) { this.zoomVel -= deg * 14; }
  push(v) { this.kick.add(v); }
  update(realDt) {
    const c = CONFIG.camera; this.t += realDt;
    this.trauma = Math.max(0, this.trauma - c.traumaDecay * realDt);
    // critically-damped spring for zoom punch
    const k = c.zoomReturn;
    this.zoomVel += (-this.zoom * k * k - this.zoomVel * 2 * k) * realDt;
    this.zoom += this.zoomVel * realDt;
    this.kick.multiplyScalar(Math.exp(-10 * realDt));
    const s = this.trauma * this.trauma, f = c.shakeFreq, t = this.t;
    const nx = Math.sin(t * f * 1.1) * 0.6 + Math.sin(t * f * 2.3 + 1.7) * 0.4;
    const ny = Math.sin(t * f * 1.3 + 4.1) * 0.6 + Math.sin(t * f * 2.9 + 0.3) * 0.4;
    const nr = Math.sin(t * f * 0.9 + 2.2);
    const cam = this.camera;
    cam.position.copy(this.basePos).add(this.follow).add(this.kick);
    cam.position.x += nx * s * c.shakeAmp; cam.position.y += ny * s * c.shakeAmp;
    cam.lookAt(this.lookAt.x + this.follow.x * 0.5, this.lookAt.y, this.lookAt.z);
    cam.rotateZ(nr * s * c.shakeRoll);
    const fov = this.baseFov + this.zoom;
    if (Math.abs(cam.fov - fov) > 0.001) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
}

// ------------------------------------------------------------ particles -----
const PVERT = `
attribute float aSize; attribute vec4 aColor; varying vec4 vColor;
uniform float uScale;
void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
varying vec4 vColor;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vColor.rgb * (0.6 + a), vColor.a * a); }`;

export class Particles {
  constructor(scene, max = CONFIG.fx.maxParticles, blending = THREE.AdditiveBlending) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 3); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending, uniforms: { uScale: { value: 300 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.geo = g;
    scene.add(this.points);
  }
  setScale(h) { this.mat.uniforms.uScale.value = h * 0.9; }
  spawn(p, v, color, size, life, grav = CONFIG.fx.sparkGravity, drag = 1.5) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.base.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  // burst of sparks at a contact point; dir = slash direction (world) to bias the spray
  burst(p, count, { color = new THREE.Color(1, 0.75, 0.35), dir = null, speed = CONFIG.fx.sparkSpeed, size = 0.09, life = CONFIG.fx.sparkLife, spread = 1, grav } = {}) {
    const v = new THREE.Vector3(), c = new THREE.Color();
    for (let k = 0; k < count; k++) {
      v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(spread);
      if (dir) v.addScaledVector(dir, 0.9);
      v.z += 0.5; // toward camera
      v.normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.9));
      c.copy(color).offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.3) * 0.2);
      this.spawn(p, v, c, size * (0.6 + Math.random() * 0.9), life * (0.5 + Math.random() * 0.8), grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        // swap-remove
        const j = --this.n;
        if (i !== j) {
          for (let a = 0; a < 3; a++) { this.pos[i*3+a] = this.pos[j*3+a]; this.vel[i*3+a] = this.vel[j*3+a]; this.base[i*3+a] = this.base[j*3+a]; }
          this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
        }
        i--; continue;
      }
      this.life[i] -= dt;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i*3] *= dr; this.vel[i*3+2] *= dr; this.vel[i*3+1] = this.vel[i*3+1] * dr - this.grav[i] * dt;
      this.pos[i*3] += this.vel[i*3] * dt; this.pos[i*3+1] += this.vel[i*3+1] * dt; this.pos[i*3+2] += this.vel[i*3+2] * dt;
      if (this.pos[i*3+1] < 0.02) { this.pos[i*3+1] = 0.02; this.vel[i*3+1] *= -0.3; }
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i*4] = this.base[i*3]; this.col[i*4+1] = this.base[i*3+1] * (0.4 + 0.6 * k); this.col[i*4+2] = this.base[i*3+2] * k; this.col[i*4+3] = k;
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
}

// ------------------------------------------------------------ blade trail ---
// Ribbon between blade base & tip samples, fading with age.
export class BladeTrail {
  constructor(scene, color = 0x99bbff, segs = 24) {
    this.segs = segs; this.samples = []; this.life = CONFIG.fx.swordTrailLife;
    const g = new THREE.BufferGeometry();
    this.posArr = new Float32Array(segs * 2 * 3); this.alphaArr = new Float32Array(segs * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphaArr, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(mix(uColor, vec3(1.0), vA*vA*0.6), vA*vA*0.9);} `,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.geo = g;
    scene.add(this.mesh);
  }
  setColor(c) { this.mat.uniforms.uColor.value.set(c); }
  add(base, tip, t) { this.samples.push({ b: base.clone(), t: tip.clone(), time: t }); if (this.samples.length > this.segs) this.samples.shift(); }
  update(now) {
    while (this.samples.length && now - this.samples[0].time > this.life) this.samples.shift();
    const n = this.samples.length;
    for (let i = 0; i < this.segs; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      if (!s) { this.alphaArr[i*2] = this.alphaArr[i*2+1] = 0; continue; }
      const a = i < n ? Math.max(0, 1 - (now - s.time) / this.life) : 0;
      this.posArr.set([s.b.x, s.b.y, s.b.z], i * 6); this.posArr.set([s.t.x, s.t.y, s.t.z], i * 6 + 3);
      this.alphaArr[i*2] = a * 0.15; this.alphaArr[i*2+1] = a;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

// ---------------------------------------------------- 2D finger swipe trail -
export class SwipeTrail {
  constructor(canvas) { this.c = canvas; this.g = canvas.getContext('2d'); this.pts = []; this.dpr = 1; }
  resize(w, h, dpr) { this.dpr = dpr; this.c.width = w * dpr; this.c.height = h * dpr; this.c.style.width = w + 'px'; this.c.style.height = h + 'px'; }
  add(x, y, t, stroke) { this.pts.push({ x, y, t, stroke }); }
  draw(now) {
    const g = this.g, life = CONFIG.swipe.trailLife * 1000;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.c.width, this.c.height);
    this.pts = this.pts.filter(p => now - p.t < life);
    g.lineCap = 'round';
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      if (a.stroke !== b.stroke) continue;
      const k = 1 - (now - b.t) / life;
      g.strokeStyle = `rgba(140,190,255,${0.35 * k})`; g.lineWidth = 22 * k;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.95 * k})`; g.lineWidth = 6 * k;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
  }
}

// ------------------------------------------------------- damage numbers -----
export class DamageNumbers {
  constructor(layer, camera) { this.layer = layer; this.camera = camera; this.v = new THREE.Vector3(); }
  show(worldPos, text, cls = '') {
    this.v.copy(worldPos).project(this.camera);
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth, y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = 'dmg ' + cls; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.setProperty('--dx', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
    el.style.animationDuration = CONFIG.fx.damageNumberTime + 's';
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), CONFIG.fx.damageNumberTime * 1000 + 50);
  }
}

// ------------------------------------------------------- shockwave rings ----
export class Rings {
  constructor(scene) { this.scene = scene; this.list = []; this.geo = new THREE.RingGeometry(0.8, 1, 48); }
  spawn(pos, color = 0xffd080, maxR = 4, life = 0.45, vertical = false) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos); if (!vertical) m.rotation.x = -Math.PI / 2;
    this.scene.add(m); this.list.push({ m, t: 0, life, maxR });
  }
  update(dt) {
    this.list = this.list.filter(r => {
      r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); return false; }
      const s = 0.2 + (1 - Math.pow(1 - k, 3)) * r.maxR; r.m.scale.set(s, s, s); r.m.material.opacity = 1 - k; return true;
    });
  }
}

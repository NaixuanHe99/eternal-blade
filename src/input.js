// Low-latency swipe input. A slash fires DURING the stroke as soon as it is long
// enough (no waiting for finger-up). Direction comes from the stroke itself,
// speed (px/ms, screen-normalised) is reported for damage scaling.
import { CONFIG } from './config.js';

export class SwipeInput {
  constructor(el, { onSwipe, onPoint, onDown }) {
    this.el = el; this.onSwipe = onSwipe; this.onPoint = onPoint; this.onDown = onDown;
    this.active = null; this.strokeId = 0;
    el.addEventListener('pointerdown', (e) => this.down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this.up(e), { passive: false });
  }
  scale() { return Math.min(window.innerWidth, window.innerHeight); }
  down(e) {
    e.preventDefault();
    if (this.active) return; // single swiping pointer; buttons are separate elements
    this.onDown && this.onDown();
    const t = performance.now();
    this.active = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: t, x: e.clientX, y: e.clientY, fired: false, stroke: ++this.strokeId, samples: [{ x: e.clientX, y: e.clientY, t }] };
    this.onPoint && this.onPoint(e.clientX, e.clientY, t, this.active.stroke);
  }
  move(e) {
    const a = this.active; if (!a || e.pointerId !== a.id) return;
    e.preventDefault();
    // use coalesced events for a smoother path / earlier detection
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const t = ev.timeStamp || performance.now();
      a.x = ev.clientX; a.y = ev.clientY; a.samples.push({ x: a.x, y: a.y, t });
      this.onPoint && this.onPoint(a.x, a.y, performance.now(), a.stroke);
    }
    if (a.samples.length > 40) a.samples.splice(0, a.samples.length - 40);
    const dist = Math.hypot(a.x - a.x0, a.y - a.y0);
    if (!a.fired && dist >= CONFIG.swipe.commitDistFrac * this.scale()) {
      const dx = (a.x - a.x0) / dist, dy = (a.y - a.y0) / dist;
      // same direction as the slash just fired in this stroke → slide origin, don't re-fire
      if (a.lastDir && dx * a.lastDir.x + dy * a.lastDir.y > 0.3) { a.x0 = a.x; a.y0 = a.y; a.samples = a.samples.slice(-4); }
      else this.fire(a);
    }
  }
  up(e) {
    const a = this.active; if (!a || e.pointerId !== a.id) return;
    const dist = Math.hypot(a.x - a.x0, a.y - a.y0);
    if (!a.fired && !a.lastDir && dist >= CONFIG.swipe.minDistFrac * this.scale()) this.fire(a);
    this.active = null;
  }
  fire(a) {
    a.fired = true;
    const dx = a.x - a.x0, dy = a.y - a.y0, len = Math.hypot(dx, dy) || 1;
    // speed from the recent part of the stroke (last ~80ms) normalised to an 800px screen
    const now = a.samples[a.samples.length - 1];
    let old = a.samples[0];
    for (let i = a.samples.length - 1; i >= 0; i--) { if (now.t - a.samples[i].t > 80) { old = a.samples[i]; break; } }
    const dt = Math.max(8, now.t - old.t);
    const speed = (Math.hypot(now.x - old.x, now.y - old.y) / dt) * (800 / this.scale());
    const s = CONFIG.swipe;
    const mul = Math.min(s.maxSpeedMul, Math.max(s.minSpeedMul, speed / s.refSpeed));
    this.onSwipe({ x: dx / len, y: dy / len, speed, mul });
    // allow a second slash in the same stroke if the finger keeps going (zig-zag combos)
    a.lastDir = { x: dx / len, y: dy / len };
    a.x0 = a.x; a.y0 = a.y; a.fired = false; a.samples = [now];
  }
}

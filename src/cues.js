// "Swipe this way" parry cue: animated chevrons flowing along the direction the
// PLAYER must swipe. Drawn on its own 2D canvas; only one cue is ever shown.
import { CONFIG } from './config.js';

const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export class ParryCue {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.dpr = 1; this.w = 1; this.h = 1;
    this.dir = { x: 1, y: 0 }; this.phase = null; this.alpha = 0; this.nowK = 0; this.t = 0; this.label = '';
  }
  resize(w, h, dpr) { this.w = w; this.h = h; this.dpr = dpr; this.c.width = w * dpr; this.c.height = h * dpr; this.c.style.width = w + 'px'; this.c.style.height = h + 'px'; }
  // phase: null | 'ready' | 'now' | 'demo'
  set(dir, phase, label = '') {
    if (phase && dir) { this.dir = dir; }
    if (phase !== this.phase && phase === 'now') this.t = 0;
    this.phase = phase; this.label = label;
  }
  draw(realDt) {
    const C = CONFIG.cues, g = this.g;
    this.t += realDt;
    const target = this.phase ? (this.phase === 'ready' ? 0.55 : 1) : 0;
    this.alpha += (target - this.alpha) * Math.min(1, realDt * (this.phase ? 14 : 10));
    this.nowK += ((this.phase === 'now' ? 1 : 0) - this.nowK) * Math.min(1, realDt * 20);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (this.alpha < 0.01) return;
    const m = Math.min(this.w, this.h), L = m * C.lengthFrac * (1 + this.nowK * 0.12);
    const cx = this.w / 2, cy = this.h * C.centerY, d = this.dir;
    const len = Math.hypot(d.x, d.y) || 1, ux = d.x / len, uy = d.y / len, px = -uy, py = ux;
    const x0 = cx - ux * L / 2, y0 = cy - uy * L / 2, x1 = cx + ux * L / 2, y1 = cy + uy * L / 2;
    const ready = hexToRgb(C.readyColor), now = hexToRgb(C.nowColor);
    const col = this.phase === 'demo' ? [255, 255, 255] : ready.map((v, i) => Math.round(v + (now[i] - v) * this.nowK));
    const rgba = (a) => `rgba(${col[0]},${col[1]},${col[2]},${(a * this.alpha).toFixed(3)})`;
    const pulse = this.nowK > 0.5 ? 0.75 + 0.25 * Math.sin(this.t * 28) : 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // glowing track
    g.shadowColor = rgba(1); g.shadowBlur = 18 + 14 * this.nowK;
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, rgba(0)); grad.addColorStop(0.25, rgba(0.25)); grad.addColorStop(1, rgba(0.55 * pulse));
    g.strokeStyle = grad; g.lineWidth = m * 0.035; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    // flowing chevrons
    const n = C.chevrons, cs = m * (0.055 + 0.015 * this.nowK);
    for (let i = 0; i < n; i++) {
      const s = ((i / n) + this.t * C.flowSpeed * (this.phase === 'now' ? 1.5 : 1)) % 1;
      const a = Math.min(1, s * 4) * Math.min(1, (1 - s) * 3);
      const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s;
      g.strokeStyle = rgba(a * pulse); g.lineWidth = m * 0.022;
      g.beginPath();
      g.moveTo(x - ux * cs + px * cs, y - uy * cs + py * cs); g.lineTo(x, y); g.lineTo(x - ux * cs - px * cs, y - uy * cs - py * cs);
      g.stroke();
    }
    // arrow head
    const hs = m * 0.085 * (1 + 0.15 * this.nowK);
    g.fillStyle = rgba(pulse);
    g.beginPath(); g.moveTo(x1 + ux * hs * 0.6, y1 + uy * hs * 0.6);
    g.lineTo(x1 - ux * hs * 0.6 + px * hs * 0.75, y1 - uy * hs * 0.6 + py * hs * 0.75);
    g.lineTo(x1 - ux * hs * 0.2, y1 - uy * hs * 0.2);
    g.lineTo(x1 - ux * hs * 0.6 - px * hs * 0.75, y1 - uy * hs * 0.6 - py * hs * 0.75); g.closePath(); g.fill();
    // start dot (where the finger goes)
    g.beginPath(); g.arc(x0, y0, m * (0.022 + 0.008 * Math.sin(this.t * 10)), 0, Math.PI * 2); g.fillStyle = rgba(0.8); g.fill();
    // one short label beside the tail
    g.shadowBlur = 6; g.shadowColor = 'rgba(0,0,0,0.9)';
    const text = this.label || (this.phase === 'now' ? '招架！NOW' : this.phase === 'ready' ? '准备招架' : '');
    if (text) {
      g.font = `900 ${Math.round(m * (0.05 + 0.012 * this.nowK))}px Georgia, "Songti SC", "Noto Serif SC", serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const off = m * 0.11, sgn = py > 0.3 || Math.abs(py) <= 0.3 ? 1 : -1; // put text below horizontal tracks
      const horiz = Math.abs(ux) > 0.7;
      const lx = horiz ? cx : cx + m * 0.08, ly = horiz ? cy + off * sgn : cy;
      g.textAlign = horiz ? 'center' : 'left';
      g.fillStyle = rgba(1); g.fillText(text, lx, ly);
    }
    g.shadowBlur = 0;
  }
}

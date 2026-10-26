// Procedural WebAudio sound effects — no audio files.
import { CONFIG } from './config.js';

let ctx = null, master = null, comp = null, noiseBuf = null, verb = null;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = CONFIG.audio.master;
  master.connect(comp); comp.connect(ctx.destination);
  // white noise buffer
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // cheap "hall" reverb: feedback delay network
  verb = ctx.createGain(); verb.gain.value = 0.28;
  const d1 = ctx.createDelay(); d1.delayTime.value = 0.087;
  const d2 = ctx.createDelay(); d2.delayTime.value = 0.131;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  verb.connect(d1); d1.connect(d2); d2.connect(lp); lp.connect(fb); fb.connect(d1); lp.connect(master);
}

const now = () => ctx.currentTime;

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function noise(t, dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, peak = 0.5, a = 0.005, rev = 0 } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, peak, dur);
  src.connect(f); f.connect(g); g.connect(master); if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(verb); }
  src.start(t, Math.random() * 0.5); src.stop(t + a + dur + 0.05);
}

function tone(t, dur, { type = 'sine', f0 = 440, f1 = f0, peak = 0.3, a = 0.003, rev = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, peak, dur);
  o.connect(g); g.connect(master); if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(verb); }
  o.start(t); o.stop(t + a + dur + 0.05);
}

// metallic ring: inharmonic partials
function metal(t, base, dur, peak, rev = 0.6) {
  const ratios = [1, 2.76, 5.4, 8.93, 13.3];
  ratios.forEach((r, i) => tone(t, dur / (1 + i * 0.5), { f0: base * r * (1 + (Math.random() - 0.5) * 0.01), f1: base * r * 0.995, peak: peak / (1 + i * 0.8), rev }));
}

export const sfx = {
  whoosh(strength = 1) {
    if (!ctx) return; const t = now();
    noise(t, 0.16 + 0.06 * strength, { f0: 500 + 300 * strength, f1: 2600 + 1600 * strength, q: 1.4, peak: 0.12 + 0.12 * strength, a: 0.03 });
  },
  hit(strength = 1) { // flesh/stone thud + slice
    if (!ctx) return; const t = now();
    tone(t, 0.18 + 0.08 * strength, { f0: 150 + 40 * strength, f1: 45, peak: 0.55 + 0.25 * strength });
    noise(t, 0.09, { type: 'highpass', f0: 2500, f1: 1200, peak: 0.35 * strength + 0.2 });
    noise(t + 0.005, 0.22, { type: 'lowpass', f0: 900, f1: 120, peak: 0.45, rev: 0.3 });
  },
  crit() {
    if (!ctx) return; const t = now();
    this.hit(1.6); metal(t, 620, 0.5, 0.18, 0.5);
    tone(t, 0.35, { type: 'triangle', f0: 90, f1: 35, peak: 0.6 });
  },
  clang(strength = 1) { // blade on weapon / guarded
    if (!ctx) return; const t = now();
    noise(t, 0.05, { type: 'highpass', f0: 3000, peak: 0.5 });
    metal(t, 380 + Math.random() * 120, 0.55 * strength, 0.22 * strength);
  },
  block() { // shield
    if (!ctx) return; const t = now();
    tone(t, 0.22, { f0: 110, f1: 50, peak: 0.7 });
    noise(t, 0.12, { type: 'bandpass', f0: 1800, f1: 600, q: 0.8, peak: 0.5 });
    metal(t, 240, 0.45, 0.2, 0.4);
  },
  parry() { // big ringing clang + boom
    if (!ctx) return; const t = now();
    noise(t, 0.06, { type: 'highpass', f0: 4000, peak: 0.7 });
    metal(t, 520, 1.4, 0.32, 1.0);
    metal(t + 0.01, 780, 1.0, 0.15, 1.0);
    tone(t, 0.6, { type: 'sine', f0: 80, f1: 30, peak: 0.8 });
    noise(t + 0.02, 0.9, { f0: 6000, f1: 1500, q: 0.5, peak: 0.12, rev: 0.8 });
  },
  hurt() {
    if (!ctx) return; const t = now();
    tone(t, 0.35, { type: 'sine', f0: 95, f1: 32, peak: 0.9 });
    noise(t, 0.25, { type: 'lowpass', f0: 700, f1: 90, peak: 0.6 });
  },
  windup(heavy = false) {
    if (!ctx) return; const t = now();
    tone(t, 0.5, { type: 'sawtooth', f0: heavy ? 55 : 70, f1: heavy ? 110 : 120, peak: heavy ? 0.12 : 0.06, a: 0.15 });
    if (heavy) noise(t, 0.6, { f0: 200, f1: 900, q: 2, peak: 0.15, a: 0.2 });
  },
  enemyWhoosh(heavy = false) {
    if (!ctx) return; const t = now();
    noise(t, 0.3, { f0: 250, f1: heavy ? 900 : 1500, q: 1.1, peak: heavy ? 0.4 : 0.28, a: 0.04 });
  },
  slam() {
    if (!ctx) return; const t = now();
    tone(t, 0.7, { f0: 70, f1: 25, peak: 1.0 });
    noise(t, 0.6, { type: 'lowpass', f0: 600, f1: 60, peak: 0.8, rev: 0.5 });
  },
  dodge() { if (!ctx) return; noise(now(), 0.18, { f0: 900, f1: 300, q: 1, peak: 0.16, a: 0.02 }); },
  magic(kind = 'lightning') {
    if (!ctx) return; const t = now();
    if (kind === 'heal') {
      tone(t, 0.45, { type: 'sine', f0: 520, f1: 880, peak: 0.18, rev: 0.5 });
      tone(t + 0.08, 0.5, { type: 'triangle', f0: 660, f1: 990, peak: 0.12, rev: 0.4 });
      return;
    }
    if (kind === 'ice') {
      noise(t, 0.2, { type: 'highpass', f0: 3000, f1: 6000, peak: 0.25 });
      tone(t, 0.7, { type: 'sine', f0: 1400, f1: 420, peak: 0.16, rev: 0.6 });
      tone(t, 0.5, { f0: 220, f1: 70, peak: 0.45 });
      return;
    }
    if (kind === 'fire') {
      noise(t, 0.45, { type: 'lowpass', f0: 400, f1: 80, peak: 0.7, rev: 0.4 });
      noise(t, 0.25, { type: 'bandpass', f0: 900, f1: 1800, q: 0.7, peak: 0.35 });
      tone(t, 0.4, { f0: 90, f1: 40, peak: 0.6 });
      return;
    }
    noise(t, 0.08, { type: 'highpass', f0: 5000, peak: 0.8 });
    tone(t, 1.1, { type: 'sawtooth', f0: 1200, f1: 40, peak: 0.25, rev: 0.8 });
    tone(t, 0.9, { f0: 60, f1: 22, peak: 1.0 });
    noise(t + 0.03, 1.2, { type: 'lowpass', f0: 3000, f1: 80, peak: 0.7, rev: 0.9 });
  },
  rebirth() {
    if (!ctx) return; const t = now();
    [196, 247, 294, 392, 494].forEach((f, i) => tone(t + i * 0.14, 0.7, { type: 'triangle', f0: f, peak: 0.18, rev: 0.7 }));
  },
  victory() {
    if (!ctx) return; const t = now();
    [262, 330, 392, 523].forEach((f, i) => tone(t + i * 0.12, 0.6, { type: 'triangle', f0: f, peak: 0.2, rev: 0.6 }));
  },
  defeat() {
    if (!ctx) return; const t = now();
    [220, 196, 165, 131].forEach((f, i) => tone(t + i * 0.22, 0.8, { type: 'triangle', f0: f, f1: f * 0.98, peak: 0.18, rev: 0.7 }));
  },
  ping(danger = false) { // parry/dodge window opens — short bright "ting"
    if (!ctx) return; const t = now();
    tone(t, 0.18, { type: 'sine', f0: danger ? 1320 : 1760, f1: danger ? 1250 : 1700, peak: 0.16, rev: 0.4 });
    tone(t, 0.12, { type: 'triangle', f0: danger ? 660 : 2640, peak: 0.06 });
  },
  hint() { if (!ctx) return; const t = now(); tone(t, 0.25, { type: 'triangle', f0: 660, f1: 990, peak: 0.12, rev: 0.5 }); },
  ui() { if (!ctx) return; tone(now(), 0.08, { type: 'triangle', f0: 880, f1: 660, peak: 0.12 }); },
};

export function vibrate(pattern) {
  if (!CONFIG.haptics.enabled || !pattern || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (_) { /* ignore */ }
}

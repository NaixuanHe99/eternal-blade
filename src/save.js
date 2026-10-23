// Persistent progression (localStorage). Survives rebirth: level, stats, gold, swords.
const KEY = 'eternal-blade-save-v1';
export const DEFAULT_SAVE = () => ({ level: 1, xp: 0, gold: 0, points: 0, stats: { hp: 0, atk: 0, shield: 0, magic: 0 },
  swords: ['iron'], equipped: 'iron', bloodline: 1, stage: 0, kills: 0 });
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.stats) return { ...DEFAULT_SAVE(), ...s }; } catch (_) { /* ignore */ }
  return DEFAULT_SAVE();
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* ignore */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ } }

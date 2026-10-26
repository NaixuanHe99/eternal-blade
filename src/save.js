// Persistent progression (localStorage). Gear, level and bloodline survive a castle clear.
import { CONFIG } from './config.js';
import { starterSword, legacySword, SLOTS } from './loot.js';
import { positionFromLinear } from './progress.js';

const KEY = 'eternal-blade-save-v1';

export function blankSave() {
  return {
    level: 1, xp: 0, gold: 0, points: 0,
    stats: { hp: 0, atk: 0, shield: 0, magic: 0 },
    bloodline: 1, floor: 0, room: 0, kills: 0, tutorialDone: false,
    inventory: [], equipped: { sword: null, shield: null, armor: null, helmet: null },
    spell: 'lightning',
  };
}

export function newGameSave() {
  const s = blankSave();
  const sword = starterSword();
  s.inventory = [sword];
  s.equipped.sword = sword.id;
  return s;
}

function normalize(raw) {
  const d = blankSave();
  const s = { ...d, ...raw, stats: { ...d.stats, ...(raw.stats || {}) } };
  if (!Array.isArray(s.inventory)) s.inventory = [];
  const equippedWasString = typeof raw.equipped === 'string';
  if (!s.equipped || typeof s.equipped !== 'object' || Array.isArray(s.equipped)) {
    s.equipped = { sword: null, shield: null, armor: null, helmet: null };
  }
  for (const slot of SLOTS) if (s.equipped[slot] === undefined) s.equipped[slot] = null;

  if (equippedWasString || (Array.isArray(raw.swords) && s.inventory.length === 0)) {
    const sword = starterSword();
    s.inventory = [sword];
    if (Array.isArray(raw.swords)) {
      for (const id of raw.swords) {
        const legacy = legacySword(id);
        if (legacy && !s.inventory.some((it) => it.id === legacy.id)) s.inventory.push(legacy);
      }
    }
    const want = equippedWasString ? legacySword(raw.equipped) : null;
    s.equipped = { sword: want ? want.id : sword.id, shield: null, armor: null, helmet: null };
  }

  if (!s.inventory.some((it) => it && it.id === s.equipped.sword) && !s.equipped.sword) {
    if (!s.inventory.length) {
      const sword = starterSword();
      s.inventory.push(sword);
      s.equipped.sword = sword.id;
    }
  }
  // Drop dangling equip pointers.
  for (const slot of SLOTS) {
    const id = s.equipped[slot];
    if (id && !s.inventory.some((it) => it && it.id === id)) s.equipped[slot] = null;
  }
  if (typeof s.floor !== 'number' || typeof s.room !== 'number') {
    const pos = positionFromLinear(raw.stage || 0);
    s.floor = pos.floor; s.room = pos.room;
  }
  s.floor = Math.max(0, Math.min(CONFIG.floors.length - 1, s.floor | 0));
  const rooms = CONFIG.floors[s.floor].rooms.length;
  s.room = Math.max(0, Math.min(rooms - 1, s.room | 0));
  if (!CONFIG.spells[s.spell]) s.spell = 'lightning';
  delete s.swords;
  return s;
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.stats) return normalize(s);
  } catch (_) { /* ignore */ }
  return newGameSave();
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* ignore */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ } }

// Back-compat name used by the UI reset path.
export const DEFAULT_SAVE = newGameSave;

// Gear generation: Sword / Shield / Armor / Helmet, Common → Legendary.
// Original names only. No DOM.
import { CONFIG, RARITIES, RARITY_LABEL, SLOT_LABEL, ELEMENT_LABEL } from './config.js';

export const SLOTS = ['sword', 'shield', 'armor', 'helmet'];
const ELEMENTS = ['fire', 'ice', 'lightning'];

const BUDGET = {
  common: [4, 7],
  uncommon: [8, 12],
  rare: [13, 18],
  epic: [19, 26],
  legendary: [27, 36],
};
// How a slot prefers to spend its budget. Primary stat lands largest.
const BIAS = {
  sword:  { atk: 1.0, def: 0.12, hp: 0.08, crit: 0.62, magic: 0.2 },
  shield: { atk: 0.08, def: 1.0, hp: 0.5, crit: 0.05, magic: 0.12 },
  armor:  { atk: 0.12, def: 0.72, hp: 1.0, crit: 0.05, magic: 0.16 },
  helmet: { atk: 0.16, def: 0.36, hp: 0.4, crit: 0.32, magic: 1.0 },
};
// Budget points → real combat stats.
const MULT = { atk: 1, def: 1, hp: 4, crit: 0.01, magic: 0.02 };

const WEIGHTS = {
  normal: [52, 28, 14, 5, 1],
  boss: [0, 10, 40, 34, 16],
};
const SELL = { common: 18, uncommon: 45, rare: 100, epic: 200, legendary: 420 };
const EL_PREFIX = { fire: '炎·', ice: '霜·', lightning: '雷·' };
const RARITY_HEX = { common: 0xc8ccd4, uncommon: 0x8fd9a0, rare: 0x8ec2ff, epic: 0xd2a6ff, legendary: 0xffd27a };
const RARITY_GLOW = { common: 0x9aa4b8, uncommon: 0x3ecf6a, rare: 0x3aa0ff, epic: 0xb45cff, legendary: 0xffb020 };
const ELEMENT_TINT = { fire: 0xff5a1a, ice: 0x7fd8ff, lightning: 0xdde8ff };

const NAMES = {
  sword: {
    common: ['旧铁剑', '门卫佩剑', '短刃'],
    uncommon: ['淬火剑', '灰钢刃', '巡夜剑'],
    rare: ['裂风长剑', '城垣刃', '潮鸣剑'],
    epic: ['暮焰斩', '星屑刃', '断潮'],
    legendary: ['永昼', '星陨之锋', '空座遗刃'],
  },
  shield: {
    common: ['木盾', '旧圆盾', '门板盾'],
    uncommon: ['铁环盾', '灰钢圆盾', '巡卫盾'],
    rare: ['城纹盾', '藤纹盾', '烛火盾'],
    epic: ['君印盾', '霜壁', '断浪盾'],
    legendary: ['永守', '王座残盾', '昼辉壁'],
  },
  armor: {
    common: ['皮甲', '锁子旧甲', '布衬甲'],
    uncommon: ['淬火胸甲', '巡卫板甲', '灰钢甲'],
    rare: ['城垣胸甲', '厅堂板甲', '藤纹甲'],
    epic: ['君卫胸甲', '烬核甲', '咏者法袍'],
    legendary: ['灰冠胸甲', '永夜铠', '星座铠'],
  },
  helmet: {
    common: ['铁盔', '皮帽', '旧面甲'],
    uncommon: ['淬火盔', '巡夜盔', '灰钢盔'],
    rare: ['城纹盔', '咏者兜', '烛火盔'],
    epic: ['君印冠盔', '影刃面甲', '霜冠'],
    legendary: ['灰冠', '永昼冠', '空座冠'],
  },
};

let seq = 1;

export function pickRarity(boss, minRarity, rng = Math.random) {
  const w = (boss ? WEIGHTS.boss : WEIGHTS.normal).slice();
  const minI = Math.max(0, RARITIES.indexOf(minRarity || 'common'));
  for (let i = 0; i < minI; i++) w[i] = 0;
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return RARITIES[minI] || 'common';
  let r = rng() * sum;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return RARITIES[i];
  }
  return RARITIES[RARITIES.length - 1];
}

export function rollStats(slot, rarity, rng = Math.random) {
  const [lo, hi] = BUDGET[rarity] || BUDGET.common;
  const budget = lo + Math.floor(rng() * (hi - lo + 1));
  const bias = BIAS[slot] || BIAS.sword;
  const keys = ['atk', 'def', 'hp', 'crit', 'magic'];
  let wsum = 0;
  for (const k of keys) wsum += bias[k];
  const raw = {};
  let used = 0;
  for (const k of keys) {
    const portion = budget * (bias[k] / wsum);
    const jitter = portion * (0.85 + rng() * 0.3);
    raw[k] = jitter;
    used += jitter;
  }
  const scale = used > 0 ? budget / used : 1;
  const out = {};
  for (const k of keys) {
    const pts = Math.round(raw[k] * scale);
    out[k] = k === 'crit' || k === 'magic' ? pts * MULT[k] : pts * MULT[k];
  }
  const primary = keys.reduce((a, k) => (bias[k] > bias[a] ? k : a), keys[0]);
  if (out[primary] <= 0) out[primary] = MULT[primary];
  return out;
}

export function makeItem(slot, rarity, rng = Math.random) {
  const names = (NAMES[slot] && NAMES[slot][rarity]) || NAMES.sword.common;
  const elementChance = slot === 'sword' ? 0.62 : 0.28;
  const element = rng() < elementChance ? ELEMENTS[Math.floor(rng() * ELEMENTS.length)] : null;
  const stats = rollStats(slot, rarity, rng);
  const base = names[Math.floor(rng() * names.length)];
  const tint = element ? ELEMENT_TINT[element] : RARITY_HEX[rarity];
  return {
    id: `it_${(seq++).toString(36)}_${Math.floor(rng() * 1e9).toString(36)}`,
    slot, rarity, element,
    name: `${element ? EL_PREFIX[element] : ''}${base}`,
    ...stats,
    color: tint,
    glow: element ? ELEMENT_TINT[element] : RARITY_GLOW[rarity],
  };
}

export function starterSword() {
  return {
    id: 'starter-iron', slot: 'sword', rarity: 'common', element: null,
    name: '门卫铁剑', atk: 2, def: 0, hp: 0, crit: 0.04, magic: 0,
    color: 0xc8ccd4, glow: 0x88aaff,
  };
}

/** Fixed legacy shop swords so old saves keep something in the bag. */
export function legacySword(id) {
  const table = {
    steel:   { name: '精钢剑', rarity: 'uncommon', atk: 5, crit: 0.08, color: 0xe4e8f0, glow: 0xaad4ff },
    ember:   { name: '余烬之刃', rarity: 'rare', atk: 11, crit: 0.1, element: 'fire', color: 0xff8a4a, glow: 0xff5a1a },
    frost:   { name: '霜牙', rarity: 'epic', atk: 16, crit: 0.12, element: 'ice', color: 0x9fe6ff, glow: 0x40c8ff },
    eclipse: { name: '蚀月', rarity: 'legendary', atk: 22, crit: 0.16, element: 'lightning', color: 0xb98cff, glow: 0xa040ff },
  };
  const t = table[id];
  if (!t) return null;
  return {
    id: `legacy-${id}`, slot: 'sword', rarity: t.rarity, element: t.element || null,
    name: t.name, atk: t.atk, def: 0, hp: 0, crit: t.crit, magic: 0, color: t.color, glow: t.glow,
  };
}

export function rollLoot(def, rng = Math.random) {
  const chance = def && typeof def.drop === 'number' ? def.drop : 0.4;
  if (rng() > chance) return null;
  const rarity = pickRarity(!!def.boss, def.minRarity, rng);
  const slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  return makeItem(slot, rarity, rng);
}

export function sellValue(item) {
  if (!item) return 0;
  const base = SELL[item.rarity] || SELL.common;
  const extra = Math.round((item.atk || 0) * 2 + (item.def || 0) * 2 + (item.hp || 0) * 0.4);
  return base + extra;
}

export function elementMul(element, def) {
  if (!element || element === 'heal' || !def) return 1;
  if (def.weak === element) return 1.5;
  if (def.resist === element) return 0.55;
  return 1;
}

export function formatStats(item) {
  if (!item) return '';
  const bits = [];
  if (item.atk) bits.push(`攻击 +${item.atk}`);
  if (item.def) bits.push(`防御 +${item.def}`);
  if (item.hp) bits.push(`生命 +${item.hp}`);
  if (item.crit) bits.push(`暴击 ${Math.round(item.crit * 100)}%`);
  if (item.magic) bits.push(`魔力 +${Math.round(item.magic * 100)}%`);
  if (item.element) bits.push(ELEMENT_LABEL[item.element] || item.element);
  return bits.join(' · ') || '无加成';
}

export function rarityLabel(r) { return RARITY_LABEL[r] || r; }
export function slotLabel(s) { return SLOT_LABEL[s] || s; }

export function describeEnemyTags(def) {
  if (!def) return '';
  const bits = [];
  if (def.weak) bits.push(`弱点 ${ELEMENT_LABEL[def.weak] || def.weak}`);
  if (def.resist) bits.push(`抵抗 ${ELEMENT_LABEL[def.resist] || def.resist}`);
  if (def.boss) bits.push('头目');
  return bits.join(' · ');
}

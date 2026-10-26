// Pure checks for the castle loop, loot and procedural enemy rigs. No browser.
import * as THREE from 'three';
import { CONFIG } from '../src/config.js';
import { peekAdvance, fightScale, enemyAt } from '../src/progress.js';
import { makeItem, rollLoot, pickRarity, elementMul, sellValue, starterSword } from '../src/loot.js';
import { Enemy, Player } from '../src/characters.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); failed++; }
  else console.log('ok', msg);
}

const gateBoss = peekAdvance({ floor: 0, room: 2 });
assert(gateBoss.kind === 'floor' && gateBoss.floor === 1 && gateBoss.room === 0, 'clearing the gate boss opens the courtyard');
const still = { floor: 0, room: 2 };
peekAdvance(still);
assert(still.room === 2 && still.floor === 0, 'peekAdvance does not mutate the save');

const throne = peekAdvance({ floor: 3, room: CONFIG.floors[3].rooms.length - 1 });
assert(throne.kind === 'castle' && throne.floor === 0 && throne.room === 0, 'last throne room clears the castle');
const mid = peekAdvance({ floor: 2, room: 1 });
assert(mid.kind === 'room' && mid.floor === 2 && mid.room === 2, 'room advance stays on the same floor');

const arch = new Set(Object.values(CONFIG.enemies).map((e) => e.archetype));
assert(arch.size >= 8, `at least 8 archetypes (got ${arch.size}: ${[...arch].join(', ')})`);
assert(CONFIG.floors.length === 4, 'four castle floors');
assert(CONFIG.floors.every((f) => {
  const boss = CONFIG.enemies[f.rooms[f.rooms.length - 1]];
  return boss && boss.boss && boss.patterns2 && boss.patterns2.length && boss.intro;
}), 'each floor ends on a boss with phase-2 patterns and an intro');
assert(Object.keys(CONFIG.spells).length >= 4, 'four god-powers');
assert(CONFIG.spells.lightning.cost === CONFIG.magic.max, 'lightning still spends a full magic bar');
assert(CONFIG.spells.heal.heal > 0 && CONFIG.spells.fire.burnTicks > 0 && CONFIG.spells.ice.stagger > CONFIG.spells.fire.stagger, 'heal, burn and a longer ice stagger exist');

const low = fightScale({ bloodline: 1, floor: 0, room: 0 });
const blood = fightScale({ bloodline: 3, floor: 0, room: 0 });
const deep = fightScale({ bloodline: 1, floor: 3, room: 2 });
assert(blood > low && deep > low, 'bloodline and floor depth both scale enemies');

const counts = {};
for (let i = 0; i < 300; i++) counts[pickRarity(true, 'epic', Math.random)] = true;
assert(!counts.common && !counts.uncommon && !counts.rare && counts.epic && counts.legendary, 'boss minRarity epic only rolls epic or legendary');

const sword = makeItem('sword', 'legendary', () => 0.2);
assert(sword.atk > 8 && sword.slot === 'sword' && sword.name && !/infinity|radriar|siris|god king/i.test(sword.name), 'legendary sword is original and has attack');
assert(sellValue(sword) > sellValue(starterSword()), 'rarer gear sells for more than the starter sword');

const boss = enemyAt(0, 2);
const drops = Array.from({ length: 40 }, () => rollLoot(boss, Math.random));
assert(drops.every(Boolean), 'floor boss always drops');
assert(drops.every((d) => ['rare', 'epic', 'legendary'].includes(d.rarity)), 'gate boss respects min rarity rare');
assert(elementMul('fire', boss) === (boss.weak === 'fire' ? 1.5 : boss.resist === 'fire' ? 0.55 : 1), 'element multiplier matches the boss');
assert(elementMul('heal', boss) === 1, 'heal is not an elemental damage type');
assert(elementMul('ice', { weak: 'fire', resist: 'ice' }) === 0.55, 'resist multiplier');
assert(elementMul('fire', { weak: 'fire', resist: 'ice' }) === 1.5, 'weak multiplier');

const scene = new THREE.Scene();
const enemy = new Enemy(scene);
const seen = new Set();
for (const def of Object.values(CONFIG.enemies)) {
  enemy.build(def);
  seen.add(enemy.archetype);
  enemy.update(0.016, { mode: 'windup', attack: 'L', p: 0.8 });
  enemy.update(0.016, { mode: 'strike', attack: 'S', p: 0.5 });
  enemy.setPhase(2);
  enemy.update(0.016, { mode: 'stagger', attack: 'H', p: 0.2 });
  enemy.update(0.016, { mode: 'dead', attack: 'O', p: 1 });
  assert(enemy.arm && enemy.weaponTip && enemy.weaponMat && enemy.head && enemy.offArm && enemy.chestLocal, `rig complete for ${def.name}`);
}
assert(seen.size >= 8, 'every archetype actually built');

const player = new Player(scene);
player.setGearVisual({ sword, armor: makeItem('armor', 'rare', () => 0.4), shield: null, helmet: makeItem('helmet', 'epic', () => 0.6) });
player.startSwing({ x: 1, y: 0 }, 0.2);
player.update(0.05, 1, true);
assert(player.tip.length() > 0, 'player swing still produces a blade tip');

if (failed) { console.error(`${failed} logic check(s) failed`); process.exit(1); }
console.log('logic OK');

// Castle route helpers. Pure: no DOM, safe to unit-test.
import { CONFIG } from './config.js';

export function floorDef(i) {
  const floors = CONFIG.floors;
  if (!floors.length) return null;
  const n = ((i % floors.length) + floors.length) % floors.length;
  return floors[n];
}

export function enemyById(id) {
  return CONFIG.enemies[id] || null;
}

export function enemyAt(floor, room) {
  const f = CONFIG.floors[floor];
  if (!f) return enemyById(CONFIG.floors[0].rooms[0]);
  const id = f.rooms[Math.max(0, Math.min(room, f.rooms.length - 1))];
  return enemyById(id);
}

export function currentFloor(save) { return floorDef(save.floor || 0); }
export function currentEnemy(save) { return enemyAt(save.floor || 0, save.room || 0); }

export function fightScale(save) {
  const P = CONFIG.progression;
  const blood = 1 + Math.max(0, (save.bloodline || 1) - 1) * P.rebirthEnemyScale;
  const depth = 1 + (save.floor || 0) * P.floorScale + (save.room || 0) * P.roomScale;
  return blood * depth;
}

/** What the next win would do. Does not mutate. */
export function peekAdvance(save) {
  const floors = CONFIG.floors;
  const floor = save.floor || 0;
  const room = save.room || 0;
  const len = floors[floor].rooms.length;
  if (room + 1 < len) return { kind: 'room', floor, room: room + 1 };
  if (floor + 1 < floors.length) return { kind: 'floor', floor: floor + 1, room: 0, cleared: floors[floor].name };
  return { kind: 'castle', floor: 0, room: 0, cleared: floors[floor].name };
}

export function linearIndex(save) {
  let n = 0;
  const floor = save.floor || 0;
  const room = save.room || 0;
  for (let i = 0; i < floor; i++) n += CONFIG.floors[i].rooms.length;
  return n + room;
}

export function positionFromLinear(index) {
  const floors = CONFIG.floors;
  let n = Math.max(0, index | 0);
  for (let i = 0; i < floors.length; i++) {
    if (n < floors[i].rooms.length) return { floor: i, room: n };
    n -= floors[i].rooms.length;
  }
  return { floor: 0, room: 0 };
}

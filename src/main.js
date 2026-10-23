// Eternal Blade — main game: scene setup, combat rules, enemy AI, game loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildWorld } from './world.js';
import { Player, Enemy, ATTACKS } from './characters.js';
import { time, CameraRig, Particles, BladeTrail, SwipeTrail, DamageNumbers, Rings } from './fx.js';
import { SwipeInput } from './input.js';
import { sfx, unlockAudio, vibrate } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { UI } from './ui.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ----------------------------------------------------------------- setup ---
const $ = (id) => document.getElementById(id);
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
const rig = new CameraRig(camera);
const world = buildWorld(scene);
const player = new Player(scene);
const enemy = new Enemy(scene);
const sparks = new Particles(scene);
const chunks = new Particles(scene, 300, THREE.NormalBlending);
const playerTrail = new BladeTrail(scene, 0x88aaff);
const enemyTrail = new BladeTrail(scene, 0xffc040);
const rings = new Rings(scene);
const swipeTrail = new SwipeTrail($('swipe'));
const dmgNums = new DamageNumbers($('dmgLayer'), camera);
const flashEl = $('flashOverlay');
let flashAmt = 0, flashColor = '#fff';

// lightning bolt mesh for magic
const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.05, 14, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
bolt.visible = false; scene.add(bolt);
let boltT = 0;

const save = loadSave();
const ui = new UI(save, { onStart: startFight, onNext: startFight, onRebirth: startFight, onResume: resume, onQuit: toTitle, sword: equipSwordVisual });

// ------------------------------------------------------------ fight state --
let state = 'title';  // title | fight | over | paused | victory | defeat
let simTime = 0;
const F = {}; // current fight

const sword = () => CONFIG.swords.find((s) => s.id === save.equipped) || CONFIG.swords[0];
function equipSwordVisual() { const s = sword(); player.setSwordColors(s.color, s.glow); playerTrail.setColor(s.glow); }
equipSwordVisual();
enemy.build(CONFIG.enemies[save.stage % CONFIG.enemies.length]); // title-screen backdrop

function stats() {
  const P = CONFIG.player, st = save.stats;
  return { hp: P.baseHp + st.hp * P.hpPerPoint, dmg: P.baseDamage + st.atk * P.damagePerPoint + sword().damage, shield: P.baseShield + st.shield * P.shieldPerPoint,
    magicMul: 1 + st.magic * P.magicPerPoint, crit: sword().crit };
}

function startFight() {
  unlockAudio();
  const list = CONFIG.enemies, def = list[save.stage % list.length];
  const loop = Math.floor(save.stage / list.length);
  const scale = (1 + loop * CONFIG.progression.loopScale) * (1 + (save.bloodline - 1) * CONFIG.progression.rebirthEnemyScale);
  const s = stats();
  Object.assign(F, {
    def, scale, php: s.hp, phpMax: s.hp, shield: s.shield, shieldMax: s.shield, shieldRegen: 0, magic: 0,
    ehp: Math.round(def.hp * scale), ehpMax: Math.round(def.hp * scale),
    e: { mode: 'idle', t: 0, dur: 1.4, queue: [], attack: 'O', resolved: false, parryLocked: false, guardHits: 0, outcome: null },
    combo: 0, lastHit: -9, buffered: null, pending: null, dodge: null, blocking: false, endTimer: 0, hurtT: 0,
  });
  enemy.build(def);
  player.offsetX = 0; player.swing = null; player.hurtT = 0;
  equipSwordVisual();
  ui.hud(def.name + (loop ? `  +${loop}` : ''), save);
  state = 'fight';
  ui.banner('FIGHT!', 900);
}

function resume() { state = 'fight'; }
function toTitle() { state = 'title'; ui.title(); }

// ------------------------------------------------------------ helpers ------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PARRY_DIR = { L: { x: -1, y: 0 }, R: { x: 1, y: 0 }, O: { x: 0, y: -1 }, S: { x: -1, y: 0 } };
const SOUND = { guarded: () => sfx.clang(0.7), light: () => sfx.hit(1), heavy: () => sfx.hit(1.5), crit: () => sfx.crit(), parry: () => sfx.parry(),
  block: () => sfx.block(), hurt: () => sfx.hurt(), magic: () => sfx.magic(), kill: () => { sfx.crit(); sfx.slam(); }, perfectDodge: () => {} };
const SPARK_COLOR = { guarded: new THREE.Color(0.8, 0.85, 1), light: new THREE.Color(1, 0.6, 0.25), heavy: new THREE.Color(1, 0.55, 0.2), crit: new THREE.Color(1, 0.8, 0.3),
  parry: new THREE.Color(0.7, 0.9, 1), block: new THREE.Color(1, 0.8, 0.4), magic: new THREE.Color(0.6, 0.85, 1), kill: new THREE.Color(1, 0.7, 0.3) };

function impact(kind, pos, dirW) {
  const I = CONFIG.impact[kind];
  if (I.hitStop) time.freeze(I.hitStop);
  rig.addTrauma(I.shake); rig.punch(I.zoom);
  if (dirW) rig.push(V(dirW.x * 0.06 * I.shake, dirW.y * 0.06 * I.shake, -0.08 * I.shake));
  if (pos && I.sparks) {
    sparks.burst(pos, I.sparks, { color: SPARK_COLOR[kind] || SPARK_COLOR.light, dir: dirW, speed: CONFIG.fx.sparkSpeed * (kind === 'parry' || kind === 'magic' ? 1.5 : 1) });
    if (kind !== 'guarded' && kind !== 'block' && kind !== 'parry') // "ichor" — dark molten chunks for flesh-ish hits
      chunks.burst(pos, Math.round(I.sparks * 0.5), { color: new THREE.Color(0.35, 0.03, 0.02), dir: dirW, speed: 4.5, size: 0.14, life: 0.7, grav: 16 });
  }
  if (I.slowmo) time.slowmo(I.slowmo[0], I.slowmo[1]);
  vibrate(I.vibrate);
  (SOUND[kind] || (() => {}))();
}
function screenFlash(color, amt) { flashColor = color; flashAmt = Math.max(flashAmt, amt); }
function canAct() { return state === 'fight' && F.php > 0 && F.e.mode !== 'dead' && F.hurtT <= 0 && !F.dodge; }

// ------------------------------------------------------------ input --------
function onSwipe(sw) {
  if (state !== 'fight') return;
  if (F.php <= 0 || F.e.mode === 'dead' || F.blocking) return;
  // combo chaining / input buffering: a swipe made mid-slash, mid-dodge or while stunned
  // is queued and fires the instant the player can act again
  if (player.swing || !canAct()) { F.buffered = { sw, at: simTime }; return; }
  doSlash(sw);
}

function doSlash(sw) {
  const e = F.e, dur = CONFIG.player.slashTime / Math.min(1.4, Math.max(0.8, sw.mul));
  // ---- parry check (decided instantly on input) ----
  const inWindow = (e.mode === 'windup' && e.t >= e.dur - CONFIG.enemy.parryWindowBefore) || (e.mode === 'strike' && !e.resolved);
  if (inWindow && !e.parryLocked && e.attack !== 'H') {
    const req = PARRY_DIR[e.attack];
    if (sw.x * req.x + sw.y * req.y >= CONFIG.swipe.parryDot) { doParry(sw, dur); return; }
    e.parryLocked = true; // wrong direction inside the window: no second chance this swing
  }
  player.startSwing(sw, dur);
  player.swing.t = dur * 0.12; // skip the very start so contact comes sooner (feels instant)
  F.pending = { sw, done: false };
  sfx.whoosh(sw.mul);
}

function doParry(sw, dur) {
  const e = F.e;
  player.startSwing(sw, dur); player.swing.t = dur * CONFIG.player.slashHitAt; // snap blade to the clash point
  F.pending = null;
  e.mode = 'stagger'; e.t = 0; e.dur = CONFIG.enemy.flurryTime; e.queue = []; e.resolved = true;
  const clash = player.tip.clone().lerp(enemy.tipW, 0.5); clash.y = Math.max(1.2, clash.y);
  const dirW = V(sw.x, -sw.y, 0);
  impact('parry', clash, dirW);
  rings.spawn(clash, 0x9fd8ff, 2.5, 0.35, true);
  enemy.hitFlinch(dirW, 1.6);
  screenFlash('#bfe6ff', 0.55);
  F.magic = Math.min(CONFIG.magic.max, F.magic + CONFIG.magic.onParry * stats().magicMul);
  dmgNums.show(clash, 'PARRY!', 'parry');
  ui.banner('', 0);
}

function applyPlayerHit(sw) {
  const e = F.e; if (e.mode === 'dead') return;
  const s = stats(), C = CONFIG.enemy, P = CONFIG.player;
  let stateMul = C.guardMul, guarded = true;
  if (e.mode === 'open') { stateMul = C.openMul; guarded = false; }
  if (e.mode === 'stagger') { stateMul = C.staggerMul; guarded = false; }
  F.combo = simTime - F.lastHit < P.comboWindow ? Math.min(P.comboMax, F.combo + 1) : 1; F.lastHit = simTime;
  const comboMul = 1 + (F.combo - 1) * P.comboStep;
  const crit = !guarded && Math.random() < s.crit;
  let kind = guarded ? 'guarded' : crit ? 'crit' : (sw.mul >= CONFIG.swipe.heavySpeedMul || F.combo >= 5) ? 'heavy' : 'light';
  const dmg = Math.max(1, Math.round(s.dmg * sw.mul * comboMul * stateMul * (crit ? P.critMul : 1) * (0.92 + Math.random() * 0.16)));
  // contact point: front of the titan, following the actual blade tip
  const chest = enemy.chestWorld();
  const pos = V(THREE.MathUtils.clamp(player.tip.x * 0.8, -1.3, 1.3), THREE.MathUtils.clamp(player.tip.y + 0.8, 1.6, chest.y + 0.6), chest.z + 0.25 * enemy.root.scale.x);
  const dirW = V(sw.x, -sw.y, 0).normalize();
  F.ehp = Math.max(0, F.ehp - dmg);
  if (F.ehp <= 0) { kill(pos, dirW); dmgNums.show(pos, String(dmg), 'crit'); return; }
  impact(kind, pos, dirW);
  enemy.hitFlinch(dirW, guarded ? 0.25 : kind === 'crit' ? 1.6 : kind === 'heavy' ? 1.2 : 0.8 * CONFIG.enemy.flinchStrength);
  dmgNums.show(pos, String(dmg), kind === 'light' ? '' : kind === 'guarded' ? 'guard' : kind);
  F.magic = Math.min(CONFIG.magic.max, F.magic + CONFIG.magic.onHit * (guarded ? 0.5 : 1) * s.magicMul);
  if (F.combo >= 2) ui.combo(F.combo);
  if (guarded && (e.mode === 'idle' || e.mode === 'recover')) {
    e.guardHits++;
    if (e.guardHits >= C.guardBreakHits) { e.guardHits = 0; e.mode = 'stagger'; e.t = 0; e.dur = C.guardBreakStagger; e.queue = []; ui.banner('GUARD BREAK', 700); sfx.clang(1.3); }
  }
}

function kill(pos, dirW) {
  const e = F.e; e.mode = 'dead'; e.t = 0;
  impact('kill', pos, dirW);
  enemy.hitFlinch(dirW, 2.2);
  rings.spawn(V(0, 0.1, enemy.root.position.z), 0xffc070, 6, 0.9);
  screenFlash('#fff', 0.7);
  F.endTimer = 2.2; F.result = 'win';
  ui.banner('VICTORY', 2000);
}

function dodge(dir) {
  if (state !== 'fight' || F.php <= 0 || F.dodge || F.hurtT > 0 || F.e.mode === 'dead') return;
  player.swing = null; F.pending = null; F.buffered = null; // dodge cancels a slash
  F.dodge = { dir, t: 0 }; sfx.dodge(); vibrate([8]);
}

function castMagic() {
  if (state !== 'fight' || F.magic < CONFIG.magic.max || F.e.mode === 'dead' || F.php <= 0) return;
  F.magic = 0;
  const chest = enemy.chestWorld();
  bolt.position.set(chest.x, chest.y + 6, chest.z); bolt.visible = true; boltT = 0.35;
  const dmg = Math.round(stats().dmg * CONFIG.magic.damageMul * stats().magicMul);
  F.ehp = Math.max(0, F.ehp - dmg);
  screenFlash('#cfefff', 0.9);
  rings.spawn(V(chest.x, 0.1, chest.z), 0x9fd8ff, 7, 0.7);
  dmgNums.show(chest, String(dmg), 'crit');
  if (F.ehp <= 0) { kill(chest, V(0, -1, 0)); return; }
  impact('magic', chest, V(0, -1, 0));
  enemy.hitFlinch(V(0, -1, 0), 2);
  const e = F.e; e.mode = 'stagger'; e.t = 0; e.dur = CONFIG.magic.staggerTime; e.queue = []; e.resolved = true;
}

new SwipeInput(canvas, {
  onSwipe,
  onDown: () => unlockAudio(),
  onPoint: (x, y, t, stroke) => swipeTrail.add(x, y, t, stroke),
});
function holdButton(el, down, up) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); el.classList.add('pressed'); down(); });
  const rel = (e) => { el.classList.remove('pressed'); up && up(); };
  el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel);
}
holdButton($('btnDodgeL'), () => dodge(-1));
holdButton($('btnDodgeR'), () => dodge(1));
holdButton($('btnBlock'), () => { F.blocking = true; }, () => { F.blocking = false; });
holdButton($('btnMagic'), castMagic);
holdButton($('btnPause'), () => { if (state === 'fight') { state = 'paused'; ui.pause(); } });
const KEYSW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  unlockAudio();
  if (KEYSW[e.code]) { const [x, y] = KEYSW[e.code]; onSwipe({ x, y, speed: 1.6, mul: 1.1 }); }
  if (e.code === 'KeyA') dodge(-1);
  if (e.code === 'KeyD') dodge(1);
  if (e.code === 'KeyS' || e.code === 'Space') F.blocking = true;
  if (e.code === 'KeyQ' || e.code === 'KeyE') castMagic();
  if (e.code === 'Escape' && state === 'fight') { state = 'paused'; ui.pause(); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'KeyS' || e.code === 'Space') F.blocking = false; });
// stop iOS gesture zoom / double-tap zoom / context menu
['gesturestart', 'gesturechange', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.panel')) e.preventDefault(); }, { passive: false });

// ------------------------------------------------------------ enemy AI -----
function pickPattern() { const p = F.def.patterns; return [...p[Math.floor(Math.random() * p.length)]]; }
function startAttack(a) {
  const e = F.e; e.attack = a; e.mode = 'windup'; e.t = 0; e.resolved = false; e.parryLocked = false;
  const speed = 1 / (1 + (F.scale - 1) * 0.25);
  e.dur = F.def.windup * speed * (a === 'H' ? 1.45 : 1) * (0.9 + Math.random() * 0.2);
  sfx.windup(a === 'H');
  ui.telegraph(a);
}
function setMode(m, dur) { const e = F.e; e.mode = m; e.t = 0; e.dur = dur; }

function resolveEnemyImpact() {
  const e = F.e; e.resolved = true;
  const a = e.attack, C = CONFIG;
  const dmgBase = F.def.damage * F.scale * (a === 'H' ? 1.7 : 1);
  const shieldPos = player.shield.getWorldPosition(V());
  if (F.dodge && F.dodge.t < C.player.dodgeInvuln && a !== 'S') {
    e.outcome = 'evade';
    if (F.dodge.t < C.player.perfectDodgeWindow + 0.0) {
      impact('perfectDodge'); F.magic = Math.min(C.magic.max, F.magic + C.magic.onPerfectDodge * stats().magicMul);
      dmgNums.show(V(player.root.position.x, 2.2, -0.5), 'PERFECT', 'info');
    } else dmgNums.show(V(player.root.position.x, 2.2, -0.5), 'DODGE', 'info');
    if (a === 'H') { sfx.slam(); rig.addTrauma(0.45); rings.spawn(V(0, 0.1, -1.6), 0xff6040, 4, 0.5); }
    return;
  }
  if (F.blocking && F.shield > 0) {
    if (a === 'H') { // heavy smashes through the shield
      F.shield = Math.max(0, F.shield - 2); hurtPlayer(dmgBase * 0.6); sfx.block(); rings.spawn(V(0, 0.1, -1.6), 0xff6040, 4, 0.5); sfx.slam();
      dmgNums.show(shieldPos, 'SHIELD BREAK', 'player'); e.outcome = 'hit'; return;
    }
    F.shield -= 1; e.outcome = 'block';
    impact('block', shieldPos.clone().add(V(0, 0, -0.3)), V(a === 'R' ? -1 : a === 'L' ? 1 : 0, a === 'O' ? -1 : 0, 0));
    rig.push(V(0, 0, 0.25));
    F.magic = Math.min(C.magic.max, F.magic + C.magic.onBlock * stats().magicMul);
    dmgNums.show(shieldPos, 'BLOCK', 'guard');
    return;
  }
  e.outcome = 'hit';
  if (a === 'H') { sfx.slam(); rings.spawn(V(0, 0.1, -1.6), 0xff6040, 4, 0.5); }
  hurtPlayer(dmgBase);
}
function hurtPlayer(amount) {
  const dmg = Math.round(amount * (0.9 + Math.random() * 0.2));
  F.php = Math.max(0, F.php - dmg);
  F.hurtT = CONFIG.player.hurtStun; player.hurtT = CONFIG.player.hurtStun;
  player.swing = null; F.pending = null; F.buffered = null; F.combo = 0;
  impact('hurt', null, V(0, 0, 1));
  rig.push(V(0, -0.1, 0.35));
  screenFlash('#ff2a1a', 0.5);
  dmgNums.show(V(player.root.position.x + 0.2, 2.0, -0.3), '-' + dmg, 'player');
  if (F.php <= 0) {
    time.slowmo(0.2, 1.2); F.endTimer = 1.8; F.result = 'lose'; ui.banner('YOU HAVE FALLEN', 1800); sfx.defeat();
  }
}

function updateEnemyAI(dt) {
  const e = F.e; e.t += dt;
  if (F.result) { if (e.mode !== 'dead' && F.result === 'lose') { e.mode = 'idle'; } return; }
  switch (e.mode) {
    case 'idle': if (e.t >= e.dur) { e.queue = pickPattern(); startAttack(e.queue.shift()); } break;
    case 'windup': if (e.t >= e.dur) { setMode('strike', CONFIG.enemy.strikeTime * (e.attack === 'H' ? 1.25 : 1)); sfx.enemyWhoosh(e.attack === 'H'); } break;
    case 'strike':
      if (!e.resolved && e.t >= e.dur * 0.5) resolveEnemyImpact();
      if (e.t >= e.dur && e.mode === 'strike') {
        ui.telegraph(null);
        if (e.queue.length) setMode('recover', CONFIG.enemy.chainGap);
        else if (e.outcome === 'evade' || e.outcome === 'block') { setMode('open', CONFIG.enemy.openingTime); ui.banner('OPENING!', 500); }
        else setMode('recover', CONFIG.enemy.recoverTime);
      }
      break;
    case 'recover': if (e.t >= e.dur) { if (e.queue.length) startAttack(e.queue.shift()); else { setMode('idle', rand(CONFIG.enemy.idleMin, CONFIG.enemy.idleMax)); e.guardHits = 0; } } break;
    case 'open': if (e.t >= e.dur) setMode('recover', 0.35); break;
    case 'stagger': if (e.t >= e.dur) { setMode('idle', 0.5); e.guardHits = 0; } break;
  }
}
const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------ fight update -
function updateFight(dt, realDt) {
  const P = CONFIG.player;
  F.hurtT = Math.max(0, F.hurtT - dt);
  // dodge motion: fast out, slower return
  if (F.dodge) {
    F.dodge.t += dt; const p = F.dodge.t / P.dodgeTime;
    const off = p < 0.3 ? Math.sin((p / 0.3) * Math.PI / 2) : Math.cos(((p - 0.3) / 0.7) * Math.PI / 2);
    player.offsetX = F.dodge.dir * P.dodgeDistance * off;
    if (p >= 1) { F.dodge = null; player.offsetX = 0; }
  }
  // shield regen
  if (CONFIG.player.shieldRegenTime > 0 && F.shield < F.shieldMax) {
    F.shieldRegen += dt; if (F.shieldRegen >= CONFIG.player.shieldRegenTime) { F.shieldRegen = 0; F.shield++; }
  } else F.shieldRegen = 0;
  const blocking = F.blocking && F.shield > 0 && !F.dodge && F.php > 0;
  // slash contact
  if (player.swing && F.pending && !F.pending.done && player.swingProgress >= P.slashHitAt) { F.pending.done = true; applyPlayerHit(F.pending.sw); }
  if (F.buffered && simTime - F.buffered.at > CONFIG.swipe.bufferTime) F.buffered = null; // stale input
  if (!player.swing && F.buffered && canAct() && !blocking) { const b = F.buffered; F.buffered = null; doSlash(b.sw); }
  if (!player.swing && F.pending) F.pending = null;
  updateEnemyAI(dt);
  // combo decay
  if (simTime - F.lastHit > P.comboWindow && F.combo) { F.combo = 0; ui.combo(0); }
  if (F.result) {
    F.endTimer -= realDt;
    if (F.endTimer <= 0) endFight();
  }
  return blocking;
}

function endFight() {
  if (F.result === 'win') {
    const xp = Math.round(F.def.xp * F.scale), gold = Math.round(F.def.gold * F.scale);
    save.xp += xp; save.gold += gold; save.kills++;
    let levels = 0;
    while (save.xp >= CONFIG.progression.xpToLevel(save.level)) { save.xp -= CONFIG.progression.xpToLevel(save.level); save.level++; levels++; save.points += CONFIG.progression.statPointsPerLevel; }
    save.stage++;
    writeSave(save); sfx.victory();
    state = 'victory'; ui.victory({ xp, gold, levels, enemy: F.def.name });
  } else {
    save.bloodline++; save.stage = 0; writeSave(save);
    state = 'defeat'; ui.defeat({ enemy: F.def.name });
  }
  F.result = null;
}

// ------------------------------------------------------------ resize -------
function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, CONFIG.fx.pixelRatioCap);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const portrait = h > w; const k = THREE.MathUtils.clamp((1.6 - w / h) / 1.0, 0, 1); // 0 = wide, 1 = tall
  rig.baseFov = THREE.MathUtils.lerp(CONFIG.camera.fovLandscape, CONFIG.camera.fovPortrait, k);
  rig.basePos.set(THREE.MathUtils.lerp(1.35, 0.95, k), THREE.MathUtils.lerp(2.45, 2.7, k), THREE.MathUtils.lerp(3.7, 4.6, k));
  rig.lookAt.set(THREE.MathUtils.lerp(0.1, 0.15, k), THREE.MathUtils.lerp(2.55, 2.8, k), -4);
  camera.updateProjectionMatrix();
  sparks.setScale(h * dpr); chunks.setScale(h * dpr);
  swipeTrail.resize(w, h, Math.min(dpr, 1.5));
  document.body.classList.toggle('portrait', portrait);
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ------------------------------------------------------------ main loop ----
let last = performance.now(), emberAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - last) / 1000); last = now;
  const playing = state === 'fight';
  const dt = playing ? time.step(realDt) : (state === 'title' || state === 'victory' || state === 'defeat' ? realDt * 0.5 : 0);
  simTime += dt;
  let blocking = false;
  if (playing) blocking = updateFight(dt, realDt);
  // characters
  player.update(dt, simTime, blocking);
  const e = F.e || { mode: 'idle', t: 0, dur: 1 };
  enemy.update(dt, { mode: e.mode, attack: e.attack, p: e.dur ? e.t / e.dur : 0 });
  // trails (sampled on simulation clock so hit-stop freezes them too)
  if (player.swing || player.recover < 0.6) playerTrail.add(player.base, player.tip, simTime);
  if (e.mode === 'strike' || (e.mode === 'recover' && e.t < 0.08)) enemyTrail.add(enemy.baseW, enemy.tipW, simTime);
  enemyTrail.setColor(ATTACKS[e.attack] ? ATTACKS[e.attack].glow : 0xffc040);
  playerTrail.update(simTime); enemyTrail.update(simTime);
  // ambient embers
  emberAcc += dt * 14;
  while (emberAcc > 1) { emberAcc--; sparks.spawn(V(rand(-9, 9), rand(0, 1), rand(-12, 2)), V(rand(-0.3, 0.3), rand(0.6, 1.4), rand(-0.3, 0.3)), new THREE.Color(1, 0.5, 0.15), 0.05, rand(2, 4), -0.05, 0.2); }
  sparks.update(dt); chunks.update(dt); rings.update(dt);
  if (boltT > 0) { boltT -= realDt; bolt.visible = boltT > 0; bolt.material.opacity = Math.max(0, boltT / 0.35); bolt.scale.x = bolt.scale.z = 0.6 + Math.random() * 0.8; }
  world.update(simTime);
  rig.follow.set(player.offsetX * 0.55, 0, 0);
  rig.update(realDt);
  // screen flash
  flashAmt = Math.max(0, flashAmt - realDt * 3.5);
  flashEl.style.opacity = flashAmt.toFixed(3); flashEl.style.background = flashColor;
  if (playing || state === 'paused') ui.updateHud(F, CONFIG, simTime);
  swipeTrail.draw(performance.now());
  renderer.render(scene, camera);
}
ui.title();
requestAnimationFrame(frame);

// test / debug hook (used by the headless smoke test)
window.__game = {
  get state() { return state; }, get fight() { return F; }, save,
  swipe: (x, y, mul = 1.2) => onSwipe({ x, y, speed: 2, mul }), dodge, castMagic, startFight,
  block: (b) => { F.blocking = b; },
};

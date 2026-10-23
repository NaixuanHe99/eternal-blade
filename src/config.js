// ============================================================================
// Eternal Blade — ALL TUNABLE VALUES LIVE HERE.
// Tweak these to adjust combat feel (打击手感), difficulty and progression.
// Times are in seconds unless the name ends in Ms.
// ============================================================================

export const CONFIG = {
  // ---------------------------------------------------------------- input ---
  swipe: {
    minDistFrac: 0.045,     // stroke must travel this fraction of min(screenW,screenH) to count
    commitDistFrac: 0.11,   // slash fires *during* the stroke once it passes this (no wait for finger-up)
    refSpeed: 1.6,          // px/ms (normalised to 800px screen) that counts as a "1.0x" slash
    minSpeedMul: 0.75,      // slowest swipe damage multiplier
    maxSpeedMul: 1.6,       // fastest swipe damage multiplier
    heavySpeedMul: 1.3,     // speed multiplier at/above which a hit counts as "heavy"
    bufferTime: 0.45,       // swipes made mid-slash / mid-dodge are queued this long (combo chaining)
    parryDot: 0.55,         // cos(angle) needed between swipe and required parry direction
    trailLife: 0.22,        // 2D finger-trail fade time
  },

  // --------------------------------------------------------------- player ---
  player: {
    baseHp: 100, hpPerPoint: 20,
    baseDamage: 9, damagePerPoint: 3,
    baseShield: 3, shieldPerPoint: 1,
    shieldRegenTime: 7,     // seconds to regen 1 shield pip (0 = never)
    magicPerPoint: 0.15,    // +15% magic damage & gain per point
    slashTime: 0.2,         // base slash animation length at 1.0x speed
    slashHitAt: 0.45,       // fraction of the slash at which contact happens
    dodgeTime: 0.5, dodgeInvuln: 0.38, dodgeDistance: 1.7,
    perfectDodgeWindow: 0.22, // dodge started this soon before impact = "perfect"
    hurtStun: 0.35,
    comboWindow: 0.75,      // time between slashes to keep the combo going
    comboStep: 0.1,         // +10% damage per combo hit
    comboMax: 10,
    critMul: 2.0,
  },

  // ---------------------------------------------------------------- magic ---
  magic: {
    max: 100,
    onHit: 4, onParry: 22, onPerfectDodge: 10, onBlock: 6,
    damageMul: 4.0,         // x base damage
    staggerTime: 2.2,
  },

  // ---------------------------------------------------------------- enemy ---
  enemy: {
    guardMul: 0.35,          // damage taken while guarding
    openMul: 1.0,            // damage after a dodge/block opening
    staggerMul: 1.3,         // damage during parry flurry
    guardBreakHits: 5,       // hits on guard before guard breaks
    guardBreakStagger: 1.0,
    parryWindowBefore: 0.32, // parry window opens this long before the swing starts...
    strikeTime: 0.22,        // ...and stays open through the swing (impact at mid-swing)
    recoverTime: 0.55,       // after hitting the player
    openingTime: 1.15,       // after being dodged/blocked (free hits)
    flurryTime: 2.4,         // after a parry
    idleMin: 0.7, idleMax: 1.5,
    chainGap: 0.28,          // pause between attacks inside a pattern
    flinchStrength: 1.0,
  },

  // ------------------------------------------------ on-screen defence cues ---
  // One cue at a time. Parryable attacks -> animated chevrons showing the way the
  // PLAYER must swipe. Unparryable heavy (red) -> dodge-button pulse + icon.
  cues: {
    showParryCue: true,      // set false for "expert mode" (enemy weapon glow only)
    showDodgeCue: true,
    previewTime: 0.45,       // cue fades in (dim) this long before the parry window opens
    lengthFrac: 0.46,        // chevron track length as a fraction of min(screenW, screenH)
    centerY: 0.47,           // vertical centre of the cue (fraction of screen height)
    chevrons: 4,             // number of chevrons along the track
    flowSpeed: 1.6,          // chevron travel speed (tracks per second)
    readyColor: '#ffd36a',   // cue colour before the window opens
    nowColor: '#8ff2ff',     // cue colour while the window is open ("NOW")
    dodgeColor: '#ff4a3a',
    windowRingColor: 0x9ff4ff, // ring + weapon flash when the parry window opens
    windowWeaponColor: 0xc8faff,
    windowPing: true,        // short high "ting" sound when the window opens
    windowVibrate: [8],      // haptic tick when the window opens
  },

  // ------------------------------------------------ first-fight tutorial -----
  tutorial: {
    enabled: true,           // runs once (stored in the save) — skippable
    slowScale: 0.04,         // game speed while a tutorial hint is waiting for you
    maxWait: 8,              // seconds (real time) before a hint gives up and resumes
    attackHits: 3,           // hits needed to finish the "swipe to attack" step
    windupMul: 1.6,          // tutorial enemy attacks wind up slower
  },

  // ---------------------------------------------- impact / hit-feel table ---
  // hitStop: freeze-frame length (s). shake: camera trauma 0..1. zoom: FOV punch (deg).
  // sparks: particle count. vibrate: navigator.vibrate pattern (ms).
  // slowmo: [timeScale, duration] or null.
  impact: {
    guarded:   { hitStop: 0.035, shake: 0.18, zoom: 0.6, sparks: 14, vibrate: [12],          slowmo: null },
    light:     { hitStop: 0.055, shake: 0.28, zoom: 1.4, sparks: 18, vibrate: [18],          slowmo: null },
    heavy:     { hitStop: 0.085, shake: 0.42, zoom: 2.6, sparks: 30, vibrate: [30],          slowmo: null },
    crit:      { hitStop: 0.12,  shake: 0.55, zoom: 3.6, sparks: 44, vibrate: [45],          slowmo: [0.45, 0.18] },
    parry:     { hitStop: 0.16,  shake: 0.65, zoom: 5.0, sparks: 60, vibrate: [20, 30, 60],  slowmo: [0.18, 0.75] },
    block:     { hitStop: 0.07,  shake: 0.38, zoom: -1.5, sparks: 26, vibrate: [35],         slowmo: null },
    hurt:      { hitStop: 0.09,  shake: 0.75, zoom: -3.0, sparks: 0,  vibrate: [80],         slowmo: null },
    perfectDodge:{ hitStop: 0.0, shake: 0.12, zoom: 2.0, sparks: 0,  vibrate: [10],          slowmo: [0.3, 0.45] },
    magic:     { hitStop: 0.18,  shake: 0.9,  zoom: 6.0, sparks: 80, vibrate: [40, 40, 90],  slowmo: [0.35, 0.5] },
    kill:      { hitStop: 0.22,  shake: 1.0,  zoom: 7.0, sparks: 90, vibrate: [60, 40, 140], slowmo: [0.15, 1.4] },
  },
  camera: {
    shakeAmp: 0.22,          // max positional shake (world units) at trauma 1
    shakeRoll: 0.05,         // max roll (rad) at trauma 1
    shakeFreq: 28,
    traumaDecay: 1.9,        // trauma lost per second
    zoomReturn: 9,           // spring speed of FOV punch recovery
    fovLandscape: 52, fovPortrait: 74,
  },
  fx: {
    maxParticles: 900,
    sparkSpeed: 7.5, sparkGravity: 14, sparkLife: 0.45,
    swordTrailLife: 0.16,    // 3D blade trail fade
    damageNumberTime: 0.85,
    pixelRatioCap: 1.75,
    shadowMapSize: 1024,
  },
  audio: { master: 0.7 },
  haptics: { enabled: true },

  // ---------------------------------------------------------- progression ---
  progression: {
    xpToLevel: (lvl) => Math.round(60 * Math.pow(lvl, 1.35)),
    statPointsPerLevel: 2,
    rebirthEnemyScale: 0.12, // each bloodline makes enemies +12% tougher
    loopScale: 0.35,         // after beating every enemy, they come back +35%
  },

  swords: [
    { id: 'iron',    name: '铁剑 Iron Blade',       damage: 0,  crit: 0.05, price: 0,    color: 0xc8ccd4, glow: 0x88aaff },
    { id: 'steel',   name: '精钢剑 Tempered Steel',  damage: 5,  crit: 0.08, price: 120,  color: 0xe4e8f0, glow: 0xaad4ff },
    { id: 'ember',   name: '余烬之刃 Emberbrand',    damage: 11, crit: 0.12, price: 320,  color: 0xff8a4a, glow: 0xff5a1a },
    { id: 'frost',   name: '霜牙 Frostfang',         damage: 18, crit: 0.16, price: 650,  color: 0x9fe6ff, glow: 0x40c8ff },
    { id: 'eclipse', name: '蚀月 Eclipse',           damage: 28, crit: 0.22, price: 1200, color: 0xb98cff, glow: 0xa040ff },
  ],

  // attack types: L = swing from player's left→right, R = right→left, O = overhead,
  // S = low sweep (cannot dodge: block/parry), H = heavy slam (cannot block or parry: dodge!)
  enemies: [
    { name: '石像巨人 Stone Brute',    hp: 160, damage: 14, windup: 0.95, scale: 1.0, color: 0x8a8378, eye: 0xffa040, xp: 50, gold: 70,
      patterns: [['O'], ['L'], ['R'], ['L', 'R']] },
    { name: '铁甲泰坦 Iron Titan',     hp: 260, damage: 18, windup: 0.85, scale: 1.12, color: 0x5d6470, eye: 0x60c0ff, xp: 85, gold: 120,
      patterns: [['O'], ['L', 'R'], ['R', 'L'], ['S'], ['H']] },
    { name: '熔岩魔像 Magma Golem',    hp: 380, damage: 22, windup: 0.75, scale: 1.2, color: 0x4a2a22, eye: 0xff4a10, xp: 130, gold: 190,
      patterns: [['L', 'R', 'O'], ['S', 'O'], ['H'], ['R', 'R'], ['O', 'H']] },
    { name: '暗影君王 Shadow King',    hp: 520, damage: 27, windup: 0.66, scale: 1.3, color: 0x2a2436, eye: 0xc060ff, xp: 200, gold: 300,
      patterns: [['L', 'R', 'L'], ['O', 'S'], ['H', 'O'], ['R', 'L', 'H'], ['S', 'S', 'O']] },
  ],
};

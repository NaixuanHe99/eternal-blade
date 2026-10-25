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
    rebirthEnemyScale: 0.12, // each bloodline (full castle clear) makes enemies +12% tougher
    floorScale: 0.16,        // each floor deeper
    roomScale: 0.05,         // each room along the floor
    retreatGoldLoss: 0.15,   // dying and retreating to the gate drops this fraction of gold
    clearGold: 80,           // bonus gold on bloodline rebirth
    clearGoldPerBlood: 30,
    bagMax: 28,
  },

  // God-powers. Lightning keeps the old full-meter ultimate; cheaper spells spend part of the bar.
  // Element ids match enemy weak / resist and gear elements.
  spells: {
    lightning: { name: '雷击', en: 'Lightning', glyph: '⚡', cost: 100, element: 'lightning', damageMul: 4.0, stagger: 2.2 },
    ice:       { name: '霜缚', en: 'Ice',       glyph: '❄', cost: 80,  element: 'ice',       damageMul: 2.6, stagger: 3.15 },
    fire:      { name: '炎爆', en: 'Fire',      glyph: '🔥', cost: 70,  element: 'fire',      damageMul: 3.0, stagger: 1.35, burnTicks: 3, burnFrac: 0.2 },
    heal:      { name: '愈光', en: 'Heal',      glyph: '✚', cost: 45,  element: 'heal',      damageMul: 0,   stagger: 0, heal: 0.34 },
  },
  spellOrder: ['lightning', 'ice', 'fire', 'heal'],

  // attack types: L = swing from player's left→right, R = right→left, O = overhead,
  // S = low sweep (cannot dodge: block/parry), H = heavy slam (cannot block or parry: dodge!)
  // Archetypes pick a procedural silhouette in characters.js. Original names only.
  enemies: {
    spear_guard: {
      name: '城门矛卫', en: 'Gate Spearman', archetype: 'spear',
      hp: 145, damage: 13, windup: 0.98, scale: 1.02, color: 0x6e675c, eye: 0xffc060,
      xp: 42, gold: 50, drop: 0.42, weak: 'lightning', resist: null,
      patterns: [['O'], ['L'], ['O', 'R'], ['S']],
    },
    ash_sentry: {
      name: '灰烬剑哨', en: 'Ash Sentry', archetype: 'warden',
      hp: 175, damage: 15, windup: 0.9, scale: 1.04, color: 0x8a8378, eye: 0xffa040,
      xp: 50, gold: 58, drop: 0.42, weak: 'ice', resist: 'fire',
      patterns: [['L'], ['R'], ['L', 'R'], ['O'], ['R', 'L']],
    },
    gate_marshal: {
      name: '城垣统领', en: 'Rampart Marshal', archetype: 'knight', boss: true,
      hp: 340, damage: 18, windup: 0.86, scale: 1.16, color: 0x4a5568, eye: 0xffe080,
      xp: 120, gold: 150, drop: 1, minRarity: 'rare', weak: 'lightning', resist: 'fire',
      intro: '统领举起长剑，闸门在他身后合拢。',
      patterns: [['L', 'R'], ['O'], ['S'], ['H'], ['R', 'O']],
      patterns2: [['H', 'L'], ['S', 'S'], ['O', 'H'], ['L', 'R', 'O']],
    },
    hound: {
      name: '裂喉猎犬', en: 'Riven Hound', archetype: 'hound',
      hp: 155, damage: 14, windup: 0.7, scale: 0.96, color: 0x5a4638, eye: 0xff6030,
      xp: 54, gold: 62, drop: 0.4, weak: 'fire', resist: 'ice',
      patterns: [['L', 'R'], ['S'], ['L'], ['R', 'L'], ['S', 'L']],
    },
    vineguard: {
      name: '藤甲庭卫', en: 'Vine Warden', archetype: 'warden',
      hp: 220, damage: 16, windup: 0.84, scale: 1.1, color: 0x3d5a3a, eye: 0x9dff6a,
      xp: 68, gold: 76, drop: 0.44, weak: 'fire', resist: 'ice',
      patterns: [['S'], ['L', 'O'], ['R'], ['S', 'L'], ['O', 'R']],
    },
    court_colossus: {
      name: '中庭巨像', en: 'Court Colossus', archetype: 'golem', boss: true,
      hp: 480, damage: 22, windup: 1.02, scale: 1.28, color: 0x6a6458, eye: 0xffe080,
      xp: 170, gold: 210, drop: 1, minRarity: 'rare', weak: 'ice', resist: 'lightning',
      intro: '石块拼成的巨像从庭院中央站起。',
      patterns: [['O'], ['H'], ['S', 'O'], ['L', 'R'], ['O', 'H']],
      patterns2: [['H', 'H'], ['O', 'S', 'H'], ['S', 'O'], ['H', 'L']],
    },
    hall_knight: {
      name: '长厅骑士', en: 'Hall Knight', archetype: 'knight',
      hp: 250, damage: 18, windup: 0.78, scale: 1.06, color: 0x3e4a62, eye: 0x80c0ff,
      xp: 82, gold: 92, drop: 0.46, weak: 'fire', resist: null,
      patterns: [['L', 'R'], ['O', 'L'], ['S'], ['R', 'O'], ['L', 'S']],
    },
    chanter: {
      name: '灰烛咏者', en: 'Ash Chanter', archetype: 'chanter',
      hp: 210, damage: 17, windup: 0.82, scale: 1.02, color: 0x3a3050, eye: 0xc080ff,
      xp: 88, gold: 100, drop: 0.5, weak: 'lightning', resist: 'ice',
      patterns: [['O'], ['S', 'O'], ['L'], ['R', 'O'], ['O', 'L']],
    },
    shade: {
      name: '影刃侍从', en: 'Shade Blade', archetype: 'shade',
      hp: 200, damage: 20, windup: 0.66, scale: 1.0, color: 0x241c30, eye: 0xd060ff,
      xp: 94, gold: 108, drop: 0.46, weak: 'fire', resist: 'ice',
      patterns: [['L', 'R', 'L'], ['R', 'L'], ['S'], ['H'], ['L', 'H']],
    },
    hall_keeper: {
      name: '长厅守印者', en: 'Hall Keeper', archetype: 'chanter', boss: true,
      hp: 540, damage: 24, windup: 0.76, scale: 1.22, color: 0x2a2040, eye: 0xffd060,
      xp: 200, gold: 250, drop: 1, minRarity: 'epic', weak: 'fire', resist: 'ice',
      intro: '守印者抬起法杖，厅内烛火同时低下。',
      patterns: [['O', 'S'], ['L', 'R'], ['H'], ['S', 'O'], ['O', 'L']],
      patterns2: [['H', 'O'], ['S', 'S', 'L'], ['O', 'H', 'R'], ['H', 'S']],
    },
    throne_shade: {
      name: '王座影卫', en: 'Throne Shade', archetype: 'shade',
      hp: 240, damage: 22, windup: 0.62, scale: 1.06, color: 0x1a1424, eye: 0xff4060,
      xp: 110, gold: 130, drop: 0.52, weak: 'lightning', resist: 'fire',
      patterns: [['L', 'R'], ['H'], ['S', 'L'], ['R', 'R'], ['L', 'H']],
    },
    cinder_golem: {
      name: '烬核石卫', en: 'Cinder Ward', archetype: 'golem',
      hp: 320, damage: 23, windup: 0.88, scale: 1.16, color: 0x4a2a22, eye: 0xff4a10,
      xp: 120, gold: 140, drop: 0.52, weak: 'ice', resist: 'fire',
      patterns: [['O', 'H'], ['S'], ['H'], ['L', 'O'], ['O', 'S']],
    },
    sovereign: {
      name: '灰冠君王', en: 'Ashcrown Sovereign', archetype: 'sovereign', boss: true,
      hp: 720, damage: 28, windup: 0.7, scale: 1.32, color: 0x2c2428, eye: 0xffd24a,
      xp: 300, gold: 380, drop: 1, minRarity: 'epic', weak: 'ice', resist: 'fire',
      intro: '灰冠君王从王座站起。击败他，血脉将进入下一代。',
      patterns: [['L', 'R', 'O'], ['H'], ['S', 'O'], ['R', 'L', 'H'], ['O', 'S']],
      patterns2: [['H', 'H'], ['S', 'O', 'H'], ['L', 'R', 'L', 'H'], ['O', 'S', 'H']],
    },
  },

  // Castle route. Each floor: several regular fights, then a floor boss.
  floors: [
    { id: 'gate', name: '外城门', en: 'Outer Gate', theme: 'gate',
      blurb: '生锈的闸门与冷风。矛卫、剑哨，然后是城垣统领。',
      rooms: ['spear_guard', 'ash_sentry', 'gate_marshal'] },
    { id: 'court', name: '中庭', en: 'Courtyard', theme: 'court',
      blurb: '露天石庭，藤蔓爬上残柱。猎犬与藤甲之后，巨像醒来。',
      rooms: ['hound', 'vineguard', 'court_colossus'] },
    { id: 'hall', name: '长厅', en: 'Great Hall', theme: 'hall',
      blurb: '烛火长廊。骑士、咏者与影刃守着厅印。',
      rooms: ['hall_knight', 'chanter', 'shade', 'hall_keeper'] },
    { id: 'throne', name: '王座', en: 'Throne', theme: 'throne',
      blurb: '红雾与金座。影卫、烬核，最后是灰冠君王。',
      rooms: ['throne_shade', 'cinder_golem', 'sovereign'] },
  ],
};

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_LABEL = { common: '普通', uncommon: '优良', rare: '稀有', epic: '史诗', legendary: '传说' };
export const RARITY_COLOR = { common: '#c8c8d0', uncommon: '#5dcc6a', rare: '#4aa3ff', epic: '#c06bff', legendary: '#ffb020' };
export const SLOT_LABEL = { sword: '剑', shield: '盾', armor: '甲', helmet: '盔' };
export const ELEMENT_LABEL = { fire: '火', ice: '冰', lightning: '雷', heal: '愈' };

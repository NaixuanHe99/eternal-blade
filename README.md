# Eternal Blade · 永恒之刃

A browser **3D sword-duel prototype** inspired by the *gameplay* of classic swipe-to-slash mobile duel games.
Built with Three.js + Vite and plays on **phones (touch)** and **desktop (mouse/keyboard)**. All art is
procedural primitives and all sound is synthesized with WebAudio. No third-party game assets, names or music are used.

一个浏览器 3D 剑斗原型（玩法致敬经典滑屏决斗手游，不使用其任何名称/美术/音乐）。手机和电脑都能玩。

Live (after deploy): https://naixuanhe99.github.io/eternal-blade/

## Run 运行

```bash
npm install
npm run dev        # dev server → http://localhost:5173 (use --host to try it on a phone over LAN)
npm run build      # production build → dist/ (relative paths, base './')
npm run preview    # serve dist/ on http://localhost:4173
npm test           # build first; headless Chrome smoke test + screenshots → screenshots/
```

`npm test` needs Chrome at `/usr/bin/google-chrome`. To use another path, set `CHROME_PATH` or edit `scripts/smoke-test.mjs`.

## Controls 操作

| Action | Touch 手机 | Desktop 电脑 |
|---|---|---|
| Slash 斩击 | Swipe anywhere. The stroke direction sets the cut and faster swipes do more damage. Zig-zag for combos. | Drag the mouse, or use the arrow keys |
| Parry 招架 | Swipe **the way the glowing chevrons flow**. The cue only appears when the attack can be parried: gold = get ready (准备招架), cyan pulsing + "ting" = **NOW** (招架！). A clean parry pops **PARRY! 招架**, staggers the enemy, triggers slow-mo and opens a flurry window. | same |
| Dodge 闪避 | ⟸ / ⟹ buttons. A late dodge counts as a *perfect dodge* (slow-mo). | A / D |
| Block 格挡 | Hold 🛡️. This uses shield durability and shows **BLOCK 格挡**. It is safer than a parry but gives no opening. | S / Space |
| Magic 法术 | ▸ cycles 雷击 / 霜缚 / 炎爆 / 愈光, then ✦ casts if you have enough mana. Lightning still costs a full bar. | Q casts, E cycles |
| Pause | ❚❚ | Esc |

Enemy attack types: left / right / overhead are dodgeable, blockable and parryable.
**Sweep** (blue) cannot be dodged, so block or parry it (its cue says swipe left). **Heavy** (red) breaks your guard and cannot be parried, so dodge it.

### Cues 提示 (one at a time)
- **Parry cue**: animated glowing chevrons on screen point in the direction *you* must swipe. They appear during the wind-up and turn cyan when the parry window opens.
- **Window open**: when the window opens, the enemy weapon flashes cyan-white and keeps glowing, an impact ring spawns at the blade tip, and you get a "ting" plus a short vibration.
- **Unparryable (heavy)**: no chevrons. Instead you see a red ⟸ ⚠ ⟹ **闪避！DODGE · 重击无法招架** cue, and both dodge buttons pulse red when it's time.
- **Tutorial 教程**: runs on the first fight only (`tutorialDone` in the save) and can be skipped. It covers swipe to attack → parry as shown → dodge buttons → hold shield → magic. The first time each cue appears, the game drops into slow-mo with a one-line hint (Chinese + English) until you act.

## Loop 流程
The castle is four floors — **外城门 → 中庭 → 长厅 → 王座**. Each floor is a short run of regular fights and then a floor boss (intro line, then a phase 2 at half HP). Between fights a corridor screen shows the route, the next opponent, stat points, and your bag.

Win a fight → XP, gold, and a chance of gear (bosses always drop, and drop higher rarities). Slots are **剑 / 盾 / 甲 / 盔**, rarities **普通 → 传说**, with ATK / DEF / HP / Crit / Magic and sometimes an element. Equip or sell from the corridor. Everything persists in `localStorage`.

Clearing the throne (**灰冠君王**) is a **血脉轮回**: bloodline +1, back to the outer gate, level and gear kept, enemies scale up. Dying does **not** raise the bloodline — retry the same fight, or retreat to the gate and lose a little gold.

Some enemies are weak or resistant to 火 / 冰 / 雷. Spells: 雷击 (full bar, heavy stagger), 霜缚 (long stagger), 炎爆 (burn), 愈光 (heal).

## Hit feel 打击手感
- **Hit-stop** freeze frames scale with the hit: guarded < light < heavy < crit < parry < kill.
- **Camera trauma shake** (position + roll) plus a **FOV zoom punch** on a spring. Getting hurt or blocking punches outward.
- **Slow-motion** on parry, crit, perfect dodge, magic and the killing blow. It eases back to normal speed.
- **Weapon trail** ribbon on the 3D blade and a glowing 2D finger trail on the swipe canvas.
- **Sparks + dark ichor particles** spawn at the real blade/body contact point, plus impact rings and a screen flash.
- **Directional enemy flinch** spring, an emissive hit flash, stagger and guard-break states.
- **Procedural WebAudio**: whoosh (pitch follows swipe speed), slice/thud, crit, metal clang (block/parry), shield block, hurt, enemy wind-up and whoosh, slam. A small reverb is added.
- **Haptics** via `navigator.vibrate` with a pattern per impact type. Toggle it in Pause. iOS Safari ignores vibrate.
- **Instant input**: a slash fires *mid-stroke* once the finger travels the commit distance, without waiting for touch-up. Direction comes from the stroke and damage scales with speed over the last ~80 ms. Inputs are buffered during swings and dodges.

**All tunables live in [`src/config.js`](src/config.js)**:
- `impact.*`: hitStop / shake / zoom / sparks / vibrate / slowmo for each event type
- `camera.*`: shake amplitude, roll, frequency, FOV spring
- `swipe.*`: commit distance, speed→damage curve, buffer time, parry angle tolerance
- `player.*`: slash timing, dodge window, combo
- `enemy.*`: parry window, opening and flurry durations, guard
- `cues.*`: parry/dodge cue on/off, size, position, chevron count/speed, colours, window flash colour, ping, vibrate
- `tutorial.*`: enabled, slow-mo scale while waiting, max wait, attack hits, wind-up multiplier
- `fx.*`: particles and trails
- `progression`, `spells`, `floors`, `enemies`: castle route, attack patterns, elements

## Structure 结构
```
index.html            canvases + HUD + buttons
src/main.js           renderer, game state machine, combat resolution, enemy AI, resize, debug hook (window.__game)
src/config.js         ALL tunable numbers (hit feel, timing, balance, floors, enemies, spells)
src/progress.js       floor / room advance and enemy scaling
src/loot.js           rarity rolls, gear stats, sell prices, element multipliers
src/fx.js             time control (hit-stop/slow-mo), camera rig, particles, blade/swipe trails, damage numbers, rings
src/audio.js          procedural WebAudio SFX + haptics
src/input.js          low-latency swipe recognizer (pointer events, coalesced)
src/characters.js     procedural knight + 8 enemy silhouettes
src/world.js          arena themes per floor (gate, court, hall, throne)
src/ui.js             title / HUD / corridor loot & equip / defeat / bloodline / pause
src/cues.js           2D "swipe this way" parry cue (glowing chevrons)
src/save.js           localStorage save (migrates the old sword shop)
scripts/logic-test.mjs  castle, loot and silhouette checks (no browser)
scripts/smoke-test.mjs headless test (desktop + mobile, swipes, parry, floor advance, equip, boss, screenshots)
.github/workflows/deploy.yml  GitHub Pages deploy on push to main
```

## Deploy 部署 (GitHub Pages)
`vite.config.js` uses `base: './'`, so the build works under any subpath, for example `/eternal-blade/`.
Push to `main` on a repo named `eternal-blade` and set **Settings → Pages → Source: GitHub Actions**.
The workflow then builds and publishes `dist/`.

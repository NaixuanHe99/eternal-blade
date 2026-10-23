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
| Parry 招架 | When the enemy's wind-up glows, swipe **opposite** to the incoming attack. That staggers it, triggers slow-mo and opens a flurry window. | same |
| Dodge 闪避 | ⟸ / ⟹ buttons. A late dodge counts as a *perfect dodge* (slow-mo). | A / D |
| Block 格挡 | Hold 🛡️. This uses shield durability. | S / Space |
| Magic 魔法 | ✦ button when the meter is full | Q / E |
| Pause | ❚❚ | Esc |

Enemy attack types: left / right / overhead are dodgeable, blockable and parryable.
**Sweep** (blue) cannot be dodged, so block or parry it. **Heavy** (red) breaks your guard and cannot be parried, so dodge it.

## Loop 流程
Fight → win → XP / gold / stat points → spend points, buy or equip swords → next, tougher titan.
If you die you **rebirth** (转生): bloodline +1, back to the first titan, and you keep your level, stats and swords.
Each loop through the enemy list scales enemy stats up. Progress is saved in `localStorage`.

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
- `fx.*`: particles and trails
- `progression`, `swords`, `enemies`: attack patterns per titan

## Structure 结构
```
index.html            canvases + HUD + buttons
src/main.js           renderer, game state machine, combat resolution, enemy AI, resize, debug hook (window.__game)
src/config.js         ALL tunable numbers (hit feel, timing, balance, swords, enemies)
src/fx.js             time control (hit-stop/slow-mo), camera rig, particles, blade/swipe trails, damage numbers, rings
src/audio.js          procedural WebAudio SFX + haptics
src/input.js          low-latency swipe recognizer (pointer events, coalesced)
src/characters.js     procedural knight + titan models and animation
src/world.js          arena, lights, fog, braziers
src/ui.js             title / HUD / victory + shop / defeat / pause screens
src/save.js           localStorage save
scripts/smoke-test.mjs headless test (desktop + mobile, swipes, parry, victory, screenshots)
.github/workflows/deploy.yml  GitHub Pages deploy on push to main
```

## Deploy 部署 (GitHub Pages)
`vite.config.js` uses `base: './'`, so the build works under any subpath, for example `/eternal-blade/`.
Push to `main` on a repo named `eternal-blade` and set **Settings → Pages → Source: GitHub Actions**.
The workflow then builds and publishes `dist/`.

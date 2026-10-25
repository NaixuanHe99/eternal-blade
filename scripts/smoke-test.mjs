// Headless smoke test: builds must exist in dist/. Serves dist, loads the game in
// Chrome (desktop + mobile viewport), simulates swipes / parry / dodge, captures
// screenshots and fails on console errors.
//   npm run build && npm test     (CHROME_PATH env var overrides the browser path)
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p)) || '/usr/bin/google-chrome';
const OUT = new URL('../screenshots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 4173, host: '127.0.0.1' } });
const URL_ = 'http://127.0.0.1:4173/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(viewport, label) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  await page.goto(URL_, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  return page;
}
const waitFor = (page, fn, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 16 });

async function mouseSwipe(page, x0, y0, x1, y1, steps = 6) {
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await sleep(8); }
  await page.mouse.up();
}
async function touchSwipe(page, x0, y0, x1, y1, steps = 6) {
  await page.touchscreen.touchStart(x0, y0);
  for (let i = 1; i <= steps; i++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await sleep(8); }
  await page.touchscreen.touchEnd();
}

// ---------------- desktop ----------------
{
  const page = await open({ width: 1280, height: 720 }, 'desktop');
  await page.screenshot({ path: OUT + '01-title-desktop.png' });
  await page.click('#bStart');
  await waitFor(page, () => window.__game.state === 'fight');
  await page.evaluate(() => window.__game.skipTutorial());
  await sleep(600);
  const hp0 = await page.evaluate(() => window.__game.fight.ehp);
  for (const [a, b, c, d] of [[500, 400, 800, 380], [800, 300, 500, 330], [640, 250, 640, 520], [520, 300, 760, 480]]) { await mouseSwipe(page, a, b, c, d); await sleep(90); }
  await sleep(300);
  const hp1 = await page.evaluate(() => window.__game.fight.ehp);
  console.log(`desktop mouse swipes: enemy hp ${hp0} -> ${hp1}`);
  if (!(hp1 < hp0)) errors.push('mouse swipes did not damage the enemy');
  // wait for an enemy wind-up and parry it correctly (via the same code path as a swipe)
  await waitFor(page, () => { const e = window.__game.fight.e; return e.mode === 'windup' && e.attack !== 'H' && e.t >= e.dur - 0.25; }, 15000);
  const parried = await page.evaluate(() => {
    const e = window.__game.fight.e; const d = { L: [-1, 0], R: [1, 0], O: [0, -1], S: [-1, 0] }[e.attack];
    window.__game.swipe(d[0], d[1], 1.4); return window.__game.fight.e.mode;
  });
  console.log('parry attempt -> enemy mode:', parried);
  if (parried !== 'stagger') errors.push('parry did not stagger enemy');
  await sleep(60);
  await page.screenshot({ path: OUT + '02-parry-desktop.png' });
  // flurry
  for (let i = 0; i < 4; i++) { await mouseSwipe(page, i % 2 ? 800 : 480, 360, i % 2 ? 480 : 800, 360, 4); await sleep(60); }
  await sleep(120);
  await page.screenshot({ path: OUT + '03-flurry-desktop.png' });
  // dodge + block buttons
  await page.click('#btnDodgeL'); await sleep(200);
  const st = await page.evaluate(() => ({ dodge: !!window.__game.fight.dodge || true, php: window.__game.fight.php }));
  console.log('dodge pressed, player hp', st.php);
  // force a win to exercise the victory screen
  await page.evaluate(() => { window.__game.fight.ehp = 1; window.__game.fight.e.mode = 'open'; window.__game.fight.e.t = 0; window.__game.fight.e.dur = 5; });
  await sleep(450);
  await mouseSwipe(page, 500, 360, 800, 360);
  await waitFor(page, () => window.__game.state === 'victory', 20000);
  await sleep(300);
  await page.screenshot({ path: OUT + '04-victory-shop-desktop.png' });
  const prog = await page.evaluate(() => ({ state: window.__game.state, floor: window.__game.save.floor, room: window.__game.save.room, blood: window.__game.save.bloodline, gold: window.__game.save.gold }));
  console.log('victory reached; progress =', JSON.stringify(prog));
  if (prog.state !== 'victory') errors.push('win did not open the corridor');
  if (prog.floor !== 0 || prog.room !== 1) errors.push(`floor did not advance to the next room (floor ${prog.floor} room ${prog.room})`);
  if (prog.blood !== 1) errors.push('bloodline changed before the castle was cleared');
  const equipped = await page.evaluate(() => {
    const it = window.__game.debugGrant('helmet', 'rare');
    window.__game.debugEquip(it.id);
    const st = window.__game.playerStats();
    return { id: window.__game.save.equipped.helmet, name: it.name, magic: st.magicMul, hp: st.hp, text: document.body.innerText };
  });
  console.log('equipped', equipped.name, 'magic', equipped.magic, 'hp', equipped.hp);
  if (!equipped.id) errors.push('equip did not set the helmet slot');
  if (!equipped.text.includes(equipped.name)) errors.push('equipped item not shown in the corridor');
  if (!(equipped.magic > 1 || equipped.hp > 100)) errors.push('equipping gear did not change player stats');
  const sold = await page.evaluate(() => {
    const before = window.__game.save.gold;
    const it = window.__game.debugGrant('shield', 'common');
    const btn = document.querySelector(`[data-sell="${it.id}"]`);
    if (btn) btn.click();
    return { before, after: window.__game.save.gold, had: !!btn, still: window.__game.save.inventory.some((x) => x.id === it.id) };
  });
  console.log('sell', JSON.stringify(sold));
  if (!sold.had || !(sold.after > sold.before) || sold.still) errors.push('sell from the corridor bag failed');
  await page.evaluate(() => window.__game.debugGoto(0, 2));
  await page.click('#bNext');
  await waitFor(page, () => window.__game.state === 'fight' && window.__game.fight.def && window.__game.fight.def.boss);
  const boss = await page.evaluate(() => ({ name: window.__game.fight.def.name, intro: !!window.__game.fight.introSeen, theme: window.__game.theme, arch: window.__game.fight.def.archetype }));
  console.log('boss fight', JSON.stringify(boss));
  if (boss.name !== '城垣统领' || !boss.intro) errors.push('floor boss intro did not start');
  if (boss.theme !== 'gate') errors.push('gate boss used the wrong arena theme');
  await page.evaluate(() => {
    const F = window.__game.fight;
    F.introT = 0;
    F.ehp = Math.floor(F.ehpMax * 0.5) + 5;
    F.e.mode = 'open'; F.e.t = 0; F.e.dur = 8; F.e.phase2 = false; F.result = null;
  });
  await mouseSwipe(page, 480, 380, 860, 360);
  await sleep(450);
  let phase = await page.evaluate(() => ({ phase2: !!window.__game.fight.e.phase2, hp: window.__game.fight.ehp, max: window.__game.fight.ehpMax }));
  if (!phase.phase2) { await mouseSwipe(page, 860, 400, 460, 340); await sleep(450); phase = await page.evaluate(() => ({ phase2: !!window.__game.fight.e.phase2, hp: window.__game.fight.ehp, max: window.__game.fight.ehpMax })); }
  console.log('boss phase', JSON.stringify(phase));
  if (!phase.phase2) errors.push('boss did not enter phase 2 after dropping to half HP');
  if (!(phase.hp > 0)) errors.push('phase test killed the boss outright');
  await page.evaluate(() => { window.__game.debugGoto(2, 0); window.__game.startFight(); });
  const hall = await page.evaluate(() => ({ theme: window.__game.theme, name: document.getElementById('enemyName').textContent, floor: window.__game.save.floor }));
  console.log('hall', JSON.stringify(hall));
  if (hall.theme !== 'hall' || hall.floor !== 2 || !hall.name.includes('长厅')) errors.push('great hall theme/name did not apply');
  await page.close();
}

// ---------------- mobile portrait (touch) ----------------
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const freezeShot = async (page, name) => { await page.evaluate(() => window.__game.hold(0)); await sleep(250); await page.screenshot({ path: OUT + name }); await page.evaluate(() => window.__game.hold(1)); };
{
  const page = await open(MOBILE, 'mobile');
  await page.tap('#bStart');
  await waitFor(page, () => window.__game.state === 'fight');
  await page.evaluate(() => window.__game.skipTutorial());
  await sleep(500);
  const hp0 = await page.evaluate(() => window.__game.fight.ehp);
  for (const [a, b, c, d] of [[100, 400, 300, 380], [300, 350, 90, 420], [200, 300, 200, 520]]) { await touchSwipe(page, a, b, c, d); await sleep(80); }
  await sleep(40);
  await page.screenshot({ path: OUT + '05-mobile-portrait-hit.png' });
  const hp1 = await page.evaluate(() => window.__game.fight.ehp);
  console.log(`mobile touch swipes: enemy hp ${hp0} -> ${hp1}`);
  if (!(hp1 < hp0)) errors.push('touch swipes did not damage the enemy');
  const scrolled = await page.evaluate(() => window.scrollY + document.documentElement.scrollTop);
  if (scrolled !== 0) errors.push('page scrolled during touch');
  // parry cue ("swipe this way") at the moment the window opens
  await waitFor(page, () => ['idle', 'recover', 'open'].includes(window.__game.fight.e.mode), 15000);
  await page.evaluate(() => window.__game.forceAttack('L'));
  await waitFor(page, () => { const e = window.__game.fight.e; return e.mode === 'windup' && e.windowFired; }, 15000);
  await freezeShot(page, '06-mobile-parry-cue.png');
  // real touch swipe in the cue direction (L attack -> swipe left) must parry
  await touchSwipe(page, 300, 420, 90, 420, 5);
  const pr = await page.evaluate(() => { window.__game.hold(0); const p = document.getElementById('pop'); p.getAnimations().forEach((an) => { an.pause(); an.currentTime = 300; }); return { mode: window.__game.fight.e.mode, pop: p.className + ':' + p.textContent }; });
  console.log('mobile touch parry following cue ->', pr);
  if (pr.mode !== 'stagger') errors.push('touch swipe along the parry cue did not parry');
  if (!/parry:PARRY/.test(pr.pop)) errors.push('PARRY pop not shown');
  await sleep(150);
  await page.screenshot({ path: OUT + '07-mobile-parry-pop.png' });
  await page.evaluate(() => { document.getElementById('pop').getAnimations().forEach((an) => an.play()); window.__game.hold(1); });
  // unparryable heavy -> dodge cue
  await waitFor(page, () => ['idle', 'recover', 'open'].includes(window.__game.fight.e.mode), 15000);
  await page.evaluate(() => window.__game.forceAttack('H'));
  await waitFor(page, () => document.getElementById('dodgeCue').classList.contains('now'), 15000);
  const cueState = await page.evaluate(() => ({ dodgeBtn: document.getElementById('btnDodgeL').classList.contains('cue') }));
  if (!cueState.dodgeBtn) errors.push('dodge buttons not highlighted for heavy attack');
  await freezeShot(page, '08-mobile-dodge-cue.png');
  await page.tap('#btnDodgeR');
  await sleep(600);
  // landscape
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(400);
  await waitFor(page, () => ['idle', 'recover', 'open'].includes(window.__game.fight.e.mode), 15000);
  await page.evaluate(() => window.__game.forceAttack('O'));
  await waitFor(page, () => { const e = window.__game.fight.e; return e.mode === 'windup' && e.windowFired; }, 15000);
  await freezeShot(page, '09-mobile-landscape-parry-cue.png');
  // perf sample
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps (headless swiftshader, not representative):', fps);
  await page.close();
}

// ---------------- first-fight tutorial (mobile portrait) ----------------
{
  const page = await open(MOBILE, 'tutorial');
  await page.tap('#bStart');
  await waitFor(page, () => window.__game.state === 'fight' && window.__game.tutorial.active);
  await sleep(700);
  await page.screenshot({ path: OUT + '10-tutorial-attack.png' });
  for (let i = 0; i < 5 && (await page.evaluate(() => window.__game.tutorial.step)) === 'attack'; i++) { await touchSwipe(page, i % 2 ? 300 : 90, 450, i % 2 ? 90 : 300, 430); await sleep(350); }
  await waitFor(page, () => window.__game.tutorial.step === 'parry' && window.__game.tutorial.waiting, 20000);
  await sleep(300);
  await page.screenshot({ path: OUT + '11-tutorial-parry.png' });
  await touchSwipe(page, 90, 430, 300, 430, 5); // forced 'R' attack -> swipe right
  await sleep(40);
  const pm = await page.evaluate(() => window.__game.fight.e.mode);
  console.log('tutorial parry -> enemy mode:', pm);
  if (pm !== 'stagger') errors.push('tutorial parry failed');
  await waitFor(page, () => window.__game.tutorial.step === 'dodge' && window.__game.tutorial.waiting, 50000);
  await sleep(300);
  await page.screenshot({ path: OUT + '12-tutorial-dodge.png' });
  await page.tap('#btnDodgeL');
  await waitFor(page, () => window.__game.tutorial.step === 'block' && window.__game.tutorial.waiting, 50000);
  await sleep(200);
  await page.screenshot({ path: OUT + '13-tutorial-block.png' });
  const bb = await page.evaluate(() => { const r = document.getElementById('btnBlock').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.touchscreen.touchStart(bb[0], bb[1]);
  await waitFor(page, () => window.__game.tutorial.step === 'magic', 50000);
  await page.touchscreen.touchEnd();
  await sleep(300);
  await page.tap('#btnMagic');
  await waitFor(page, () => !window.__game.tutorial.active, 10000);
  const done = await page.evaluate(() => JSON.parse(localStorage.getItem('eternal-blade-save-v1')).tutorialDone);
  console.log('tutorial completed, saved tutorialDone =', done);
  if (!done) errors.push('tutorial completion not saved');
  await page.close();
}

await browser.close();
server.httpServer.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('OK — no console errors. Screenshots in screenshots/');

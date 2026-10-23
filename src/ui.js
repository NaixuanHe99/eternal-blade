// DOM UI: title / HUD / victory (stats + sword shop) / defeat (rebirth) / pause.
import { CONFIG } from './config.js';
import { writeSave, resetSave, DEFAULT_SAVE } from './save.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const ARROW = { L: '➜', R: '⬅', O: '⬇', S: '➜', H: '⬇' };
const HELP = `
  <b>攻击 Attack</b>：在屏幕上滑动挥剑，方向=斩击方向，越快伤害越高；连续滑动打出连击。<br>
  <b>招架 Parry</b>：敌人挥砍即将落下时，朝<b>相反方向</b>滑动 → 硬直 + 慢动作 + 连斩时间。<br>
  <b>闪避 Dodge</b> ⟸ ⟹ ：躲开攻击（蓝光横扫 <span style="color:#6af">S</span> 无法闪避）。<br>
  <b>格挡 Block</b> 🛡 按住：消耗盾牌耐久（红光重击 <span style="color:#f55">H</span> 会击破盾牌，只能闪避）。<br>
  <b>魔法 Magic</b> ✦：能量满时释放雷击。<br>
  <span style="opacity:.7">桌面：鼠标拖动挥剑 / 方向键斩击，A/D 闪避，S 或空格格挡，Q 魔法。</span>`;

export class UI {
  constructor(save, cb) { this.save = save; this.cb = cb; this.screen = $('screen'); this.hudEl = $('hud'); this._comboT = 0; this._lastPips = -1; }

  show(html) { const old = this.screen.querySelector('.panel'); const st = old ? old.scrollTop : 0; this.screen.innerHTML = `<div class="panel">${html}</div>`; this.screen.classList.remove('hidden'); this.hudEl.classList.add('hidden'); if (st) this.screen.querySelector('.panel').scrollTop = st; }
  hide() { this.screen.classList.add('hidden'); this.screen.innerHTML = ''; }
  bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); sfx.ui(); fn(); }); }

  title() {
    const s = this.save;
    this.show(`<h1>ETERNAL<br>BLADE</h1><div class="sub">永恒之刃 · 血脉第 ${s.bloodline} 代 · Lv ${s.level}</div>
      <div class="help">${HELP}</div>
      <button class="btn" id="bStart">⚔ 开始战斗</button><br>
      <button class="btn small" id="bReset">重置进度</button>`);
    this.bind('bStart', () => { this.hide(); this.cb.onStart(); });
    this.bind('bReset', () => { if (confirm('重置所有进度？')) { resetSave(); Object.assign(this.save, DEFAULT_SAVE()); this.cb.sword(); this.title(); } });
  }

  hud(name) {
    this.hide(); this.hudEl.classList.remove('hidden');
    $('enemyName').textContent = name; this._lastPips = -1;
    $('enemyHp').style.transform = 'scaleX(1)'; $('enemyHpLag').style.transform = 'scaleX(1)';
  }

  updateHud(F, C) {
    if (!F.ehpMax) return;
    const ek = F.ehp / F.ehpMax;
    $('enemyHp').style.transform = `scaleX(${ek})`; $('enemyHpLag').style.transform = `scaleX(${ek})`;
    $('playerHp').style.transform = `scaleX(${F.php / F.phpMax})`;
    const mk = F.magic / C.magic.max;
    const mb = $('magicBar'); mb.style.transform = `scaleX(${mk})`; mb.classList.toggle('full', mk >= 1);
    $('btnMagic').classList.toggle('ready', mk >= 1);
    $('btnBlock').classList.toggle('disabled', F.shield <= 0);
    const pipsKey = F.shield * 100 + F.shieldMax;
    if (pipsKey !== this._lastPips) {
      this._lastPips = pipsKey;
      $('shieldPips').innerHTML = Array.from({ length: F.shieldMax }, (_, i) => `<div class="pip ${i < F.shield ? '' : 'off'}"></div>`).join('');
    }
    // telegraph arrow intensity
    const t = $('telegraph');
    if (F.e && F.e.mode === 'windup' && CONFIG.enemy.showTelegraphArrow) t.style.opacity = Math.min(1, (F.e.t / F.e.dur) * 1.3).toFixed(2);
    else if (!(F.e && F.e.mode === 'strike')) t.style.opacity = 0;
  }

  telegraph(a) {
    const t = $('telegraph');
    if (!a) { t.style.opacity = 0; return; }
    t.textContent = ARROW[a] + (a === 'H' ? '!' : ''); t.className = a;
    t.style.top = a === 'S' ? '62%' : '44%';
  }

  combo(n) {
    const c = $('combo');
    if (n < 2) { c.style.opacity = 0; return; }
    c.textContent = `${n} 连击`; c.style.opacity = 1; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  }

  banner(text, ms) {
    const b = $('banner'); clearTimeout(this._bt);
    if (!text) { b.style.opacity = 0; return; }
    b.textContent = text; b.style.opacity = 1; this._bt = setTimeout(() => (b.style.opacity = 0), ms);
  }

  // -------------------------------------------------------------- victory --
  victory(r) {
    this._victory = r; this.renderVictory();
  }
  renderVictory() {
    const s = this.save, r = this._victory, P = CONFIG.player;
    const need = CONFIG.progression.xpToLevel(s.level);
    const row = (key, label, val) => `<span>${label}</span><b>${val}</b><button class="btn small" data-stat="${key}" ${s.points ? '' : 'disabled'}>+</button>`;
    const shop = CONFIG.swords.map((w) => {
      const owned = s.swords.includes(w.id), eq = s.equipped === w.id;
      const btn = eq ? '<button class="btn small" disabled>已装备</button>'
        : owned ? `<button class="btn small" data-equip="${w.id}">装备</button>`
        : `<button class="btn small" data-buy="${w.id}" ${s.gold >= w.price ? '' : 'disabled'}>💰${w.price}</button>`;
      return `<div class="item"><span><i class="sw" style="background:#${w.glow.toString(16).padStart(6, '0')}"></i>${w.name}<br><small style="opacity:.7">攻击 +${w.damage} · 暴击 ${Math.round(w.crit * 100)}%</small></span>${btn}</div>`;
    }).join('');
    const nextDef = CONFIG.enemies[s.stage % CONFIG.enemies.length];
    this.show(`<h2>胜利 VICTORY</h2>
      <div class="sub">击败 ${r.enemy}</div>
      <p><span class="xp">+${r.xp} XP</span> · <span class="gold">+${r.gold} 金币</span>${r.levels ? ` · <b style="color:#ffd060">升级! Lv ${s.level}</b>` : ''}</p>
      <p class="sub">Lv ${s.level} · XP ${s.xp}/${need} · <span class="gold">💰${s.gold}</span> · 属性点 <b>${s.points}</b></p>
      <button class="btn" id="bNext">下一战：${nextDef.name} ⚔</button>
      <div class="stats">
        ${row('hp', '生命 Health', P.baseHp + s.stats.hp * P.hpPerPoint)}
        ${row('atk', '攻击 Attack', P.baseDamage + s.stats.atk * P.damagePerPoint)}
        ${row('shield', '盾牌 Shield', P.baseShield + s.stats.shield * P.shieldPerPoint)}
        ${row('magic', '魔力 Magic', '+' + Math.round(s.stats.magic * P.magicPerPoint * 100) + '%')}
      </div>
      <div class="shop">${shop}</div>`);
    this.screen.querySelectorAll('[data-stat]').forEach((b) => b.addEventListener('click', () => { if (s.points > 0) { s.points--; s.stats[b.dataset.stat]++; writeSave(s); sfx.ui(); this.renderVictory(); } }));
    this.screen.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const w = CONFIG.swords.find((x) => x.id === b.dataset.buy); if (s.gold < w.price) return;
      s.gold -= w.price; s.swords.push(w.id); s.equipped = w.id; writeSave(s); sfx.clang(1); this.cb.sword(); this.renderVictory();
    }));
    this.screen.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', () => { s.equipped = b.dataset.equip; writeSave(s); sfx.clang(0.8); this.cb.sword(); this.renderVictory(); }));
    this.bind('bNext', () => { this.hide(); this.cb.onNext(); });
  }

  defeat(r) {
    const s = this.save;
    this.show(`<h2 style="color:#e05040">你倒下了</h2><div class="sub">被 ${r.enemy} 击败</div>
      <p>但血脉永存。你的后裔将继承你的等级与装备，重新挑战。<br><small style="opacity:.7">The bloodline continues — level & gear are kept, enemies grow stronger.</small></p>
      <p>血脉第 <b>${s.bloodline}</b> 代 · Lv ${s.level} · <span class="gold">💰${s.gold}</span></p>
      <button class="btn" id="bReb">⟲ 转生 REBIRTH</button>`);
    this.bind('bReb', () => { this.hide(); this.cb.onRebirth(); });
  }

  pause() {
    const on = CONFIG.haptics.enabled;
    this.show(`<h2>暂停</h2><div class="help">${HELP}</div>
      <button class="btn" id="bRes">继续</button><button class="btn" id="bHap">震动: ${on ? '开' : '关'}</button><br><button class="btn small" id="bQuit">返回标题</button>`);
    this.bind('bRes', () => { this.hide(); this.hudEl.classList.remove('hidden'); this.cb.onResume(); });
    this.bind('bHap', () => { CONFIG.haptics.enabled = !on; this.pause(); });
    this.bind('bQuit', () => this.cb.onQuit());
  }
}

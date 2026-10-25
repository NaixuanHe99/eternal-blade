// DOM UI: title / HUD / corridor (loot + equip) / defeat / bloodline / pause.
import { CONFIG, RARITY_COLOR, ELEMENT_LABEL } from './config.js';
import { writeSave, resetSave, newGameSave } from './save.js';
import { sfx, unlockAudio } from './audio.js';
import { currentEnemy, currentFloor } from './progress.js';
import { formatStats, sellValue, slotLabel, rarityLabel, describeEnemyTags, SLOTS } from './loot.js';

const $ = (id) => document.getElementById(id);
const HELP = `
  <b>城堡 Castle</b>：外城门 → 中庭 → 长厅 → 王座。每层数名敌人，最后是头目。通关全部楼层会<b>血脉轮回</b>（保留等级与装备，敌人更强）。<br>
  <b>攻击 Attack</b>：在屏幕上滑动挥剑。滑得越快伤害越高，连续滑动打出连击。<br>
  <b>招架 Parry</b>（最强防御）：敌人举起武器时，屏幕中央会出现<b>流动的箭头</b>——<b>顺着箭头方向滑动</b>。
  武器闪成<span style="color:#8ff2ff">青白色</span>并响起“叮”＝<b>现在！</b>成功 → <b>PARRY! 招架</b>，敌人硬直 + 慢动作 + 连斩。<br>
  <b>闪避 Dodge</b> ⟸ ⟹：<span style="color:#f55">红光重击</span>无法招架/格挡——闪避按钮闪红时点它。（蓝光横扫无法闪避，请招架或格挡。）<br>
  <b>格挡 Block</b> 🛡 按住：安全但消耗盾牌耐久，不会让敌人硬直。<br>
  <b>法术 Spells</b>：点 ▸ 切换 雷击 / 霜缚 / 炎爆 / 愈光，再点法术键释放。魔力够就能放，不必攒满。敌人名字下会标出弱点与抵抗。<br>
  <b>装备 Gear</b>：剑 / 盾 / 甲 / 盔。普通到传说，战斗后掉落，可装备或出售。<br>
  <span style="opacity:.7">桌面：鼠标拖动挥剑 / 方向键斩击，A/D 闪避，S 或空格格挡，Q 释放法术，E 切换法术。</span>`;

export class UI {
  constructor(save, cb) { this.save = save; this.cb = cb; this.screen = $('screen'); this.hudEl = $('hud'); this._comboT = 0; this._lastPips = -1; }

  show(html) { const old = this.screen.querySelector('.panel'); const st = old ? old.scrollTop : 0; this.screen.innerHTML = `<div class="panel">${html}</div>`; this.screen.classList.remove('hidden'); this.hudEl.classList.add('hidden'); if (st) this.screen.querySelector('.panel').scrollTop = st; }
  hide() { this.screen.classList.add('hidden'); this.screen.innerHTML = ''; }
  bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); sfx.ui(); fn(); }); }

  title() {
    const s = this.save;
    const f = currentFloor(s);
    const next = currentEnemy(s);
    this.show(`<h1>ETERNAL<br>BLADE</h1><div class="sub">永恒之刃 · 血脉第 ${s.bloodline} 代 · ${f.name} ${s.room + 1}/${f.rooms.length} · Lv ${s.level}</div>
      <p class="sub">下一战 ${next.name}${next.boss ? ' ★' : ''} · ${describeEnemyTags(next) || '无属性倾向'}</p>
      <div class="help">${HELP}</div>
      <button class="btn" id="bStart">${s.tutorialDone ? '⚔ 继续征途' : '⚔ 开始战斗'}</button><br>
      <button class="btn small" id="bReset">重置进度</button>`);
    this.bind('bStart', () => { this.hide(); this.cb.onStart(); });
    this.bind('bReset', () => {
      if (confirm('重置所有进度？')) {
        resetSave();
        const fresh = newGameSave();
        for (const k of Object.keys(this.save)) delete this.save[k];
        Object.assign(this.save, fresh);
        writeSave(this.save);
        this.cb.gear();
        this.title();
      }
    });
  }

  hud(name) {
    this.hide(); this.hudEl.classList.remove('hidden');
    $('enemyName').textContent = name; this._lastPips = -1;
    $('enemyHp').style.transform = 'scaleX(1)'; $('enemyHpLag').style.transform = 'scaleX(1)';
    const sub = $('enemySub'); if (sub) sub.textContent = '';
  }

  updateHud(F, C) {
    if (!F.ehpMax) return;
    if (F.title && $('enemyName').textContent !== F.title) $('enemyName').textContent = F.title;
    const ek = F.ehp / F.ehpMax;
    $('enemyHp').style.transform = `scaleX(${ek})`; $('enemyHpLag').style.transform = `scaleX(${ek})`;
    $('playerHp').style.transform = `scaleX(${Math.max(0, F.php) / F.phpMax})`;
    const sp = C.spells[this.save.spell] || C.spells.lightning;
    const mk = F.magic / C.magic.max;
    const ready = F.magic >= sp.cost;
    const mb = $('magicBar'); mb.style.transform = `scaleX(${mk})`; mb.classList.toggle('full', ready);
    const btn = $('btnMagic'); btn.classList.toggle('ready', ready); btn.dataset.element = sp.element;
    const glyph = $('magicGlyph'); const lbl = $('magicLbl');
    if (glyph && glyph.textContent !== sp.glyph) glyph.textContent = sp.glyph;
    const label = `${sp.name} ${sp.cost}`;
    if (lbl && lbl.textContent !== label) lbl.textContent = label;
    $('btnBlock').classList.toggle('disabled', F.shield <= 0);
    const sub = $('enemySub');
    if (sub && F.def) {
      const bits = [];
      if (F.def.weak) bits.push(`弱点 ${ELEMENT_LABEL[F.def.weak]}`);
      if (F.def.resist) bits.push(`抵抗 ${ELEMENT_LABEL[F.def.resist]}`);
      if (F.e && F.e.phase2) bits.push('狂化');
      const t = bits.join(' · ');
      if (sub.textContent !== t) sub.textContent = t;
    }
    const pipsKey = F.shield * 100 + F.shieldMax;
    if (pipsKey !== this._lastPips) {
      this._lastPips = pipsKey;
      $('shieldPips').innerHTML = Array.from({ length: F.shieldMax }, (_, i) => `<div class="pip ${i < F.shield ? '' : 'off'}"></div>`).join('');
    }
  }

  dodgeCue(phase) {
    if (phase === this._dodgePhase) return; this._dodgePhase = phase;
    const el = $('dodgeCue'); el.classList.toggle('on', !!phase); el.classList.toggle('now', phase === 'now');
    for (const id of ['btnDodgeL', 'btnDodgeR']) { const b = $(id); b.classList.toggle('cue', !!phase); b.classList.toggle('now', phase === 'now'); }
  }
  highlight(id) {
    for (const b of document.querySelectorAll('.cueBlue')) b.classList.remove('cueBlue');
    if (id) $(id).classList.add('cueBlue');
  }
  pop(text, cls) {
    const p = $('pop'); p.textContent = text; p.className = ''; void p.offsetWidth; p.className = cls;
  }
  hint(zh, en, skip = true) {
    const h = $('hint');
    if (!zh) { h.classList.remove('on'); return; }
    h.querySelector('.zh').textContent = zh; h.querySelector('.en').textContent = en || '';
    $('btnSkip').style.display = skip ? '' : 'none';
    h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
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

  // -------------------------------------------------------------- corridor --
  victory(r) { this._loot = r; this.renderCorridor(); }
  refresh() { if (this._loot) this.renderCorridor(); }

  renderCorridor() {
    const s = this.save, r = this._loot || {}, P = CONFIG.player;
    const floor = currentFloor(s);
    const next = currentEnemy(s);
    const need = CONFIG.progression.xpToLevel(s.level);
    const tot = this.cb.stats ? this.cb.stats() : null;
    const hp = tot ? tot.hp : P.baseHp + s.stats.hp * P.hpPerPoint;
    const atk = tot ? tot.dmg : P.baseDamage + s.stats.atk * P.damagePerPoint;
    const shield = tot ? tot.shield : P.baseShield + s.stats.shield * P.shieldPerPoint;
    const mag = tot ? Math.round((tot.magicMul - 1) * 100) : Math.round(s.stats.magic * P.magicPerPoint * 100);
    const def = tot ? tot.def : 0;
    const byId = (id) => s.inventory.find((it) => it && it.id === id);
    const eqSet = new Set(SLOTS.map((slot) => s.equipped[slot]).filter(Boolean));
    const swatch = (it) => `<i class="sw" style="background:${RARITY_COLOR[it.rarity]}"></i>`;
    const slots = SLOTS.map((slot) => {
      const it = byId(s.equipped[slot]);
      const body = it
        ? `${swatch(it)}<b class="rar-${it.rarity}">${it.name}</b><br><small>${rarityLabel(it.rarity)} · ${formatStats(it)}</small><br><button class="btn small" data-unequip="${slot}">卸下</button>`
        : `<span style="opacity:.55">空</span>`;
      return `<div class="slot"><div class="k">${slotLabel(slot)}</div>${body}</div>`;
    }).join('');
    const bag = s.inventory.filter((it) => it && !eqSet.has(it.id));
    const bagHtml = bag.length ? bag.map((it) => `<div class="item">${swatch(it)}<span><b class="rar-${it.rarity}">${it.name}</b> · ${slotLabel(it.slot)} · ${rarityLabel(it.rarity)}<br><small style="opacity:.75">${formatStats(it)}</small></span>
      <span><button class="btn small" data-equip="${it.id}">装备</button><button class="btn small" data-sell="${it.id}">出售 ${sellValue(it)}</button></span></div>`).join('')
      : `<p class="sub">背包是空的。击败敌人有机会掉落装备。</p>`;
    const route = floor.rooms.map((id, i) => {
      const e = CONFIG.enemies[id];
      const cls = `${i < s.room ? 'done' : ''}${i === s.room ? ' now' : ''}${e.boss ? ' boss' : ''}`;
      return `<div class="node${cls}"><b>${e.boss ? '★' : i + 1}</b><small>${e.name}</small></div>`;
    }).join('<div class="path"></div>');
    const row = (key, label, val) => `<span>${label}</span><b>${val}</b><button class="btn small" data-stat="${key}" ${s.points ? '' : 'disabled'}>+</button>`;
    const loot = r.enemy ? `<div class="loot"><b>击败 ${r.enemy}</b><br><span class="xp">+${r.xp} XP</span> · <span class="gold">+${r.gold} 金币</span>${r.levels ? ` · <b style="color:#ffd060">升级! Lv ${s.level}</b>` : ''}${r.item ? `<br>获得 <b class="rar-${r.item.rarity}">${r.item.name}</b> · ${rarityLabel(r.item.rarity)} ${slotLabel(r.item.slot)}<br><small>${formatStats(r.item)}</small>` : '<br><small>这次没有装备掉落。</small>'}${r.converted ? `<br><small>背包已满，掉落折成 <span class="gold">${r.converted} 金币</span></small>` : ''}</div>` : '';
    const beat = r.kind === 'floor' ? `<div class="beat">${r.cleared} 已攻破。前方是 ${floor.name}。</div>` : '';
    this.show(`<h2>${floor.name}</h2>
      <div class="sub">${floor.en} · 血脉第 ${s.bloodline} 代 · ${s.room + 1}/${floor.rooms.length}</div>
      <p class="sub">${floor.blurb}</p>
      <div class="route">${route}</div>
      ${beat}${loot}
      <p class="sub">下一战 <b>${next.name}</b>${next.boss ? ' ★ 头目' : ''} · ${describeEnemyTags(next) || '无属性倾向'}</p>
      <button class="btn" id="bNext">迎战 ${next.name} ⚔</button>
      <p class="sub">Lv ${s.level} · XP ${s.xp}/${need} · <span class="gold">💰${s.gold}</span> · 属性点 <b>${s.points}</b> · 防御 ${def}</p>
      <div class="stats">
        ${row('hp', '生命 Health', hp)}
        ${row('atk', '攻击 Attack', atk)}
        ${row('shield', '盾牌 Shield', shield)}
        ${row('magic', '魔力 Magic', '+' + mag + '%')}
      </div>
      <div class="slots">${slots}</div>
      <div class="shop"><div class="sub" style="text-align:left">背包 ${bag.length}/${CONFIG.progression.bagMax}</div>${bagHtml}</div>`);
    const rerender = () => { writeSave(s); this.renderCorridor(); };
    this.screen.querySelectorAll('[data-stat]').forEach((b) => b.addEventListener('click', () => {
      if (s.points <= 0) return; s.points--; s.stats[b.dataset.stat]++; sfx.ui(); rerender();
    }));
    this.screen.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', () => {
      const it = byId(b.dataset.equip); if (!it) return;
      const prev = s.equipped[it.slot];
      s.equipped[it.slot] = it.id;
      if (prev && prev !== it.id) { /* stays in inventory */ }
      sfx.clang(0.8); this.cb.gear(); rerender();
    }));
    this.screen.querySelectorAll('[data-unequip]').forEach((b) => b.addEventListener('click', () => {
      s.equipped[b.dataset.unequip] = null; sfx.ui(); this.cb.gear(); rerender();
    }));
    this.screen.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
      const it = byId(b.dataset.sell); if (!it || eqSet.has(it.id)) return;
      s.gold += sellValue(it);
      s.inventory = s.inventory.filter((x) => x.id !== it.id);
      sfx.ui(); rerender();
    }));
    this.bind('bNext', () => { this.hide(); this.cb.onNext(); });
  }

  defeat(r) {
    const s = this.save;
    this.show(`<h2 style="color:#e05040">你倒下了</h2><div class="sub">被 ${r.enemy} 击败 · ${currentFloor(s).name}</div>
      <p>血脉尚未轮回。再战会留在这一场；退回城门会从外城门重走，并失去一部分金币。<br><small style="opacity:.7">Gear and level stay. Bloodline rises only when the whole castle falls.</small></p>
      <p>血脉第 <b>${s.bloodline}</b> 代 · Lv ${s.level} · <span class="gold">💰${s.gold}</span></p>
      <button class="btn" id="bRetry">再战</button><button class="btn" id="bRetreat">退回城门</button>`);
    this.bind('bRetry', () => { this.hide(); this.cb.onRetry(); });
    this.bind('bRetreat', () => { this.hide(); this.cb.onRetreat(); });
  }

  rebirth(r) {
    const s = this.save;
    this.show(`<h2>血脉轮回</h2>
      <div class="sub">击败 ${r.enemy}</div>
      <div class="beat">城堡已尽。第 ${s.bloodline} 代血脉醒来，等级与装备都还在，敌人更强了。</div>
      <p><span class="gold">+${r.bonusGold} 金币</span> · 属性点 +1</p>
      <p class="sub">外城门的门再次打开。</p>
      <button class="btn" id="bReb">踏入新的轮回 ⚔</button>`);
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

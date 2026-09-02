/**
 * 杏坛 · 课堂工具（零依赖，数据与接线方式与 chinese.js 一致）
 * 两个工具：随机点名（名单存账号、防重复抽取）/ 课堂计时（倒数 + 结束提示音）
 * 新增工具 = 加一个 pane + 一组函数，不碰其他模块。
 */
const Classroom = (() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // ---------- 名单解析（纯函数，供离线测试） ----------
  // 支持换行/逗号/顿号/分号/Tab 分隔；去空、去重；保留姓名内部空格（兼容英文名）
  function parseNames(text) {
    const seen = new Set(); const out = [];
    String(text || '').split(/[\n\r,，、;；\t]+/).forEach(s => {
      const n = s.trim();
      if (n && !seen.has(n)) { seen.add(n); out.push(n); }
    });
    return out;
  }

  // ---------- 状态 ----------
  let tab = 'pick';          // pick | timer
  let names = [];            // 当前名单
  let drawn = new Set();     // 不重复模式下已抽中的姓名
  let noRepeat = true;
  let history = [];          // [{name, time}]
  let picking = false;
  let tLeft = 300, tRun = null;
  let ready = false;

  // ---------- 随机点名 ----------
  function renderRosterInfo() {
    $('#ct-roster-info').innerHTML = `共 <b>${names.length}</b> 名学生` +
      (noRepeat && drawn.size ? ` · 已抽 ${drawn.size} 人` : '');
  }

  function renderHistory() {
    $('#ct-history').innerHTML = history.map(h =>
      `<span>${esc(h.name)} · ${esc(h.time)}</span>`).join('');
  }

  // 抽取动画：先快滚后减速定格，最后从剩余池中抽一人
  function startPick() {
    if (picking) return;
    const slot = $('#ct-slot'), btn = $('#ct-go');
    if (!names.length) {
      slot.textContent = '请先在左侧导入名单';
      return;
    }
    let pool = noRepeat ? names.filter(n => !drawn.has(n)) : names.slice();
    if (!pool.length) {           // 全部抽过 → 自动重置再来一轮
      drawn.clear();
      pool = names.slice();
      renderRosterInfo();
    }
    picking = true;
    btn.disabled = true; btn.textContent = '…';
    slot.classList.remove('hit');
    // 用墙钟控制总时长（约 2.2s）：setTimeout 被系统节流时只是滚动帧变少，动画不会拖长
    const t0 = performance.now();
    const spin = () => {
      slot.textContent = names[Math.floor(Math.random() * names.length)];
      const el = performance.now() - t0;
      if (el >= 2200) { finish(); return; }
      setTimeout(spin, el < 1400 ? 55 : 150);   // 后段减速，定格更有"开奖感"
    };
    const finish = () => {
      const name = pool[Math.floor(Math.random() * pool.length)];
      if (noRepeat) drawn.add(name);
      history.unshift({ name, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
      history = history.slice(0, 8);
      slot.textContent = name;
      slot.classList.add('hit');
      picking = false;
      btn.disabled = false; btn.textContent = '🎲 再抽一个';
      renderRosterInfo();
      renderHistory();
    };
    spin();
  }

  // ---------- 课堂计时 ----------
  const fmtClock = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  function setClock(sec) {
    tLeft = Math.max(0, Math.round(sec));
    const clock = $('#ct-clock');
    clock.textContent = fmtClock(tLeft);
    clock.classList.toggle('warn', tLeft > 0 && tLeft <= 10);
  }
  function stopTimer() {
    if (tRun) { clearInterval(tRun); tRun = null; }
    $('#ct-t-start').textContent = '▶ 开始倒计时';
    const h = $('#ct-t-hint');
    if (h && h.textContent === '计时中…') h.textContent = '已暂停，点「开始倒计时」继续';
  }
  function tickTimer() {
    setClock(tLeft - 1);
    if (tLeft <= 0) {
      stopTimer();
      $('#ct-t-hint').textContent = '⏰ 时间到！';
      beep();
    }
  }
  // WebAudio 内置振荡器当提示音，零素材零依赖；不可用时静默
  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(t => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 880; g.gain.value = 0.12;
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.18);
      });
    } catch (e) { /* 无音频设备不影响计时 */ }
  }

  // ---------- 标签切换 ----------
  function setTab(t) {
    tab = t;
    $$('#page-classroom .ct-tab').forEach(b => b.classList.toggle('active', b.dataset.ctTab === t));
    ['pick', 'timer'].forEach(name => {
      const pane = $('#ct-pane-' + name);
      if (pane) pane.classList.toggle('hidden', name !== t);
    });
  }

  function init() {
    if (ready) return;
    ready = true;
    $$('#page-classroom .ct-tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.ctTab)));
    // 点名
    $('#ct-parse').addEventListener('click', () => {
      names = parseNames($('#ct-names').value);
      drawn.clear(); history = [];
      renderRosterInfo(); renderHistory();
      $('#ct-slot').textContent = names.length ? '点击「开始点名」' : '名单为空';
    });
    $('#ct-go').addEventListener('click', startPick);
    $('#ct-norepeat').addEventListener('change', e => {
      noRepeat = e.target.checked;
      if (noRepeat) drawn.clear();
      renderRosterInfo();
    });
    $('#ct-reset-drawn').addEventListener('click', () => {
      drawn.clear(); history = [];
      renderRosterInfo(); renderHistory();
    });
    // 计时
    $$('.ct-preset').forEach(b => b.addEventListener('click', () => {
      stopTimer(); setClock(parseInt(b.dataset.min, 10) * 60);
      $('#ct-t-hint').textContent = '讨论、练习、小组活动计时。最后 10 秒变红，结束有提示音。';
    }));
    $('#ct-t-plus').addEventListener('click', () => { setClock(tLeft + 30); });
    $('#ct-t-start').addEventListener('click', () => {
      if (tRun) { stopTimer(); return; }
      if (tLeft <= 0) setClock(300);
      $('#ct-t-start').textContent = '⏸ 暂停';
      $('#ct-t-hint').textContent = '计时中…';
      tRun = setInterval(tickTimer, 1000);
    });
    $('#ct-t-reset').addEventListener('click', () => {
      stopTimer(); setClock(300);
      $('#ct-t-hint').textContent = '讨论、练习、小组活动计时。最后 10 秒变红，结束有提示音。';
    });
    setClock(300);
  }

  // ---------- 持久化（名单随账号保存） ----------
  function state() {
    return { kind: 'classroom', tab, noRepeat, names: names.length ? names.slice() : null };
  }

  function applyScene(s) {
    init();
    if (s.tab) setTab(s.tab);
    if (Array.isArray(s.names)) {
      names = s.names.filter(n => typeof n === 'string' && n.trim());
      $('#ct-names').value = names.join('\n');
      drawn.clear(); history = [];
      renderRosterInfo(); renderHistory();
      $('#ct-slot').textContent = names.length ? '点击「开始点名」' : '名单为空';
    }
    if (typeof s.noRepeat === 'boolean' && s.noRepeat !== noRepeat) {
      noRepeat = s.noRepeat;
      $('#ct-norepeat').checked = noRepeat;
    }
  }

  return { init, state, applyScene, _internal: { parseNames } };
})();

/**
 * 杏坛教师助手 · 原型主逻辑
 * 三个视图：home（生成+课件列表）/ editor（预览+导出）/ present（全屏演示）
 */
(() => {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const LS_KEY = 'xingtan_coursewares';

  // ---------- 状态 ----------
  let deck = null;          // 当前课件
  let currentSlide = 0;     // 编辑器当前页
  let presentIdx = 0;       // 演示模式当前页

  // ---------- 工具 ----------
  function toast(msg, warn) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('warn', !!warn);
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  window.toast = toast; // 供 export.js 使用

  function loadRecent() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveRecent(list) { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 30))); }
  function upsertDeck(d) {
    const list = loadRecent().filter(x => x.id !== d.id);
    list.unshift(d);
    saveRecent(list);
  }

  const GRADES = {
    '小学': ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    '初中': ['七年级', '八年级', '九年级'],
    '高中': ['高一', '高二', '高三']
  };

  const TYPE_ZH = { cover: '封面', objectives: '目标', text: '讲解', demo: '互动演示', summary: '小结', homework: '作业' };

  // ---------- 视图切换 ----------
  function show(view) {
    $('#home-view').classList.toggle('hidden', view !== 'home');
    $('#editor-view').classList.toggle('hidden', view !== 'editor');
    $('#present-overlay').classList.toggle('hidden', view !== 'present');
    $('#topbar-actions').innerHTML = '';
  }

  // ---------- 首页 ----------
  function initHome() {
    const stageSel = $('#f-stage'), gradeSel = $('#f-grade');
    function fillGrades() {
      gradeSel.innerHTML = GRADES[stageSel.value].map(g => `<option>${g}</option>`).join('');
    }
    stageSel.addEventListener('change', fillGrades);
    fillGrades();

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $('#f-topic').value = chip.dataset.topic;
        $('#f-subject').value = chip.dataset.subject;
        document.body.dataset.subject = chip.dataset.subject;
      });
    });
    $('#f-subject').addEventListener('change', e => { document.body.dataset.subject = e.target.value; });
    document.body.dataset.subject = $('#f-subject').value;

    $('#btn-generate').addEventListener('click', generate);
    $('#f-topic').addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });

    renderRecent();
  }

  async function generate() {
    const topic = $('#f-topic').value.trim();
    if (!topic) { toast('请先填写课题', true); $('#f-topic').focus(); return; }
    const payload = {
      stage: $('#f-stage').value,
      grade: $('#f-grade').value,
      subject: $('#f-subject').value,
      textbook: $('#f-textbook').value,
      topic
    };
    const btn = $('#btn-generate'), status = $('#gen-status');
    btn.disabled = true;
    status.classList.remove('hidden');
    status.textContent = '正在生成：教研员正在备课，预计 10~30 秒……';
    // 假进度文案
    const tips = ['正在分析课题与教材对齐……', '正在设计教学环节……', '正在编排互动演示……', '正在润色课堂语言……'];
    let ti = 0;
    const tipTimer = setInterval(() => { status.textContent = tips[Math.min(ti++, tips.length - 1)]; }, 5000);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || '生成失败');
      deck = data.deck;
      upsertDeck(deck);
      if (data.source === 'fallback') {
        toast('AI 暂不可用，已用内置模板生成', true);
      } else {
        toast('生成完成：' + deck.title);
      }
      openEditor(0);
    } catch (err) {
      toast('生成失败：' + err.message, true);
    } finally {
      clearInterval(tipTimer);
      btn.disabled = false;
      status.classList.add('hidden');
      renderRecent();
    }
  }

  function renderRecent() {
    const list = loadRecent();
    const box = $('#recent-list');
    if (!list.length) {
      box.innerHTML = '<div class="recent-empty">还没有课件。上面输入课题，点「AI 生成课件」试试。</div>';
      return;
    }
    box.innerHTML = '';
    list.forEach(d => {
      const card = document.createElement('div');
      card.className = 'recent-card';
      card.innerHTML = `
        <div class="t">${escapeHtml(d.title)}</div>
        <div class="meta">${escapeHtml([d.grade, d.subject, d.textbook].filter(Boolean).join(' · ') || '—')}
          · ${d.slides.length} 页 · ${d.source === 'ai' ? 'AI' : '模板'}</div>
        <div class="ops">
          <button class="btn small open">打开</button>
          <button class="btn small present-now">▶ 演示</button>
          <button class="btn small del">删除</button>
        </div>`;
      card.querySelector('.open').addEventListener('click', () => { deck = d; openEditor(0); });
      card.querySelector('.present-now').addEventListener('click', () => { deck = d; startPresent(0); });
      card.querySelector('.del').addEventListener('click', () => {
        saveRecent(loadRecent().filter(x => x.id !== d.id));
        renderRecent();
      });
      box.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- 编辑器 ----------
  function openEditor(idx) {
    show('editor');
    if (deck.subject) document.body.dataset.subject = deck.subject;
    currentSlide = idx || 0;
    $('#editor-title').textContent = deck.title;
    renderSlideList();
    renderPreview();
  }

  function renderSlideList() {
    const box = $('#slide-list');
    box.innerHTML = '';
    deck.slides.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'thumb' + (i === currentSlide ? ' active' : '');
      b.innerHTML = `<div class="no">${i + 1}</div><div class="tt">${escapeHtml(s.title || TYPE_ZH[s.type])}</div><div class="tp">${TYPE_ZH[s.type] || ''}</div>`;
      b.addEventListener('click', () => { currentSlide = i; renderSlideList(); renderPreview(); });
      box.appendChild(b);
    });
  }

  function renderPreview() {
    const box = $('#slide-preview');
    Demos.destroyAll();
    box.innerHTML = '';
    const s = deck.slides[currentSlide];
    buildSlideEl(s, box, false);
    $('#slide-note').textContent = s.note ? '备注：' + s.note : '';
  }

  // 构造单页 DOM（编辑与演示共用）
  function buildSlideEl(s, container, isPresent) {
    const el = document.createElement('div');
    el.className = 'slide ' + s.type;

    if (s.type === 'cover') {
      el.innerHTML = `
        <div class="kicker">COURSEWARE</div>
        <h2 class="stitle">${escapeHtml(s.title || deck.title)}</h2>
        <div class="subtitle">${escapeHtml(s.subtitle || '')}</div>
        <div class="meta-line">${escapeHtml([deck.textbook, deck.grade, deck.subject].filter(Boolean).join(' · '))}</div>`;
    } else {
      const kicker = TYPE_ZH[s.type] === '互动演示' ? 'INTERACTIVE DEMO' : ({ objectives: 'LEARNING GOALS', summary: 'SUMMARY', homework: 'HOMEWORK' }[s.type] || 'COURSEWARE');
      el.innerHTML = `<div class="kicker">${kicker}</div><h2 class="stitle">${escapeHtml(s.title || '')}</h2>`;
      if (s.type === 'demo') {
        const area = document.createElement('div');
        area.className = 'demo-area';
        const demoBox = document.createElement('div');
        demoBox.className = 'demo-box-slot';
        area.appendChild(demoBox);
        if (s.instruction) {
          const tip = document.createElement('div');
          tip.className = 'demo-instruction';
          tip.textContent = '🖐 ' + s.instruction;
          area.appendChild(tip);
        }
        el.appendChild(area);
        // 下一帧再挂载，保证容器已布局（JSXGraph 需要真实尺寸）
        requestAnimationFrame(() => Demos.mount(demoBox, s.demo));
      } else if (Array.isArray(s.bullets)) {
        const ul = document.createElement('ul');
        ul.className = 'bullets';
        s.bullets.forEach(t => {
          const li = document.createElement('li');
          li.textContent = t;
          ul.appendChild(li);
        });
        el.appendChild(ul);
      }
    }
    container.appendChild(el);
    return el;
  }

  // ---------- 演示模式 ----------
  function startPresent(idx) {
    presentIdx = idx || 0;
    show('present');
    renderPresent();
  }

  function renderPresent() {
    const stage = $('#present-stage');
    Demos.destroyAll();
    stage.innerHTML = '';
    const s = deck.slides[presentIdx];
    buildSlideEl(s, stage, true);
    $('#present-progress').textContent = (presentIdx + 1) + ' / ' + deck.slides.length + '　' + (s.title || '');
  }

  function movePresent(delta) {
    const next = presentIdx + delta;
    if (next < 0 || next >= deck.slides.length) return;
    presentIdx = next;
    renderPresent();
  }

  function exitPresent() {
    Demos.destroyAll();
    openEditor(presentIdx);
  }

  // ---------- 全局事件 ----------
  function bindGlobal() {
    $('#btn-back').addEventListener('click', () => { renderRecent(); show('home'); });
    $('#btn-save').addEventListener('click', () => { upsertDeck(deck); renderRecent(); toast('已保存到本机'); });
    $('#btn-export').addEventListener('click', () => exportPptx(deck));
    $('#btn-present').addEventListener('click', () => startPresent(currentSlide));
    $('#btn-exit-present').addEventListener('click', exitPresent);
    $('#nav-prev').addEventListener('click', () => movePresent(-1));
    $('#nav-next').addEventListener('click', () => movePresent(1));

    document.addEventListener('keydown', e => {
      if ($('#present-overlay').classList.contains('hidden')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); movePresent(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); movePresent(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); exitPresent(); }
      else if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    });
  }

  // ---------- 启动 ----------
  async function boot() {
    bindGlobal();
    initHome();
    show('home');
    try {
      const h = await (await fetch('/api/health')).json();
      if (!h.ai) toast('未配置 AI Key，将使用内置模板生成');
    } catch (e) { /* 忽略 */ }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

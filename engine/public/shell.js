/**
 * 杏坛数学实验室 · 应用外壳
 * 登录/注册、侧边栏导航、工作台、我的演示（按账号隔离）、物理化学页接线
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const TOKEN_KEY = 'xt_token';

  let token = localStorage.getItem(TOKEN_KEY) || '';
  let me = null;
  let inited = { math: false, physics: false, chem: false, geogebra: false };
  let currentPage = 'dashboard';
  let ggbType = 'graphing';
  const GGB_TYPES = [
    { id: 'graphing', t: '图形计算器', d: '函数、方程、滑块' },
    { id: 'geometry', t: '几何画板', d: '点线圆、变换、测量' },
    { id: '3d', t: '3D 计算器', d: '曲面、立体几何' },
    { id: 'classic', t: '经典版（全功能）', d: '含 CAS / 表格 / 脚本' }
  ];
  const ggbTypeName = id => (GGB_TYPES.find(t => t.id === id) || {}).t || 'GeoGebra 画板';

  function toast(msg, warn) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('warn', !!warn);
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ================= 认证 =================
  async function boot() {
    bindAuth();
    if (token) {
      try {
        const r = await fetch('/api/auth/me', { headers: authHeaders() });
        if (r.ok) {
          const d = await r.json();
          me = d.username;
          enterApp();
          return;
        }
      } catch (e) { /* 服务未起 */ }
      token = ''; localStorage.removeItem(TOKEN_KEY);
    }
    showLogin();
  }

  function showLogin() {
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
  }

  function enterApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    $('#who').textContent = me;
    initShell();
    gotoPage('dashboard');
  }

  function bindAuth() {
    const doAuth = async path => {
      const username = $('#login-user').value.trim();
      const password = $('#login-pass').value;
      $('#login-err').textContent = '';
      try {
        const r = await fetch('/api/auth/' + path, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const d = await r.json();
        if (!d.ok) { $('#login-err').textContent = d.error; return; }
        token = d.token; me = d.username;
        localStorage.setItem(TOKEN_KEY, token);
        toast(path === 'login' ? '欢迎回来，' + me : '注册成功，欢迎 ' + me);
        enterApp();
      } catch (e) { $('#login-err').textContent = '网络错误：' + e.message; }
    };
    $('#btn-login').addEventListener('click', () => doAuth('login'));
    $('#btn-register').addEventListener('click', () => doAuth('register'));
    $('#login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doAuth('login'); });
    $('#login-user').addEventListener('keydown', e => { if (e.key === 'Enter') $('#login-pass').focus(); });
    $('#btn-logout').addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }); } catch (e) { /* ignore */ }
      token = ''; me = null;
      localStorage.removeItem(TOKEN_KEY);
      showLogin();
      toast('已退出登录');
    });
  }

  // ================= 导航 =================
  function initShell() {
    if (inited.shell) return;
    inited.shell = true;
    $$('#nav .nav-item').forEach(b => b.addEventListener('click', () => gotoPage(b.dataset.page, b.dataset.cat)));
    $('#math-save').addEventListener('click', saveScene);
    $('#dash-hello').textContent = '';
  }

  function gotoPage(page, cat) {
    currentPage = page;
    $$('.page').forEach(p => p.classList.add('hidden'));
    $('#page-' + page).classList.remove('hidden');
    $$('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page && (!b.dataset.cat || b.dataset.cat === (cat || ''))));
    if (page === 'math') {
      if (!inited.math) { MathLab.init(); inited.math = true; }
      if (cat) MathLab.setCategory(cat);
      else MathLab.setCategory('basic');
    } else if (page === 'physics') {
      if (!inited.physics) { initPhysics(); inited.physics = true; }
    } else if (page === 'chem') {
      if (!inited.chem) { initChem(); inited.chem = true; }
    } else if (page === 'geogebra') {
      if (!inited.geogebra) { initGeoGebra(); inited.geogebra = true; }
      renderGgbMine();
    } else if (page === 'mine') {
      renderMine();
    } else if (page === 'dashboard') {
      renderDashboard();
    }
  }

  // ================= 工作台 =================
  async function renderDashboard() {
    $('#dash-hello').textContent = `${me}，欢迎回来。选择左侧分类开始探索，或从下面快速进入。`;
    let count = 0;
    try {
      const r = await fetch('/api/scenes', { headers: authHeaders() });
      const d = await r.json();
      count = (d.scenes || []).length;
    } catch (e) { /* ignore */ }
    const cards = [
      { num: '15', lbl: '数学分类（小学 → 大学全学段）' },
      { num: '89', lbl: '一键函数预设（含 cot/sec/伽马/阶乘）' },
      { num: '13', lbl: '互动演示（导数/积分/泰勒/傅里叶/向量场…）' },
      { num: String(count), lbl: '我保存的演示' }
    ];
    $('#dash-cards').innerHTML = cards.map(c => `<div class="dash-card"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');

    const quick = [
      { cat: 'basic', t: '二次函数', d: '拖 a/b/c 看开口、顶点、对称轴', expr: 'a*x^2 + b*x + c' },
      { cat: 'trig', t: '正弦波', d: '振幅 A、频率 w、初相 p', expr: 'A*sin(w*x + p)' },
      { cat: 'calculus', t: '导数与切线', d: '拖动点观察切线斜率 = 导数', demo: 'deriv' },
      { cat: 'conic', t: '隐函数：圆', d: '直接输入 x^2 + y^2 = 25 即可画出', expr: 'x^2 + y^2 = 25' },
      { cat: 'conic', t: '向量场与流线', d: '输入 P、Q，点击图面释放粒子', demo: 'vfield' },
      { cat: 'param', t: '利萨茹曲线', d: '两个垂直简谐振动的合成', demo: 'lissajous' },
      { cat: 'param', t: '摆线滚动', d: '车轮上一点的轨迹动画', demo: 'cycloid' },
      { cat: 'fourier', t: '傅里叶变换 · 频谱', d: '时域信号分解出频率成分', demo: 'dft' },
      { cat: 'surface', t: '三维曲面', d: 'z = x²+y² 旋转抛物面（自动 3D）', expr: 'x^2 + y^2' }
    ];
    const q = $('#dash-quick');
    q.innerHTML = '';
    quick.forEach(c => {
      const b = document.createElement('button');
      b.className = 'quick-card';
      b.innerHTML = `<div class="t">${esc(c.t)}</div><div class="d">${esc(c.d)}</div>`;
      b.addEventListener('click', () => {
        gotoPage('math', c.cat);
        if (c.demo) {
          setTimeout(() => {
            const key = { deriv: '导数', dft: '频谱', lissajous: '利萨茹', cycloid: '摆线', 'fourier-square': '方波', vfield: '向量场' }[c.demo] || '方波';
            const btn = [...document.querySelectorAll('#demo-list .preset-item')].find(x => x.textContent.includes(key));
            btn && btn.click();
          }, 60);
        } else {
          setTimeout(() => {
            $('#expr-input').value = c.expr;
            $('#btn-add-fn').click();
          }, 60);
        }
      });
      q.appendChild(b);
    });
    // 最近保存
    const box = $('#dash-recent');
    try {
      const r = await fetch('/api/scenes', { headers: authHeaders() });
      const d = await r.json();
      const list = (d.scenes || []).slice(0, 3);
      box.innerHTML = list.length ? '' : '<div class="mine-empty">还没有保存的演示</div>';
      list.forEach(s => box.appendChild(mineCard(s, true)));
    } catch (e) {
      box.innerHTML = '<div class="mine-empty">加载失败</div>';
    }
  }

  // ================= GeoGebra 画板页 =================
  function loadGgbScript() {
    return new Promise((resolve, reject) => {
      if (window.GGBApplet) return resolve();
      const s = document.createElement('script');
      s.src = 'https://www.geogebra.org/apps/deployggb.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('GeoGebra 脚本加载失败（需要联网）'));
      document.head.appendChild(s);
    });
  }

  function injectGgb(type) {
    ggbType = type;
    const box = $('#ggb-app');
    box.innerHTML = '<div class="ggb-loading">正在加载 GeoGebra…（首次加载需联网，约几秒）</div>';
    const w = Math.max(640, box.clientWidth || 900);
    const h = Math.max(460, Math.min(700, window.innerHeight - 190));
    const params = {
      appName: type, id: 'ggbApplet', width: w, height: h,
      showToolBar: true, showAlgebraInput: true, showMenuBar: type === 'classic',
      showResetIcon: true, enableRightClick: true, language: 'zh_CN',
      appletOnLoad: () => {
        const tip = box.querySelector('.ggb-loading');
        if (tip) tip.remove();
      }
    };
    new GGBApplet(params, '5.0').inject('ggb-app');
  }

  async function initGeoGebra() {
    try {
      await loadGgbScript();
    } catch (e) {
      $('#ggb-app').innerHTML = '<div class="mine-empty">GeoGebra 加载失败：' + esc(e.message) + '。请检查网络后刷新重试。</div>';
      return;
    }
    const box = $('#ggb-types');
    if (!box.dataset.built) {
      box.dataset.built = '1';
      GGB_TYPES.forEach((tp, i) => {
        const b = document.createElement('button');
        b.className = 'template-item' + (i === 0 ? ' active' : '');
        b.dataset.id = tp.id;
        b.innerHTML = `<div class="t">${esc(tp.t)}</div><div class="d">${esc(tp.d)}</div>`;
        b.addEventListener('click', () => {
          $$('#ggb-types .template-item').forEach(x => x.classList.toggle('active', x.dataset.id === tp.id));
          injectGgb(tp.id);
        });
        box.appendChild(b);
      });
      $('#ggb-save').addEventListener('click', saveScene);
    }
    injectGgb(ggbType);
  }

  function ggbSnapshot() {
    return new Promise(resolve => {
      if (!window.ggbApplet) { toast('画板尚未加载完成', true); resolve(null); return; }
      window.ggbApplet.getBase64(data => resolve({
        kind: 'geogebra', subject: '数学', appType: ggbType,
        title: ggbTypeName(ggbType), data
      }));
    });
  }

  function renderGgbMine() {
    const box = $('#ggb-mine');
    box.innerHTML = '<div class="mine-empty" style="padding:14px;">加载中…</div>';
    fetch('/api/scenes', { headers: authHeaders() }).then(r => r.json()).then(d => {
      const list = (d.scenes || []).filter(s => s.kind === 'geogebra');
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<div class="mine-empty" style="padding:14px;">还没有保存的画板</div>';
        return;
      }
      list.forEach(s => {
        const b = document.createElement('button');
        b.className = 'template-item';
        b.innerHTML = `<div class="t">${esc(s.title)}</div><div class="d">${new Date(s.createdAt).toLocaleDateString()}</div>`;
        b.addEventListener('click', () => openScene(s));
        box.appendChild(b);
      });
    }).catch(() => { box.innerHTML = '<div class="mine-empty" style="padding:14px;">加载失败</div>'; });
  }

  // ================= 保存 / 我的演示 =================
  function snapshotScene() {
    if (currentPage === 'math') {
      const st = MathLab.state();
      return Object.assign(st, { title: st.exprs.length ? st.exprs[0].slice(0, 24) : '数学演示' });
    }
    if (currentPage === 'physics') {
      const tpl = Physics.list().find(t => t.id === Physics.currentId());
      return {
        kind: 'physics', subject: '物理', template: Physics.currentId(),
        title: tpl ? tpl.title : '物理实验',
        params: Physics.currentParams(),
        gravity: parseFloat($('#phy-gravity').value),
        trails: $('#phy-trails').checked
      };
    }
    if (currentPage === 'chem') {
      const r = ChemEngine.currentReaction();
      return { kind: 'chem', subject: '化学', reaction: r.id, title: r.title };
    }
    return null;
  }

  // 输入弹窗（代替 prompt，兼容所有环境）
  function askName(title, def) {
    return new Promise(resolve => {
      $('#ask-title').textContent = title;
      const inp = $('#ask-input');
      inp.value = def || '';
      $('#ask-modal').classList.remove('hidden');
      setTimeout(() => inp.focus(), 60);
      const done = v => {
        $('#ask-modal').classList.add('hidden');
        $('#ask-ok').onclick = $('#ask-cancel').onclick = inp.onkeydown = null;
        resolve(v);
      };
      $('#ask-ok').addEventListener('click', () => done(inp.value.trim() || null));
      $('#ask-cancel').addEventListener('click', () => done(null));
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') done(inp.value.trim() || null);
        if (e.key === 'Escape') done(null);
      });
    });
  }

  async function saveScene() {
    let scene;
    if (currentPage === 'geogebra') scene = await ggbSnapshot();
    else scene = snapshotScene();
    if (!scene) { toast('当前页没有可保存的内容', true); return; }
    const title = await askName('保存演示', scene.title);
    if (!title) return;
    scene.title = title;
    scene.id = uid();
    scene.createdAt = new Date().toISOString();
    try {
      const r = await fetch('/api/scenes', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ scene }) });
      const d = await r.json();
      if (d.ok) {
        toast('已保存到账号「' + me + '」');
        if (currentPage === 'geogebra') renderGgbMine();
      }
      else toast(d.error || '保存失败', true);
    } catch (e) { toast('保存失败：' + e.message, true); }
  }

  function mineCard(s, compact) {
    const card = document.createElement('div');
    card.className = 'mine-card';
    const meta = s.kind === 'physics'
      ? Object.values(s.params || {}).join(' / ')
      : s.kind === 'math' ? (s.exprs || []).join(' ｜ ').slice(0, 70)
        : s.kind === 'geogebra' ? ggbTypeName(s.appType)
          : (s.reaction || '');
    card.innerHTML = `
      <span class="subj">${esc(s.subject || ({ math: '数学', physics: '物理', chem: '化学', geogebra: 'GeoGebra' }[s.kind] || ''))}</span>
      <div class="t">${esc(s.title)}</div>
      <div class="m">${esc(meta || '')}</div>
      <div class="ops">
        <button class="btn small open">打开</button>
        ${compact ? '' : '<button class="btn small del">删除</button>'}
      </div>`;
    card.querySelector('.open').addEventListener('click', () => openScene(s));
    const del = card.querySelector('.del');
    if (del) del.addEventListener('click', async () => {
      await fetch('/api/scenes/delete', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: s.id }) });
      renderMine();
    });
    return card;
  }

  async function renderMine() {
    $('#mine-user').textContent = `（${me}）`;
    const box = $('#mine-list');
    box.innerHTML = '<div class="mine-empty">加载中…</div>';
    try {
      const r = await fetch('/api/scenes', { headers: authHeaders() });
      const d = await r.json();
      const list = d.scenes || [];
      box.innerHTML = list.length ? '' : '<div class="mine-empty">还没有保存的演示。在数学/物理/化学页操作后，点「💾 保存当前演示」。</div>';
      list.forEach(s => box.appendChild(mineCard(s, false)));
    } catch (e) {
      box.innerHTML = '<div class="mine-empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function openScene(s) {
    if (s.kind === 'math') {
      gotoPage('math');
      setTimeout(() => { MathLab.applyScene(s); }, 80);
    } else if (s.kind === 'physics') {
      gotoPage('physics');
      setTimeout(() => {
        selectTemplate(s.template);
        renderPhyParams(s.params);
        Physics.setScene(s.template, s.params);
        if (s.gravity !== undefined) {
          $('#phy-gravity').value = s.gravity;
          $('#phy-gravity-v').textContent = s.gravity;
          Physics.setGravity(s.gravity);
        }
        if (s.trails !== undefined) { $('#phy-trails').checked = s.trails; Physics.setTrails(s.trails); }
      }, 80);
    } else if (s.kind === 'chem') {
      gotoPage('chem');
      setTimeout(() => selectReaction(s.reaction), 80);
    } else if (s.kind === 'geogebra') {
      gotoPage('geogebra');
      setTimeout(() => {
        if (!window.ggbApplet || !s.data) return;
        if (s.appType && s.appType !== ggbType) {
          $$('#ggb-types .template-item').forEach(x => x.classList.toggle('active', x.dataset.id === s.appType));
          injectGgb(s.appType);
        }
        setTimeout(() => { try { window.ggbApplet.setBase64(s.data); toast('画板已恢复'); } catch (e) { toast('画板恢复失败', true); } }, 800);
      }, 1200);
    }
    toast('已打开：' + s.title);
  }

  // ================= 物理页 =================
  function initPhysics() {
    Physics.init($('#phy-canvas'));
    const box = $('#phy-templates');
    Physics.list().forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'template-item' + (i === 0 ? ' active' : '');
      b.dataset.id = t.id;
      b.innerHTML = `<div class="t">${esc(t.title)}</div><div class="d">${esc(t.desc)}</div>`;
      b.addEventListener('click', () => selectTemplate(t.id));
      box.appendChild(b);
    });
    $('#phy-play').addEventListener('click', () => {
      const p = !Physics.isPaused();
      Physics.setPaused(p);
      $('#phy-play').textContent = p ? '▶ 继续' : '⏸ 暂停';
    });
    $('#phy-reset').addEventListener('click', () => Physics.reset());
    $('#phy-save').addEventListener('click', saveScene);
    $('#phy-vectors').addEventListener('change', e => Physics.setVectors(e.target.checked));
    $('#phy-trails').addEventListener('change', e => Physics.setTrails(e.target.checked));
    $('#phy-gravity').addEventListener('input', e => {
      $('#phy-gravity-v').textContent = e.target.value;
      Physics.setGravity(parseFloat(e.target.value));
    });
    selectTemplate(Physics.list()[0].id);
  }

  function selectTemplate(id) {
    $$('#phy-templates .template-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    Physics.setScene(id, null);
    renderPhyParams();
  }

  function renderPhyParams(overrides) {
    const defs = Physics.paramDefs(Physics.currentId());
    const panel = $('#phy-params');
    panel.innerHTML = '';
    defs.forEach(d => {
      const v = overrides && overrides[d.key] !== undefined ? overrides[d.key] : d.value;
      const line = document.createElement('label');
      line.className = 'slider-line';
      line.innerHTML = `${esc(d.label)} <input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}"><span>${v}</span>`;
      const input = line.querySelector('input'), span = line.querySelector('span');
      input.addEventListener('input', () => {
        span.textContent = input.value;
        const cur = Physics.currentParams();
        cur[d.key] = parseFloat(input.value);
        Physics.setScene(Physics.currentId(), cur);
      });
      panel.appendChild(line);
    });
  }

  // ================= 化学页 =================
  const chemInited = { periodic: false, mol3: false };
  function initChem() {
    // 子标签：反应演示 | 元素周期表 | 分子 3D（惰性初始化各自面板）
    $$('#page-chem .chem-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('#page-chem .chem-tab').forEach(t => t.classList.toggle('active', t === tab));
        const name = tab.dataset.chemTab;
        $$('#page-chem .chem-pane').forEach(p => p.classList.toggle('hidden', p.id !== 'chem-pane-' + name));
        if (name === 'periodic' && !chemInited.periodic) { Periodic.init(); chemInited.periodic = true; }
        if (name === 'mol3' && !chemInited.mol3) { Mol3.init(); chemInited.mol3 = true; }
      });
    });
    ChemEngine.init({
      macro: $('#chem-macro'),
      micro: $('#chem-micro'),
      onCaption: st => {
        const r = ChemEngine.currentReaction();
        if (!r) return;
        $('#chem-caption').textContent = r.captions[st.captionIdx];
        $$('#chem-dots .dot').forEach((d, i) => d.classList.toggle('on', i === Math.round(st.showIdx)));
      },
      onPlayState: () => { $('#chem-play').textContent = '▶ 播放'; }
    });
    const box = $('#chem-reactions');
    ChemEngine.list().forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'template-item' + (i === 0 ? ' active' : '');
      b.dataset.id = r.id;
      b.innerHTML = `<div class="t">${esc(r.title)}</div><div class="d">${esc(r.equation)}</div>`;
      b.addEventListener('click', () => selectReaction(r.id));
      box.appendChild(b);
    });
    $('#chem-play').addEventListener('click', () => {
      if (ChemEngine.isPlaying()) { ChemEngine.pause(); $('#chem-play').textContent = '▶ 播放'; }
      else { ChemEngine.play(); $('#chem-play').textContent = '⏸ 暂停'; }
    });
    $('#chem-next').addEventListener('click', () => ChemEngine.next());
    $('#chem-prev').addEventListener('click', () => ChemEngine.prev());
    $('#chem-save').addEventListener('click', saveScene);
    selectReaction('electrolysis');
  }

  function selectReaction(id) {
    $$('#chem-reactions .template-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    ChemEngine.setReaction(id);
    const r = ChemEngine.currentReaction();
    $('#chem-equation').textContent = r.equation;
    const dots = $('#chem-dots');
    dots.innerHTML = '';
    for (let i = 0; i < r.stages.length; i++) {
      const d = document.createElement('button');
      d.className = 'dot' + (i === 0 ? ' on' : '');
      d.addEventListener('click', () => ChemEngine.gotoStage(i));
      dots.appendChild(d);
    }
    $('#chem-caption').textContent = r.captions[0];
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

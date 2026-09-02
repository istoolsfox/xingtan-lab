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
  let inited = { math: false, physics: false, chem: false, geogebra: false, chinese: false };
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
    $('#chinese-save').addEventListener('click', saveScene);
    $('#dash-hello').textContent = '';
    bindMathCatSelect();
    bindPresent();
    $$('.btn-export').forEach(b => b.addEventListener('click', exportImage));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.body.classList.contains('present')) setPresent(false);
    });
    // 窗口尺寸变化（接投影仪/分屏）时同步 2D 画板
    window.addEventListener('resize', () => {
      if (inited.math && currentPage === 'math') MathLab.resize();
    });
  }

  // 页面内数学分类下拉：免回侧边栏滚动，切分类即离开演示模式
  function bindMathCatSelect() {
    const sel = $('#math-cat');
    if (!sel || sel.dataset.built) return;
    sel.dataset.built = '1';
    [...new Set(Object.values(MathLab.CATS).map(c => c.level))].forEach(lv => {
      const og = document.createElement('optgroup');
      og.label = lv;
      Object.entries(MathLab.CATS).forEach(([id, c]) => {
        if (c.level !== lv) return;
        const o = document.createElement('option');
        o.value = id; o.textContent = c.name;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.addEventListener('change', () => {
      MathLab.setCategory(sel.value);
      $$('#nav .nav-item').forEach(b =>
        b.classList.toggle('active', b.dataset.page === 'math' && b.dataset.cat === sel.value));
    });
  }
  function syncMathCat() {
    const sel = $('#math-cat');
    if (sel && MathLab.CATS[MathLab.currentCategory()]) sel.value = MathLab.currentCategory();
  }

  // ================= 上课模式 =================
  // 课堂投屏：隐藏导航与两侧面板，画面占满窗口；Esc 或浮动按钮退出
  function setPresent(on) {
    document.body.classList.toggle('present', !!on);
    $('#present-exit').classList.toggle('hidden', !on);
    // 画板容器尺寸变了：rAF 驱动的引擎下一帧会自然跟上，2D 画板需显式重设尺寸
    if (inited.math && currentPage === 'math') MathLab.resize();
  }
  function bindPresent() {
    $('#btn-present').addEventListener('click', () => setPresent(true));
    $('#present-exit').addEventListener('click', () => setPresent(false));
  }

  // ================= 导出画面（插入课件用） =================
  function downloadDataURL(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  // JSXGraph 1.10 用 SVG 渲染：序列化成 data URL 图片，再画到 canvas 上转位图
  function svgToImage(svg) {
    return new Promise((resolve, reject) => {
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('svg load fail'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }
  async function exportMathPlot(name) {
    const vis = el => el && el.offsetParent !== null;
    const cvs = [...document.querySelectorAll('.plot-area canvas')].filter(vis);
    const svgs = [...document.querySelectorAll('.plot-area svg')].filter(vis);
    if (cvs.length === 1 && !svgs.length) { downloadDataURL(cvs[0].toDataURL('image/png'), name); return true; }
    // 多画布（如 DFT 时域+频域）或矢量画板：统一转图片后拼接成一张
    const parts = [];
    for (const c of cvs) parts.push({ img: c, w: c.width, h: c.height });
    for (const s of svgs) {
      try {
        parts.push({ img: await svgToImage(s), w: s.clientWidth || 860, h: s.clientHeight || 540 });
      } catch (e) { /* 单块失败跳过 */ }
    }
    if (!parts.length) return false;
    const out = document.createElement('canvas');
    const ctx = out.getContext('2d');
    const gap = 12;
    out.width = parts.reduce((a, p) => a + p.w, 0) + gap * (parts.length - 1);
    out.height = Math.max(...parts.map(p => p.h));
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    let x = 0;
    for (const p of parts) { ctx.drawImage(p.img, x, 0, p.w, p.h); x += p.w + gap; }
    downloadDataURL(out.toDataURL('image/png'), name);
    return true;
  }
  async function exportImage() {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const name = `杏坛-${currentPage}-${stamp}.png`;
    if (currentPage === 'chem') {
      // 宏观 + 微观纵向合成一张图（带方程式标题），插入 PPT 更完整
      const c1 = $('#chem-macro'), c2 = $('#chem-micro');
      const out = document.createElement('canvas');
      out.width = Math.max(c1.width, c2.width);
      out.height = c1.height + c2.height + 46;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
      const r = ChemEngine.currentReaction();
      ctx.fillStyle = '#1c2430'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(r ? r.equation : '化学反应演示', out.width / 2, 30);
      ctx.textAlign = 'left';
      ctx.drawImage(c1, 0, 40); ctx.drawImage(c2, 0, 44 + c1.height);
      downloadDataURL(out.toDataURL('image/png'), name);
      toast('画面已导出（宏观 + 微观合成图）');
      return;
    }
    if (currentPage === 'geogebra') {
      if (!window.ggbApplet) { toast('画板尚未加载完成', true); return; }
      window.ggbApplet.getPNG(2, false, url => {
        if (url) downloadDataURL(url, name); else toast('画板导出失败', true);
      });
      toast('正在导出画板…');
      return;
    }
    let ok = false;
    if (currentPage === 'math') ok = await exportMathPlot(name);
    else if (currentPage === 'physics') {
      const cv = $('#phy-canvas');
      if (cv) { downloadDataURL(cv.toDataURL('image/png'), name); ok = true; }
    } else if (currentPage === 'chinese') {
      const cv = $('#cn-scene');
      if (cv) { downloadDataURL(cv.toDataURL('image/png'), name); ok = true; }
    }
    if (ok) toast('画面已导出 PNG，可直接插入课件');
    else toast('当前页面没有可导出的画面', true);
  }

  function gotoPage(page, cat) {
    currentPage = page;
    document.body.dataset.page = page;
    $$('.page').forEach(p => p.classList.add('hidden'));
    $('#page-' + page).classList.remove('hidden');
    $$('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page && (!b.dataset.cat || b.dataset.cat === (cat || ''))));
    if (page === 'math') {
      if (!inited.math) { MathLab.init(); inited.math = true; }
      if (cat) MathLab.setCategory(cat);
      else if (!MathLab.CATS[MathLab.currentCategory()]) MathLab.setCategory('basic');
      syncMathCat();
    } else if (page === 'physics') {
      if (!inited.physics) { initPhysics(); inited.physics = true; }
    } else if (page === 'chem') {
      if (!inited.chem) { initChem(); inited.chem = true; }
    } else if (page === 'chinese') {
      if (!inited.chinese) { Chinese.init(); inited.chinese = true; }
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
    // 统计数字从各模块实时取——内容扩充后工作台自动跟上，不再手抄硬编码
    let presets = 0, demos = 0;
    Object.values(MathLab.CATS).forEach(c => { presets += c.presets.length; demos += (c.demos || []).length; });
    let count = 0;
    try {
      const r = await fetch('/api/scenes', { headers: authHeaders() });
      const d = await r.json();
      count = (d.scenes || []).length;
    } catch (e) { /* ignore */ }
    const cards = [
      { num: String(Object.keys(MathLab.CATS).length), lbl: '数学分类（小学 → 大学全学段）' },
      { num: String(presets), lbl: '一键函数预设（含 cot/sec/伽马/阶乘）' },
      { num: String(demos + Physics.list().length + ChemEngine.list().length), lbl: '互动演示 · 物理实验 · 化学反应' },
      { num: String(count), lbl: '我保存的演示' }
    ];
    $('#dash-cards').innerHTML = cards.map(c => `<div class="dash-card"><div class="num">${esc(c.num)}</div><div class="lbl">${esc(c.lbl)}</div></div>`).join('');

    // 快速开始：覆盖全部学科，点击即到达对应内容
    const quick = [
      { type: 'math', cat: 'basic', t: '二次函数', d: '拖 a/b/c 看开口、顶点、对称轴', expr: 'a*x^2 + b*x + c' },
      { type: 'math', cat: 'trig', t: '正弦波', d: '振幅 A、频率 w、初相 p', expr: 'A*sin(w*x + p)' },
      { type: 'math', cat: 'calculus', t: '导数与切线', d: '拖动点观察切线斜率 = 导数', demo: 'deriv' },
      { type: 'math', cat: 'conic', t: '隐函数：圆', d: '直接输入 x^2 + y^2 = 25 即可画出', expr: 'x^2 + y^2 = 25' },
      { type: 'math', cat: 'conic', t: '向量场与流线', d: '输入 P、Q，点击图面释放粒子', demo: 'vfield' },
      { type: 'math', cat: 'param', t: '利萨茹曲线', d: '两个垂直简谐振动的合成', demo: 'lissajous' },
      { type: 'math', cat: 'param', t: '摆线滚动', d: '车轮上一点的轨迹动画', demo: 'cycloid' },
      { type: 'math', cat: 'surface', t: '三维曲面', d: 'x²+y² 旋转抛物面（自动 3D）', expr: 'x^2 + y^2' },
      { type: 'chem', react: 'electrolysis', t: '水的电解', d: '宏观气泡 2:1 ↔ 微观分子重组联动' },
      { type: 'chem', react: 'neutralization', t: '酸碱中和', d: '酚酞褪色背后的 H⁺ + OH⁻ → H₂O' },
      { type: 'physics', tpl: 'fall-vs-projectile', t: '平抛 vs 自由落体', d: '同时释放，看谁先落地' },
      { type: 'physics', tpl: 'optics-refraction', t: '光的折射与全反射', d: '调入射角与介质，实时画光线' },
      { type: 'chinese', poem: 'jingyesi', t: '《静夜思》意境图', d: '逐句注释 + 动态月夜画面' },
      { type: 'geogebra', t: 'GeoGebra 画板', d: '几何作图 / 3D / CAS 符号计算' }
    ];
    const q = $('#dash-quick');
    q.innerHTML = '';
    quick.forEach(c => {
      const b = document.createElement('button');
      b.className = 'quick-card';
      b.innerHTML = `<div class="t">${esc(c.t)}</div><div class="d">${esc(c.d)}</div>`;
      b.addEventListener('click', () => openQuick(c));
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

  // 快速开始卡片 → 对应模块并直达内容（走各模块 API，不靠碰 DOM 找按钮）
  function openQuick(c) {
    if (c.type === 'math' || !c.type) {
      gotoPage('math', c.cat);
      setTimeout(() => {
        if (c.demo) { MathLab.openDemo(c.demo); return; }
        try {
          MathLab.addExpr(c.expr);
          $('#expr-error').textContent = '';
        } catch (e) { $('#expr-error').textContent = e.message; }
      }, 60);
    } else if (c.type === 'chem') {
      gotoPage('chem');
      setTimeout(() => selectReaction(c.react), 80);
    } else if (c.type === 'physics') {
      gotoPage('physics');
      setTimeout(() => selectTemplate(c.tpl), 80);
    } else if (c.type === 'chinese') {
      gotoPage('chinese');
      setTimeout(() => Chinese.applyScene({ tab: 'poem', poem: c.poem }), 80);
    } else if (c.type === 'geogebra') {
      gotoPage('geogebra');
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
        vectors: $('#phy-vectors').checked,
        trails: $('#phy-trails').checked
      };
    }
    if (currentPage === 'chem') {
      const r = ChemEngine.currentReaction();
      return { kind: 'chem', subject: '化学', reaction: r.id, title: r.title };
    }
    if (currentPage === 'chinese') {
      const st = Chinese.state();
      const poem = (st.poem && document.querySelector(`#cn-poem-list .template-item.active .t`) || {}).textContent;
      return { kind: 'chinese', subject: '语文', tab: st.tab, poem: st.poem, title: (st.tab === 'poem' && poem ? poem : '语文演示') };
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
      : s.kind === 'chinese' ? '语文 · ' + (s.tab === 'poem' ? '古诗文' : s.tab === 'outline' ? '课文脉络' : '写作框架')
        : s.kind === 'geogebra' ? ggbTypeName(s.appType)
          : (s.reaction || '');
    card.innerHTML = `
      <span class="subj">${esc(s.subject || ({ math: '数学', physics: '物理', chem: '化学', chinese: '语文', geogebra: 'GeoGebra' }[s.kind] || ''))}</span>
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

  // 我的演示：按学科筛选（全部/数学/物理/化学/语文/GeoGebra）
  let mineFilter = 'all';
  const MINE_KINDS = [['all', '全部'], ['math', '数学'], ['physics', '物理'], ['chem', '化学'], ['chinese', '语文'], ['geogebra', 'GeoGebra']];

  async function renderMine() {
    $('#mine-user').textContent = `（${me}）`;
    const box = $('#mine-list');
    box.innerHTML = '<div class="mine-empty">加载中…</div>';
    let list = [];
    try {
      const r = await fetch('/api/scenes', { headers: authHeaders() });
      const d = await r.json();
      list = d.scenes || [];
    } catch (e) {
      $('#mine-filters').innerHTML = '';
      box.innerHTML = '<div class="mine-empty">加载失败：' + esc(e.message) + '</div>';
      return;
    }
    const fl = $('#mine-filters');
    fl.innerHTML = '';
    MINE_KINDS.forEach(([k, label]) => {
      const n = k === 'all' ? list.length : list.filter(s => s.kind === k).length;
      const b = document.createElement('button');
      b.className = 'chip' + (mineFilter === k ? ' active' : '');
      b.textContent = `${label} ${n}`;
      b.addEventListener('click', () => { mineFilter = k; renderMine(); });
      fl.appendChild(b);
    });
    const shown = list.filter(s => mineFilter === 'all' || s.kind === mineFilter);
    box.innerHTML = shown.length ? '' : '<div class="mine-empty">该学科下还没有保存的演示。在各模块页操作后，点「💾 保存」。</div>';
    shown.forEach(s => box.appendChild(mineCard(s, false)));
  }

  function openScene(s) {
    if (s.kind === 'math') {
      gotoPage('math');
      setTimeout(() => { MathLab.applyScene(s); syncMathCat(); }, 80);
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
        if (s.vectors !== undefined) { $('#phy-vectors').checked = s.vectors; Physics.setVectors(s.vectors); }
        if (s.trails !== undefined) { $('#phy-trails').checked = s.trails; Physics.setTrails(s.trails); }
      }, 80);
    } else if (s.kind === 'chem') {
      gotoPage('chem');
      setTimeout(() => selectReaction(s.reaction), 80);
    } else if (s.kind === 'chinese') {
      gotoPage('chinese');
      setTimeout(() => Chinese.applyScene(s), 80);
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

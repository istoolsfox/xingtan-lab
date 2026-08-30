/**
 * 杏坛数学实验室 · 数学模块
 * - 初等/高等分类预设库，一键应用
 * - 函数列表：自动命名 f/g/h…，点列表或点曲线选中，右侧面板直接编辑
 * - 自由嵌套：表达式可引用已有函数名（如 g(x)=sin(f(x))），联动更新，循环检测
 * - 自定义参数：滑块 + 数值框自由调节
 * - 视图：拖拽平移、滚轮缩放、＋/－/复位
 * - 含 y 自动切 z=f(x,y) 三维曲面
 * - 高数演示：导数切线、黎曼积分、泰勒展开、傅里叶级数、DFT 频谱
 */
const MathLab = (() => {
  'use strict';
  const FN_NAMES = ['sin', 'cos', 'tan', 'atan', 'asin', 'acos', 'sqrt', 'abs', 'log', 'exp', 'min', 'max', 'PI', 'round', 'floor', 'ceil', 'sgn'];
  const FN_RE = new RegExp('\\b(' + FN_NAMES.join('|') + ')\\b', 'g');
  const COLORS = ['#3b6fd4', '#e05656', '#2fae6e', '#9b59b6', '#e67e22', '#16a085'];
  const NAME_SEQ = ['f', 'g', 'h', 'u', 'v', 'w'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- 分类与预设 ----------------
  const CATS = {
    basic: {
      name: '① 基本函数', level: '初等数学',
      intro: '一次、二次、反比例与绝对值函数——初中函数的起点。',
      presets: [
        { name: '一次函数', expr: 'k*x + b', desc: '斜率与截距' },
        { name: '二次函数（一般式）', expr: 'a*x^2 + b*x + c', desc: '开口/顶点/对称轴' },
        { name: '二次函数（顶点式）', expr: 'a*(x-h)^2 + k', desc: '顶点 (h,k)' },
        { name: '反比例函数', expr: 'k/x', desc: '双曲线' },
        { name: '绝对值函数', expr: 'a*abs(x) + b', desc: 'V 形折线' },
        { name: '分段拼合（示例）', expr: 'x + abs(x^2 - 4)', desc: '绝对值构造分段' }
      ],
      demos: []
    },
    power: {
      name: '② 幂·指数·对数', level: '初等数学',
      intro: '三类增长速度完全不同的基本初等函数。',
      presets: [
        { name: '幂函数', expr: 'x^a', desc: 'a 控制形状' },
        { name: '指数函数', expr: 'a^x', desc: '增长 / 衰减' },
        { name: '自然指数', expr: 'exp(x)', desc: 'e^x' },
        { name: '对数函数', expr: 'log(x)/log(a)', desc: 'log_a(x)' },
        { name: '指数 vs 幂', expr: 'a^x - x^2', desc: '谁增长更快？' }
      ],
      demos: []
    },
    trig: {
      name: '③ 三角函数', level: '初等数学',
      intro: '周期现象的数学语言。',
      presets: [
        { name: '正弦波', expr: 'A*sin(w*x + p)', desc: '振幅/频率/初相' },
        { name: '余弦波', expr: 'A*cos(w*x + p)', desc: '与正弦相差 π/2' },
        { name: '正切', expr: 'A*tan(w*x)', desc: '周期 π' },
        { name: '拍（叠加）', expr: 'sin(a*x) + sin(b*x)', desc: '频率接近形成拍' }
      ],
      demos: []
    },
    calculus: {
      name: '④ 微分与积分', level: '高等数学',
      intro: '切线的斜率是导数，曲线下的面积是积分。',
      presets: [
        { name: '三次曲线', expr: 'a*x^3 + b*x', desc: '配合下方演示观察' }
      ],
      demos: [
        { id: 'deriv', name: '导数与切线', desc: '拖动点，切线与导数实时变化' },
        { id: 'integral', name: '定积分 · 黎曼和', desc: '矩形逼近曲线下面积' }
      ]
    },
    series: {
      name: '⑤ 级数·泰勒展开', level: '高等数学',
      intro: '用多项式逼近任意光滑函数。',
      presets: [
        { name: '正弦', expr: 'sin(x)', desc: '配合泰勒演示' },
        { name: '多项式', expr: 'x - x^3/6 + x^5/120', desc: 'sin 的 5 阶泰勒' }
      ],
      demos: [
        { id: 'taylor-sin', name: '泰勒逼近 · sin x', desc: '阶数滑块 0~15' },
        { id: 'taylor-cos', name: '泰勒逼近 · cos x', desc: '偶次多项式' },
        { id: 'taylor-exp', name: '泰勒逼近 · e^x', desc: '各项均为正' }
      ]
    },
    fourier: {
      name: '⑥ 傅里叶', level: '高等数学',
      intro: '任何周期信号都是正弦波的叠加。',
      presets: [
        { name: '谐波叠加', expr: 'sin(x) + sin(3*x)/3 + sin(5*x)/5', desc: '方波的前 3 项' }
      ],
      demos: [
        { id: 'fourier-square', name: '傅里叶级数 · 方波', desc: 'N 项谐波合成方波' },
        { id: 'fourier-saw', name: '傅里叶级数 · 锯齿波', desc: '锯齿波合成' },
        { id: 'dft', name: '傅里叶变换 · 频谱', desc: '时域信号 → DFT → 频谱' }
      ]
    },
    surface: {
      name: '⑦ 三维曲面', level: '高等数学',
      intro: 'z = f(x, y)，输入含 y 的表达式自动进入三维。',
      presets: [
        { name: '旋转抛物面', expr: 'x^2 + y^2', desc: 'z = x²+y²' },
        { name: '马鞍面', expr: 'x^2 - y^2', desc: '双曲抛物面' },
        { name: '正弦波面', expr: 'sin(x)*cos(y)', desc: '二维驻波' },
        { name: '涟漪', expr: 'sin(sqrt(x^2 + y^2))', desc: '中心扩散波纹' },
        { name: '高斯峰', expr: 'exp(-(x^2 + y^2))', desc: '钟形曲面' },
        { name: '带参数的波', expr: 'a*sin(x*y)', desc: '拖 a 看变化' }
      ],
      demos: []
    },
    param: {
      name: '⑧ 参数曲线·极坐标', level: '拓展',
      intro: '当 x、y 各自随参数 t 变化，或用角度与半径描述曲线时，会得到一系列经典曲线。',
      presets: [],
      demos: [
        { id: 'rose', name: '极坐标玫瑰线', desc: 'r = cos(kθ)，花瓣数由 k 决定' },
        { id: 'lissajous', name: '利萨茹曲线', desc: '两个垂直简谐振动的合成' },
        { id: 'cycloid', name: '摆线滚动', desc: '滚轮上一点的轨迹（可播放动画）' }
      ]
    }
  };

  // ---------------- 表达式解析 ----------------
  // refNames: 允许被嵌套引用的已有函数名。表达式里的 g(x) 会被编译成 __F.g(x)，
  // __F 在每次求值时实时构建，因此被引用函数改动后引用方自动联动。
  function parseExpr(expr, refNames) {
    refNames = refNames || [];
    if (!/^[0-9a-zA-Z+\-*/().^\s,]+$/.test(expr)) throw new Error('含有不支持的字符');
    let js = expr.replace(/\bMath\s*\.\s*/g, '').replace(/\^/g, '**');
    const refs = refNames.filter(n => new RegExp('(^|[^a-zA-Z0-9_])' + n + '\\s*\\(').test(js));
    let stripped = js.replace(FN_RE, '');
    refs.forEach(n => { stripped = stripped.replace(new RegExp('\\b' + n + '\\s*\\(', 'g'), ''); });
    const refLetters = refs.join('');
    const letters = [...new Set(stripped.match(/[a-zA-Z]/g) || [])]
      .filter(c => c !== 'x' && c !== 'y' && c !== 'e' && !refLetters.includes(c));
    const is3D = /\by\b/.test(stripped);
    let withMath = js.replace(FN_RE, 'Math.$1').replace(/\bsgn\(/g, 'Math.sign(');
    refs.forEach(n => { withMath = withMath.replace(new RegExp('\\b' + n + '\\s*\\(', 'g'), '__F.' + n + '('); });
    const vars = is3D ? ['x', 'y'] : ['x'];
    const argNames = ['__F', ...vars, ...letters];
    const f = new Function(...argNames, `"use strict"; return (${withMath});`);
    // 试算：嵌套引用用替身作用域（任何函数返回 1）
    const stub = new Proxy({}, { get: () => () => 1 });
    try {
      const t0 = f(stub, ...vars.map(() => 1), ...letters.map(() => 1));
      if (typeof t0 !== 'number' || isNaN(t0)) throw new Error('表达式无法计算');
    } catch (e) {
      if (!refs.length) throw new Error('表达式无法计算');
    }
    return { f, params: letters, is3D, refs };
  }

  // ---------------- 模块状态 ----------------
  let board = null;              // 2D 画板
  let surf = null;               // 3D 渲染器
  let mode = '2d';               // '2d' | '3d' | 'demo'
  let catId = 'basic';
  let fns = [];                  // 2D 函数列表 {id,name,expr,f,params,pr,refs,color,visible,curve,fn}
  let fn3d = null;               // 3D 函数 {id,name,expr,f,params,pr,refs}
  let selectedId = null;         // 当前选中的 2D 函数 id
  let idc = 1;
  let colorIdx = 0;
  let demoState = null;          // 当前演示
  const $ = s => document.querySelector(s);

  // 引用作用域：实时构建，保证嵌套联动
  function scope() {
    const s = {};
    fns.forEach(o => { s[o.name] = o.fn; });
    return s;
  }
  function nextName() {
    for (const b of NAME_SEQ) if (!fns.some(o => o.name === b)) return b;
    let i = 2;
    while (fns.some(o => o.name === 'f' + i)) i++;
    return 'f' + i;
  }
  // entry 想引用 refNames，检查是否会形成循环嵌套
  function hasCycle(entry, refNames) {
    const byName = {};
    fns.forEach(o => { byName[o.name] = o; });
    const seen = new Set();
    const stack = refNames.slice();
    while (stack.length) {
      const n = stack.pop();
      if (n === entry.name) return true;
      const o = byName[n];
      if (o && !seen.has(n)) { seen.add(n); stack.push(...o.refs); }
    }
    return false;
  }
  const entryOf = id => fns.find(o => o.id === id);

  // ---------------- 2D ----------------
  function ensureBoard() {
    if (!board) {
      board = JXG.JSXGraph.initBoard('plot2d', {
        boundingbox: [-8, 6, 8, -6], axis: true, showCopyright: false,
        pan: { enabled: true, needShift: false, needTwoFinger: false },
        zoom: { wheel: true, needShift: false },
        showNavigation: false, keyboard: { enabled: false }
      });
    }
    return board;
  }

  function add2D(expr) {
    const p = parseExpr(expr, fns.map(o => o.name));
    const name = nextName();
    const color = COLORS[colorIdx++ % COLORS.length];
    const pr = {};
    p.params.forEach(k => { pr[k] = 1; });
    const entry = {
      id: 'fn' + idc++, name, expr, f: p.f, params: p.params, pr, refs: p.refs,
      color, visible: true
    };
    entry.fn = x => {
      try {
        const v = entry.f(scope(), x, ...entry.params.map(k => entry.pr[k]));
        return typeof v === 'number' ? v : NaN;
      } catch (e) { return NaN; }
    };
    entry.curve = ensureBoard().create('functiongraph', [entry.fn, -100, 100], { strokeColor: color, strokeWidth: 2.5 });
    entry.curve.on('down', () => { if (mode === '2d') selectFn(entry.id); });
    fns.push(entry);
    renderFnList();
    selectFn(entry.id);
    return entry;
  }

  function update2DExpr(entry, newExpr) {
    const others = fns.filter(o => o !== entry).map(o => o.name);
    const p = parseExpr(newExpr, others);
    if (hasCycle(entry, p.refs)) throw new Error('不允许循环嵌套（f → g → f）');
    entry.expr = newExpr;
    entry.f = p.f;
    entry.refs = p.refs;
    entry.params = p.params;
    entry.params.forEach(k => { if (entry.pr[k] === undefined) entry.pr[k] = 1; });
    board.update();
  }

  function remove2D(id) {
    const i = fns.findIndex(o => o.id === id);
    if (i < 0) return;
    board.removeObject(fns[i].curve);
    fns.splice(i, 1);
    if (selectedId === id) selectedId = fns.length ? fns[fns.length - 1].id : null;
    renderFnList();
    renderInspector();
  }

  // ---------------- 3D ----------------
  function add3D(expr) {
    const p = parseExpr(expr, fns.map(o => o.name));
    const pr = {};
    p.params.forEach(k => { pr[k] = 1; });
    fn3d = { id: 'fn3d', name: 'F', expr, f: p.f, params: p.params, pr, refs: p.refs, color: '#9b59b6' };
    fn3d.fn = (x, y) => {
      try {
        const v = fn3d.f(scope(), x, y, ...fn3d.params.map(k => fn3d.pr[k]));
        return typeof v === 'number' ? v : NaN;
      } catch (e) { return NaN; }
    };
    surf.setFunction(fn3d.fn, fn3d.pr);
    surf.resetView();
    renderFnList();
    renderInspector();
  }

  function update3DExpr(newExpr) {
    const p = parseExpr(newExpr, fns.map(o => o.name));
    fn3d.expr = newExpr;
    fn3d.f = p.f;
    fn3d.refs = p.refs;
    fn3d.params = p.params;
    fn3d.params.forEach(k => { if (fn3d.pr[k] === undefined) fn3d.pr[k] = 1; });
    surf.setFunction(fn3d.fn, fn3d.pr);
  }

  // ---------------- 视图切换 ----------------
  function setMode(m) {
    mode = m;
    const is2d = m === '2d' || m === 'demo';
    $('#plot2d').classList.toggle('hidden', !is2d || m === 'demo');
    $('#plot3d').classList.toggle('hidden', m !== '3d');
    $('#controls-3d').classList.toggle('hidden', m !== '3d');
    $('#c3-title').classList.toggle('hidden', m !== '3d');
    $('#view-badge').textContent = m === '3d' ? '三维视图' : m === 'demo' ? '互动演示' : '二维视图';
    $('#view-badge').classList.toggle('v3d', m === '3d');
    $('#expr-label').textContent = m === '3d' ? 'z = F(x, y) =' : 'f(x) =';
    $('#btn-back-fn').classList.toggle('hidden', m !== 'demo');
    $('#demo-bar').classList.toggle('hidden', m !== 'demo');
    $('#view-tools').classList.toggle('hidden', m !== '2d');
    if (m !== 'demo') renderInspector();
  }

  function addExpr(expr) {
    expr = (expr || '').replace(/\s+/g, ' ').trim();
    if (!expr) throw new Error('请输入表达式');
    const { is3D } = parseExpr(expr, fns.map(o => o.name));
    if (is3D) {
      setMode('3d');
      add3D(expr);
    } else {
      if (mode === '3d') setMode('2d');
      add2D(expr);
    }
  }

  // ---------------- 选中函数面板 ----------------
  function selectFn(id) {
    selectedId = id;
    renderFnList();
    renderInspector();
  }

  function paramRow(container, entry, k, onChange) {
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = `<span class="pk">${esc(k)}</span>` +
      `<input type="range" min="-10" max="10" step="0.1" value="${entry.pr[k]}">` +
      `<input type="number" step="0.1" value="${entry.pr[k]}">`;
    const [rg, num] = row.querySelectorAll('input');
    const set = v => {
      if (isNaN(v)) return;
      entry.pr[k] = v;
      rg.value = v; num.value = v;
      onChange();
    };
    rg.addEventListener('input', () => set(parseFloat(rg.value)));
    num.addEventListener('change', () => set(parseFloat(num.value)));
    container.appendChild(row);
  }

  function renderInspector() {
    const box = $('#fn-inspect');
    box.innerHTML = '';
    if (mode === 'demo') {
      box.innerHTML = '<div class="inspect-empty">互动演示运行中。<br>点「← 返回函数列表」后可继续编辑函数。</div>';
      return;
    }
    const is3 = mode === '3d';
    const entry = is3 ? fn3d : entryOf(selectedId);
    if (!entry) {
      box.innerHTML = '<div class="inspect-empty">点击左侧列表中的函数，<br>或直接点击图中曲线选中。<br><br>选中后可在此修改表达式、<br>调节参数、换色、删除。</div>';
      return;
    }
    // 标题
    const head = document.createElement('div');
    head.className = 'inspect-head';
    head.innerHTML = `<span class="sw" style="background:${entry.color || '#9b59b6'}"></span>` +
      `<span class="fx">${is3 ? 'z = F(x, y)' : 'y = ' + esc(entry.name) + '(x)'}</span>`;
    box.appendChild(head);
    // 表达式编辑
    const er = document.createElement('div');
    er.className = 'inspect-expr';
    er.innerHTML = `<input type="text" maxlength="80" value="${esc(entry.expr)}">` +
      `<button class="btn tiny primary">应用</button>` +
      `<div class="inspect-err"></div>`;
    const errEl = er.querySelector('.inspect-err');
    er.querySelector('button').addEventListener('click', () => {
      const v = er.querySelector('input').value.trim();
      if (!v) return;
      try {
        if (is3) update3DExpr(v); else update2DExpr(entry, v);
        errEl.textContent = '';
        renderFnList();
        renderInspector();
      } catch (e) { errEl.textContent = e.message; }
    });
    er.querySelector('input').addEventListener('keydown', e => {
      if (e.key === 'Enter') er.querySelector('button').click();
    });
    box.appendChild(er);
    // 参数（自动识别，滑块 + 数值框）
    if (entry.params.length) {
      const t = document.createElement('div');
      t.className = 'inspect-sub';
      t.textContent = '参数（可拖动或直接输入数值）';
      box.appendChild(t);
      const onChange = is3
        ? () => entry.params.forEach(k => surf.setParam(k, entry.pr[k]))
        : () => board.update();
      entry.params.forEach(k => paramRow(box, entry, k, onChange));
    } else {
      const t = document.createElement('div');
      t.className = 'inspect-sub';
      t.textContent = '该函数没有自由参数';
      box.appendChild(t);
    }
    if (is3) {
      const tip = document.createElement('div');
      tip.className = 'tip-3d';
      tip.textContent = '在上方表达式里引用已添加的二维函数（如 f(x)）即可嵌套；拖拽旋转视角，滚轮缩放。';
      box.appendChild(tip);
      return;
    }
    // 颜色 / 显示 / 删除
    const cr = document.createElement('div');
    cr.className = 'inspect-row';
    cr.innerHTML = `<span>颜色</span><input type="color" value="${entry.color}">` +
      `<label class="check-line"><input type="checkbox" ${entry.visible ? 'checked' : ''}>显示</label>`;
    cr.querySelector('input[type=color]').addEventListener('input', e => {
      entry.color = e.target.value;
      entry.curve.setAttribute({ strokeColor: entry.color });
      renderFnList();
      renderInspector();
    });
    cr.querySelector('input[type=checkbox]').addEventListener('change', e => {
      entry.visible = e.target.checked;
      entry.curve.setAttribute({ visible: entry.visible });
    });
    box.appendChild(cr);
    const del = document.createElement('button');
    del.className = 'btn small danger';
    del.textContent = '删除该函数';
    del.addEventListener('click', () => remove2D(entry.id));
    box.appendChild(del);
  }

  function renderFnList() {
    const box = $('#fn-list');
    box.innerHTML = '';
    if (mode === '3d') {
      if (fn3d) {
        const row = document.createElement('div');
        row.className = 'fn-item sel';
        row.innerHTML = `<span class="sw" style="background:#9b59b6"></span><span class="fx" title="${esc(fn3d.expr)}">F(x,y) = ${esc(fn3d.expr)}</span>`;
        box.appendChild(row);
      }
      return;
    }
    fns.forEach(o => {
      const row = document.createElement('div');
      row.className = 'fn-item' + (o.id === selectedId ? ' sel' : '') + (o.visible ? '' : ' off');
      row.innerHTML = `<span class="sw" style="background:${o.color}"></span>` +
        `<span class="fx" title="${esc(o.expr)}">${esc(o.name)}(x) = ${esc(o.expr)}</span>` +
        `<button class="del" title="删除">✕</button>`;
      row.addEventListener('click', e => {
        if (e.target.classList.contains('del')) { remove2D(o.id); return; }
        selectFn(o.id);
      });
      box.appendChild(row);
    });
  }

  // ---------------- 高数演示 ----------------
  const Demos = {
    deriv(div, bar) {
      const b = JXG.JSXGraph.initBoard(div, { boundingbox: [-4, 7, 4, -5], axis: true, showCopyright: false, showNavigation: false });
      const f = x => x * x * x - 3 * x;
      const fp = x => 3 * x * x - 3;
      b.create('functiongraph', [f, -20, 20], { strokeColor: '#3b6fd4', strokeWidth: 2.5 });
      b.create('functiongraph', [fp, -20, 20], { strokeColor: '#e05656', strokeWidth: 2, dash: 2 });
      const P = b.create('glider', [1, f(1), b.create('functiongraph', [f, -20, 20], { visible: false })], { name: 'P（可拖动）', size: 4, fillColor: '#e05656' });
      b.create('tangent', [P], { strokeColor: '#2fae6e', strokeWidth: 2 });
      b.create('text', [-3.7, 5.6, () => `x₀ = ${P.X().toFixed(2)}    切线斜率 f'(x₀) = ${fp(P.X()).toFixed(2)}`], { fontSize: 15, fontWeight: 'bold' });
      b.create('text', [-3.7, 4.9, '蓝：f(x) = x³ − 3x　红（虚）：f \'(x) = 3x² − 3　绿：切线'], { fontSize: 12, color: '#5b6575' });
      bar.innerHTML = '<div class="caption"><b>导数</b>：切线斜率 = 导数值。拖动红点 P，观察切线与导函数的对应关系。</div>';
      return () => JXG.JSXGraph.freeBoard(b);
    },
    integral(div, bar) {
      const b = JXG.JSXGraph.initBoard(div, { boundingbox: [-5, 8, 5, -1.5], axis: true, showCopyright: false, showNavigation: false });
      const f = x => x * x / 4 + 1;
      const curve = b.create('functiongraph', [f, -20, 20], { strokeColor: '#3b6fd4', strokeWidth: 2.5 });
      let a = -2, bnd = 2, n = 8;
      const exact = b.create('integral', [[() => a, () => bnd], curve], { fillColor: '#eaf1fd', fillOpacity: 0.6, curveLeft: { visible: false }, curveRight: { visible: false }, baseLabel: 'S' });
      let polys = [];
      const txt = b.create('text', [-4.7, 6.8, () => `n = ${n} 个矩形：黎曼和 ≈ ${riemann().toFixed(4)}　|　精确积分 S = ${((bnd ** 3 / 12 + bnd) - (a ** 3 / 12 + a)).toFixed(4)}`], { fontSize: 14, fontWeight: 'bold' });
      function riemann() {
        const w = (bnd - a) / n; let s = 0;
        for (let i = 0; i < n; i++) s += f(a + i * w) * w;
        return s;
      }
      function rebuild() {
        polys.forEach(p => b.removeObject(p));
        polys = [];
        const w = (bnd - a) / n;
        for (let i = 0; i < n; i++) {
          const x0 = a + i * w, h = f(x0);
          polys.push(b.create('polygon', [
            [() => x0, 0], [() => x0 + w, 0], [() => x0 + w, () => h], [() => x0, () => h]
          ], { borders: { strokeColor: '#e67e22', strokeWidth: 1 }, fillColor: '#f8c471', fillOpacity: 0.45, vertices: { visible: false } }));
        }
        b.update();
      }
      bar.innerHTML = `
        <div class="caption"><b>定积分</b>：矩形越多，黎曼和越接近真实面积。</div>
        <label class="slider-line">下限 a <input id="ig-a" type="range" min="-4.5" max="0" step="0.1" value="${a}"><span>${a}</span></label>
        <label class="slider-line">上限 b <input id="ig-b" type="range" min="0" max="4.5" step="0.1" value="${bnd}"><span>${bnd}</span></label>
        <label class="slider-line">矩形数 n <input id="ig-n" type="range" min="2" max="40" step="1" value="${n}"><span>${n}</span></label>`;
      const bind = (id, fn) => {
        const el = bar.querySelector('#' + id), sp = el.parentElement.querySelector('span');
        el.addEventListener('input', () => { sp.textContent = el.value; fn(parseFloat(el.value)); rebuild(); });
      };
      bind('ig-a', v => a = v); bind('ig-b', v => bnd = v); bind('ig-n', v => n = Math.round(v));
      rebuild();
      return () => JXG.JSXGraph.freeBoard(b);
    },
    taylor(kind) {
      return (div, bar) => {
        const isExp = kind === 'exp';
        const b = JXG.JSXGraph.initBoard(div, {
          boundingbox: isExp ? [-4.2, 12, 5, -1.5] : [-7.2, 2.4, 7.2, -2.4],
          axis: true, showCopyright: false, showNavigation: false
        });
        const OF = { sin: Math.sin, cos: Math.cos, exp: Math.exp }[kind];
        let n = 3;
        function approx(x) {
          let s = 0;
          if (kind === 'sin') { for (let k = 0; 2 * k + 1 <= n; k++) s += Math.pow(-1, k) * Math.pow(x, 2 * k + 1) / fact(2 * k + 1); }
          else if (kind === 'cos') { for (let k = 0; 2 * k <= n; k++) s += Math.pow(-1, k) * Math.pow(x, 2 * k) / fact(2 * k); }
          else { for (let k = 0; k <= n; k++) s += Math.pow(x, k) / fact(k); }
          return isFinite(s) ? s : NaN;
        }
        function fact(m) { let r = 1; for (let i = 2; i <= m; i++) r *= i; return r; }
        const dom = isExp ? 6 : 7.5;
        b.create('functiongraph', [OF, -20, 20], { strokeColor: '#3b6fd4', strokeWidth: 2.5, name: '原函数' });
        const approxCurve = b.create('functiongraph', [x => approx(x), -dom, dom], { strokeColor: '#e05656', strokeWidth: 2, dash: 2 });
        const lbl = { sin: 'sin x', cos: 'cos x', exp: 'eˣ' }[kind];
        const txt = b.create('text', [isExp ? -4 : -6.9, isExp ? 10.8 : 1.95, () => `红色虚线：${lbl} 的 ${n} 阶泰勒多项式（在 x = 0 处展开）`], { fontSize: 13, fontWeight: 'bold', color: '#e05656' });
        bar.innerHTML = `
          <div class="caption"><b>泰勒展开</b>：多项式如何在 0 附近逼近原函数，远离 0 时误差增大。</div>
          <label class="slider-line">阶数 n <input id="ty-n" type="range" min="0" max="15" step="1" value="${n}"><span>${n}</span></label>`;
        const el = bar.querySelector('#ty-n'), sp = el.parentElement.querySelector('span');
        el.addEventListener('input', () => { n = parseInt(el.value); sp.textContent = n; b.update(); });
        return () => JXG.JSXGraph.freeBoard(b);
      };
    },
    fourier(kind) {
      return (div, bar) => {
        const b = JXG.JSXGraph.initBoard(div, { boundingbox: [-9.8, 1.8, 9.8, -1.8], axis: true, showCopyright: false, showNavigation: false, axis: true });
        let N = 5;
        const approx = x => {
          let s = 0;
          if (kind === 'square') { for (let k = 1; k <= 2 * N - 1; k += 2) s += Math.sin(k * x) / k; return 4 / Math.PI * s; }
          for (let k = 1; k <= N; k++) s += Math.pow(-1, k + 1) * Math.sin(k * x) / k;
          return 2 * s;
        };
        const target = x => kind === 'square' ? Math.sign(Math.sin(x)) : ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) / Math.PI;
        b.create('functiongraph', [target, -20, 20], { strokeColor: '#9aa5b5', strokeWidth: 1.5 });
        b.create('functiongraph', [x => Math.sin(x), -20, 20], { strokeColor: '#c9a227', strokeWidth: 1.2, dash: 1 });
        b.create('functiongraph', [approx, -20, 20], { strokeColor: '#3b6fd4', strokeWidth: 2.8 });
        const txt = b.create('text', [-9.3, 1.5, () => `N = ${N} 项谐波　蓝：合成波　灰：目标${kind === 'square' ? '方波' : '锯齿波'}　黄(虚)：第 1 次谐波`], { fontSize: 12.5, fontWeight: 'bold' });
        bar.innerHTML = `
          <div class="caption"><b>傅里叶级数</b>：不断增加谐波项，合成波逐渐逼近目标波形（吉布斯振荡出现在跳变处）。</div>
          <label class="slider-line">谐波数 N <input id="fr-n" type="range" min="1" max="25" step="1" value="${N}"><span>${N}</span></label>`;
        const el = bar.querySelector('#fr-n'), sp = el.parentElement.querySelector('span');
        el.addEventListener('input', () => { N = parseInt(el.value); sp.textContent = N; b.update(); });
        return () => JXG.JSXGraph.freeBoard(b);
      };
    },
    rose(div, bar) {
      const b = JXG.JSXGraph.initBoard(div, { boundingbox: [-1.55, 1.55, 1.55, -1.55], axis: true, showCopyright: false, showNavigation: false, keepaspectratio: true });
      let k = 5;
      let c = null;
      function draw() {
        if (c) b.removeObject(c);
        const r = t => Math.cos(k * t);
        c = b.create('curve', [t => r(t) * Math.cos(t), t => r(t) * Math.sin(t),
          0, 2 * Math.PI * (k % 2 === 1 ? 1 : 2)], { strokeColor: '#3b6fd4', strokeWidth: 2.5 });
        b.update();
      }
      draw();
      b.create('text', [-1.45, 1.32, () => `r = cos(${k}θ)　${k % 2 === 1 ? k + ' 片花瓣' : '2k = ' + 2 * k + ' 片花瓣'}`], { fontSize: 14, fontWeight: 'bold' });
      bar.innerHTML = `
        <div class="caption"><b>玫瑰线</b>：花瓣数 = k（k 为奇数）或 2k（k 为偶数）。</div>
        <label class="slider-line">花瓣数 k <input id="ro-k" type="range" min="1" max="12" step="1" value="${k}"><span>${k}</span></label>`;
      const el = bar.querySelector('#ro-k'), sp = el.parentElement.querySelector('span');
      el.addEventListener('input', () => { k = parseInt(el.value); sp.textContent = k; draw(); });
      return () => JXG.JSXGraph.freeBoard(b);
    },
    lissajous(div, bar) {
      const b = JXG.JSXGraph.initBoard(div, { boundingbox: [-1.5, 1.5, 1.5, -1.5], axis: true, showCopyright: false, showNavigation: false, keepaspectratio: true });
      let a = 3, bb2 = 2, d = Math.PI / 2;
      let c = null;
      function draw() {
        if (c) b.removeObject(c);
        c = b.create('curve', [t => Math.sin(a * t + d), t => Math.sin(bb2 * t), 0, 2 * Math.PI],
          { strokeColor: '#3b6fd4', strokeWidth: 2.5 });
        b.update();
      }
      draw();
      b.create('text', [-1.4, 1.28, () => `x = sin(${a}t + δ)　y = sin(${bb2}t)　频率比 ${a}:${bb2}`], { fontSize: 13.5, fontWeight: 'bold' });
      bar.innerHTML = `
        <div class="caption"><b>利萨茹曲线</b>：两个互相垂直的简谐振动合成。频率比为整数比时曲线闭合——示波器就是这么测频率的。</div>
        <label class="slider-line">频率 a <input id="li-a" type="range" min="1" max="9" step="1" value="${a}"><span>${a}</span></label>
        <label class="slider-line">频率 b <input id="li-b" type="range" min="1" max="9" step="1" value="${bb2}"><span>${bb2}</span></label>
        <label class="slider-line">初相 δ <input id="li-d" type="range" min="0" max="3.14" step="0.05" value="${d}"><span>${d.toFixed(2)}</span></label>`;
      const bind = (id, set, fmt) => {
        const el = bar.querySelector('#' + id), sp = el.parentElement.querySelector('span');
        el.addEventListener('input', () => { set(parseFloat(el.value)); sp.textContent = fmt ? fmt(el.value) : el.value; draw(); });
      };
      bind('li-a', v => a = Math.round(v));
      bind('li-b', v => bb2 = Math.round(v));
      bind('li-d', v => d = v, v => parseFloat(v).toFixed(2));
      return () => JXG.JSXGraph.freeBoard(b);
    },
    cycloid(div, bar) {
      const b = JXG.JSXGraph.initBoard(div, { boundingbox: [-1.2, 3.2, 13.5, -1.4], axis: true, showCopyright: false, showNavigation: false });
      let tCur = 0, timer = null;
      // 轨迹（画到当前 t 为止）
      const trace = b.create('curve', [t => t - Math.sin(t), t => 1 - Math.cos(t), 0, () => Math.max(tCur, 0.001)],
        { strokeColor: '#3b6fd4', strokeWidth: 2.5 });
      const center = b.create('point', [() => tCur, () => 1], { size: 1.5, name: '', color: '#9aa5b5', fixed: true });
      const P = b.create('point', [() => tCur - Math.sin(tCur), () => 1 - Math.cos(tCur)], { size: 3.5, name: 'P', fillColor: '#e05656', strokeColor: '#e05656', fixed: true });
      const wheel = b.create('circle', [center, 1], { strokeColor: '#9aa5b5', strokeWidth: 1.5, dash: 2 });
      b.create('segment', [center, P], { strokeColor: '#e05656', strokeWidth: 1.5 });
      b.create('text', [0.2, 2.9, () => `x = t − sin t　y = 1 − cos t　已滚动 t = ${tCur.toFixed(2)}`], { fontSize: 13.5, fontWeight: 'bold' });
      bar.innerHTML = `
        <div class="caption"><b>摆线</b>：车轮沿直线滚动时，轮缘上一点 P 画出的轨迹。拖动 t 或点「播放」观看滚动过程。</div>
        <label class="slider-line">滚动 t <input id="cy-t" type="range" min="0" max="12.56" step="0.01" value="0"><span>0.00</span></label>
        <button id="cy-play" class="btn small primary">▶ 播放</button>`;
      const el = bar.querySelector('#cy-t'), sp = el.parentElement.querySelector('span');
      el.addEventListener('input', () => { stop(); tCur = parseFloat(el.value); sp.textContent = tCur.toFixed(2); b.update(); });
      const btn = bar.querySelector('#cy-play');
      function stop() {
        if (timer) { clearInterval(timer); timer = null; btn.textContent = '▶ 播放'; }
      }
      btn.addEventListener('click', () => {
        if (timer) { stop(); return; }
        btn.textContent = '⏸ 暂停';
        timer = setInterval(() => {
          tCur += 0.06;
          if (tCur > 12.56) tCur = 0;
          el.value = tCur; sp.textContent = tCur.toFixed(2);
          b.update();
        }, 40);
      });
      return () => { stop(); JXG.JSXGraph.freeBoard(b); };
    },
    dft(divWrap, bar) {
      // 双画布：时域 + 频域
      divWrap.style.display = 'flex';
      divWrap.style.gap = '10px';
      const d1 = document.createElement('div');
      const d2 = document.createElement('div');
      d1.id = 'xt-dft-t'; d2.id = 'xt-dft-f';
      d1.style.flex = d2.style.flex = '1';
      divWrap.appendChild(d1); divWrap.appendChild(d2);
      const bt = JXG.JSXGraph.initBoard('xt-dft-t', { boundingbox: [-0.05, 3.4, 1.05, -3.4], axis: true, showCopyright: false, showNavigation: false });
      const bf = JXG.JSXGraph.initBoard('xt-dft-f', { boundingbox: [0, 3.4, 15, -0.4], axis: true, showCopyright: false, showNavigation: false });
      const freqs = [2, 5, 9];
      let amps = [1, 1, 0.5];
      const Ns = 240;
      let sig = [], spec = [];
      function compute() {
        sig = [];
        for (let i = 0; i < Ns; i++) {
          const t = i / Ns;
          sig.push(amps[0] * Math.sin(2 * Math.PI * freqs[0] * t) + amps[1] * Math.sin(2 * Math.PI * freqs[1] * t) + amps[2] * Math.sin(2 * Math.PI * freqs[2] * t));
        }
        spec = [];
        for (let k = 0; k <= 15; k++) {
          let re = 0, im = 0;
          for (let i = 0; i < Ns; i++) {
            const ang = -2 * Math.PI * k * i / Ns;
            re += sig[i] * Math.cos(ang); im += sig[i] * Math.sin(ang);
          }
          spec.push(Math.hypot(re, im) * 2 / Ns);
        }
      }
      compute();
      let tCurve = bt.create('curve', [sig.map((_, i) => i / Ns), sig.slice()], { strokeColor: '#3b6fd4', strokeWidth: 1.6 });
      bt.create('text', [0.02, 3.0, '时域：y(t)（t ∈ [0,1] 秒）'], { fontSize: 13, fontWeight: 'bold' });
      // 频谱 stem
      const stems = [];
      for (let k = 1; k <= 15; k++) {
        stems.push(bf.create('segment', [[k, 0], [k, () => spec[k] || 0]], { strokeColor: '#9b59b6', strokeWidth: 3 }));
        stems.push(bf.create('point', [k, () => spec[k] || 0], { size: 2.5, fillColor: '#9b59b6', strokeColor: '#9b59b6', name: '', fixed: true }));
      }
      bf.create('text', [0.3, 3.0, '频域：|Y(k)| —— 三个峰 = 2/5/9 Hz'], { fontSize: 13, fontWeight: 'bold', color: '#9b59b6' });
      bar.innerHTML = `
        <div class="caption"><b>傅里叶变换（DFT）</b>：把三个正弦叠加的信号分解回频率成分。拖动幅度滑块，观察峰的高度变化。</div>
        ${[0, 1, 2].map(i => `<label class="slider-line">A${i + 1}（${freqs[i]}Hz） <input data-ai="${i}" type="range" min="0" max="2" step="0.05" value="${amps[i]}"><span>${amps[i]}</span></label>`).join('')}`;
      bar.querySelectorAll('input[data-ai]').forEach(el => {
        el.addEventListener('input', () => {
          amps[parseInt(el.dataset.ai)] = parseFloat(el.value);
          el.parentElement.querySelector('span').textContent = el.value;
          compute();
          bt.removeObject(tCurve);
          tCurve = bt.create('curve', [sig.map((_, i) => i / Ns), sig.slice()], { strokeColor: '#3b6fd4', strokeWidth: 1.6 });
          bf.update();
        });
      });
      return () => { JXG.JSXGraph.freeBoard(bt); JXG.JSXGraph.freeBoard(bf); };
    }
  };

  function openDemo(id) {
    const all = Object.values(CATS).flatMap(c => c.demos);
    const d = all.find(x => x.id === id);
    if (!d) return;
    $('#plot2d').classList.add('hidden');
    $('#plot3d').classList.add('hidden');
    $('#controls-3d').classList.add('hidden');
    $('#c3-title').classList.add('hidden');
    $('#view-badge').textContent = '互动演示';
    $('#view-badge').classList.remove('v3d');
    $('#btn-back-fn').classList.remove('hidden');
    $('#demo-bar').classList.remove('hidden');
    $('#demo-bar').innerHTML = '';
    $('#view-tools').classList.add('hidden');
    let wrap = $('#xt-demo-wrap');
    if (wrap) wrap.remove();
    wrap = document.createElement('div');
    wrap.id = 'xt-demo-wrap';
    wrap.style.cssText = 'flex:1;margin:8px;border-radius:10px;overflow:hidden;background:#fff';
    const inner = document.createElement('div');
    inner.id = 'xt-demo';
    inner.style.cssText = 'width:100%;height:100%';
    wrap.appendChild(inner);
    $('.plot-area').appendChild(wrap);
    mode = 'demo';
    renderFnList();
    renderInspector();
    const build = ({ deriv: Demos.deriv, integral: Demos.integral, rose: Demos.rose, lissajous: Demos.lissajous, cycloid: Demos.cycloid }[id]
      || id.startsWith('taylor') && Demos.taylor(id.slice(7))
      || id.startsWith('fourier') && Demos.fourier(id.slice(8))
      || Demos.dft);
    demoState = { id, destroy: build($('#xt-demo'), $('#demo-bar')) };
  }

  function closeDemo() {
    if (demoState) { try { demoState.destroy(); } catch (e) { /* ignore */ } demoState = null; }
    const wrap = $('#xt-demo-wrap');
    if (wrap) wrap.remove();
    if (fn3d && mode === '3d') setMode('3d');
    else setMode('2d');
    renderFnList(); renderInspector();
  }

  // ---------------- 分类面板 ----------------
  function setCategory(id) {
    catId = id;
    const cat = CATS[id];
    $('#preset-cat-title').textContent = cat.name + ' · ' + cat.level;
    const pl = $('#preset-list');
    pl.innerHTML = '';
    cat.intro && (() => {
      const p = document.createElement('div');
      p.className = 'cat-intro';
      p.textContent = cat.intro;
      pl.appendChild(p);
    })();
    cat.presets.forEach(p => {
      const b = document.createElement('button');
      b.className = 'preset-item';
      b.innerHTML = `<div class="t">${p.name}</div><div class="d">${p.expr}</div>`;
      b.addEventListener('click', () => {
        if (mode === 'demo') closeDemo();
        try { addExpr(p.expr); $('#expr-error').textContent = ''; }
        catch (e) { $('#expr-error').textContent = e.message; }
      });
      pl.appendChild(b);
    });
    const dl = $('#demo-list');
    dl.innerHTML = '';
    $('#demo-title').classList.toggle('hidden', !cat.demos.length);
    cat.demos.forEach(d => {
      const b = document.createElement('button');
      b.className = 'preset-item demo-item';
      b.innerHTML = `<div class="t">🔬 ${d.name}</div><div class="d">${d.desc}</div>`;
      b.addEventListener('click', () => openDemo(d.id));
      dl.appendChild(b);
    });
  }

  // ---------------- 对外 ----------------
  function init() {
    board = null;
    surf = new Surface3D($('#plot3d'));
    setMode('2d');
    ensureBoard();
    setCategory('basic');
    try { add2D('k*x + b'); } catch (e) { /* ignore */ }

    $('#btn-add-fn').addEventListener('click', () => {
      try {
        if (mode === 'demo') closeDemo();
        addExpr($('#expr-input').value);
        $('#expr-input').value = '';
        $('#expr-error').textContent = '';
      } catch (e) { $('#expr-error').textContent = e.message; }
    });
    $('#expr-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#btn-add-fn').click();
    });
    $('#btn-clear-fn').addEventListener('click', clearAll);
    $('#btn-back-fn').addEventListener('click', closeDemo);
    // 2D 视图变换（拖拽平移 / 滚轮缩放已在画板开启）
    $('#view-zi').addEventListener('click', () => board.zoomIn());
    $('#view-zo').addEventListener('click', () => board.zoomOut());
    $('#view-reset').addEventListener('click', () => board.setBoundingBox([-8, 6, 8, -6]));
    $('#c3-zoom').addEventListener('input', e => {
      $('#c3-zoom-v').textContent = e.target.value;
      surf.zoom = parseInt(e.target.value) / 100;
    });
    $('#c3-reset').addEventListener('click', () => { surf.resetView(); $('#c3-zoom').value = 62; $('#c3-zoom-v').textContent = '62'; surf.zoom = 0.62; });
    $('#c3-spin').addEventListener('click', e => {
      surf.spin = !surf.spin;
      e.target.textContent = surf.spin ? '停止旋转' : '自动旋转';
    });
  }

  function clearAll() {
    if (mode === 'demo') closeDemo();
    fns.forEach(o => board.removeObject(o.curve));
    fns = []; fn3d = null; colorIdx = 0; selectedId = null;
    surf.setFunction(null);
    setMode('2d');
    renderFnList(); renderInspector();
  }

  function state() {
    return {
      kind: 'math',
      view: mode === '3d' ? '3d' : '2d',
      exprs: mode === '3d' && fn3d ? [fn3d.expr] : fns.map(o => o.expr)
    };
  }

  function applyScene(s) {
    clearAll();
    (s.exprs || []).forEach(e => { try { addExpr(e); } catch (err) { /* skip */ } });
  }

  return { init, setCategory, addExpr, state, applyScene, CATS };
})();

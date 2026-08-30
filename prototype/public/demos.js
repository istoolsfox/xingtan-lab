/**
 * 学科交互演示组件（杏坛 · 原型）
 * 数学：JSXGraph 本地实时仿真；物理/化学：PhET 官方开源仿真（iframe 嵌入）。
 * Demos.mount(el, kind) 在 el 内创建演示；Demos.destroyAll() 清理。
 */
const Demos = (() => {
  const boards = [];

  const PHET = {
    'phet-projectile': 'https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_all.html?locale=zh_CN',
    'phet-waves': 'https://phet.colorado.edu/sims/html/wave-on-a-string/latest/wave-on-a-string_all.html?locale=zh_CN',
    'phet-states': 'https://phet.colorado.edu/sims/html/states-of-matter/latest/states-of-matter_all.html?locale=zh_CN',
    'phet-reactants': 'https://phet.colorado.edu/sims/html/reactants-products-and-leftovers/latest/reactants-products-and-leftovers_all.html?locale=zh_CN'
  };

  const LABELS = {
    'parabola': '二次函数 y=ax²+bx+c 参数探究',
    'line': '一次函数 y=kx+b 斜率与截距',
    'sine': '三角函数 y=A·sin(ωx+φ)',
    'triangle': '三角形内角和',
    'phet-projectile': 'PhET 抛体运动仿真',
    'phet-waves': 'PhET 绳波演示',
    'phet-states': 'PhET 物质三态（分子热运动）',
    'phet-reactants': 'PhET 化学反应与质量守恒'
  };

  function noLib(el) {
    el.innerHTML = '<div class="demo-fallback">交互组件库（JSXGraph）未能加载。首次使用需要联网加载 CDN 资源，请检查网络后刷新重试。</div>';
  }

  function makeBoard(el, opts) {
    const div = document.createElement('div');
    div.className = 'demo-box jxgbox';
    div.id = 'jxg_' + Math.random().toString(36).slice(2, 9);
    el.appendChild(div);
    const board = JXG.JSXGraph.initBoard(div.id, Object.assign({
      boundingbox: [-8, 6, 8, -6],
      axis: true,
      showCopyright: false,
      keepaspectratio: false,
      pan: { enabled: false },
      zoom: { wheel: false }
    }, opts));
    boards.push(board);
    return board;
  }

  // 数学组件们 ------------------------------------------------

  function parabola(el) {
    const b = makeBoard(el);
    const a = b.create('slider', [[-6.5, -4.2], [-2.5, -4.2], [-3, 1, 3]], { name: 'a', snapWidth: 0.1 });
    const bb = b.create('slider', [[-6.5, -4.9], [-2.5, -4.9], [-4, 0, 4]], { name: 'b', snapWidth: 0.1 });
    const c = b.create('slider', [[-6.5, -5.6], [-2.5, -5.6], [-4, 0, 4]], { name: 'c', snapWidth: 0.1 });
    const f = x => a.Value() * x * x + bb.Value() * x + c.Value();
    b.create('functiongraph', [f, -10, 10], { strokeColor: '#4f6ef2', strokeWidth: 3 });
    const xv = () => -bb.Value() / (2 * a.Value());
    const vtx = () => f(xv());
    b.create('point', [xv, vtx], { name: '顶点', size: 4, fillColor: '#e05656', strokeColor: '#e05656', fixed: true });
    b.create('line', [[xv, -10], [xv, 10]], { strokeColor: '#e05656', dash: 2, strokeWidth: 1, highlight: false });
    b.create('text', [2.5, -4.3, () => 'y = ' + a.Value().toFixed(1) + 'x² ' + (bb.Value() >= 0 ? '+' : '−') + ' ' + Math.abs(bb.Value()).toFixed(1) + 'x ' + (c.Value() >= 0 ? '+' : '−') + ' ' + Math.abs(c.Value()).toFixed(1)], { fontSize: 16, fontWeight: 'bold' });
    b.create('text', [2.5, -5.0, () => '顶点 (' + xv().toFixed(2) + ', ' + vtx().toFixed(2) + ')  对称轴 x = ' + xv().toFixed(2)], { fontSize: 15, color: '#e05656' });
    b.create('text', [2.5, -5.7, () => '开口' + (a.Value() > 0 ? '向上 ⌣' : a.Value() < 0 ? '向下 ⌢' : '—（a=0，退化为直线）')], { fontSize: 15 });
  }

  function line(el) {
    const b = makeBoard(el);
    const k = b.create('slider', [[-6.5, -4.6], [-2.5, -4.6], [-3, 1, 3]], { name: 'k', snapWidth: 0.1 });
    const bb = b.create('slider', [[-6.5, -5.5], [-2.5, -5.5], [-4, 1, 4]], { name: 'b', snapWidth: 0.1 });
    const f = x => k.Value() * x + bb.Value();
    b.create('functiongraph', [f, -10, 10], { strokeColor: '#4f6ef2', strokeWidth: 3 });
    b.create('text', [2.5, -4.5, () => 'y = ' + k.Value().toFixed(1) + 'x ' + (bb.Value() >= 0 ? '+' : '−') + ' ' + Math.abs(bb.Value()).toFixed(1)], { fontSize: 17, fontWeight: 'bold' });
    b.create('text', [2.5, -5.5, () => 'k > 0 上升 ↗   k < 0 下降 ↘   b 决定与 y 轴交点'], { fontSize: 14, color: '#5a6474' });
  }

  function sine(el) {
    const b = makeBoard(el, { boundingbox: [-1, 8, 13, -8] });
    const A = b.create('slider', [[0.3, -6.4], [4, -6.4], [0.5, 2, 3]], { name: 'A', snapWidth: 0.1 });
    const w = b.create('slider', [[0.3, -7.2], [4, -7.2], [0.5, 1, 3]], { name: 'ω', snapWidth: 0.1 });
    const phi = b.create('slider', [[6.5, -6.4], [10.5, -6.4], [-3, 0, 3]], { name: 'φ', snapWidth: 0.1 });
    const f = x => A.Value() * Math.sin(w.Value() * x + phi.Value());
    b.create('functiongraph', [f, 0, 12.5], { strokeColor: '#4f6ef2', strokeWidth: 3 });
    b.create('text', [7, -4.6, () => 'y = ' + A.Value().toFixed(1) + '·sin(' + w.Value().toFixed(1) + 'x ' + (phi.Value() >= 0 ? '+' : '−') + ' ' + Math.abs(phi.Value()).toFixed(1) + ')'], { fontSize: 16, fontWeight: 'bold' });
    b.create('text', [7, -5.6, () => 'A 控制振幅（最高点）  ω 控制周期（T = 2π/ω）'], { fontSize: 14, color: '#5a6474' });
  }

  function triangle(el) {
    const b = makeBoard(el, {
      boundingbox: [-7, 6, 7, -6], axis: false, keepaspectratio: true,
      defaultAxes: undefined
    });
    const A = b.create('point', [-3.5, -2.5], { name: 'A', size: 3 });
    const B = b.create('point', [3.5, -2.5], { name: 'B', size: 3 });
    const C = b.create('point', [0, 3], { name: 'C', size: 3 });
    b.create('polygon', [A, B, C], { fillColor: '#4f6ef2', fillOpacity: 0.12, borders: { strokeColor: '#4f6ef2', strokeWidth: 2 } });
    const deg = (P, Q, R) => {
      const v1 = [Q.X() - P.X(), Q.Y() - P.Y()], v2 = [R.X() - P.X(), R.Y() - P.Y()];
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const m = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
      return m === 0 ? 0 : Math.acos(Math.min(1, Math.max(-1, dot / m))) * 180 / Math.PI;
    };
    b.create('text', [-5.8, 4.8, () => '∠A = ' + deg(A, B, C).toFixed(1) + '°   ∠B = ' + deg(B, A, C).toFixed(1) + '°   ∠C = ' + deg(C, A, B).toFixed(1) + '°'], { fontSize: 17, fontWeight: 'bold' });
    b.create('text', [-5.8, 3.9, () => '内角和 = ' + (deg(A, B, C) + deg(B, A, C) + deg(C, A, B)).toFixed(1) + '°  —— 拖动任意顶点试试！'], { fontSize: 15, color: '#e05656' });
  }

  // PhET -------------------------------------------------------

  function phet(el, kind) {
    const box = document.createElement('div');
    box.className = 'demo-box';
    const iframe = document.createElement('iframe');
    iframe.className = 'phet';
    iframe.src = PHET[kind];
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    box.appendChild(iframe);
    el.appendChild(box);
  }

  // 对外接口 ---------------------------------------------------

  function mount(el, kind) {
    el.innerHTML = '';
    if (PHET[kind]) return phet(el, kind);
    if (typeof JXG === 'undefined') return noLib(el);
    switch (kind) {
      case 'parabola': return parabola(el);
      case 'line': return line(el);
      case 'sine': return sine(el);
      case 'triangle': return triangle(el);
      default: el.innerHTML = '<div class="demo-fallback">未知演示组件：' + kind + '</div>';
    }
  }

  function destroyAll() {
    while (boards.length) {
      try { JXG.JSXGraph.freeBoard(boards.pop()); } catch (e) { /* 忽略 */ }
    }
  }

  return { mount, destroyAll, LABELS };
})();

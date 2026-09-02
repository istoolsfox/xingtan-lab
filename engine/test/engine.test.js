/**
 * 引擎离线冒烟测试（node:test，零依赖）
 * 覆盖：表达式路由/解析、隐函数等值线几何、极坐标、场景保存恢复、化学阶段签名一致性
 * 运行：node --test engine/test/
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ---------- 浏览器环境桩 ----------
function el() {
  const e = {
    style: {}, dataset: {}, children: [], value: '', textContent: '', _inner: '',
    selectionStart: 0, selectionEnd: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild(c) { this.children.push(c); }, remove() {},
    querySelector() { return el(); },
    querySelectorAll() { return [el(), el(), el()]; },
    setAttribute() {}, focus() {}, click() {},
    setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; },
    dispatchEvent() {},
  };
  Object.defineProperty(e, 'innerHTML', { get() { return this._inner; }, set(v) { this._inner = v; this.children = []; } });
  return e;
}
const els = {};
global.document = { querySelector(s) { return els[s] || (els[s] = el()); }, createElement() { return el(); } };
global.window = { event: null };
global.requestAnimationFrame = fn => setTimeout(fn, 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeInput(value, cursor) {
  const i = el();
  i.value = value;
  i.selectionStart = i.selectionEnd = cursor;
  return i;
}

function evalModule(file, exportName) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
  (0, eval)(src + `;globalThis.${exportName} = ${exportName};`);
  return globalThis[exportName];
}

// ---------- 智能插入（纯函数，独立于画板） ----------
describe('smartInsert', () => {
  const MathLab0 = evalModule('mathlab.js', 'MathLab');
  const si = (value, cursor, fname, opts) => {
    const input = makeInput(value, cursor);
    MathLab0._internal.smartInsert(input, fname, opts);
    return { value: input.value, cursor: input.selectionStart };
  };
  test('光标在参数 a 上 → sin 包裹且光标在括号内', () => {
    assert.deepStrictEqual(si('a*x+b', 1, 'sin'), { value: 'sin(a)*x+b', cursor: 4 });
  });
  test('token 外围已有括号 → 不重复加括号', () => {
    assert.deepStrictEqual(si('(a)*x', 2, 'sin'), { value: 'sin(a)*x', cursor: 4 });
  });
  test('token 属于函数调用（sin(b)）→ 嵌套包裹为 cos(sin(b))', () => {
    assert.deepStrictEqual(si('k*x + sin(b)', 10, 'cos'), { value: 'k*x + cos(sin(b))', cursor: 10 });
  });
  test('光标不在 token 上 → 插入 sin() 且光标居中', () => {
    assert.deepStrictEqual(si('a*x+', 4, 'cos'), { value: 'a*x+cos()', cursor: 8 });
  });
  test('数字 token 同样被包裹', () => {
    assert.deepStrictEqual(si('x+42', 4, 'sqrt'), { value: 'x+sqrt(42)', cursor: 7 });
  });
  test('x² 后缀包裹 / π 插入 PI', () => {
    assert.deepStrictEqual(si('a*x', 1, null, { postfix: true }), { value: 'a^2*x', cursor: 3 });
    assert.deepStrictEqual(si('2*', 3, 'PI'), { value: '2*PI', cursor: 5 });
  });
});

// ---------- 数值分析 ----------
describe('findZeros', () => {
  const MathLab0 = evalModule('mathlab.js', 'MathLab');
  test('sin 在 [-7,7] 求得 5 个零点（含 ±2π），误差 < 1e-8', () => {
    const zs = MathLab0._internal.findZeros(Math.sin, -7, 7);
    assert.strictEqual(zs.length, 5);
    for (const expected of [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI]) {
      assert.ok(zs.some(z => Math.abs(z - expected) < 1e-8), `应有零点 ${expected}`);
    }
  });
  test('x²+1 无零点返回空数组', () => {
    assert.deepStrictEqual(MathLab0._internal.findZeros(x => x * x + 1, -10, 10), []);
  });
});

// ---------- 数学实验室 ----------
describe('mathlab', () => {
  let created = [];
  let bb = [-8, 6, 8, -6];
  let boardHandlers = {};
  const emitBoard = ev => (boardHandlers[ev] || []).forEach(fn => fn());
  global.Surface3D = class { setFunction() {} resetView() {} setParam() {} };
  global.JXG = {
    COORDS_BY_SCREEN: 1,
    JSXGraph: {
      initBoard() {
        return {
          create(type, parents, attrs) { const o = { type, parents, attrs, on() {}, setAttribute() {} }; created.push(o); return o; },
          on(ev, fn) { (boardHandlers[ev] = boardHandlers[ev] || []).push(fn); },
          update() {}, removeObject() {}, getBoundingBox() { return bb; },
        };
      }
    }
  };
  const MathLab = evalModule('mathlab.js', 'MathLab');
  MathLab.init();

  test('隐函数 x²+y²=25 生成半径 ≈5 的闭合等值线', () => {
    created = [];
    MathLab.addExpr('x^2 + y^2 = 25');
    const curves = created.filter(c => c.type === 'curve');
    assert.ok(curves.length >= 1, '应生成曲线对象');
    const [X, Y] = curves[0].parents;
    assert.ok(X.length > 100, `等值线点数充足（${X.length}）`);
    const radii = X.map((x, i) => Math.hypot(x, Y[i])).filter(Number.isFinite);
    assert.ok(Math.min(...radii) > 4.85 && Math.max(...radii) < 5.15, `半径应≈5（实际 ${Math.min(...radii).toFixed(3)}~${Math.max(...radii).toFixed(3)}）`);
  });

  test('极坐标 r=1+cos(θ) 心形线过极点且外径≈2', () => {
    created = [];
    MathLab.addExpr('r = 1 + cos(θ)');
    const pol = created.filter(c => c.type === 'curve');
    assert.strictEqual(pol.length, 1);
    const [XF, YF] = pol[0].parents;
    assert.strictEqual(typeof XF, 'function', '应以参数函数形式给出');
    let rmax = 0, near0 = false;
    for (let i = 0; i <= 4000; i++) {
      const t = i / 4000 * 8 * Math.PI;
      const r = Math.hypot(XF(t), YF(t));
      if (Number.isFinite(r)) { rmax = Math.max(rmax, r); if (r < 0.05) near0 = true; }
    }
    assert.ok(rmax > 1.5, `最大半径应≈2（实际 ${rmax.toFixed(3)}）`);
    assert.ok(near0, '心形线应在 θ=π 处过极点');
  });

  test('路由校验：多等号/极坐标含 y 被拒绝', () => {
    assert.throws(() => MathLab.addExpr('x^2 = 3 = 4'), /等号/);
    assert.throws(() => MathLab.addExpr('r = sin(y)'), /极坐标/);
  });

  test('裸含 y 表达式自动进三维（修复一元求值画空曲线）', () => {
    MathLab.applyScene({ exprs: [] });
    MathLab.addExpr('x^2 + y^2');
    assert.strictEqual(MathLab.state().view, '3d');
    assert.deepStrictEqual(MathLab.state().exprs, ['x^2 + y^2']);
    MathLab.applyScene({ exprs: [] });
  });

  test('场景完整往返：分类/参数/颜色随场景保存恢复；旧场景（无新字段）仍兼容', () => {
    MathLab.setCategory('quadratic');
    MathLab.applyScene({ exprs: ['a*x^2 + b*x + c'] });
    const e = MathLab._internal.lastEntry();
    e.pr.a = 2; e.pr.b = -1; e.pr.c = 3;
    e.color = '#123456';
    const st = MathLab.state();
    assert.strictEqual(st.cat, 'quadratic');
    assert.strictEqual(st.fns.length, 1);
    MathLab.applyScene({ exprs: ['sin(x)'] });   // 先切到别的内容
    MathLab.applyScene(st);                       // 再完整恢复
    const e2 = MathLab._internal.lastEntry();
    assert.strictEqual(e2.expr, 'a*x^2 + b*x + c');
    assert.deepStrictEqual(e2.pr, { a: 2, b: -1, c: 3 });
    assert.strictEqual(e2.color, '#123456');
    // 旧场景：只有 exprs 字段也能恢复（兼容性纪律）
    MathLab.applyScene({ kind: 'math', exprs: ['x^2/25 + y^2/9 = 1'] });
    assert.deepStrictEqual(MathLab.state().exprs, ['x^2/25 + y^2/9 = 1']);
  });

  test('场景保存与恢复：隐函数/极坐标表达式原样往返', () => {
    MathLab.applyScene({ exprs: ['x^2/25 + y^2/9 = 1', 'r = 1 + cos(t)', 'sin(x)'] });
    const st = MathLab.state();
    assert.deepStrictEqual(st.exprs, ['x^2/25 + y^2/9 = 1', 'r = 1 + cos(t)', 'sin(x)']);
  });

  test('普通函数嵌套联动不受新类型影响', () => {
    MathLab.applyScene({ exprs: ['a*x^2', 'sin(f(x)/2)'] });
    assert.strictEqual(MathLab.state().exprs.length, 2);
  });

  test('无限画布：视口平移后函数曲线定义域跟随重建', async () => {
    MathLab.applyScene({ exprs: ['x^2'] });
    created = [];
    bb = [20, 10, 40, -10];          // 模拟向右平移两屏
    emitBoard('update');
    await sleep(20);                 // rAF 桩走 setTimeout
    const fg = created.filter(c => c.type === 'functiongraph').pop();
    assert.ok(fg, '视口变化应重建 functiongraph');
    assert.ok(fg.parents[1] <= 20 && fg.parents[2] >= 40,
      `定义域应覆盖新视口（实际 ${fg.parents[1]}..${fg.parents[2]}）`);
    bb = [-8, 6, 8, -6];
  });

  test('全学段函数库：15 个分类、学段标记齐全、每个分类有预设', () => {
    const cats = Object.values(MathLab.CATS);
    assert.strictEqual(cats.length, 15);
    for (const c of cats) {
      assert.ok(['小学', '初中', '高中', '大学', '拓展'].includes(c.level), `${c.name} level=${c.level}`);
      assert.ok(c.presets.length >= 2, `${c.name} 预设过少`);
    }
  });

  test('所有预设表达式均可解析添加（含新函数/极坐标/隐函数）', () => {
    const failed = [];
    let total = 0;
    for (const c of Object.values(MathLab.CATS)) {
      for (const p of c.presets) {
        total++;
        try { MathLab.addExpr(p.expr); } catch (e) { failed.push(`${c.id}/${p.expr} → ${e.message}`); }
      }
    }
    MathLab.applyScene({ exprs: ['x'] });
    assert.deepStrictEqual(failed, [], failed.join('；'));
    assert.ok(total >= 85, `预设总数 ${total}`);
  });

  test('新内置函数求值正确（cot/sec/csc/gamma/fact）', () => {
    MathLab.applyScene({ exprs: [] });
    const at = (expr, x) => {
      MathLab.addExpr(expr);
      const v = MathLab._internal.lastEntry().fn(x);
      MathLab.applyScene({ exprs: [] });
      return v;
    };
    assert.ok(Math.abs(at('sec(x) - 2', Math.PI / 3)) < 1e-9, 'sec(π/3)=2');
    assert.ok(Math.abs(at('cot(x) - 1', Math.PI / 4)) < 1e-9, 'cot(π/4)=1');
    assert.ok(Math.abs(at('csc(x) - 2', Math.PI / 6)) < 1e-9, 'csc(π/6)=2');
    assert.ok(Math.abs(at('gamma(x)', 3) - 2) < 1e-9, 'Γ(3)=2');
    assert.ok(Math.abs(at('gamma(x)', 0.5) - Math.sqrt(Math.PI)) < 1e-9, 'Γ(1/2)=√π');
    assert.ok(Math.abs(at('fact(x)', 4) - 24) < 1e-9, '4!=24');
  });
});

// ---------- 化学引擎 ----------
describe('chemistry', () => {
  global.performance = { now: () => 0 };
  global.cancelAnimationFrame = () => {};
  const hook = 'globalThis.__check = () => REACTIONS.map(r => ({ id: r.id, macro: r.macro, caps: r.captions.length, nStages: r.stages.length, sigs: r.stages.map(s => { const d = s(); return d.atoms.map(a => a.el).join(",") + "#" + d.atoms.length; }) }));\n  return { init, setReaction,';
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'chemistry.js'), 'utf8').replace('return { init, setReaction,', hook) + ';globalThis.ChemEngine = ChemEngine;';
  (0, eval)(src);
  const chem = globalThis.ChemEngine;
  chem.init({ macro: { width: 900, height: 290, getContext: () => null }, micro: { width: 900, height: 290, getContext: () => null } });

  test('反应库齐全（初中重点 + 中和/还原扩充）', () => {
    const ids = chem.list().map(r => r.id);
    for (const id of ['electrolysis', 'combustion', 'carbon-burn', 'methane-burn', 'fe-cuso4', 'neutralization', 'co-reduce-cuo']) {
      assert.ok(ids.includes(id), `缺少反应 ${id}`);
    }
  });

  test('所有反应各阶段原子数量与元素序列一致（补间引擎的前提）', () => {
    // 通过 setReaction 驱动并读取闭包内 REACTIONS 的等价校验：直接重放 stages
    for (const r of globalThis.__check()) {
      assert.ok(r.sigs.every(s => s === r.sigs[0]), `${r.id} 阶段签名不一致:\n  ${r.sigs.join('\n  ')}`);
    }
  });

  test('每个反应都有宏观渲染器，且解说条数与阶段数一致', () => {
    const MACROS = ['electrolyzer', 'combustion', 'charcoal', 'methane', 'displacement', 'neutral', 'co-reduce'];
    for (const r of globalThis.__check()) {
      assert.ok(MACROS.includes(r.macro), `${r.id} 宏观渲染器 "${r.macro}" 未注册`);
      assert.strictEqual(r.caps, r.nStages, `${r.id} captions(${r.caps}) 与 stages(${r.nStages}) 数量不一致`);
    }
  });
});

// ---------- 课堂工具（名单解析纯函数） ----------
describe('classroom', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'classroom.js'), 'utf8')
    .replace('return { init, state, applyScene, _internal: { parseNames } };', 'return { init, state, applyScene, __t: { parseNames } };')
    + ';globalThis.ClassroomMod = Classroom;';
  (0, eval)(src);
  const parse = globalThis.ClassroomMod.__t.parseNames;

  test('名单解析：换行/逗号/顿号/分号分隔，去空去重，保留姓名内部空格', () => {
    assert.deepStrictEqual(parse('张三\n李四，王五、张三；赵六'),
      ['张三', '李四', '王五', '赵六']);
    assert.deepStrictEqual(parse('  \n\n'), []);
    assert.deepStrictEqual(parse('Tom Smith'), ['Tom Smith']);
    assert.deepStrictEqual(parse('张三\r\n张三'), ['张三']);
  });
});

// ---------- 语文模块（数据健全性：新增条目只需加数据，此处保证不写错字段） ----------
describe('chinese', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'chinese.js'), 'utf8')
    .replace('return { init, state, applyScene };', 'return { init, state, applyScene, __data: { POEMS, SCENERY, OUTLINES, WRITINGS } };')
    + ';globalThis.ChineseMod = Chinese;';
  (0, eval)(src);
  const { POEMS, SCENERY, OUTLINES, WRITINGS } = globalThis.ChineseMod.__data;

  test('古诗文库：每首诗字段齐全，意境元素类型都已注册', () => {
    assert.ok(POEMS.length >= 10, `古诗数量 ${POEMS.length}，扩充后应 ≥10`);
    for (const p of POEMS) {
      assert.ok(p.id && p.title && p.author && p.grade, `${p.id || '?'} 基础字段缺失`);
      assert.ok(p.lines.length >= 4 && p.lines.every(l => l.text && l.note), `${p.title} 诗句/注释缺失`);
      assert.ok(typeof p.translation === 'string' && p.translation.length > 10, `${p.title} 缺译文`);
      assert.ok(typeof p.mood === 'string' && p.mood.startsWith('意境：'), `${p.title} 缺意境赏析`);
      assert.ok(p.scenery.length >= 3, `${p.title} 意境元素过少`);
      for (const s of p.scenery) {
        assert.ok(SCENERY[s.type], `${p.title} 引用了未注册的意境元素 "${s.type}"`);
      }
    }
  });

  test('课文脉络与写作框架：结构字段齐全', () => {
    assert.ok(OUTLINES.length >= 4, `课文脉络 ${OUTLINES.length}`);
    for (const o of OUTLINES) {
      assert.ok(o.title && o.root && o.idea, `${o.id} 字段缺失`);
      assert.ok(o.nodes.length >= 3 && o.nodes.every(n => n.text && Array.isArray(n.children)), `${o.title} 节点结构缺失`);
    }
    assert.ok(WRITINGS.length >= 4, `写作框架 ${WRITINGS.length}`);
    for (const w of WRITINGS) {
      assert.ok(w.name && w.tip && w.blocks.length >= 3 && w.blocks.every(b => b.title && b.tips.length), `${w.name} 结构缺失`);
    }
  });
});

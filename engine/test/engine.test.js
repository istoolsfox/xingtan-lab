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
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild(c) { this.children.push(c); }, remove() {},
    querySelector() { return el(); },
    querySelectorAll() { return [el(), el()]; },
    setAttribute() {}, focus() {}, click() {},
  };
  Object.defineProperty(e, 'innerHTML', { get() { return this._inner; }, set(v) { this._inner = v; this.children = []; } });
  return e;
}
const els = {};
global.document = { querySelector(s) { return els[s] || (els[s] = el()); }, createElement() { return el(); } };
global.window = { event: null };
global.requestAnimationFrame = fn => setTimeout(fn, 0);

function evalModule(file, exportName) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
  (0, eval)(src + `;globalThis.${exportName} = ${exportName};`);
  return globalThis[exportName];
}

// ---------- 数学实验室 ----------
describe('mathlab', () => {
  let created = [];
  global.Surface3D = class { setFunction() {} resetView() {} setParam() {} };
  global.JXG = {
    COORDS_BY_SCREEN: 1,
    JSXGraph: {
      initBoard() {
        return {
          create(type, parents, attrs) { const o = { type, parents, attrs, on() {}, setAttribute() {} }; created.push(o); return o; },
          on() {}, update() {}, removeObject() {}, getBoundingBox() { return [-8, 6, 8, -6]; },
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

  test('场景保存与恢复：隐函数/极坐标表达式原样往返', () => {
    MathLab.applyScene({ exprs: ['x^2/25 + y^2/9 = 1', 'r = 1 + cos(t)', 'sin(x)'] });
    const st = MathLab.state();
    assert.deepStrictEqual(st.exprs, ['x^2/25 + y^2/9 = 1', 'r = 1 + cos(t)', 'sin(x)']);
  });

  test('普通函数嵌套联动不受新类型影响', () => {
    MathLab.applyScene({ exprs: ['a*x^2', 'sin(f(x)/2)'] });
    assert.strictEqual(MathLab.state().exprs.length, 2);
  });
});

// ---------- 化学引擎 ----------
describe('chemistry', () => {
  global.performance = { now: () => 0 };
  global.cancelAnimationFrame = () => {};
  const hook = 'globalThis.__check = () => REACTIONS.map(r => ({ id: r.id, sigs: r.stages.map(s => { const d = s(); return d.atoms.map(a => a.el).join(",") + "#" + d.atoms.length; }) }));\n  return { init, setReaction,';
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'chemistry.js'), 'utf8').replace('return { init, setReaction,', hook) + ';globalThis.ChemEngine = ChemEngine;';
  (0, eval)(src);
  const chem = globalThis.ChemEngine;
  chem.init({ macro: { width: 900, height: 290, getContext: () => null }, micro: { width: 900, height: 290, getContext: () => null } });

  test('初中重点反应库齐全', () => {
    const ids = chem.list().map(r => r.id);
    for (const id of ['electrolysis', 'combustion', 'carbon-burn', 'methane-burn', 'fe-cuso4']) {
      assert.ok(ids.includes(id), `缺少反应 ${id}`);
    }
  });

  test('所有反应各阶段原子数量与元素序列一致（补间引擎的前提）', () => {
    // 通过 setReaction 驱动并读取闭包内 REACTIONS 的等价校验：直接重放 stages
    for (const r of globalThis.__check()) {
      assert.ok(r.sigs.every(s => s === r.sigs[0]), `${r.id} 阶段签名不一致:\n  ${r.sigs.join('\n  ')}`);
    }
  });
});

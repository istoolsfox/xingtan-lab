/**
 * 杏坛 · 物理演示引擎（PoC）
 * matter.js 内核 + 自定义渲染：速度矢量、运动轨迹、真实单位 HUD。
 * 内置实验模板化（Physics.TEMPLATES），新增实验只需加一个模板定义。
 */
const Physics = (() => {
  const { Engine, World, Bodies, Body, Composite, Constraint, Vector } = Matter;
  const PPM = 42; // 像素/米
  const W = 900, H = 520;

  let engine = null, canvas, ctx;
  let current = null;          // 当前模板实例
  let templateId = null;
  let params = {};
  let paused = false;
  let showVectors = true, showTrails = false;
  let gravity = 9.8;
  let trailMap = new Map();    // body.id -> [{x,y}]
  let hudFn = null;            // (info) => hud 文本

  const COLOR = '#3b7dd8', STATIC_COLOR = '#8a94a6';

  // ---------- 工具 ----------
  const px = m => m * PPM;
  const py = m => H - m * PPM;
  function ground() {
    return Bodies.rectangle(W / 2, H + 30, W * 2, 60, { isStatic: true, label: 'ground' });
  }
  function ball(xm, ym, rm, opts = {}) {
    return Bodies.circle(px(xm), py(ym), px(rm), Object.assign({
      restitution: 0.4, friction: 0.05, frictionAir: 0,
      label: 'ball', renderInfo: { color: opts.color || COLOR }
    }, opts));
  }
  function vMs(v) { return v / PPM * 60; } // matter px/step → m/s

  // ---------- 模板定义 ----------
  const TEMPLATES = [
    {
      id: 'fall-vs-projectile',
      title: '自由落体 vs 平抛运动',
      desc: '同时释放：竖直下落 vs 水平抛出，看谁先落地',
      params: [
        { key: 'h', label: '高度 (m)', min: 2, max: 9, step: 0.5, value: 6 },
        { key: 'vx', label: '平抛初速 (m/s)', min: 1, max: 12, step: 0.5, value: 6 }
      ],
      setup(p) {
        const A = ball(4, p.h + 1, 0.45);
        const B = ball(4, p.h + 1, 0.45);
        Body.setVelocity(B, { x: px(p.vx) / 60, y: 0 });
        World.add(engine.world, [ground(), A, B]);
        let landed = null;
        hudFn = () => {
          const t = engine.timing.timestamp / 1000;
          const va = `(${vMs(A.velocity.x).toFixed(1)}, ${vMs(A.velocity.y).toFixed(1)})`;
          const vb = `(${vMs(B.velocity.x).toFixed(1)}, ${vMs(B.velocity.y).toFixed(1)})`;
          return `t = ${t.toFixed(2)} s\nA 竖直下落  v = ${va} m/s\nB 平抛运动  v = ${vb} m/s`;
        };
        return { bodies: [A, B], tracked: [A, B] };
      }
    },
    {
      id: 'incline',
      title: '斜面滑块（摩擦）',
      desc: '调角度和摩擦系数，看滑块滑还是停、加速多快',
      params: [
        { key: 'ang', label: '倾角 (°)', min: 10, max: 60, step: 1, value: 30 },
        { key: 'mu', label: '摩擦系数 μ', min: 0, max: 1, step: 0.05, value: 0.15 }
      ],
      setup(p) {
        const ang = p.ang * Math.PI / 180;
        const len = 12;
        const ramp = Bodies.rectangle(px(6.5), py(4.2), px(len), 16, {
          isStatic: true, angle: -ang, label: 'ramp',
          renderInfo: { color: STATIC_COLOR }
        });
        const block = Bodies.rectangle(px(2.6), py(8.2), px(1.4), px(0.9), {
          friction: p.mu, frictionStatic: p.mu, frictionAir: 0, label: 'block'
        });
        World.add(engine.world, [ground(), ramp, block]);
        hudFn = () => {
          const v = vMs(Vector.magnitude(block.velocity)).toFixed(2);
          const gsin = (gravity * Math.sin(ang)).toFixed(2);
          const fmax = (p.mu * gravity * Math.cos(ang)).toFixed(2);
          return `v = ${v} m/s\n重力沿斜面分量 g·sinθ = ${gsin} m/s²\n最大静摩擦 μ·g·cosθ = ${fmax} m/s²`;
        };
        return { bodies: [block], tracked: [block] };
      }
    },
    {
      id: 'collision',
      title: '一维碰撞（动量守恒）',
      desc: '调质量和恢复系数，对比弹性/非弹性碰撞',
      params: [
        { key: 'm1', label: 'A 质量', min: 0.5, max: 6, step: 0.5, value: 2 },
        { key: 'm2', label: 'B 质量', min: 0.5, max: 6, step: 0.5, value: 2 },
        { key: 'e', label: '恢复系数', min: 0, max: 1, step: 0.1, value: 1 },
        { key: 'v1', label: 'A 初速 (m/s)', min: 1, max: 10, step: 0.5, value: 6 }
      ],
      setup(p) {
        const A = Bodies.circle(px(3), py(2), px(0.5 * Math.cbrt(p.m1)), {
          restitution: p.e, friction: 0, frictionAir: 0, mass: p.m1, label: 'A'
        });
        const B = Bodies.circle(px(13), py(2), px(0.5 * Math.cbrt(p.m2)), {
          restitution: p.e, friction: 0, frictionAir: 0, mass: p.m2, label: 'B'
        });
        Body.setVelocity(A, { x: px(p.v1) / 60, y: 0 });
        Body.setVelocity(B, { x: 0, y: 0 });
        // 两堵墙防止跑出
        const wl = Bodies.rectangle(-20, H / 2, 40, H * 2, { isStatic: true });
        const wr = Bodies.rectangle(W + 20, H / 2, 40, H * 2, { isStatic: true });
        World.add(engine.world, [ground(), wl, wr, A, B]);
        hudFn = () => {
          const v1 = vMs(A.velocity.x), v2 = vMs(B.velocity.x);
          const pTotal = (p.m1 * v1 + p.m2 * v2).toFixed(1);
          return `vA = ${v1.toFixed(2)} m/s   vB = ${v2.toFixed(2)} m/s\n总动量 p = ${pTotal} kg·m/s（守恒）`;
        };
        return { bodies: [A, B], tracked: [A, B] };
      }
    },
    {
      id: 'pendulum',
      title: '单摆（周期）',
      desc: '调摆长和重力，验证 T = 2π√(L/g)',
      params: [
        { key: 'L', label: '摆长 (m)', min: 1, max: 7, step: 0.25, value: 4 },
        { key: 'ang0', label: '初始摆角 (°)', min: 5, max: 60, step: 1, value: 30 }
      ],
      setup(p) {
        const anchor = { x: px(7), y: py(11.5) };
        const bob = Bodies.circle(anchor.x + px(p.L * Math.sin(p.ang0 * Math.PI / 180)), anchor.y + px(p.L * Math.cos(p.ang0 * Math.PI / 180)), px(0.5), {
          frictionAir: 0, restitution: 1, label: 'bob'
        });
        const c = Constraint.create({ pointA: anchor, bodyB: bob, length: px(p.L), stiffness: 1 });
        World.add(engine.world, [bob, c]);
        // 摆线渲染由 drawExtras 完成
        let crossings = 0, lastSide = 1, lastT = 0, period = 0;
        hudFn = () => {
          const t = engine.timing.timestamp / 1000;
          const dx = bob.position.x - anchor.x;
          const side = dx >= 0 ? 1 : -1;
          if (side !== lastSide) { crossings++; if (crossings % 2 === 0) period = t - lastT, lastT = t; else lastT = t; lastSide = side; }
          const theory = 2 * Math.PI * Math.sqrt(p.L / gravity);
          return `摆长 L = ${p.L} m   g = ${gravity} m/s²\n实测周期 ≈ ${period ? period.toFixed(2) + ' s' : '测量中…'}\n理论 T = 2π√(L/g) = ${theory.toFixed(2)} s`;
        };
        drawExtra = ctx2 => {
          ctx2.strokeStyle = '#8a94a6'; ctx2.lineWidth = 2.5;
          ctx2.beginPath(); ctx2.moveTo(anchor.x, anchor.y); ctx2.lineTo(bob.position.x, bob.position.y); ctx2.stroke();
          ctx2.fillStyle = '#4a5261'; ctx2.fillRect(anchor.x - 24, anchor.y - 8, 48, 8);
        };
        return { bodies: [bob], tracked: [bob] };
      }
    },
    {
      id: 'optics-refraction',
      title: '光的折射与全反射',
      desc: '调入射角与介质折射率，看折射线偏折与全反射临界角（斯涅尔定律）',
      params: [
        { key: 'ang', label: '入射角 θ₁ (°)', min: 0, max: 88, step: 1, value: 40 },
        { key: 'n1', label: '上介质折射率 n₁', min: 1, max: 2.5, step: 0.01, value: 1 },
        { key: 'n2', label: '下介质折射率 n₂', min: 1, max: 2.5, step: 0.01, value: 1.33 }
      ],
      setup(p) {
        // 无刚体：纯几何光学画布（折射算法参考 ray-optics 的界面斯涅尔定律处理）
        const cx = W / 2, cy = H / 2, L = 300;
        const toRad = d => d * Math.PI / 180;
        drawExtra = ctx2 => {
          // 两种介质
          ctx2.fillStyle = `rgba(120,170,230,${0.10 + p.n1 * 0.05})`;
          ctx2.fillRect(0, 0, W, cy);
          ctx2.fillStyle = `rgba(70,130,200,${0.12 + p.n2 * 0.08})`;
          ctx2.fillRect(0, cy, W, H - cy);
          ctx2.strokeStyle = '#5b6575'; ctx2.lineWidth = 2;
          ctx2.beginPath(); ctx2.moveTo(0, cy); ctx2.lineTo(W, cy); ctx2.stroke();
          // 法线（虚线）
          ctx2.setLineDash([6, 6]); ctx2.strokeStyle = '#9aa5b5'; ctx2.lineWidth = 1.5;
          ctx2.beginPath(); ctx2.moveTo(cx, 40); ctx2.lineTo(cx, H - 40); ctx2.stroke();
          ctx2.setLineDash([]);
          const th1 = toRad(p.ang);
          const sin2 = p.n1 * Math.sin(th1) / p.n2;
          const tir = sin2 > 1;                       // 全反射
          const th2 = tir ? null : Math.asin(sin2);
          const ray = (dx, dy, color, w) => {
            ctx2.strokeStyle = color; ctx2.lineWidth = w || 2.5;
            ctx2.beginPath(); ctx2.moveTo(cx, cy); ctx2.lineTo(cx + dx, cy + dy); ctx2.stroke();
          };
          // 入射线（左上 → O）
          ctx2.strokeStyle = '#e05656'; ctx2.lineWidth = 2.5;
          ctx2.beginPath(); ctx2.moveTo(cx - L * Math.sin(th1), cy - L * Math.cos(th1)); ctx2.lineTo(cx, cy); ctx2.stroke();
          // 反射线（右上）
          ray(L * Math.sin(th1), -L * Math.cos(th1), '#e67e22');
          // 折射线（右下）或全反射标注
          if (!tir) ray(L * Math.sin(th2), L * Math.cos(th2), '#2fae6e');
          // 入射点
          ctx2.fillStyle = '#1c2430';
          ctx2.beginPath(); ctx2.arc(cx, cy, 5, 0, Math.PI * 2); ctx2.fill();
          // 角度弧与标注
          ctx2.strokeStyle = '#e05656'; ctx2.lineWidth = 1.5;
          ctx2.beginPath(); ctx2.arc(cx, cy, 46, -Math.PI / 2 - th1, -Math.PI / 2); ctx2.stroke();
          ctx2.fillStyle = '#e05656'; ctx2.font = 'bold 13px sans-serif';
          ctx2.fillText(`θ₁ = ${p.ang}°`, cx - 92, cy - 60);
          if (!tir) {
            ctx2.strokeStyle = '#2fae6e';
            ctx2.beginPath(); ctx2.arc(cx, cy, 60, Math.PI / 2, Math.PI / 2 + th2); ctx2.stroke();
            ctx2.fillStyle = '#2fae6e';
            ctx2.fillText(`θ₂ = ${(th2 * 180 / Math.PI).toFixed(1)}°`, cx + 14, cy + 92);
          } else {
            const thc = Math.asin(p.n2 / p.n1) * 180 / Math.PI;
            ctx2.fillStyle = '#c0392b'; ctx2.font = 'bold 15px sans-serif';
            ctx2.fillText('全反射（无折射光）', cx + 18, cy + 60);
            ctx2.font = '12px sans-serif';
            ctx2.fillText(`临界角 θc = asin(n₂/n₁) = ${thc.toFixed(1)}°`, cx + 18, cy + 80);
          }
          // 介质标注
          ctx2.fillStyle = '#5b6575'; ctx2.font = '12px sans-serif';
          ctx2.fillText(`n₁ = ${p.n1.toFixed(2)}（空气=1.00 · 水=1.33 · 玻璃=1.50 · 钻石=2.42）`, 20, 26);
          ctx2.fillText(`n₂ = ${p.n2.toFixed(2)}`, 20, H - 14);
          ctx2.textAlign = 'center'; ctx2.font = 'bold 13px sans-serif'; ctx2.fillStyle = '#4a5261';
          ctx2.fillText(`n₁·sinθ₁ = ${(p.n1 * Math.sin(th1)).toFixed(3)}　　n₂·sinθ₂ = ${tir ? '—（全反射）' : (p.n2 * sin2).toFixed(3)}`, cx, cy - 12 < 40 ? cy - 12 : 40);
          ctx2.textAlign = 'left';
        };
        hudFn = () => {
          const th1 = toRad(p.ang);
          const sin2 = p.n1 * Math.sin(th1) / p.n2;
          if (sin2 > 1) {
            const thc = Math.asin(p.n2 / p.n1) * 180 / Math.PI;
            return `θ₁ = ${p.ang}° > 临界角 θc = ${thc.toFixed(1)}°\nn₁·sinθ₁ = ${(p.n1 * Math.sin(th1)).toFixed(3)} > n₂\n发生全反射：全部能量反射回上介质`;
          }
          const th2 = Math.asin(sin2) * 180 / Math.PI;
          return `斯涅尔定律：n₁·sinθ₁ = n₂·sinθ₂\n${p.n1.toFixed(2)}·sin(${p.ang}°) = ${p.n2.toFixed(2)}·sin(${th2.toFixed(1)}°)\n折射角 θ₂ = ${th2.toFixed(1)}°`;
        };
        return { bodies: [], tracked: [] };
      }
    }
  ];

  // ---------- 渲染 ----------
  function render() {
    ctx.clearRect(0, 0, W, H);
    // 背景
    ctx.fillStyle = '#fdfdff'; ctx.fillRect(0, 0, W, H);
    // 米格网（每米淡线）
    ctx.strokeStyle = '#eef1f6'; ctx.lineWidth = 1;
    for (let m = 1; m * PPM < W; m++) { ctx.beginPath(); ctx.moveTo(m * PPM, 0); ctx.lineTo(m * PPM, H); ctx.stroke(); }
    for (let m = 1; m * PPM < H; m++) { ctx.beginPath(); ctx.moveTo(0, H - m * PPM); ctx.lineTo(W, H - m * PPM); ctx.stroke(); }

    // 轨迹
    if (showTrails) {
      trailMap.forEach((arr, id) => {
        ctx.strokeStyle = 'rgba(59,125,216,.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        arr.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
      });
    }

    const bodies = Composite.allBodies(engine.world);
    bodies.forEach(b => {
      const info = b.renderInfo || {};
      ctx.fillStyle = b.isStatic ? STATIC_COLOR : (info.color || COLOR);
      const v = b.vertices;
      ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1; ctx.stroke();
    });

    if (drawExtra) drawExtra(ctx);

    // 速度矢量
    if (showVectors) {
      bodies.forEach(b => {
        if (b.isStatic) return;
        const vx = b.velocity.x, vy = b.velocity.y;
        const sp = Math.hypot(vx, vy);
        if (sp < 0.3) return;
        const scale = 8;
        const x1 = b.position.x, y1 = b.position.y;
        const x2 = x1 + vx * scale, y2 = y1 + vy * scale;
        ctx.strokeStyle = '#2fae6e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.fillStyle = '#2fae6e';
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 9 * Math.cos(ang - 0.4), y2 - 9 * Math.sin(ang - 0.4));
        ctx.lineTo(x2 - 9 * Math.cos(ang + 0.4), y2 - 9 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
      });
    }
  }

  function loop() {
    if (!paused && engine) {
      Engine.update(engine, 1000 / 60);
      if (showTrails && current) {
        (current.tracked || []).forEach(b => {
          let arr = trailMap.get(b.id) || [];
          arr.push({ x: b.position.x, y: b.position.y });
          if (arr.length > 90) arr.shift();
          trailMap.set(b.id, arr);
        });
      }
      render();
      if (hudFn) document.getElementById('phy-hud').textContent = hudFn();
    }
    requestAnimationFrame(loop);
  }

  // ---------- 场景构建 ----------
  function build() {
    if (engine) { World.clear(engine.world, false); Engine.clear(engine); }
    engine = Engine.create();
    // matter 默认 y=1、scale=0.001 视觉上等效真实重力；按 PPM 与 g 值等比缩放
    engine.gravity.y = gravity / 9.8;
    engine.gravity.scale = 0.001 * PPM / 42;
    trailMap = new Map();
    drawExtra = null;
    const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
    // 参数归一
    const p = {};
    tpl.params.forEach(pd => { p[pd.key] = params[pd.key] !== undefined ? params[pd.key] : pd.value; });
    current = tpl.setup(p);
  }

  // ---------- 对外 API ----------
  function init(cvs) {
    canvas = cvs; ctx = canvas.getContext('2d');
    requestAnimationFrame(loop);
  }

  function list() {
    return TEMPLATES.map(t => ({ id: t.id, title: t.title, desc: t.desc }));
  }

  function paramDefs(id) {
    return (TEMPLATES.find(t => t.id === id) || TEMPLATES[0]).params;
  }

  function setScene(id, paramOverrides) {
    templateId = id || templateId;
    params = paramOverrides || {};
    build();
    paused = false;
  }

  function setGravity(g) { gravity = g; if (engine) engine.gravity.y = gravity / 9.8; }
  function setPaused(v) { paused = v; }
  function isPaused() { return paused; }
  function reset() { build(); }
  function setVectors(v) { showVectors = v; }
  function setTrails(v) { showTrails = v; if (!v) trailMap = new Map(); }
  function currentId() { return templateId; }
  function currentParams() {
    const p = {};
    paramDefs(templateId).forEach(pd => { p[pd.key] = params[pd.key] !== undefined ? params[pd.key] : pd.value; });
    return p;
  }

  return { init, list, paramDefs, setScene, setGravity, setPaused, isPaused, reset, setVectors, setTrails, currentId, currentParams };
})();

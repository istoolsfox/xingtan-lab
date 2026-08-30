/**
 * 杏坛 · 化学分子反应引擎（PoC）
 * 思路：反应 = 一串"阶段关键帧"，每个阶段给出全部原子的位置和化学键；
 * 引擎在阶段间对原子做位置补间、对键做渐隐渐现；同一时间轴同步驱动宏观现象画布。
 * 新增反应只需在 REACTIONS 里加一份 JSON 式定义。
 */
const ChemEngine = (() => {
  // ---------- 元素与分子库 ----------
  const ATOMS = {
    H: { color: '#ff6b6b', r: 11, label: 'H' },
    O: { color: '#4d94f7', r: 15, label: 'O' },
    C: { color: '#8a94a6', r: 16, label: 'C' }
  };
  // 分子几何：局部坐标 + 键（原子局部索引对 + 键级）
  const MOLS = {
    H2O: { atoms: ['O', 'H', 'H'], pos: [[0, 0], [-15, 14], [15, 14]], bonds: [[0, 1, 1], [0, 2, 1]] },
    H2: { atoms: ['H', 'H'], pos: [[-13, 0], [13, 0]], bonds: [[0, 1, 1]] },
    O2: { atoms: ['O', 'O'], pos: [[-16, 0], [16, 0]], bonds: [[0, 1, 2]] },
    CO2: { atoms: ['C', 'O', 'O'], pos: [[0, 0], [-26, 0], [26, 0]], bonds: [[0, 1, 2], [0, 2, 2]] }
  };

  // 把一个分子实例摆到 (x,y,旋转)，返回原子(全局索引)与键
  function place(molId, x, y, rotDeg, base) {
    const m = MOLS[molId];
    const rot = rotDeg * Math.PI / 180;
    const atoms = m.atoms.map((el, i) => ({
      el,
      x: x + m.pos[i][0] * Math.cos(rot) - m.pos[i][1] * Math.sin(rot),
      y: y + m.pos[i][0] * Math.sin(rot) + m.pos[i][1] * Math.cos(rot)
    }));
    const bonds = m.bonds.map(b => ({ a: base + b[0], b: base + b[1], order: b[2] }));
    return { atoms, bonds };
  }

  // ---------- 反应定义（数据驱动） ----------
  // build(stageIndex) → { atoms:[{el,x,y}], bonds:[{a,b,order}], macro:state }
  const REACTIONS = [
    {
      id: 'electrolysis',
      title: '水的电解',
      equation: '2H₂O —通电→ 2H₂↑ + O₂↑',
      macro: 'electrolyzer',
      nAtoms: 12,
      captions: [
        '通电前：水分子在液态水中运动',
        '通电：化学键断裂，水分子分解为氢原子和氧原子',
        '原子重新组合：每 2 个 H 原子 → 1 个 H₂，每 2 个 O 原子 → 1 个 O₂',
        '负极 H₂ : 正极 O₂ 体积比 = 2 : 1（分子个数比 4 : 2）'
      ],
      stages: [
        // 0  四个水分子
        () => {
          const P = [[250, 105], [600, 105], [250, 210], [600, 210]];
          let atoms = [], bonds = [];
          P.forEach((p, i) => { const r = place('H2O', p[0], p[1], 0, i * 3); atoms.push(...r.atoms); bonds.push(...r.bonds); });
          return { atoms, bonds, macro: 0 };
        },
        // 1  自由原子（键断裂）
        () => ({
          atoms: [
            { el: 'O', x: 200, y: 80 }, { el: 'H', x: 140, y: 150 }, { el: 'H', x: 240, y: 170 },
            { el: 'O', x: 560, y: 80 }, { el: 'H', x: 510, y: 160 }, { el: 'H', x: 620, y: 160 },
            { el: 'O', x: 200, y: 190 }, { el: 'H', x: 150, y: 255 }, { el: 'H', x: 260, y: 250 },
            { el: 'O', x: 600, y: 190 }, { el: 'H', x: 555, y: 250 }, { el: 'H', x: 665, y: 250 }
          ],
          bonds: [], macro: 1
        }),
        // 2  重组：4 个 H2 + 2 个 O2（原子两两配对）
        () => {
          const o2 = {
            atoms: [{ el: 'O', x: 250 - 16, y: 210 }, { el: 'O', x: 250 + 16, y: 210 }],
            bonds: [{ a: 0, b: 3, order: 2 }]
          };
          const o22 = { atoms: [{ el: 'O', x: 550 - 16, y: 210 }, { el: 'O', x: 550 + 16, y: 210 }], bonds: [{ a: 6, b: 9, order: 2 }] };
          return {
            atoms: [
              { el: 'H', x: 150 - 13, y: 80 }, { el: 'H', x: 150 + 13, y: 80 },
              { el: 'H', x: 300 - 13, y: 80 }, { el: 'H', x: 300 + 13, y: 80 },
              { el: 'H', x: 450 - 13, y: 80 }, { el: 'H', x: 450 + 13, y: 80 },
              { el: 'H', x: 600 - 13, y: 80 }, { el: 'H', x: 600 + 13, y: 80 },
              o2.atoms[0], o2.atoms[1], o22.atoms[0], o22.atoms[1]
            ],
            bonds: [
              { a: 1, b: 2, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 10, b: 11, order: 1 },
              { a: 0, b: 3, order: 2 }, { a: 6, b: 9, order: 2 }
            ],
            macro: 2
          };
        },
        // 3  分组排列：H2 在左（2x2），O2 在右
        () => ({
          atoms: [
            { el: 'H', x: 170 - 13, y: 100 }, { el: 'H', x: 170 + 13, y: 100 },
            { el: 'H', x: 300 - 13, y: 100 }, { el: 'H', x: 300 + 13, y: 100 },
            { el: 'H', x: 170 - 13, y: 205 }, { el: 'H', x: 170 + 13, y: 205 },
            { el: 'H', x: 300 - 13, y: 205 }, { el: 'H', x: 300 + 13, y: 205 },
            { el: 'O', x: 660 - 16, y: 120 }, { el: 'O', x: 660 + 16, y: 120 },
            { el: 'O', x: 660 - 16, y: 210 }, { el: 'O', x: 660 + 16, y: 210 }
          ],
          bonds: [
            { a: 1, b: 2, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 10, b: 11, order: 1 },
            { a: 0, b: 3, order: 2 }, { a: 6, b: 9, order: 2 }
          ],
          macro: 3
        })
      ]
    },
    {
      id: 'combustion',
      title: '氢气燃烧',
      equation: '2H₂ + O₂ —点燃→ 2H₂O',
      macro: 'combustion',
      nAtoms: 12,
      captions: [
        '点燃前：氢分子（H₂）和氧分子（O₂）混合',
        '点燃：分子分解为氢原子和氧原子（反应放出大量热）',
        '原子重新结合：每 2 个 H 原子 + 1 个 O 原子 → 1 个水分子（H₂O）',
        '宏观现象：干冷烧杯内壁出现水珠 → 生成物是水'
      ],
      stages: [
        // 0  4 H2 + 2 O2 混合（原子索引：H=0..7，O=8..11）
        () => ({
          atoms: [
            { el: 'H', x: 150 - 13, y: 90 }, { el: 'H', x: 150 + 13, y: 90 },
            { el: 'H', x: 360 - 13, y: 150 }, { el: 'H', x: 360 + 13, y: 150 },
            { el: 'H', x: 570 - 13, y: 90 }, { el: 'H', x: 570 + 13, y: 90 },
            { el: 'H', x: 780 - 13, y: 150 }, { el: 'H', x: 780 + 13, y: 150 },
            { el: 'O', x: 250 - 16, y: 225 }, { el: 'O', x: 250 + 16, y: 225 },
            { el: 'O', x: 650 - 16, y: 225 }, { el: 'O', x: 650 + 16, y: 225 }
          ],
          bonds: [
            { a: 0, b: 1, order: 1 }, { a: 2, b: 3, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 6, b: 7, order: 1 },
            { a: 8, b: 9, order: 2 }, { a: 10, b: 11, order: 2 }
          ],
          macro: 0
        }),
        // 1  自由原子
        () => ({
          atoms: [
            { el: 'H', x: 110, y: 80 }, { el: 'H', x: 190, y: 170 }, { el: 'H', x: 300, y: 60 }, { el: 'H', x: 400, y: 200 },
            { el: 'H', x: 500, y: 110 }, { el: 'H', x: 600, y: 210 }, { el: 'H', x: 700, y: 70 }, { el: 'H', x: 800, y: 180 },
            { el: 'O', x: 150, y: 240 }, { el: 'O', x: 350, y: 140 }, { el: 'O', x: 560, y: 60 }, { el: 'O', x: 680, y: 150 }
          ],
          bonds: [], macro: 1
        }),
        // 2  组成 4 个 H2O（O8+H0,H1 ｜ O9+H2,H3 ｜ O10+H4,H5 ｜ O11+H6,H7）
        () => {
          const P = [[180, 110], [450, 90], [720, 110], [450, 220]];
          const pairs = [[8, 0, 1], [9, 2, 3], [10, 4, 5], [11, 6, 7]];
          const atoms = new Array(12);
          const bonds = [];
          pairs.forEach((pr, i) => {
            const g = place('H2O', P[i][0], P[i][1], 0, 0); // O,H,H 顺序
            atoms[pr[0]] = { ...g.atoms[0] };
            atoms[pr[1]] = { ...g.atoms[1] };
            atoms[pr[2]] = { ...g.atoms[2] };
            bonds.push({ a: pr[0], b: pr[1], order: 1 }, { a: pr[0], b: pr[2], order: 1 });
          });
          return { atoms, bonds, macro: 1 };
        },
        // 3  水分子聚集（生成液态水）
        () => {
          const P = [[230, 225], [430, 225], [630, 225], [520, 120]];
          const pairs = [[8, 0, 1], [9, 2, 3], [10, 4, 5], [11, 6, 7]];
          const atoms = new Array(12);
          const bonds = [];
          pairs.forEach((pr, i) => {
            const g = place('H2O', P[i][0], P[i][1], 0, 0);
            atoms[pr[0]] = { ...g.atoms[0] };
            atoms[pr[1]] = { ...g.atoms[1] };
            atoms[pr[2]] = { ...g.atoms[2] };
            bonds.push({ a: pr[0], b: pr[1], order: 1 }, { a: pr[0], b: pr[2], order: 1 });
          });
          return { atoms, bonds, macro: 2 };
        }
      ]
    }
  ];

  // ---------- 引擎状态 ----------
  const HOLD = 1500, TRANSIT = 2200;   // 每阶段：停留 + 补间（毫秒）
  let macroCv, microCv, mctx, ictx;
  let reaction = null, phase = 0, playing = false, raf = null, lastT = 0;
  let bubbles = [];                    // 电解气泡粒子
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function stageData(i) { return reaction.stages[i](); }

  // 插值出当前原子/键状态
  function current() {
    const n = reaction.stages.length;
    phase = Math.max(0, Math.min(phase, n - 1));
    const seg = Math.min(Math.floor(phase), n - 2);
    const local = n <= 1 ? 1 : phase - seg;
    const A = stageData(seg), B = stageData(Math.min(seg + 1, n - 1));
    let t, showIdx = seg;
    if (local <= HOLD / (HOLD + TRANSIT) || seg >= n - 1) {
      t = 0;
    } else {
      t = ease((local - HOLD / (HOLD + TRANSIT)) / (TRANSIT / (HOLD + TRANSIT)));
      showIdx = t >= 1 ? seg + 1 : seg;
    }
    const atoms = A.atoms.map((a, i) => {
      const b = B.atoms[i] || a;
      return { el: a.el, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
    // 键：A 有 B 无 → 渐隐(1-t)；A 无 B 有 → 渐显(t)；都有 → 常显
    const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    const mapA = new Map(A.bonds.map(b => [key(b.a, b.b), b]));
    const mapB = new Map(B.bonds.map(b => [key(b.a, b.b), b]));
    const bonds = [];
    mapA.forEach((b, k) => bonds.push({ ...b, alpha: 1 - t }));
    mapB.forEach((b, k) => { if (!mapA.has(k)) bonds.push({ ...b, alpha: t }); });
    const macroMix = { from: A.macro, to: B.macro, t };
    const captionIdx = t > 0.4 ? Math.min(seg + 1, n - 1) : seg;
    return { atoms, bonds, macroMix, captionIdx, showIdx };
  }

  // ---------- 微观渲染 ----------
  function drawMicro(st) {
    const ctx = ictx, W = microCv.width, H = microCv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfdff'; ctx.fillRect(0, 0, W, H);
    // 角标
    ctx.fillStyle = '#9aa5b5'; ctx.font = '12px sans-serif';
    ctx.fillText('微观 · 分子视角', 14, 20);
    // 键
    st.bonds.forEach(b => {
      if (b.alpha <= 0.02) return;
      const A = st.atoms[b.a], B = st.atoms[b.b];
      if (!A || !B) return;
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = '#5b6575'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      if (b.order === 2) {
        const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
        const ox = -dy / L * 4, oy = dx / L * 4;
        ctx.beginPath(); ctx.moveTo(A.x + ox, A.y + oy); ctx.lineTo(B.x + ox, B.y + oy);
        ctx.moveTo(A.x - ox, A.y - oy); ctx.lineTo(B.x - ox, B.y - oy); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    // 原子
    st.atoms.forEach(a => {
      const d = ATOMS[a.el]; if (!d) return;
      ctx.beginPath(); ctx.arc(a.x, a.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${d.r}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.label, a.x, a.y + 1);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ---------- 宏观渲染 ----------
  function drawMacro(st, time) {
    const ctx = mctx, W = macroCv.width, H = macroCv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfdff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9aa5b5'; ctx.font = '12px sans-serif';
    ctx.fillText('宏观 · 实验现象', 14, 20);
    if (reaction.macro === 'electrolyzer') drawElectrolyzer(ctx, st, time, W, H);
    else if (reaction.macro === 'combustion') drawCombustion(ctx, st, time, W, H);
  }

  function drawElectrolyzer(ctx, st, time) {
    const mix = st.macroMix;
    const p = Math.min(1, (mix.from + mix.t) / 3);      // 总进度 0..1
    const active = Math.max(mix.from, mix.to) >= 1 && !(mix.from === 0 && mix.t < 0.5);
    const final = mix.to === 3 && mix.t > 0.9 || mix.from === 3;
    // 电解槽：两个竖管 + 底部连通
    const tubeW = 42, topY = 55, botY = 235;
    const xL = 360, xR = 498;
    ctx.lineWidth = 3; ctx.strokeStyle = '#7a869a'; ctx.fillStyle = '#fff';
    function tube(x) { ctx.beginPath(); ctx.roundRect(x, topY, tubeW, botY - topY + 20, 4); ctx.fill(); ctx.stroke(); }
    tube(xL); tube(xR);
    ctx.beginPath(); ctx.roundRect(xL - 3, botY, (xR + tubeW) - xL + 6, 26, 4); ctx.fill(); ctx.stroke();
    // 液体（管内下部 + 连通部）
    ctx.fillStyle = '#cfe7ff';
    const gasH2 = active || mix.from > 0 ? 130 * p * (2 / 3) : 0;  // 最大 ~87
    const gasO2 = active || mix.from > 0 ? 130 * p * (1 / 3) : 0;
    const liqTopL = topY + 14 + gasH2, liqTopR = topY + 14 + gasO2;
    ctx.fillRect(xL + 3, liqTopL, tubeW - 6, botY - liqTopL);
    ctx.fillRect(xR + 3, liqTopR, tubeW - 6, botY - liqTopR);
    ctx.fillRect(xL + 3, botY - 16, (xR + tubeW) - xL - 6, 14);
    // 电极
    ctx.fillStyle = '#4a5261';
    ctx.fillRect(xL + 13, botY - 52, 16, 34);
    ctx.fillRect(xR + 13, botY - 52, 16, 34);
    // 导线 + 电池
    ctx.strokeStyle = '#4a5261'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(xL + 21, botY - 52); ctx.lineTo(xL + 21, 34); ctx.lineTo(432, 34);
    ctx.moveTo(xR + 21, botY - 52); ctx.lineTo(xR + 21, 34); ctx.lineTo(468, 34);
    ctx.stroke();
    ctx.fillStyle = '#1c2430'; ctx.fillRect(432, 24, 36, 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('−', 438, 39); ctx.fillText('+', 456, 39);
    // 气泡
    if (active) {
      const liqSurfL = liqTopL + 6, liqSurfR = liqTopR + 6;
      if (bubbles.length < 40 && Math.random() < 0.5) {
        bubbles.push({ tube: Math.random() < 0.55 ? 'L' : 'R', x: (Math.random() < 0.5 ? xL : xR) + 15 + Math.random() * 12, y: botY - 20, v: 0.6 + Math.random() * 0.9, r: 1.5 + Math.random() * 2.5 });
      }
      ctx.strokeStyle = '#5b8fd0'; ctx.lineWidth = 1.2;
      bubbles = bubbles.filter(b => {
        b.y -= b.v;
        const surf = b.tube === 'L' ? liqSurfL : liqSurfR;
        if (b.y < surf) return false;
        ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.arc(b.x + Math.sin(b.y / 9) * 2, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      });
    }
    // 气体标注
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    if (p > 0.25) {
      ctx.fillStyle = '#ff6b6b'; ctx.fillText('H₂', xL + tubeW / 2, topY + 14 + gasH2 / 2 + 4);
      ctx.fillStyle = '#4d94f7'; ctx.fillText('O₂', xR + tubeW / 2, topY + 14 + gasO2 / 2 + 4);
    }
    if (final) {
      ctx.fillStyle = '#c0392b'; ctx.fillText('2 体积', xL + tubeW / 2, topY - 6);
      ctx.fillStyle = '#2b6cd4'; ctx.fillText('1 体积', xR + tubeW / 2, topY - 6);
    }
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif';
    ctx.fillText('负极（−）', xL + tubeW / 2, botY + 42);
    ctx.fillText('正极（+）', xR + tubeW / 2, botY + 42);
    ctx.textAlign = 'left';
  }

  function drawCombustion(ctx, st, time) {
    const mix = st.macroMix;
    const burning = Math.max(mix.from, mix.to) >= 1 && !(mix.from === 0 && mix.t < 1);
    const fl = mix.from >= 1 ? 1 : mix.t;            // 火焰强度
    const curMacro = mix.from + (mix.to - mix.from) * mix.t;
    const drops = Math.max(0, Math.min(1, (curMacro - 1.6) / 0.4));
    const cx = 450;
    // 烧杯（倒扣玻璃杯）
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 105, 175); ctx.lineTo(cx - 105, 62); ctx.lineTo(cx + 105, 62); ctx.lineTo(cx + 105, 175);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,215,240,.12)'; ctx.fill();
    // 水珠
    if (drops > 0) {
      ctx.fillStyle = `rgba(90,150,220,${0.75 * drops})`;
      const D = [[-80, 74], [-45, 68], [-10, 72], [30, 68], [66, 74], [92, 70], [-70, 92], [80, 95], [-20, 88], [50, 90]];
      D.forEach(d => { ctx.beginPath(); ctx.arc(cx + d[0], d[1], 3.2, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = `rgba(60,110,180,${drops})`; ctx.font = '12px sans-serif';
      ctx.fillText('水珠', cx + 112, 80);
    }
    // 灯/喷嘴底座
    ctx.fillStyle = '#4a5261';
    ctx.fillRect(cx - 26, 238, 52, 30);
    ctx.fillRect(cx - 8, 222, 16, 16);
    // 火焰
    if (fl > 0.02) {
      const flick = Math.sin(time / 60) * 3 + Math.sin(time / 23) * 2;
      ctx.globalAlpha = fl;
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.moveTo(cx - 20, 224);
      ctx.quadraticCurveTo(cx - 24, 190 + flick, cx, 168 + flick);
      ctx.quadraticCurveTo(cx + 24, 190 + flick, cx + 20, 224);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(cx - 10, 224);
      ctx.quadraticCurveTo(cx - 12, 202 + flick, cx, 188 + flick);
      ctx.quadraticCurveTo(cx + 12, 202 + flick, cx + 10, 224);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c0392b'; ctx.font = '12px sans-serif';
      ctx.fillText('点燃 ▲ 放热', cx + 30, 232);
    } else {
      ctx.fillStyle = '#9aa5b5'; ctx.font = '12px sans-serif';
      ctx.fillText('待点燃', cx + 24, 232);
    }
  }

  // ---------- 主循环 ----------
  function tick(now) {
    if (!reaction) return;
    const dt = Math.min(50, now - lastT); lastT = now;
    if (playing) phase += dt / (HOLD + TRANSIT);
    const n = reaction.stages.length;
    if (phase >= n - 1) { phase = n - 1; if (playing) { playing = false; onPlayState && onPlayState(); } }
    const st = current();
    drawMicro(st);
    drawMacro(st, now);
    updateCaption && updateCaption(st);
    raf = requestAnimationFrame(tick);
  }

  // UI 回调（由 app.js 注入）
  let updateCaption = null, onPlayState = null;

  // ---------- 对外 API ----------
  function init(opts) {
    macroCv = opts.macro; microCv = opts.micro;
    mctx = macroCv.getContext('2d'); ictx = microCv.getContext('2d');
    updateCaption = opts.onCaption; onPlayState = opts.onPlayState;
  }

  function setReaction(id) {
    reaction = REACTIONS.find(r => r.id === id) || REACTIONS[0];
    phase = 0; bubbles = [];
    playing = false;
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function play() { if (phase >= reaction.stages.length - 1) phase = 0; playing = true; }
  function pause() { playing = false; }
  function isPlaying() { return playing; }
  function next() { phase = Math.min(reaction.stages.length - 1, Math.floor(phase + 1) + 0.0001); }
  function prev() { const t = Math.floor(phase); phase = Math.max(0, phase - t < 0.05 ? t - 1 : t); }
  function gotoStage(i) { phase = Math.max(0, Math.min(i, reaction.stages.length - 1)); }
  function stageCount() { return reaction.stages.length; }
  function list() { return REACTIONS.map(r => ({ id: r.id, title: r.title, equation: r.equation })); }
  function currentReaction() { return reaction; }

  return { init, setReaction, play, pause, isPlaying, next, prev, gotoStage, stageCount, list, currentReaction };
})();

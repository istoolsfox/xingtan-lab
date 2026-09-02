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
    C: { color: '#8a94a6', r: 16, label: 'C' },
    S: { color: '#e3c02f', r: 14, label: 'S' },
    Fe: { color: '#8d99ae', r: 16, label: 'Fe' },
    Cu: { color: '#e0862e', r: 16, label: 'Cu' },
    Na: { color: '#ab5cf2', r: 15, label: 'Na' },
    Cl: { color: '#3fae6e', r: 14, label: 'Cl' }
  };
  // 分子几何：局部坐标 + 键（原子局部索引对 + 键级）
  const MOLS = {
    H2O: { atoms: ['O', 'H', 'H'], pos: [[0, 0], [-15, 14], [15, 14]], bonds: [[0, 1, 1], [0, 2, 1]] },
    H2: { atoms: ['H', 'H'], pos: [[-13, 0], [13, 0]], bonds: [[0, 1, 1]] },
    O2: { atoms: ['O', 'O'], pos: [[-16, 0], [16, 0]], bonds: [[0, 1, 2]] },
    CO2: { atoms: ['C', 'O', 'O'], pos: [[0, 0], [-26, 0], [26, 0]], bonds: [[0, 1, 2], [0, 2, 2]] },
    CH4: { atoms: ['C', 'H', 'H', 'H', 'H'], pos: [[0, 0], [0, -22], [21, 7], [-21, 7], [0, 24]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    SO4: { atoms: ['S', 'O', 'O', 'O', 'O'], pos: [[0, 0], [0, -25], [25, 0], [0, 25], [-25, 0]], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 2], [0, 4, 1]] }
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
        // 2  重组：4 个 H2 + 2 个 O2（原子索引与 stage0/1 对齐：O,H,H ×4，键索引 2026-08 修正）
        // H2a=H1,H2  H2b=H4,H5  H2c=H7,H8  H2d=H10,H11 ｜ O2a=O0,O3  O2b=O6,O9
        () => ({
          atoms: [
            { el: 'O', x: 660 - 16, y: 110 }, { el: 'H', x: 150 - 13, y: 80 }, { el: 'H', x: 150 + 13, y: 80 },
            { el: 'O', x: 660 + 16, y: 110 }, { el: 'H', x: 300 - 13, y: 80 }, { el: 'H', x: 300 + 13, y: 80 },
            { el: 'O', x: 660 - 16, y: 210 }, { el: 'H', x: 150 - 13, y: 205 }, { el: 'H', x: 150 + 13, y: 205 },
            { el: 'O', x: 660 + 16, y: 210 }, { el: 'H', x: 300 - 13, y: 205 }, { el: 'H', x: 300 + 13, y: 205 }
          ],
          bonds: [
            { a: 1, b: 2, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 10, b: 11, order: 1 },
            { a: 0, b: 3, order: 2 }, { a: 6, b: 9, order: 2 }
          ],
          macro: 2
        }),
        // 3  分组排列：H2 在左（2x2），O2 在右
        () => ({
          atoms: [
            { el: 'O', x: 660 - 16, y: 120 }, { el: 'H', x: 170 - 13, y: 100 }, { el: 'H', x: 170 + 13, y: 100 },
            { el: 'O', x: 660 + 16, y: 120 }, { el: 'H', x: 300 - 13, y: 100 }, { el: 'H', x: 300 + 13, y: 100 },
            { el: 'O', x: 660 - 16, y: 210 }, { el: 'H', x: 170 - 13, y: 205 }, { el: 'H', x: 170 + 13, y: 205 },
            { el: 'O', x: 660 + 16, y: 210 }, { el: 'H', x: 300 - 13, y: 205 }, { el: 'H', x: 300 + 13, y: 205 }
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
    },
    {
      id: 'carbon-burn',
      title: '木炭燃烧（碳与氧气）',
      equation: 'C + O₂ —点燃→ CO₂',
      macro: 'charcoal',
      nAtoms: 6,
      captions: [
        '点燃前：常温下木炭与氧气接触不反应',
        '点燃：化学键断裂，碳原子与氧原子重新组合',
        '每个 C 原子与 1 个 O₂ 结合 → 1 个 CO₂ 分子（化合反应）',
        '宏观：剧烈燃烧、发白光；CO₂ 使澄清石灰水变浑浊'
      ],
      stages: [
        // 0  2 个 C + 2 个 O₂（原子索引：C=0,1  O=2..5）
        () => ({
          atoms: [
            { el: 'C', x: 300, y: 200 }, { el: 'C', x: 330, y: 235 },
            { el: 'O', x: 520 - 16, y: 110 }, { el: 'O', x: 520 + 16, y: 110 },
            { el: 'O', x: 680 - 16, y: 170 }, { el: 'O', x: 680 + 16, y: 170 }
          ],
          bonds: [{ a: 2, b: 3, order: 2 }, { a: 4, b: 5, order: 2 }],
          macro: 0
        }),
        // 1  自由原子
        () => ({
          atoms: [
            { el: 'C', x: 280, y: 210 }, { el: 'C', x: 350, y: 245 },
            { el: 'O', x: 480, y: 90 }, { el: 'O', x: 560, y: 150 },
            { el: 'O', x: 640, y: 80 }, { el: 'O', x: 710, y: 190 }
          ],
          bonds: [], macro: 1
        }),
        // 2  组成 2 个 CO₂（C0=O2,O3 ｜ C1=O4,O5）
        () => ({
          atoms: [
            { el: 'C', x: 350, y: 130 }, { el: 'C', x: 620, y: 190 },
            { el: 'O', x: 350 - 26, y: 130 }, { el: 'O', x: 350 + 26, y: 130 },
            { el: 'O', x: 620 - 26, y: 190 }, { el: 'O', x: 620 + 26, y: 190 }
          ],
          bonds: [
            { a: 0, b: 2, order: 2 }, { a: 0, b: 3, order: 2 },
            { a: 1, b: 4, order: 2 }, { a: 1, b: 5, order: 2 }
          ],
          macro: 1
        }),
        // 3  CO₂ 向石灰水方向聚集（上方）
        () => ({
          atoms: [
            { el: 'C', x: 430, y: 70 }, { el: 'C', x: 560, y: 95 },
            { el: 'O', x: 430 - 26, y: 70 }, { el: 'O', x: 430 + 26, y: 70 },
            { el: 'O', x: 560 - 26, y: 95 }, { el: 'O', x: 560 + 26, y: 95 }
          ],
          bonds: [
            { a: 0, b: 2, order: 2 }, { a: 0, b: 3, order: 2 },
            { a: 1, b: 4, order: 2 }, { a: 1, b: 5, order: 2 }
          ],
          macro: 2
        })
      ]
    },
    {
      id: 'methane-burn',
      title: '甲烷燃烧（天然气）',
      equation: 'CH₄ + 2O₂ —点燃→ CO₂ + 2H₂O',
      macro: 'methane',
      nAtoms: 9,
      captions: [
        '点燃前：甲烷分子（CH₄，天然气主要成分）与氧气混合',
        '点燃：CH₄ 与 O₂ 的化学键断裂，分解为原子',
        '原子重组：C → CO₂；每 4 个 H + 2 个 O → 2 个 H₂O',
        '宏观：蓝色火焰；干冷烧杯内壁有水珠、石灰水变浑浊（同时生成 H₂O 和 CO₂）'
      ],
      stages: [
        // 0  1 个 CH₄ + 2 个 O₂（C=0 H=1..4 O=5..8）
        () => {
          const m = place('CH4', 280, 150, 0, 0);
          return {
            atoms: [...m.atoms,
              { el: 'O', x: 560 - 16, y: 100 }, { el: 'O', x: 560 + 16, y: 100 },
              { el: 'O', x: 700 - 16, y: 200 }, { el: 'O', x: 700 + 16, y: 200 }],
            bonds: [...m.bonds, { a: 5, b: 6, order: 2 }, { a: 7, b: 8, order: 2 }],
            macro: 0
          };
        },
        // 1  自由原子
        () => ({
          atoms: [
            { el: 'C', x: 300, y: 170 },
            { el: 'H', x: 250, y: 100 }, { el: 'H', x: 360, y: 120 }, { el: 'H', x: 270, y: 240 }, { el: 'H', x: 380, y: 230 },
            { el: 'O', x: 520, y: 80 }, { el: 'O', x: 610, y: 150 },
            { el: 'O', x: 680, y: 70 }, { el: 'O', x: 760, y: 180 }
          ],
          bonds: [], macro: 1
        }),
        // 2  CO₂（C0+O5,O6）+ 2 个 H₂O（O7+H1,H2 ｜ O8+H3,H4）
        () => {
          const w1 = place('H2O', 560, 200, 0, 0);
          const w2 = place('H2O', 740, 130, 0, 0);
          const atoms = new Array(9);
          atoms[0] = { el: 'C', x: 350, y: 120 };
          atoms[5] = { el: 'O', x: 350 - 26, y: 120 };
          atoms[6] = { el: 'O', x: 350 + 26, y: 120 };
          atoms[7] = { ...w1.atoms[0] }; atoms[1] = { ...w1.atoms[1] }; atoms[2] = { ...w1.atoms[2] };
          atoms[8] = { ...w2.atoms[0] }; atoms[3] = { ...w2.atoms[1] }; atoms[4] = { ...w2.atoms[2] };
          return {
            atoms,
            bonds: [
              { a: 0, b: 5, order: 2 }, { a: 0, b: 6, order: 2 },
              { a: 7, b: 1, order: 1 }, { a: 7, b: 2, order: 1 },
              { a: 8, b: 3, order: 1 }, { a: 8, b: 4, order: 1 }
            ],
            macro: 1
          };
        },
        // 3  生成物分离聚放（H₂O 凝结、CO₂ 上浮）
        () => {
          const w1 = place('H2O', 300, 230, 0, 0);
          const w2 = place('H2O', 420, 250, 0, 0);
          const atoms = new Array(9);
          atoms[0] = { el: 'C', x: 600, y: 80 };
          atoms[5] = { el: 'O', x: 600 - 26, y: 80 };
          atoms[6] = { el: 'O', x: 600 + 26, y: 80 };
          atoms[7] = { ...w1.atoms[0] }; atoms[1] = { ...w1.atoms[1] }; atoms[2] = { ...w1.atoms[2] };
          atoms[8] = { ...w2.atoms[0] }; atoms[3] = { ...w2.atoms[1] }; atoms[4] = { ...w2.atoms[2] };
          return {
            atoms,
            bonds: [
              { a: 0, b: 5, order: 2 }, { a: 0, b: 6, order: 2 },
              { a: 7, b: 1, order: 1 }, { a: 7, b: 2, order: 1 },
              { a: 8, b: 3, order: 1 }, { a: 8, b: 4, order: 1 }
            ],
            macro: 2
          };
        }
      ]
    },
    {
      id: 'fe-cuso4',
      title: '铁与硫酸铜（置换反应）',
      equation: 'Fe + CuSO₄ → FeSO₄ + Cu',
      macro: 'displacement',
      nAtoms: 7,
      captions: [
        '反应前：铁钉浸入蓝色溶液，Cu²⁺ 与 SO₄²⁻（旁观离子）在水中运动',
        '反应本质：Fe 失 2e⁻ → Fe²⁺；Cu²⁺ 得 2e⁻ → Cu（电子转移）',
        '宏观：红色铜覆盖铁钉表面，溶液由蓝变浅绿；金属活动性 Fe > Cu，质量守恒'
      ],
      stages: [
        // 0  Fe 原子（左，代表铁钉表面）+ Cu²⁺（中）+ SO₄²⁻（右）
        () => {
          const s = place('SO4', 620, 160, 0, 0);
          const atoms = [{ el: 'Fe', x: 230, y: 180 }, { el: 'Cu', x: 430, y: 130 }, ...s.atoms];
          // s.atoms: S,O,O,O,O → 全局索引 2..6
          return {
            atoms,
            bonds: [
              { a: 2, b: 3, order: 2 }, { a: 2, b: 4, order: 1 },
              { a: 2, b: 5, order: 2 }, { a: 2, b: 6, order: 1 }
            ],
            macro: 0
          };
        },
        // 1  电子转移：Cu²⁺ 移向铁钉，Fe 即将进入溶液
        () => {
          const s = place('SO4', 640, 200, 0, 0);
          const atoms = [{ el: 'Fe', x: 260, y: 180 }, { el: 'Cu', x: 320, y: 178 }, ...s.atoms];
          return {
            atoms,
            bonds: [
              { a: 2, b: 3, order: 2 }, { a: 2, b: 4, order: 1 },
              { a: 2, b: 5, order: 2 }, { a: 2, b: 6, order: 1 }
            ],
            macro: 1
          };
        },
        // 2  完成：Cu 析出附着（Fe 原位），Fe²⁺ 进入溶液
        () => {
          const s = place('SO4', 660, 130, 0, 0);
          const atoms = [{ el: 'Fe', x: 560, y: 220 }, { el: 'Cu', x: 240, y: 178 }, ...s.atoms];
          return {
            atoms,
            bonds: [
              { a: 2, b: 3, order: 2 }, { a: 2, b: 4, order: 1 },
              { a: 2, b: 5, order: 2 }, { a: 2, b: 6, order: 1 }
            ],
            macro: 2
          };
        }
      ]
    },
    {
      id: 'neutralization',
      title: '酸碱中和（盐酸与氢氧化钠）',
      equation: 'HCl + NaOH → NaCl + H₂O',
      macro: 'neutral',
      nAtoms: 10,
      captions: [
        '反应前：盐酸（HCl）滴入含酚酞的氢氧化钠（NaOH）溶液，碱液显红色',
        '解离：酸碱在水中解离出 H⁺、Cl⁻、Na⁺、OH⁻——中和的实质从这里开始',
        '中和实质：H⁺ + OH⁻ → H₂O；Na⁺、Cl⁻ 是旁观离子，仍留在溶液中',
        '宏观：红色恰好褪去，溶液呈中性——酸与碱完全反应，生成盐和水'
      ],
      // 元素序列（各阶段必须一致）：H,Cl,H,Cl,Na,O,H,Na,O,H —— 2×HCl + 2×NaOH
      stages: [
        // 0  2 个 HCl（左）+ 2 个 NaOH（右）
        () => ({
          atoms: [
            { el: 'H', x: 280 - 11, y: 110 }, { el: 'Cl', x: 280 + 11, y: 110 },
            { el: 'H', x: 280 - 11, y: 215 }, { el: 'Cl', x: 280 + 11, y: 215 },
            { el: 'Na', x: 620 - 24, y: 105 }, { el: 'O', x: 620, y: 105 }, { el: 'H', x: 634, y: 117 },
            { el: 'Na', x: 620 - 24, y: 225 }, { el: 'O', x: 620, y: 225 }, { el: 'H', x: 634, y: 237 }
          ],
          bonds: [
            { a: 0, b: 1, order: 1 }, { a: 2, b: 3, order: 1 },
            { a: 4, b: 5, order: 1 }, { a: 5, b: 6, order: 1 },
            { a: 7, b: 8, order: 1 }, { a: 8, b: 9, order: 1 }
          ],
          macro: 0
        }),
        // 1  解离：自由离子（键全部断裂）
        () => ({
          atoms: [
            { el: 'H', x: 160, y: 90 }, { el: 'Cl', x: 250, y: 170 },
            { el: 'H', x: 210, y: 250 }, { el: 'Cl', x: 330, y: 90 },
            { el: 'Na', x: 660, y: 80 }, { el: 'O', x: 580, y: 160 }, { el: 'H', x: 600, y: 200 },
            { el: 'Na', x: 720, y: 200 }, { el: 'O', x: 640, y: 250 }, { el: 'H', x: 540, y: 100 }
          ],
          bonds: [], macro: 1
        }),
        // 2  重组：2 个 H₂O（H0/H6/O5、H2/H9/O8）+ 2 个 NaCl（Na4/Cl1、Na7/Cl3）
        () => ({
          atoms: [
            { el: 'H', x: 250 - 15, y: 134 }, { el: 'Cl', x: 664, y: 120 },
            { el: 'H', x: 450 - 15, y: 134 }, { el: 'Cl', x: 664, y: 230 },
            { el: 'Na', x: 636, y: 120 }, { el: 'O', x: 250, y: 120 }, { el: 'H', x: 250 + 15, y: 134 },
            { el: 'Na', x: 636, y: 230 }, { el: 'O', x: 450, y: 120 }, { el: 'H', x: 450 + 15, y: 134 }
          ],
          bonds: [
            { a: 5, b: 0, order: 1 }, { a: 5, b: 6, order: 1 },
            { a: 8, b: 2, order: 1 }, { a: 8, b: 9, order: 1 },
            { a: 4, b: 1, order: 1 }, { a: 7, b: 3, order: 1 }
          ],
          macro: 2
        }),
        // 3  产物分离：水分子聚在下方，盐离子分散在上方
        () => ({
          atoms: [
            { el: 'H', x: 300 - 15, y: 234 }, { el: 'Cl', x: 674, y: 90 },
            { el: 'H', x: 480 - 15, y: 234 }, { el: 'Cl', x: 754, y: 170 },
            { el: 'Na', x: 646, y: 90 }, { el: 'O', x: 300, y: 220 }, { el: 'H', x: 300 + 15, y: 234 },
            { el: 'Na', x: 726, y: 170 }, { el: 'O', x: 480, y: 220 }, { el: 'H', x: 480 + 15, y: 234 }
          ],
          bonds: [
            { a: 5, b: 0, order: 1 }, { a: 5, b: 6, order: 1 },
            { a: 8, b: 2, order: 1 }, { a: 8, b: 9, order: 1 },
            { a: 4, b: 1, order: 1 }, { a: 7, b: 3, order: 1 }
          ],
          macro: 3
        })
      ]
    },
    {
      id: 'co-reduce-cuo',
      title: '一氧化碳还原氧化铜',
      equation: 'CO + CuO —Δ→ Cu + CO₂',
      macro: 'co-reduce',
      nAtoms: 8,
      captions: [
        '反应前：黑色氧化铜粉末装在玻璃管中，通入一氧化碳气体',
        '加热：CO 夺取 CuO 中的氧——CO 是还原剂，CuO 被还原成 Cu',
        '宏观：黑色粉末逐渐变红（生成铜），CO₂ 使澄清石灰水变浑浊',
        '尾气必须点燃处理：CO 有毒，直接排放会污染空气'
      ],
      // 元素序列（各阶段必须一致）：C,O,C,O,Cu,O,Cu,O —— 2×CO + 2×CuO
      stages: [
        // 0  2 个 CO（左）+ 2 个 CuO（右）
        () => ({
          atoms: [
            { el: 'C', x: 200 - 14, y: 100 }, { el: 'O', x: 200 + 14, y: 100 },
            { el: 'C', x: 200 - 14, y: 200 }, { el: 'O', x: 200 + 14, y: 200 },
            { el: 'Cu', x: 560, y: 120 }, { el: 'O', x: 592, y: 120 },
            { el: 'Cu', x: 560, y: 220 }, { el: 'O', x: 592, y: 220 }
          ],
          bonds: [
            { a: 0, b: 1, order: 2 }, { a: 2, b: 3, order: 2 },
            { a: 4, b: 5, order: 1 }, { a: 6, b: 7, order: 1 }
          ],
          macro: 0
        }),
        // 1  加热：CO 分子靠近 CuO（夺取氧的前一刻）
        () => ({
          atoms: [
            { el: 'C', x: 380 - 14, y: 110 }, { el: 'O', x: 380 + 14, y: 110 },
            { el: 'C', x: 380 - 14, y: 210 }, { el: 'O', x: 380 + 14, y: 210 },
            { el: 'Cu', x: 560, y: 120 }, { el: 'O', x: 592, y: 120 },
            { el: 'Cu', x: 560, y: 220 }, { el: 'O', x: 592, y: 220 }
          ],
          bonds: [
            { a: 0, b: 1, order: 2 }, { a: 2, b: 3, order: 2 },
            { a: 4, b: 5, order: 1 }, { a: 6, b: 7, order: 1 }
          ],
          macro: 1
        }),
        // 2  夺氧完成：CO 保留自身 O 并夺取 CuO 的 O → CO₂（O-C-O）；Cu 游离析出
        () => ({
          atoms: [
            { el: 'C', x: 686, y: 120 }, { el: 'O', x: 686 - 28, y: 120 },
            { el: 'C', x: 686, y: 220 }, { el: 'O', x: 686 - 28, y: 220 },
            { el: 'Cu', x: 560, y: 120 }, { el: 'O', x: 686 + 28, y: 120 },
            { el: 'Cu', x: 560, y: 220 }, { el: 'O', x: 686 + 28, y: 220 }
          ],
          bonds: [
            { a: 0, b: 1, order: 2 }, { a: 0, b: 5, order: 2 },
            { a: 2, b: 3, order: 2 }, { a: 2, b: 7, order: 2 }
          ],
          macro: 2
        }),
        // 3  产物分离：CO₂ 上浮散开，红色铜留在管内
        () => ({
          atoms: [
            { el: 'C', x: 626, y: 60 }, { el: 'O', x: 598, y: 60 },
            { el: 'C', x: 766, y: 100 }, { el: 'O', x: 738, y: 100 },
            { el: 'Cu', x: 540, y: 150 }, { el: 'O', x: 654, y: 60 },
            { el: 'Cu', x: 560, y: 230 }, { el: 'O', x: 794, y: 100 }
          ],
          bonds: [
            { a: 0, b: 1, order: 2 }, { a: 0, b: 5, order: 2 },
            { a: 2, b: 3, order: 2 }, { a: 2, b: 7, order: 2 }
          ],
          macro: 3
        })
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
    else if (reaction.macro === 'charcoal') drawCharcoal(ctx, st, time, W, H);
    else if (reaction.macro === 'methane') drawMethane(ctx, st, time, W, H);
    else if (reaction.macro === 'displacement') drawDisplacement(ctx, st, time, W, H);
    else if (reaction.macro === 'neutral') drawNeutral(ctx, st, time, W, H);
    else if (reaction.macro === 'co-reduce') drawCoReduce(ctx, st, time, W, H);
  }

  // 酸碱中和：0 红色碱液 + 滴加盐酸 → 1 解离 → 2 中和进行中 → 3 恰好中和（无色）
  function drawNeutral(ctx, st, time) {
    const mix = st.macroMix;
    const cur = mix.from + (mix.to - mix.from) * mix.t;               // 总进度 0..3
    const red = 0.75 * Math.max(0, 1 - Math.max(0, cur - 0.4) / 2.2); // 酚酞红色随中和进度褪去
    const bx = 280, bw = 340, bot = 252;
    // 烧杯
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, 96); ctx.lineTo(bx, bot); ctx.lineTo(bx + bw, bot); ctx.lineTo(bx + bw, 96);
    ctx.stroke();
    // 溶液（红 → 无色）
    ctx.fillStyle = `rgba(226,96,110,${Math.max(0.05, red)})`;
    ctx.fillRect(bx + 3, 140, bw - 6, bot - 143);
    ctx.strokeStyle = `rgba(226,96,110,${Math.min(0.9, red + 0.15)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx + 3, 140); ctx.lineTo(bx + bw - 3, 140); ctx.stroke();
    // 胶头滴管：只在反应初期滴加盐酸
    if (cur < 1.2) {
      ctx.fillStyle = '#4a5261';
      ctx.fillRect(bx + bw / 2 - 7, 20, 14, 26);
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2 - 5, 46); ctx.lineTo(bx + bw / 2 + 5, 46); ctx.lineTo(bx + bw / 2, 60);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const dy = 62 + ((time / 6 + i * 44) % 72);
        if (dy < 136) {
          ctx.fillStyle = 'rgba(96,150,225,.85)';
          ctx.beginPath(); ctx.ellipse(bx + bw / 2 + 10, dy, 3.4, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = '#3b6fd4'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('滴加盐酸（HCl）', bx + bw / 2 + 20, 38);
    }
    // 溶液中浮动的离子微粒（解离~中和阶段）
    if (cur > 0.6 && cur < 2.6) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 8; i++) {
        const px = bx + 24 + ((time / 24 + i * 61) % (bw - 48));
        const py = 152 + (i * 29 % 84);
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 状态标注
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(cur < 1.6 ? '含酚酞的 NaOH 溶液（红色，pH > 7）' : cur < 2.6 ? '中和进行中，红色渐褪' : '恰好中和（无色，pH = 7）', bx + bw / 2, bot + 24);
    ctx.fillStyle = red > 0.4 ? '#c0392b' : '#2fae6e';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(red > 0.4 ? '碱性' : '中性', bx + bw / 2, 132);
    ctx.textAlign = 'left';
  }

  // 一氧化碳还原氧化铜：0 黑粉通 CO → 1 加热反应 → 2 变红 + 石灰水浑浊 → 3 点燃尾气
  function drawCoReduce(ctx, st, time) {
    const mix = st.macroMix;
    const cur = mix.from + (mix.to - mix.from) * mix.t;        // 总进度 0..3
    const heat = Math.max(0, Math.min(1, cur / 1.2));          // 加热强度
    const red = Math.max(0, Math.min(1, (cur - 0.5) / 1.7));   // 黑粉变红进度
    const lime = Math.max(0, Math.min(1, (cur - 1.8) / 0.4));  // 石灰水浑浊
    // 硬质玻璃管（横放）
    const tx = 280, tw = 340, ty = 128, th = 64;
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 12); ctx.stroke();
    ctx.fillStyle = 'rgba(200,225,245,.08)'; ctx.fill();
    // 粉末：黑色 CuO 逐粒变红（Cu）
    for (let i = 0; i < 16; i++) {
      const px = tx + 18 + (i % 8) * 38, py = ty + 40 + Math.floor(i / 8) * 14;
      const hot = red > (i % 8) / 9;   // 逐粒变化更有"过程感"
      ctx.fillStyle = hot ? `rgba(224,134,46,${0.55 + 0.45 * red})` : '#3d4450';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    }
    // 左侧通入 CO
    ctx.strokeStyle = '#5b8fd0'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(150, ty + th / 2); ctx.lineTo(tx, ty + th / 2); ctx.stroke();
    ctx.fillStyle = '#3b6fd4'; ctx.font = 'bold 12.5px sans-serif';
    ctx.fillText('通入 CO →', 92, ty + th / 2 - 12);
    // 酒精灯加热
    const lx = tx + tw / 2;
    ctx.fillStyle = '#4a5261';
    ctx.fillRect(lx - 26, ty + th + 26, 52, 20);
    ctx.fillRect(lx - 7, ty + th + 14, 14, 12);
    if (heat > 0.05) {
      const flick = Math.sin(time / 55) * 3;
      ctx.globalAlpha = heat;
      ctx.fillStyle = '#7ec3f0';
      ctx.beginPath();
      ctx.moveTo(lx - 12, ty + th + 14);
      ctx.quadraticCurveTo(lx - 16, ty + th - 4 + flick, lx, ty + th - 18 + flick);
      ctx.quadraticCurveTo(lx + 16, ty + th - 4 + flick, lx + 12, ty + th + 14);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c0392b'; ctx.font = '12px sans-serif';
      ctx.fillText('加热', lx + 34, ty + th + 10);
    }
    // 右侧导管 + 澄清石灰水试管
    const tx2 = 742;
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(tx + tw, ty + th / 2); ctx.lineTo(tx2, ty + th / 2); ctx.lineTo(tx2, 150); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(tx2 - 26, 150, 52, 110, 8); ctx.stroke();
    ctx.fillStyle = `rgba(235,245,255,${0.75 - 0.25 * lime})`;
    ctx.fillRect(tx2 - 23, 186, 46, 71);
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lime > 0.5 ? '变浑浊 ✓' : '澄清石灰水', tx2, 178);
    ctx.textAlign = 'left';
    if (lime > 0) {
      ctx.fillStyle = `rgba(225,235,245,${lime})`; ctx.fillRect(tx2 - 23, 186, 46, 71);
      ctx.fillStyle = `rgba(160,175,195,${0.9 * lime})`;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(tx2 - 14 + (i % 3) * 14, 198 + Math.floor(i / 3) * 24, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 尾气点燃（CO 有毒，不能直接排放）
    ctx.beginPath(); ctx.moveTo(tx2 + 26, 200); ctx.lineTo(836, 200); ctx.stroke();
    if (cur > 2.3) {
      const flick = Math.sin(time / 45) * 2.5;
      ctx.globalAlpha = Math.min(1, (cur - 2.3) / 0.3);
      ctx.fillStyle = '#8ec9f0';
      ctx.beginPath();
      ctx.moveTo(826, 198);
      ctx.quadraticCurveTo(832 + flick, 180, 836, 168 + flick);
      ctx.quadraticCurveTo(842, 182, 846, 198);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c0392b'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('点燃尾气', 812, 152);
    }
    // 状态标注
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif';
    ctx.fillText(red > 0.9 ? '黑色粉末 → 红色铜 ✓' : '黑色 CuO 粉末', tx, ty - 10);
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

  // 木炭在集气瓶中燃烧：0 待点燃 → 1 剧烈燃烧白光 → 2 石灰水变浑浊
  function drawCharcoal(ctx, st, time) {
    const mix = st.macroMix;
    const cur = mix.from + (mix.to - mix.from) * mix.t;
    const fl = Math.min(1, cur);                       // 火焰/白光强度
    const lime = Math.max(0, Math.min(1, (cur - 1.7) / 0.3)); // 浑浊程度
    const cx = 430;
    // 集气瓶
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 90, 245); ctx.lineTo(cx - 90, 80);
    ctx.quadraticCurveTo(cx - 90, 60, cx - 70, 58);
    ctx.lineTo(cx + 70, 58); ctx.quadraticCurveTo(cx + 90, 60, cx + 90, 80);
    ctx.lineTo(cx + 90, 245); ctx.closePath();
    ctx.fillStyle = 'rgba(200,225,245,.10)'; ctx.fill(); ctx.stroke();
    // 燃烧匙与木炭
    ctx.strokeStyle = '#4a5261'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, 190); ctx.stroke();
    ctx.fillStyle = '#3d4450';
    ctx.beginPath(); ctx.ellipse(cx, 205, 30, 16, 0, 0, Math.PI * 2); ctx.fill();
    // 白光
    if (fl > 0.02) {
      const flick = Math.sin(time / 55) * 4 + Math.sin(time / 21) * 3;
      ctx.globalAlpha = fl;
      const g = ctx.createRadialGradient(cx, 190 + flick, 4, cx, 190 + flick, 70);
      g.addColorStop(0, 'rgba(255,255,240,.95)');
      g.addColorStop(0.4, 'rgba(255,240,180,.55)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, 190 + flick, 70, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c0392b'; ctx.font = '12px sans-serif';
      ctx.fillText('剧烈燃烧 · 发出白光', cx - 60, 272);
    } else {
      ctx.fillStyle = '#9aa5b5'; ctx.font = '12px sans-serif';
      ctx.fillText('待点燃', cx - 18, 272);
    }
    // 右侧：澄清石灰水试管（变浑浊）
    const tx = 700;
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(tx - 26, 120, 52, 130, 8); ctx.stroke();
    ctx.fillStyle = `rgba(235,245,255,${0.75 - 0.25 * lime})`;
    ctx.fillRect(tx - 23, 160, 46, 87);
    if (lime > 0) {
      ctx.fillStyle = `rgba(225,235,245,${lime})`; ctx.fillRect(tx - 23, 160, 46, 87);
      ctx.fillStyle = `rgba(160,175,195,${0.9 * lime})`;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc(tx - 14 + (i % 4) * 9, 175 + Math.floor(i / 4) * 22, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('澄清石灰水', tx, 270);
    ctx.fillText(lime > 0.5 ? '变浑浊 ✓' : '', tx, 145);
    ctx.textAlign = 'left';
  }

  // 甲烷燃烧：0 待点燃 → 1 蓝色火焰 → 2 产物检验（水珠 + 浑浊）
  function drawMethane(ctx, st, time) {
    const mix = st.macroMix;
    const cur = mix.from + (mix.to - mix.from) * mix.t;
    const fl = Math.min(1, cur);
    const drops = Math.max(0, Math.min(1, (cur - 1.5) / 0.5));
    const lime = Math.max(0, Math.min(1, (cur - 1.7) / 0.3));
    const cx = 380;
    // 喷嘴
    ctx.fillStyle = '#4a5261';
    ctx.fillRect(cx - 30, 238, 60, 30);
    ctx.fillRect(cx - 9, 222, 18, 16);
    ctx.fillStyle = '#9aa5b5'; ctx.font = '12px sans-serif';
    ctx.fillText('CH₄', cx + 34, 240);
    // 蓝色火焰
    if (fl > 0.02) {
      const flick = Math.sin(time / 50) * 3 + Math.sin(time / 19) * 2;
      ctx.globalAlpha = fl;
      ctx.fillStyle = '#4d94f7';
      ctx.beginPath();
      ctx.moveTo(cx - 18, 224);
      ctx.quadraticCurveTo(cx - 24, 180 + flick, cx, 150 + flick);
      ctx.quadraticCurveTo(cx + 24, 180 + flick, cx + 18, 224);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bfe0ff';
      ctx.beginPath();
      ctx.moveTo(cx - 8, 224);
      ctx.quadraticCurveTo(cx - 11, 200 + flick, cx, 186 + flick);
      ctx.quadraticCurveTo(cx + 11, 200 + flick, cx + 8, 224);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2b6cd4'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('蓝色火焰', cx + 30, 190);
    } else {
      ctx.fillStyle = '#9aa5b5'; ctx.font = '12px sans-serif';
      ctx.fillText('待点燃', cx + 26, 232);
    }
    // 干冷烧杯（内壁水珠）
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 90, 175); ctx.lineTo(cx + 90, 62); ctx.lineTo(cx + 250, 62); ctx.lineTo(cx + 250, 175);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,215,240,.12)'; ctx.fill();
    if (drops > 0) {
      ctx.fillStyle = `rgba(90,150,220,${0.75 * drops})`;
      const D = [[110, 72], [140, 68], [172, 71], [200, 67], [228, 73], [126, 90], [212, 92]];
      D.forEach(d => { ctx.beginPath(); ctx.arc(cx + d[0], d[1], 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = `rgba(60,110,180,${drops})`; ctx.font = '12px sans-serif';
      ctx.fillText('水珠（生成 H₂O）', cx + 108, 108);
    }
    // 石灰水（变浑浊）
    const tx = 760;
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(tx - 26, 120, 52, 130, 8); ctx.stroke();
    ctx.fillStyle = `rgba(235,245,255,${0.75 - 0.25 * lime})`;
    ctx.fillRect(tx - 23, 160, 46, 87);
    if (lime > 0) {
      ctx.fillStyle = `rgba(225,235,245,${lime})`; ctx.fillRect(tx - 23, 160, 46, 87);
      ctx.fillStyle = `rgba(160,175,195,${0.9 * lime})`;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc(tx - 14 + (i % 4) * 9, 175 + Math.floor(i / 4) * 22, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(60,110,180,${lime})`; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('变浑浊（生成 CO₂）', tx, 145); ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('澄清石灰水', tx, 145); ctx.textAlign = 'left';
    }
  }

  // 铁与硫酸铜置换：0 浸入蓝色溶液 → 1 反应中 → 2 铜析出、溶液变浅绿
  function drawDisplacement(ctx, st, time) {
    const mix = st.macroMix;
    const cur = mix.from + (mix.to - mix.from) * mix.t;
    const prog = Math.min(1, cur / 2);                 // 总进度
    const cx = 450;
    // 烧杯
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 150, 80); ctx.lineTo(cx - 150, 250); ctx.lineTo(cx + 150, 250); ctx.lineTo(cx + 150, 80);
    ctx.stroke();
    // 溶液：蓝色 → 浅绿
    const r = Math.round(96 + (150 - 96) * prog);
    const g = Math.round(150 + (195 - 150) * prog);
    const b = Math.round(225 + (155 - 225) * prog);
    ctx.fillStyle = `rgba(${r},${g},${b},.55)`;
    ctx.fillRect(cx - 147, 110, 294, 137);
    // 液面
    ctx.strokeStyle = `rgba(${r},${g},${b},.9)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 147, 110); ctx.lineTo(cx + 147, 110); ctx.stroke();
    // 铁钉（银灰，表面逐渐覆盖红色铜）
    const nx = cx - 60, top = 90;
    ctx.strokeStyle = '#6b7686'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(nx - 10, top); ctx.lineTo(nx - 10, 240); ctx.lineTo(nx + 10, 240); ctx.lineTo(nx + 10, top);
    ctx.stroke();
    ctx.fillStyle = '#8d99ae';
    ctx.beginPath(); ctx.arc(nx, top, 11, Math.PI, 0); ctx.fill();
    ctx.fillRect(nx - 10, top, 20, 150 - top);
    // 析出的红色铜（下半段逐渐变红）
    if (prog > 0.15) {
      const cover = Math.min(1, (prog - 0.15) / 0.5);
      ctx.fillStyle = `rgba(224,134,46,${cover})`;
      ctx.fillRect(nx - 10, 170, 20, 70);
      ctx.beginPath(); ctx.ellipse(nx, 240, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 说明文字
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif';
    ctx.fillText('铁钉', nx - 42, 200);
    ctx.fillStyle = prog > 0.5 ? '#b45309' : '#5b6575';
    ctx.fillText(prog > 0.5 ? '红色铜析出 ✓' : '', cx + 60, 150);
    ctx.fillStyle = '#5b6575';
    ctx.fillText('溶液：Cu²⁺（蓝）→ Fe²⁺（浅绿）', cx - 140, 235);
    // 微小气泡般的离子浮动点
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 5; i++) {
      const px = cx - 120 + ((time / 30 + i * 137) % 260);
      const py = 130 + (i * 37 % 90);
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- 主循环 ----------
  // 单帧绘制：切反应时同步画首帧，不必等下一个 rAF（也避免慢机器上的空白闪烁期）
  function paint(now) {
    const st = current();
    drawMicro(st);
    drawMacro(st, now || 0);
    updateCaption && updateCaption(st);
  }
  function tick(now) {
    if (!reaction) return;
    // 页面隐藏（切走导航/切到其他子标签）时冻结时间轴并跳过绘制，回来接着放
    if (macroCv.offsetParent === null) { raf = requestAnimationFrame(tick); return; }
    const dt = Math.min(50, now - lastT); lastT = now;
    if (playing) phase += dt / (HOLD + TRANSIT);
    const n = reaction.stages.length;
    if (phase >= n - 1) { phase = n - 1; if (playing) { playing = false; onPlayState && onPlayState(); } }
    paint(now);
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
    paint(0);   // 首帧同步上屏
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

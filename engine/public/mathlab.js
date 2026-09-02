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
  // 支持的内置函数（含高中反三角/余切割、大学伽马与阶乘）
  const FN_NAMES = ['sin', 'cos', 'tan', 'atan', 'asin', 'acos', 'sqrt', 'abs', 'log', 'exp', 'min', 'max', 'PI', 'round', 'floor', 'ceil', 'sgn', 'cot', 'sec', 'csc', 'gamma', 'fact'];
  const FN_RE = new RegExp('\\b(' + FN_NAMES.join('|') + ')\\b', 'g');
  // JS 没有的内置函数映射（全部走 __F 作用域；sgn 修复双重替换）
  const FN_MAP = [
    [/Math\.cot\(/g, '__F.cot('],
    [/Math\.sec\(/g, '__F.sec('],
    [/Math\.csc\(/g, '__F.csc('],
    [/Math\.sgn\(/g, 'Math.sign('],
    [/Math\.gamma\(/g, '__F.gamma('],
    [/Math\.fact\(/g, '__F.fact(']
  ];
  // Lanczos 近似伽马函数（支持阶乘/泊松/贝塔类教学函数），z>0 且非极点
  function gammaFn(z) {
    const C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
    z -= 1;
    let x = C[0];
    for (let i = 1; i < 9; i++) x += C[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  const COLORS = ['#3b6fd4', '#e05656', '#2fae6e', '#9b59b6', '#e67e22', '#16a085'];
  const NAME_SEQ = ['f', 'g', 'h', 'u', 'v', 'w'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- 分类与预设 ----------------
  const CATS = {
    primary: {
      name: '① 变量与规律', level: '小学',
      intro: '生活中"一个量变，另一个量跟着变"的关系，就是函数的种子。',
      presets: [
        { name: '正比例关系', expr: 'k*x', desc: '单价 k 元，买 x 个共 kx 元' },
        { name: '反比例关系', expr: 'k/x', desc: '总量一定，份数越多每份越少' },
        { name: '正方形面积', expr: 'x^2', desc: '边长 x → 面积 x²' },
        { name: '正方体体积', expr: 'x^3', desc: '棱长 x → 体积 x³' },
        { name: '分段计费', expr: '5 + 2*x', desc: '起步价 5 元 + 每公里 2 元' }
      ],
      demos: []
    },
    basic: {
      name: '② 一次与反比例', level: '初中',
      intro: '初中函数的起点：一次函数的直线、反比例的双曲线与绝对值。',
      presets: [
        { name: '一次函数', expr: 'k*x + b', desc: '斜率与截距' },
        { name: '正比例函数', expr: 'k*x', desc: '过原点的直线' },
        { name: '反比例函数', expr: 'k/x', desc: '双曲线' },
        { name: '绝对值函数', expr: 'a*abs(x) + b', desc: 'V 形折线' },
        { name: '分段拼合（示例）', expr: 'x + abs(x^2 - 4)', desc: '绝对值构造分段' },
        { name: '含参一次函数族', expr: 'a*x + 1', desc: '拖 a 看直线系' }
      ],
      demos: []
    },
    quadratic: {
      name: '③ 二次函数', level: '初中',
      intro: '开口、顶点、对称轴——二次函数的三种表达式各有分工。',
      presets: [
        { name: '一般式', expr: 'a*x^2 + b*x + c', desc: '开口/顶点/对称轴' },
        { name: '顶点式', expr: 'a*(x-h)^2 + k', desc: '顶点 (h,k)' },
        { name: '交点式', expr: 'a*(x-m)*(x-n)', desc: '零点在 x=m 与 x=n' },
        { name: '宽窄对比', expr: 'a*x^2', desc: '拖 a 看开口宽窄' },
        { name: '二次 + 一次（交点）', expr: 'a*x^2 - x', desc: '与直线 y=x 的交点' }
      ],
      demos: []
    },
    power: {
      name: '④ 幂·指数·对数', level: '高中',
      intro: '三类增长速度完全不同的基本初等函数。',
      presets: [
        { name: '幂函数', expr: 'x^a', desc: 'a 控制形状' },
        { name: '平方根（根式）', expr: 'sqrt(x)', desc: 'x^(1/2)' },
        { name: '立方根', expr: 'x^(1/3)', desc: '负数也有立方根' },
        { name: '指数函数', expr: 'a^x', desc: '增长 / 衰减' },
        { name: '自然指数', expr: 'exp(x)', desc: 'e^x' },
        { name: '对数函数', expr: 'log(x)/log(a)', desc: 'log_a(x)' },
        { name: '自然对数', expr: 'log(x)', desc: 'ln x' },
        { name: '指数 vs 幂', expr: 'a^x - x^2', desc: '谁增长更快？' },
        { name: '指数衰减', expr: 'exp(-a*x)', desc: '半衰期模型' }
      ],
      demos: []
    },
    trig: {
      name: '⑤ 三角函数', level: '高中',
      intro: '周期现象的数学语言：正余弦、正余切、正余割与反三角。',
      presets: [
        { name: '正弦波', expr: 'A*sin(w*x + p)', desc: '振幅/频率/初相' },
        { name: '余弦波', expr: 'A*cos(w*x + p)', desc: '与正弦相差 π/2' },
        { name: '正切', expr: 'A*tan(w*x)', desc: '周期 π，有无穷间断' },
        { name: '余切', expr: 'cot(x)', desc: '1/tan x' },
        { name: '正割', expr: 'sec(x)', desc: '1/cos x' },
        { name: '余割', expr: 'csc(x)', desc: '1/sin x' },
        { name: '反正弦', expr: 'asin(x)', desc: '值域 [-π/2, π/2]' },
        { name: '反余弦', expr: 'acos(x)', desc: '值域 [0, π]' },
        { name: '反正切', expr: 'atan(x)', desc: '水平渐近线 ±π/2' },
        { name: '拍（叠加）', expr: 'sin(a*x) + sin(b*x)', desc: '频率接近形成拍' },
        { name: '恒等式验证', expr: 'sin(x)^2 + cos(x)^2', desc: '恒等于 1 的水平线' }
      ],
      demos: []
    },
    transform: {
      name: '⑥ 函数变换', level: '高中',
      intro: '平移、伸缩、翻转、折叠——一切变换都能在 sin(x) 上看清楚。',
      presets: [
        { name: '纵向缩放', expr: 'a*sin(x)', desc: '|a|>1 拉伸，<1 压缩' },
        { name: '横向缩放', expr: 'sin(a*x)', desc: 'a 越大周期越短' },
        { name: '水平平移', expr: 'sin(x - p)', desc: '右移 p（左加右减）' },
        { name: '垂直平移', expr: 'sin(x) + k', desc: '上移 k' },
        { name: '关于 x 轴翻转', expr: '-sin(x)', desc: '上下翻转' },
        { name: '绝对值折叠', expr: 'abs(sin(x))', desc: '负半轴翻上去' },
        { name: '符号函数', expr: 'sgn(sin(x))', desc: '只保留正负号' },
        { name: '综合变换', expr: 'a*sin(w*(x - p)) + k', desc: '四要素一次看全' }
      ],
      demos: []
    },
    discrete: {
      name: '⑦ 数列与离散', level: '高中',
      intro: '把 x 换成项数 n，函数就成了数列；取整函数天然离散。',
      presets: [
        { name: '等差数列通项', expr: 'a*x + b', desc: 'an = a1 + (n-1)d' },
        { name: '等比数列通项', expr: 'a^x', desc: 'an = a1·q^(n-1)' },
        { name: '阶乘', expr: 'fact(x)', desc: 'x!（伽马函数插值）' },
        { name: '取整函数（阶梯）', expr: 'floor(x)', desc: '不超过 x 的最大整数' },
        { name: '小数部分', expr: 'x - floor(x)', desc: '锯齿波原型' },
        { name: '符号函数', expr: 'sgn(x)', desc: '三段台阶' },
        { name: '泊松分布形态', expr: 'fact(x)*exp(-l)*l^x', desc: 'P(X=k)=λᵏe^{-λ}/k!（拖 l）' }
      ],
      demos: []
    },
    calculus: {
      name: '⑧ 微分与积分', level: '大学',
      intro: '切线的斜率是导数，曲线下的面积是积分。',
      presets: [
        { name: '三次曲线', expr: 'a*x^3 + b*x', desc: '配合下方演示观察' },
        { name: '高斯函数', expr: 'exp(-x^2)', desc: '钟形，处处光滑' },
        { name: '振荡积分', expr: 'x*sin(x)', desc: '面积正负相消' }
      ],
      demos: [
        { id: 'deriv', name: '导数与切线', desc: '拖动点，切线与导数实时变化' },
        { id: 'integral', name: '定积分 · 黎曼和', desc: '矩形逼近曲线下面积' }
      ]
    },
    series: {
      name: '⑨ 级数·泰勒展开', level: '大学',
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
      name: '⑩ 傅里叶与信号', level: '大学',
      intro: '任何周期信号都是正弦波的叠加。',
      presets: [
        { name: '谐波叠加', expr: 'sin(x) + sin(3*x)/3 + sin(5*x)/5', desc: '方波的前 3 项' },
        { name: '整流信号', expr: 'abs(sin(x))', desc: '全波整流的傅里叶原料' }
      ],
      demos: [
        { id: 'fourier-square', name: '傅里叶级数 · 方波', desc: 'N 项谐波合成方波' },
        { id: 'fourier-saw', name: '傅里叶级数 · 锯齿波', desc: '锯齿波合成' },
        { id: 'dft', name: '傅里叶变换 · 频谱', desc: '时域信号 → DFT → 频谱' }
      ]
    },
    growth: {
      name: '⑪ 增长与微分方程', level: '大学',
      intro: '微分方程的解就是这些曲线：增长、衰减、振荡与饱和。',
      presets: [
        { name: '指数增长', expr: 'exp(a*x)', desc: 'y\' = a·y 的解' },
        { name: '指数衰减', expr: 'exp(-a*x)', desc: '放射性衰变 / 牛顿冷却' },
        { name: 'Logistic 饱和增长', expr: '1/(1 + exp(-k*(x - h)))', desc: 'S 形曲线，拖 k 与 h' },
        { name: '阻尼振动', expr: 'exp(-a*x)*sin(w*x)', desc: '振幅指数衰减的振动' },
        { name: '饱和模型', expr: '1 - exp(-a*x)', desc: '学习曲线 / 充电曲线' },
        { name: '过冲响应', expr: '1 - exp(-a*x)*(cos(w*x) + sin(w*x)/w)', desc: '二阶系统阶跃响应' }
      ],
      demos: []
    },
    stats: {
      name: '⑫ 概率与统计', level: '大学',
      intro: '概率密度、分布与激活函数——统计与机器学习的公共数学。',
      presets: [
        { name: '标准正态密度', expr: 'exp(-x^2/2)/sqrt(2*PI)', desc: 'μ=0, σ=1 的钟形曲线' },
        { name: '一般正态密度', expr: 'exp(-((x - m)^2)/(2*s^2))/(s*sqrt(2*PI))', desc: '拖 m 移动、s 拉宽' },
        { name: '柯西密度', expr: '1/(PI*(1 + x^2))', desc: '胖尾巴：均值不存在' },
        { name: 'Sigmoid 函数', expr: '1/(1 + exp(-x))', desc: '神经网络激活函数' },
        { name: '伽马函数', expr: 'gamma(x)', desc: '阶乘的连续推广' },
        { name: '正态 vs 柯西', expr: 'exp(-x^2/2)/sqrt(2*PI) - 1/(PI*(1 + x^2))', desc: '尾巴厚薄之差' }
      ],
      demos: []
    },
    surface: {
      name: '⑬ 三维曲面', level: '大学',
      intro: 'z = f(x, y)，输入含 y 的表达式自动进入三维。',
      presets: [
        { name: '旋转抛物面', expr: 'x^2 + y^2', desc: 'z = x²+y²' },
        { name: '马鞍面', expr: 'x^2 - y^2', desc: '双曲抛物面' },
        { name: '正弦波面', expr: 'sin(x)*cos(y)', desc: '二维驻波' },
        { name: '涟漪', expr: 'sin(sqrt(x^2 + y^2))', desc: '中心扩散波纹' },
        { name: '高斯峰', expr: 'exp(-(x^2 + y^2))', desc: '二维正态密度面' },
        { name: '带参数的波', expr: 'a*sin(x*y)', desc: '拖 a 看变化' }
      ],
      demos: []
    },
    param: {
      name: '⑭ 参数曲线·极坐标', level: '拓展',
      intro: '当 x、y 各自随参数 t 变化，或用角度与半径描述曲线时，会得到一系列经典曲线。极坐标可直接输入 r = ...（θ 可写作 t）。',
      presets: [
        { name: '心形线', expr: 'r = 1 + cos(t)', desc: 'r = 1 + cosθ' },
        { name: '玫瑰线（三叶）', expr: 'r = cos(3*t)', desc: 'r = cos(kθ)，k 奇数 k 叶' },
        { name: '玫瑰线（四叶）', expr: 'r = 2*cos(2*t)', desc: 'k 偶数时 2k 叶' },
        { name: '阿基米德螺线', expr: 'r = t/6', desc: 'r = aθ，匀速螺旋' },
        { name: '双纽线', expr: 'r = sqrt(abs(2*cos(2*t)))', desc: 'r² = 2cos2θ' }
      ],
      demos: [
        { id: 'rose', name: '极坐标玫瑰线', desc: 'r = cos(kθ)，花瓣数由 k 决定' },
        { id: 'lissajous', name: '利萨茹曲线', desc: '两个垂直简谐振动的合成' },
        { id: 'cycloid', name: '摆线滚动', desc: '滚轮上一点的轨迹（可播放动画）' }
      ]
    },
    conic: {
      name: '⑧ 圆锥曲线·向量场', level: '高中',
      intro: '直接输入含 = 的表达式即可画出隐函数曲线（如 x^2 + y^2 = 25）；参数 a、b 可拖动观察曲线如何变化。',
      presets: [
        { name: '圆', expr: 'x^2 + y^2 = 25', desc: '到定点距离等于定长' },
        { name: '椭圆', expr: 'x^2/25 + y^2/9 = 1', desc: 'a=5，b=3' },
        { name: '椭圆（可调）', expr: 'x^2/a^2 + y^2/b^2 = 1', desc: '拖动 a、b，看离心率' },
        { name: '双曲线', expr: 'x^2/9 - y^2/4 = 1', desc: '实轴 6，虚轴 4' },
        { name: '抛物线（开口向右）', expr: 'y^2 = 2*p*x', desc: '焦点 (p/2, 0)' },
        { name: '过两点的直线系', expr: 'a*x + y = 3', desc: '拖 a 看直线系' },
        { name: '笛卡尔叶形线', expr: 'x^3 + y^3 = 3*x*y', desc: '经典隐函数曲线' },
        { name: '环面曲线', expr: '(x^2 + y^2 - 4)^2 = 4', desc: 'F(x,y)=常数 的一般形式' }
      ],
      demos: [
        { id: 'vfield', name: '向量场与流线', desc: '输入 P、Q，点击图面释放粒子沿场运动' }
      ]
    }
  };

  // ---------------- 表达式解析 ----------------
  // refNames: 允许被嵌套引用的已有函数名。表达式里的 g(x) 会被编译成 __F.g(x)，
  // __F 在每次求值时实时构建，因此被引用函数改动后引用方自动联动。
  // opts.vars：显式指定变量（极坐标 ['t']、隐函数 ['x','y']）；省略时自动判断（含 y → 三维）
  function parseExpr(expr, refNames, opts) {
    opts = opts || {};
    refNames = refNames || [];
    if (!/^[0-9a-zA-Z+\-*/().^\s,]+$/.test(expr)) throw new Error('含有不支持的字符');
    let js = expr.replace(/\bMath\s*\.\s*/g, '').replace(/\^/g, '**');
    const refs = refNames.filter(n => new RegExp('(^|[^a-zA-Z0-9_])' + n + '\\s*\\(').test(js));
    let stripped = js.replace(FN_RE, '');
    refs.forEach(n => { stripped = stripped.replace(new RegExp('\\b' + n + '\\s*\\(', 'g'), ''); });
    const refLetters = refs.join('');
    const is3D = !opts.vars && /\by\b/.test(stripped);
    const vars = opts.vars || (is3D ? ['x', 'y'] : ['x']);
    const letters = [...new Set(stripped.match(/[a-zA-Z]/g) || [])]
      .filter(c => c !== 'e' && !refLetters.includes(c) && !vars.includes(c));
    let withMath = js.replace(FN_RE, 'Math.$1');
    FN_MAP.forEach(([re, to]) => { withMath = withMath.replace(re, to); });
    // JS 语法限制：一元负号不能直接作 ** 的左操作数（-x**2 是语法错误），包成 -(x**2)
    withMath = withMath
      .replace(/\*\*\s*-\s*([a-zA-Z0-9_.]+|\([^()]*\))/g, '**(-$1)')   // 右操作数：x**-1 → x**(-1)
      .replace(/(^|[(,+\-*\/]\s*)-\s*([a-zA-Z][a-zA-Z0-9_.]*(?:\s*\*\*\s*[a-zA-Z0-9_.()]+)*)/g, '$1-($2)'); // 左侧：-x**2 → -(x**2)
    refs.forEach(n => { withMath = withMath.replace(new RegExp('\\b' + n + '\\s*\\(', 'g'), '__F.' + n + '('); });
    const argNames = ['__F', ...vars, ...letters];
    const f = new Function(...argNames, `"use strict"; return (${withMath});`);
    // 试算：多组采样点防退化（如 log(x)/log(a) 在 x=1,a=1 时为 0/0），任一点有限即通过；
    // 嵌套引用用替身作用域（任何函数返回 1）且从不因试算失败拒绝
    const stub = new Proxy({}, { get: () => () => 1 });
    let trialOk = false;
    for (const pv of [2, 3]) {
      for (const xv of [1, 2, 0.5]) {
        try {
          const t0 = f(stub, ...vars.map(() => xv), ...letters.map(() => pv));
          if (typeof t0 === 'number' && isFinite(t0)) { trialOk = true; break; }
        } catch (e) { /* 试下一个点 */ }
      }
      if (trialOk) break;
    }
    if (!trialOk && !refs.length) throw new Error('表达式无法计算');
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

  // 引用作用域：实时构建，保证嵌套联动；cot/sec/csc/gamma/fact 是内置数学助手
  function scope() {
    const s = {
      cot: t => 1 / Math.tan(t),
      sec: t => 1 / Math.cos(t),
      csc: t => 1 / Math.sin(t),
      gamma: gammaFn,
      fact: n => gammaFn(n + 1)
    };
    fns.forEach(o => { s[o.name] = o.fn; });
    return s;
  }
  function nextName(base) {
    if (base && !fns.some(o => o.name === base)) return base;
    for (const b of NAME_SEQ) if (!fns.some(o => o.name === b)) return b;
    let i = 2;
    while (fns.some(o => o.name === (base || 'f') + i)) i++;
    return (base || 'f') + i;
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
  // 视图变化后的重建管线（rAF 合帧；重建期间屏蔽 update 事件，防止循环）
  // 覆盖：隐函数等值线重算 + 普通函数按新视口无限延伸重采样（无限画布）
  let impQueued = false, impBuilding = false;
  function scheduleViewRebuild() {
    if (impBuilding || impQueued) return;
    if (!fns.some(o => o.type === 'implicit' || o.type === 'fn')) return;
    impQueued = true;
    requestAnimationFrame(() => {
      impBuilding = true;
      try {
        const bb = board.getBoundingBox();
        fns.forEach(o => {
          if (o.type === 'implicit') o.build();
          else if (o.type === 'fn' && o.build) o.build(bb);
        });
      } finally { impBuilding = false; impQueued = false; }
    });
  }
  function ensureBoard() {
    if (!board) {
      board = JXG.JSXGraph.initBoard('plot2d', {
        boundingbox: [-8, 6, 8, -6], axis: true, showCopyright: false,
        pan: { enabled: true, needShift: false, needTwoFinger: false },
        zoom: { wheel: true, needShift: false },
        showNavigation: false, keyboard: { enabled: false }
      });
      board.on('update', scheduleViewRebuild);
    }
    return board;
  }

  function baseEntry(type, expr, nameBase) {
    const color = COLORS[colorIdx++ % COLORS.length];
    return { id: 'fn' + idc++, name: nextName(nameBase), type, expr, params: [], pr: {}, refs: [], color, visible: true };
  }

  function finishEntry(entry) {
    fns.push(entry);
    renderFnList();
    selectFn(entry.id);
    return entry;
  }

  function addFn(expr, parsed) {
    const p = parsed || parseExpr(expr, fns.map(o => o.name));
    const pr = {};
    p.params.forEach(k => { pr[k] = 1; });
    const entry = baseEntry('fn', expr);
    entry.f = p.f; entry.params = p.params; entry.pr = pr; entry.refs = p.refs;
    entry.width = 2.5; entry.dash = 0;
    entry.fn = x => {
      try {
        const v = entry.f(scope(), x, ...entry.params.map(k => entry.pr[k]));
        return typeof v === 'number' ? v : NaN;
      } catch (e) { return NaN; }
    };
    // 无限画布：定义域跟随视口（左右各外扩 10%），平移/缩放时由视图管线重建
    entry.build = bb => {
      bb = bb || ensureBoard().getBoundingBox();
      const m = (bb[2] - bb[0]) * 0.1;
      if (entry.curve) { try { board.removeObject(entry.curve); } catch (e) { /* ignore */ } }
      entry.curve = board.create('functiongraph', [entry.fn, bb[0] - m, bb[2] + m],
        { strokeColor: entry.color, strokeWidth: entry.width, dash: entry.dash });
      entry.curve.on('down', () => { if (mode === '2d') selectFn(entry.id); });
    };
    entry.build();
    // 参数默认值修正：全 1 组合可能整体退化（如 log(x)/log(a) 在 a=1 时恒为 NaN），换 2 试试
    if (entry.params.length && [1, 2, 3].every(v => { const r = entry.fn(v); return typeof r !== 'number' || isNaN(r); })) {
      entry.params.forEach(k => { entry.pr[k] = 2; });
      if ([1, 2, 3].every(v => { const r = entry.fn(v); return typeof r !== 'number' || isNaN(r); })) {
        entry.params.forEach(k => { entry.pr[k] = 1; });
      }
    }
    return finishEntry(entry);
  }

  function addPolar(expr, parsed) {
    // expr 形如 "r = 2*cos(t)"（θ 已归一化为 t），画出 x=r(t)·cos t，y=r(t)·sin t
    const rhs = expr.replace(/^r\s*=/i, '');
    const p = parsed || parseExpr(rhs, fns.map(o => o.name), { vars: ['t'] });
    const pr = {};
    p.params.forEach(k => { pr[k] = 1; });
    const entry = baseEntry('polar', expr, 'r');
    entry.rhs = rhs; entry.f = p.f; entry.params = p.params; entry.pr = pr; entry.refs = p.refs;
    entry.width = 2.5; entry.dash = 0;
    entry.r = t => {
      try {
        const v = entry.f(scope(), t, ...entry.params.map(k => entry.pr[k]));
        return typeof v === 'number' ? v : NaN;
      } catch (e) { return NaN; }
    };
    // t 覆盖 0~8π：玫瑰线 2π 足够闭合，螺线类也能看到足够多圈
    entry.curve = ensureBoard().create('curve',
      [t => entry.r(t) * Math.cos(t), t => entry.r(t) * Math.sin(t), 0, 8 * Math.PI],
      { strokeColor: entry.color, strokeWidth: entry.width, dash: entry.dash });
    entry.curve.on('down', () => { if (mode === '2d') selectFn(entry.id); });
    return finishEntry(entry);
  }

  // ---------------- 隐函数：marching squares 等值线 ----------------
  // F(x,y) = 左边 − 右边 = 0。网格采样后在单元格内线性插值出零线段，再拼接成折线。
  const MS_TABLE = {
    1: [[0, 3]], 2: [[0, 1]], 3: [[1, 3]], 4: [[1, 2]],
    5: [[0, 3], [1, 2]], 6: [[0, 2]], 7: [[2, 3]], 8: [[2, 3]],
    9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]],
    13: [[0, 1]], 14: [[0, 3]]
  };

  function joinSegments(segs) {
    const key = (x, y) => Math.round(x * 1e6) + ',' + Math.round(y * 1e6);
    const near = new Map();
    segs.forEach((s, i) => {
      [key(s[0], s[1]), key(s[2], s[3])].forEach(k => {
        if (!near.has(k)) near.set(k, []);
        near.get(k).push(i);
      });
    });
    const used = new Uint8Array(segs.length);
    const takeAt = k => {
      const arr = near.get(k);
      if (arr) while (arr.length) {
        const i = arr.pop();
        if (!used[i]) {
          used[i] = 1;
          const s = segs[i];
          return key(s[0], s[1]) === k ? [s[2], s[3]] : [s[0], s[1]];
        }
      }
      return null;
    };
    const lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const s = segs[i];
      const pts = [[s[0], s[1]], [s[2], s[3]]];
      for (let dir = 0; dir < 2; dir++) {
        let next = takeAt(key(pts[pts.length - 1][0], pts[pts.length - 1][1]));
        while (next) {
          pts.push(next);
          next = takeAt(key(pts[pts.length - 1][0], pts[pts.length - 1][1]));
        }
        if (dir === 0) pts.reverse();
      }
      lines.push(pts);
    }
    return lines;
  }

  function buildImplicitCurve(entry) {
    const bb = ensureBoard().getBoundingBox(); // [xmin, ymax, xmax, ymin]
    const x0 = bb[0], y1 = bb[1], x1 = bb[2], y0 = bb[3];
    const gx0 = x0 - (x1 - x0) * 0.04, gx1 = x1 + (x1 - x0) * 0.04;
    const gy0 = y0 - (y1 - y0) * 0.04, gy1 = y1 + (y1 - y0) * 0.04;
    const nx = 140;
    const ny = Math.max(30, Math.round(nx * (gy1 - gy0) / (gx1 - gx0)));
    const dx = (gx1 - gx0) / nx, dy = (gy1 - gy0) / ny;
    const W = nx + 1;
    const V = new Float64Array(W * (ny + 1));
    for (let j = 0; j <= ny; j++) {
      const y = gy0 + j * dy;
      for (let i = 0; i < W; i++) V[j * W + i] = entry.fv(gx0 + i * dx, y);
    }
    const segs = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v0 = V[j * W + i], v1 = V[j * W + i + 1],
          v2 = V[(j + 1) * W + i + 1], v3 = V[(j + 1) * W + i];
        if (isNaN(v0) || isNaN(v1) || isNaN(v2) || isNaN(v3)) continue;
        const code = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
        if (code === 0 || code === 15) continue;
        const x = gx0 + i * dx, y = gy0 + j * dy;
        const P = [[x, y], [x + dx, y], [x + dx, y + dy], [x, y + dy]];
        const E = [[P[0], P[1], v0, v1], [P[1], P[2], v1, v2], [P[3], P[2], v3, v2], [P[0], P[3], v0, v3]];
        (MS_TABLE[code] || []).forEach(pair => {
          const A = E[pair[0]], B = E[pair[1]];
          const ta = A[2] / (A[2] - A[3]), tb = B[2] / (B[2] - B[3]);
          segs.push([A[0][0] + (A[1][0] - A[0][0]) * ta, A[0][1] + (A[1][1] - A[0][1]) * ta,
            B[0][0] + (B[1][0] - B[0][0]) * tb, B[0][1] + (B[1][1] - B[0][1]) * tb]);
        });
      }
    }
    if (entry.curves) entry.curves.forEach(c => { try { board.removeObject(c); } catch (e) { /* ignore */ } });
    entry.curves = joinSegments(segs).map(pts => {
      const c = board.create('curve', [pts.map(p => p[0]), pts.map(p => p[1])],
        { strokeColor: entry.color, strokeWidth: entry.width || 2.8, dash: entry.dash || 0, curveType: 'plot' });
      c.on('down', () => { if (mode === '2d') selectFn(entry.id); });
      return c;
    });
  }

  function addImplicit(expr, parsed) {
    // expr 形如 "x^2 + y^2 = 25"，即 F(x,y) = 左边 − 右边 = 0
    const parts = expr.split('=');
    const p = parsed || parseExpr('(' + parts[0].trim() + ') - (' + parts[1].trim() + ')',
      fns.map(o => o.name), { vars: ['x', 'y'] });
    const pr = {};
    p.params.forEach(k => { pr[k] = 1; });
    const entry = baseEntry('implicit', expr, 'C');
    entry.F = p.f; entry.params = p.params; entry.pr = pr; entry.refs = p.refs;
    entry.fv = (x, y) => {
      try {
        const v = entry.F(scope(), x, y, ...entry.params.map(k => entry.pr[k]));
        return typeof v === 'number' ? v : NaN;
      } catch (e) { return NaN; }
    };
    entry.curves = [];
    entry.build = () => buildImplicitCurve(entry);
    entry.build();
    return finishEntry(entry);
  }

  const TYPE_NAME = { fn: '函数 y=f(x)', polar: '极坐标 r(θ)', implicit: '隐函数 F(x,y)=0' };

  // 把用户输入归类：r= 开头 → 极坐标；含等号 → 隐函数（y=... 视为普通函数，z=... 视为三维）
  function routeExpr(expr, refNames) {
    const e = expr.trim().replace(/θ/g, 't');
    if (/^r\s*=/i.test(e)) {
      if (/\by\b/.test(e.replace(/^r\s*=/i, ''))) throw new Error('极坐标表达式不能含 y（角度请写 t 或 θ）');
      return { type: 'polar', expr: e };
    }
    if (e.includes('=')) {
      const parts = e.split('=');
      if (parts.length > 2) throw new Error('最多只能有一个等号');
      const lhs = parts[0].trim(), rhs = parts[1].trim();
      if (!lhs || !rhs) throw new Error('等号两侧都需要表达式');
      if (lhs === 'y' && !/\by\b/.test(rhs)) return { type: 'fn', expr: rhs };
      if (lhs === 'z' && /\by\b/.test(rhs)) return { type: 'fn3d', expr: rhs };
      return { type: 'implicit', expr: e };
    }
    // 裸表达式含 y（如 x^2+y^2）无法按一元函数求值，直接进三维曲面——
    // 与 README「输入含 y 的表达式自动切三维」的承诺一致，也修复快速开始卡片画空曲线的问题
    if (/\by\b/.test(e)) return { type: 'fn3d', expr: e };
    return { type: 'fn', expr: e };
  }

  // 按类型重新解析 entry 的表达式；parsed 允许调用方传入已解析结果
  function reparseEntry(entry, newExpr, others, parsed) {
    const r = routeExpr(newExpr, others);
    if (r.type === 'fn3d') throw new Error('三维曲面请在三维视图下编辑');
    if (r.type !== entry.type) throw new Error('不能改变表达式类型（当前是' + TYPE_NAME[entry.type] + '）');
    let p = parsed;
    if (!p) {
      if (r.type === 'fn') p = parseExpr(r.expr, others);
      else if (r.type === 'polar') p = parseExpr(r.expr.replace(/^r\s*=/i, ''), others, { vars: ['t'] });
      else {
        const parts = r.expr.split('=');
        p = parseExpr('(' + parts[0].trim() + ') - (' + parts[1].trim() + ')', others, { vars: ['x', 'y'] });
      }
    }
    if (hasCycle(entry, p.refs)) throw new Error('不允许循环嵌套（f → g → f）');
    entry.expr = r.expr;
    if (r.type === 'polar') entry.rhs = r.expr.replace(/^r\s*=/i, '');
    entry.f = p.f;
    entry.refs = p.refs;
    entry.params = p.params;
    entry.params.forEach(k => { if (entry.pr[k] === undefined) entry.pr[k] = 1; });
    if (r.type === 'implicit') entry.build(); else board.update();
  }

  function update2DExpr(entry, newExpr) {
    const others = fns.filter(o => o !== entry).map(o => o.name);
    reparseEntry(entry, newExpr, others);
  }

  function removeEntryObjects(o) {
    if (o._anim) Object.values(o._anim).forEach(id => cancelAnimationFrame(id));
    o._anim = null;
    (o._marks || []).forEach(p => { try { board.removeObject(p); } catch (e) { /* ignore */ } });
    o._marks = [];
    (o.curves || [o.curve]).forEach(c => { if (c) { try { board.removeObject(c); } catch (e) { /* ignore */ } } });
  }

  function remove2D(id) {
    const i = fns.findIndex(o => o.id === id);
    if (i < 0) return;
    removeEntryObjects(fns[i]);
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
    // 视图工具：2D 专用按钮（缩放/复位）只在 2D 显示，2D⇄3D 切换按钮常驻
    $('#view-tools').classList.toggle('hidden', m === 'demo');
    $('#vt-2d-only').classList.toggle('hidden', m !== '2d');
    $('#view-dim').textContent = m === '3d' ? '⇱ 2D 画布' : '⇱ 3D 画布';
    if (m !== 'demo') renderInspector();
  }

  function addExpr(expr) {
    expr = (expr || '').replace(/\s+/g, ' ').trim();
    if (!expr) throw new Error('请输入表达式');
    const r = routeExpr(expr, fns.map(o => o.name));
    if (r.type === 'fn3d') {
      setMode('3d');
      add3D(r.expr);
    } else {
      if (mode === '3d') setMode('2d');
      if (r.type === 'fn') addFn(r.expr);
      else if (r.type === 'polar') addPolar(r.expr);
      else addImplicit(r.expr);
    }
  }

  // ---------------- 智能函数插入 ----------------
  // 光标落在标识符/数字上时，点击函数即把该 token 包裹进函数（自带括号）；
  // token 外围已有括号则不重复加（sin(a) 而非 sin((a))）；光标不在 token 上则插入 fn()。
  function smartInsert(input, fname, opts) {
    opts = opts || {};
    const value = input.value;
    let start = input.selectionStart == null ? value.length : input.selectionStart;
    let end = input.selectionEnd == null ? start : input.selectionEnd;
    // 有选区 → 直接包裹选区；无选区 → 找光标下的 token
    if (start === end) {
      const isTok = c => c !== undefined && /[a-zA-Z0-9_]/.test(c);
      while (start > 0 && isTok(value[start - 1])) start--;
      while (end < value.length && isTok(value[end])) end++;
    }
    const token = value.slice(start, end);
    let replacement, cursor;
    if (fname === 'PI') {
      replacement = 'PI';
      cursor = start + 2;
    } else if (opts.postfix) {           // 如 x²：token 后追加 ^2
      replacement = (token || 'x') + '^2';
      cursor = start + replacement.length;
    } else {
      const prevNS = value.slice(0, start).replace(/\s+$/, '');
      const nextNS = value.slice(end).replace(/^\s+/, '');
      if (token && prevNS.endsWith('(') && nextNS.startsWith(')')) {
        const openIdx = prevNS.length - 1;
        const beforeOpen = prevNS.slice(0, -1);
        if (/[a-zA-Z0-9_]$/.test(beforeOpen)) {
          // 括号属于函数调用（如 sin(b)）：整体嵌套包裹 → cos(sin(b))
          let nameStart = openIdx;
          while (nameStart > 0 && /[a-zA-Z0-9_]/.test(value[nameStart - 1])) nameStart--;
          start = nameStart;
          end += 1;                                  // 越过配对的 ')'
          replacement = fname + '(' + value.slice(start, end) + ')';
        } else {
          // 裸括号（如 (a)）：把 "(token)" 整体替换为 "fname(token)"，不产生双括号
          start -= 1; end += 1;
          replacement = fname + value.slice(start, end);
        }
      } else if (token) {
        replacement = fname + '(' + token + ')';
      } else {
        replacement = fname + '()';
      }
      cursor = start + fname.length + 1;  // 光标停在左括号后、token 前
    }
    input.value = value.slice(0, start) + replacement + value.slice(end);
    try { input.setSelectionRange(cursor, cursor); } catch (e) { /* 非可聚焦环境 */ }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  }

  // 函数工具条：[显示, 动作]
  const PALETTE = [
    ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['√', 'sqrt'], ['abs', 'abs'],
    ['log', 'log'], ['eˣ', 'exp'], ['asin', 'asin'], ['atan', 'atan'],
    ['floor', 'floor'], ['ceil', 'ceil'], ['sign', 'sgn'], ['x²', 'x²'], ['π', 'π'], ['( )', '()']
  ];
  function renderPalette(container, input) {
    container.innerHTML = '';
    PALETTE.forEach(([label, act]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pal-btn';
      b.textContent = label;
      b.addEventListener('mousedown', e => e.preventDefault()); // 不抢输入框焦点，保住光标位置
      b.addEventListener('click', () => {
        if (act === 'x²') smartInsert(input, null, { postfix: true });
        else if (act === 'π') smartInsert(input, 'PI');
        else if (act === '()') {
          const s = input.selectionStart == null ? input.value.length : input.selectionStart;
          input.value = input.value.slice(0, s) + '()' + input.value.slice(s);
          try { input.setSelectionRange(s + 1, s + 1); } catch (e) { /* ignore */ }
        } else smartInsert(input, act);
        input.focus();
      });
      container.appendChild(b);
    });
  }

  // ---------------- 数值分析（零点/极值） ----------------
  // 传入连续函数 f 与采样区间，返回区间内全部零点（有序、近邻去重、二分收敛）
  function findZeros(f, x0, x1, N) {
    N = N || 800;
    const step = (x1 - x0) / N;
    const zeros = [];
    let px = x0, py = safe(f, x0);
    for (let i = 1; i <= N; i++) {
      const x = x0 + i * step, y = safe(f, x);
      if (py !== null && y !== null) {
        if (py === 0) pushZero(zeros, px, minGapOf(x0, x1));
        else if (py * y < 0) {
          let a = px, b = x, fa = py;
          for (let k = 0; k < 60; k++) {
            const m = (a + b) / 2, fm = safe(f, m);
            if (fm === null || fm === 0) { a = b = m; break; }
            if (fa * fm < 0) b = m; else { a = m; fa = fm; }
          }
          pushZero(zeros, (a + b) / 2, minGapOf(x0, x1));
        }
      }
      px = x; py = y;
    }
    return zeros;
  }
  const safe = (f, x) => {
    try { const v = f(x); return typeof v === 'number' && isFinite(v) ? v : null; } catch (e) { return null; }
  };
  const minGapOf = (x0, x1) => Math.abs(x1 - x0) * 0.005;
  function pushZero(arr, x, gap) {
    if (!arr.length || Math.abs(x - arr[arr.length - 1]) > gap) arr.push(x);
  }


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
      `<input type="number" step="0.1" value="${entry.pr[k]}">` +
      `<button type="button" class="anim-btn" title="参数动画（往复扫描）">▶</button>`;
    const [rg, num, anim] = row.querySelectorAll('input, button');
    const set = v => {
      if (isNaN(v)) return;
      entry.pr[k] = v;
      rg.value = v; num.value = v;
      onChange();
    };
    rg.addEventListener('input', () => set(parseFloat(rg.value)));
    num.addEventListener('change', () => set(parseFloat(num.value)));
    // 参数动画：值在 [-10,10] 间往复扫描，课堂演示"拖 a 看变化"的自动化
    anim.addEventListener('click', () => {
      entry._anim = entry._anim || {};
      if (entry._anim[k]) {
        cancelAnimationFrame(entry._anim[k]);
        delete entry._anim[k];
        anim.textContent = '▶';
        return;
      }
      let dir = 1, last = performance.now();
      anim.textContent = '⏸';
      const step = now => {
        if (!entry._anim[k]) return;
        const dt = Math.min(50, now - last) / 1000; last = now;
        let v = entry.pr[k] + dir * dt * 2.5;
        if (v > 10) { v = 10; dir = -1; } else if (v < -10) { v = -10; dir = 1; }
        set(Math.round(v * 100) / 100);
        entry._anim[k] = requestAnimationFrame(step);
      };
      entry._anim[k] = requestAnimationFrame(step);
    });
    container.appendChild(row);
  }

  const fmtNum = v => v === null || !isFinite(v) ? '—' : (Math.abs(v) < 1e-10 ? '0' : String(Math.round(v * 10000) / 10000));

  // 函数分析面板：当前视口内的零点、极值、截距；math.js 在线时附符号导数
  function buildAnalysisPanel(entry) {
    const box = document.createElement('div');
    box.className = 'analysis';
    const t = document.createElement('div');
    t.className = 'inspect-sub';
    t.textContent = '函数分析（当前视口）';
    box.appendChild(t);
    const bb = board.getBoundingBox();
    const x0 = bb[0], x1 = bb[2];
    const rows = [];
    const y0 = safe(entry.fn, 0);
    rows.push(`f(0) = ${fmtNum(y0)}`);
    const roots = findZeros(entry.fn, x0, x1);
    rows.push(`零点：${roots.length ? roots.map(fmtNum).join('、') : '当前视口内无'}`);
    // 数值导数 → 零点 → 二阶差分定极大/极小
    const h = (x1 - x0) / 2000;
    const d = x => { const a = safe(entry.fn, x - h), b = safe(entry.fn, x + h); return (a === null || b === null) ? null : (b - a) / (2 * h); };
    const exts = findZeros(d, x0, x1).map(x => {
      const fm = safe(entry.fn, x);
      const a = safe(entry.fn, x - h), b = safe(entry.fn, x + h);
      const d2 = (a === null || b === null || fm === null) ? 0 : (b - 2 * fm + a) / (h * h);
      return { x, y: fm, kind: d2 > 0 ? '极小' : d2 < 0 ? '极大' : '驻点' };
    }).filter(e => e.y !== null);
    rows.push(`极值点：${exts.length ? exts.map(e => `${e.kind}(${fmtNum(e.x)}, ${fmtNum(e.y)})`).join('、') : '当前视口内无'}`);
    if (window.math) {
      try {
        let s = entry.expr;
        entry.params.forEach(k => { s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), '(' + entry.pr[k] + ')'); });
        rows.push(`f '(x) = ${math.derivative(s, 'x').toString()}`);
      } catch (e) { /* 嵌套引用等场景无法求符号导数，静默跳过 */ }
    }
    const info = document.createElement('div');
    info.className = 'analysis-body';
    info.innerHTML = rows.map(r => `<div class="ana-row">${esc(r)}</div>`).join('');
    box.appendChild(info);
    const mk = document.createElement('div');
    mk.className = 'btn-row';
    const btnRoots = document.createElement('button');
    btnRoots.className = 'btn tiny';
    btnRoots.textContent = '⊙ 标注零点';
    btnRoots.addEventListener('click', () => {
      entry._marks = entry._marks || [];
      roots.forEach(x => {
        const y = safe(entry.fn, x);
        if (y === null) return;
        entry._marks.push(board.create('point', [x, y],
          { name: '', size: 3, fillColor: '#e05656', strokeColor: '#e05656', fixed: true }));
      });
    });
    const btnClear = document.createElement('button');
    btnClear.className = 'btn tiny';
    btnClear.textContent = '清除标注';
    btnClear.addEventListener('click', () => {
      (entry._marks || []).forEach(p => { try { board.removeObject(p); } catch (e) { /* ignore */ } });
      entry._marks = [];
    });
    mk.appendChild(btnRoots);
    mk.appendChild(btnClear);
    box.appendChild(mk);
    const tip = document.createElement('div');
    tip.className = 'tip-3d';
    tip.textContent = '基于当前视口采样分析，自动去重；符号导数由 math.js 提供（未加载时自动省略）。';
    box.appendChild(tip);
    return box;
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
      `<span class="fx">${is3 ? 'z = F(x, y)' :
        entry.type === 'implicit' ? esc(entry.name) + '：F(x, y) = 0' :
        entry.type === 'polar' ? 'r = r(θ)' :
        'y = ' + esc(entry.name) + '(x)'}</span>`;
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
    // 函数工具条：光标处智能插入（token 包裹 + 括号去重）
    const pal = document.createElement('div');
    pal.className = 'ins-palette';
    renderPalette(pal, er.querySelector('input'));
    box.appendChild(pal);
    // 函数分析（仅普通函数）：零点/极值/截距 + 可选符号导数
    if (!is3 && entry.type === 'fn') box.appendChild(buildAnalysisPanel(entry));
    // 参数（自动识别，滑块 + 数值框）
    if (entry.params.length) {
      const t = document.createElement('div');
      t.className = 'inspect-sub';
      t.textContent = '参数（可拖动或直接输入数值）';
      box.appendChild(t);
      const onChange = is3
        ? () => entry.params.forEach(k => surf.setParam(k, entry.pr[k]))
        : () => { if (entry.type === 'implicit') entry.build(); else board.update(); };
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
    const setStyle = attr => {
      (entry.curves || [entry.curve]).forEach(c => c && c.setAttribute(attr));
    };
    if (entry.type === 'implicit') {
      const tip = document.createElement('div');
      tip.className = 'tip-3d';
      tip.textContent = '隐函数曲线随视图平移缩放自动重算；参数变化即时生效。';
      box.appendChild(tip);
    } else if (entry.type === 'polar') {
      const tip = document.createElement('div');
      tip.className = 'tip-3d';
      tip.textContent = '极坐标曲线 θ 取 0 ~ 8π；θ 可以直接写成 t。';
      box.appendChild(tip);
    }
    // 颜色 / 显示 / 删除
    const cr = document.createElement('div');
    cr.className = 'inspect-row';
    cr.innerHTML = `<span>颜色</span><input type="color" value="${entry.color}">` +
      `<label class="check-line"><input type="checkbox" ${entry.visible ? 'checked' : ''}>显示</label>`;
    cr.querySelector('input[type=color]').addEventListener('input', e => {
      entry.color = e.target.value;
      setStyle({ strokeColor: entry.color });
      renderFnList();
      renderInspector();
    });
    cr.querySelector('input[type=checkbox]').addEventListener('change', e => {
      entry.visible = e.target.checked;
      setStyle({ visible: entry.visible });
    });
    box.appendChild(cr);
    // 曲线样式：线宽 + 线型
    const st = document.createElement('div');
    st.className = 'inspect-row';
    st.innerHTML = `<span>线宽</span><select class="st-w">` +
      [1, 1.5, 2, 2.5, 3, 4, 5].map(w => `<option value="${w}" ${w === (entry.width || 2.5) ? 'selected' : ''}>${w}</option>`).join('') +
      `</select><span>线型</span><select class="st-d">` +
      [[0, '实线'], [2, '虚线'], [1, '点线'], [3, '点划线']].map(([v, n]) => `<option value="${v}" ${v === (entry.dash || 0) ? 'selected' : ''}>${n}</option>`).join('') +
      `</select>`;
    st.querySelector('.st-w').addEventListener('change', e => {
      entry.width = parseFloat(e.target.value);
      setStyle({ strokeWidth: entry.width });
    });
    st.querySelector('.st-d').addEventListener('change', e => {
      entry.dash = parseInt(e.target.value);
      setStyle({ dash: entry.dash });
    });
    box.appendChild(st);
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
      const label = o.type === 'implicit' ? o.name + ': ' + o.expr
        : o.type === 'polar' ? 'r(θ) = ' + o.rhs
        : o.name + '(x) = ' + o.expr;
      const row = document.createElement('div');
      row.className = 'fn-item' + (o.id === selectedId ? ' sel' : '') + (o.visible ? '' : ' off');
      row.innerHTML = `<span class="sw" style="background:${o.color}"></span>` +
        `<span class="fx" title="${esc(label)}">${esc(label)}</span>` +
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
    vfield(div, bar) {
      const b = JXG.JSXGraph.initBoard(div, {
        boundingbox: [-5, 4, 5, -4], axis: true, showCopyright: false, showNavigation: false,
        keepaspectratio: true, pan: { enabled: false }, zoom: { wheel: true, needShift: false }
      });
      let pExpr = '-y', qExpr = 'x';
      let P = null, Q = null;
      let arrows = [], traces = [];
      function compile() {
        P = parseExpr(pExpr, [], { vars: ['x', 'y'] }).f;
        Q = parseExpr(qExpr, [], { vars: ['x', 'y'] }).f;
      }
      function F(x, y) {
        try {
          const u = P(null, x, y), v = Q(null, x, y);
          return (typeof u === 'number' && typeof v === 'number' && isFinite(u) && isFinite(v)) ? [u, v] : null;
        } catch (e) { return null; }
      }
      // 颜色随模长从蓝到红
      const fieldColor = m => `hsl(${Math.round(220 - 220 * Math.min(1, m / 3))},72%,${Math.round(58 - 14 * Math.min(1, m / 3))}%)`;
      function drawArrows() {
        arrows.forEach(a => { try { b.removeObject(a); } catch (e) { /* ignore */ } });
        arrows = [];
        const bb = b.getBoundingBox();
        const x0 = bb[0], y1 = bb[1], x1 = bb[2], y0 = bb[3];
        const nx = 17, ny = Math.max(6, Math.round(nx * (y1 - y0) / (x1 - x0)));
        const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
        const len = Math.min(dx, dy) * 0.44;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const x = x0 + (i + 0.5) * dx, y = y0 + (j + 0.5) * dy;
          const f = F(x, y);
          if (!f) continue;
          const m = Math.hypot(f[0], f[1]);
          if (m < 1e-9) continue;
          arrows.push(b.create('segment', [[x, y], [x + f[0] / m * len, y + f[1] / m * len]], {
            strokeColor: fieldColor(m), strokeWidth: 1.7,
            lastArrow: { type: 2, size: 5 }, highlight: false, fixed: true
          }));
        }
      }
      // 从 (x,y) 出发沿单位化场方向 RK4 积分，dir=±1 表示顺/逆场方向
      function halfTrace(x, y, dir, ext) {
        const xs = [], ys = [];
        let px = x, py = y;
        const step = 0.05;
        const slope = (ax, ay) => {
          const f = F(ax, ay);
          if (!f) return null;
          const m = Math.hypot(f[0], f[1]);
          if (m < 1e-9) return null;
          return [dir * f[0] / m, dir * f[1] / m];
        };
        for (let n = 0; n < 900; n++) {
          xs.push(px); ys.push(py);
          const k1 = slope(px, py); if (!k1) break;
          const k2 = slope(px + step / 2 * k1[0], py + step / 2 * k1[1]); if (!k2) break;
          const k3 = slope(px + step / 2 * k2[0], py + step / 2 * k2[1]); if (!k3) break;
          const k4 = slope(px + step * k3[0], py + step * k3[1]); if (!k4) break;
          px += step / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
          py += step / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
          if (Math.abs(px - x) > ext[0] || Math.abs(py - y) > ext[1]) break;
        }
        return [xs, ys];
      }
      function drawTrace(x, y) {
        const bb = b.getBoundingBox();
        const ext = [Math.abs(bb[2] - bb[0]) * 0.9, Math.abs(bb[1] - bb[3]) * 0.9];
        const [xf, yf] = halfTrace(x, y, 1, ext);
        const [xb, yb] = halfTrace(x, y, -1, ext);
        if (traces.length >= 6) {
          const old = traces.shift();
          try { b.removeObject(old.point); b.removeObject(old.curve); } catch (e) { /* ignore */ }
        }
        const pt = b.create('point', [x, y], { size: 2.5, fillColor: '#e05656', strokeColor: '#e05656', name: '', fixed: true });
        const crv = b.create('curve', [xb.reverse().concat(xf), yb.reverse().concat(yf)],
          { strokeColor: '#e05656', strokeWidth: 2.2, highlight: false });
        traces.push({ point: pt, curve: crv });
      }
      compile();
      drawArrows();
      b.on('down', e => {
        const pos = b.getMousePosition(e || window.event);
        if (!pos) return;
        const c = new JXG.Coords(JXG.COORDS_BY_SCREEN, pos, b);
        drawTrace(c.usrCoords[1], c.usrCoords[2]);
      });
      // 缩放后按新视野重排箭头（合帧 + 屏蔽重建期间触发，防止循环）
      let at = false;
      b.on('update', () => {
        if (at) return;
        at = true;
        requestAnimationFrame(() => { drawArrows(); at = false; });
      });
      bar.innerHTML = `
        <div class="caption"><b>向量场</b>：每个箭头表示向量 (P, Q) 在该点的方向与大小（颜色越红模长越大）。<b>点击图面</b>任意位置释放粒子，红色轨迹即流线（可点 6 条）。</div>
        <div class="btn-row">
          <label class="vf-line">P(x,y) <input id="vf-p" type="text" value="${esc(pExpr)}"></label>
          <label class="vf-line">Q(x,y) <input id="vf-q" type="text" value="${esc(qExpr)}"></label>
          <button id="vf-apply" class="btn small primary">应用</button>
          <button id="vf-clear" class="btn small">清除流线</button>
          <span id="vf-err" class="inspect-err"></span>
        </div>
        <div class="caption">试试：旋转场 P=-y, Q=x ｜ 辐射场 P=x, Q=y ｜ 剪切场 P=0, Q=x ｜ 波动场 P=sin(y), Q=sin(x)</div>`;
      bar.querySelector('#vf-apply').addEventListener('click', () => {
        const err = bar.querySelector('#vf-err');
        try {
          const np = parseExpr(bar.querySelector('#vf-p').value.trim(), [], { vars: ['x', 'y'] });
          const nq = parseExpr(bar.querySelector('#vf-q').value.trim(), [], { vars: ['x', 'y'] });
          pExpr = bar.querySelector('#vf-p').value.trim();
          qExpr = bar.querySelector('#vf-q').value.trim();
          P = np.f; Q = nq.f;
          err.textContent = '';
          traces.forEach(t => { try { b.removeObject(t.point); b.removeObject(t.curve); } catch (e) { /* ignore */ } });
          traces = [];
          drawArrows();
        } catch (e) { err.textContent = e.message; }
      });
      bar.querySelector('#vf-clear').addEventListener('click', () => {
        traces.forEach(t => { try { b.removeObject(t.point); b.removeObject(t.curve); } catch (e) { /* ignore */ } });
        traces = [];
      });
      return () => JXG.JSXGraph.freeBoard(b);
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
    const build = ({ deriv: Demos.deriv, integral: Demos.integral, rose: Demos.rose, lissajous: Demos.lissajous, cycloid: Demos.cycloid, vfield: Demos.vfield }[id]
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
    if (!CATS[id]) return;
    // 切分类即离开互动演示：预设面板此时不可用，留在演示里只会让教师困惑
    if (mode === 'demo') closeDemo();
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
    try { addFn('k*x + b'); } catch (e) { /* ignore */ }

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
    // 2D⇄3D 自由切换；首次进 3D 且无曲面时给默认涟漪曲面，教师立刻看到效果
    $('#view-dim').addEventListener('click', () => {
      if (mode === 'demo') closeDemo();
      if (mode === '3d') { setMode('2d'); return; }
      setMode('3d');
      if (!fn3d) { try { add3D('sin(sqrt(x^2 + y^2))'); } catch (e) { /* ignore */ } }
    });
    // 主输入框的函数工具条
    renderPalette($('#main-palette'), $('#expr-input'));
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
    fns.forEach(removeEntryObjects);
    fns = []; fn3d = null; colorIdx = 0; selectedId = null;
    surf.setFunction(null);
    setMode('2d');
    renderFnList(); renderInspector();
  }

  function state() {
    return {
      kind: 'math',
      cat: catId,
      view: mode === '3d' ? '3d' : '2d',
      // 3D 视图下二维函数仍保留：保存的是整个工作区而非单一画面
      exprs: [...fns.map(o => o.expr), ...(fn3d ? [fn3d.expr] : [])],
      // v1.1 起新增：完整恢复教师调好的参数与曲线样式；旧场景无此字段，恢复时按默认值
      fns: fns.map(o => ({
        expr: o.expr, pr: Object.assign({}, o.pr), color: o.color,
        width: o.width, dash: o.dash, visible: o.visible
      })),
      fn3d: fn3d ? { expr: fn3d.expr, pr: Object.assign({}, fn3d.pr) } : null
    };
  }

  function applyScene(s) {
    clearAll();
    if (s.cat && CATS[s.cat]) setCategory(s.cat);
    (s.exprs || []).forEach(e => { try { addExpr(e); } catch (err) { /* skip */ } });
    // 恢复参数与样式：按表达式匹配（个别旧表达式解析失败也不会错位），缺省字段保持 addExpr 的默认值
    (Array.isArray(s.fns) ? s.fns : []).forEach(sv => {
      if (!sv || typeof sv.expr !== 'string') return;
      const o = fns.find(x => x.expr === sv.expr);
      if (!o) return;
      if (sv.pr && typeof sv.pr === 'object') {
        Object.keys(sv.pr).forEach(k => { if (isFinite(sv.pr[k])) o.pr[k] = parseFloat(sv.pr[k]); });
      }
      if (typeof sv.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(sv.color)) o.color = sv.color;
      if (isFinite(sv.width)) o.width = Math.max(1, Math.min(8, parseFloat(sv.width)));
      if ([0, 1, 2, 3].includes(sv.dash)) o.dash = sv.dash;
      const style = { strokeColor: o.color, strokeWidth: o.width, dash: o.dash };
      (o.curves || [o.curve]).forEach(c => { if (c) c.setAttribute(style); });
      if (typeof sv.visible === 'boolean' && sv.visible !== o.visible) {
        o.visible = sv.visible;
        (o.curves || [o.curve]).forEach(c => { if (c) c.setAttribute({ visible: o.visible }); });
      }
      if (o.type === 'implicit') o.build(); else board.update();
    });
    // 三维曲面的参数恢复；显式 view === '3d' 时回到三维视图
    if (fn3d && s.fn3d && s.fn3d.pr && typeof s.fn3d.pr === 'object') {
      Object.keys(s.fn3d.pr).forEach(k => {
        if (isFinite(s.fn3d.pr[k])) { fn3d.pr[k] = parseFloat(s.fn3d.pr[k]); surf.setParam(k, fn3d.pr[k]); }
      });
    }
    if (s.view === '3d' && fn3d) setMode('3d');
    renderFnList();
    renderInspector();
  }

  return {
    init, setCategory, addExpr, state, applyScene, CATS,
    // 供外壳（工作台快速开始/分类下拉）调用的轻量入口，避免外壳碰 DOM 找按钮
    openDemo, closeDemo, currentCategory: () => catId,
    // 容器尺寸变化（如上课模式隐藏侧栏）后重设画板并全量重绘
    resize() {
      if (!board || mode === 'demo') return;
      try {
        const box = board.containerObj || document.getElementById('plot2d');
        if (!box || !box.clientWidth || !box.clientHeight) return;
        board.resizeContainer(box.clientWidth, box.clientHeight);
        board.fullUpdate();
      } catch (e) { /* 旧版 JSXGraph 缺少 API 时静默降级 */ }
    },
    // 内部工具：仅测试与高级用法使用
    _internal: { smartInsert, findZeros, scheduleViewRebuild, safe, entryOf, lastEntry: () => fns[fns.length - 1] || null }
  };
})();

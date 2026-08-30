/**
 * 杏坛教师助手 · 课件演示原型 - 后端
 * 零依赖：Node 内置 http。提供静态文件服务 + /api/generate（GLM 生成课件）。
 * AI 失败时自动降级为内置模板，保证演示永远可用。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 6173;
const PUB = path.join(__dirname, 'public');

let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (e) { /* 无 config 时走环境变量 */ }
const GLM_KEY = process.env.XINGTAN_GLM_KEY || config.glmApiKey || '';
const GLM_MODEL = config.glmModel || 'glm-4-flash';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ---------------- 提示词 ----------------

const DEMO_CATALOG = [
  ['parabola', '二次函数 y=ax²+bx+c 参数滑块（拖动 a/b/c 看开口与顶点变化）', '数学'],
  ['line', '一次函数 y=kx+b 斜率截距滑块', '数学'],
  ['sine', '三角函数 y=A·sin(ωx+φ) 参数滑块', '数学'],
  ['triangle', '三角形内角和演示（顶点可拖动，实时显示三个内角）', '数学/几何'],
  ['phet-projectile', 'PhET 抛体运动仿真（可调初速度、角度、重力）', '物理'],
  ['phet-waves', 'PhET 绳波演示（波的传播与振动）', '物理'],
  ['phet-states', 'PhET 物质三态与分子热运动', '物理/化学'],
  ['phet-reactants', 'PhET 化学反应：反应物、生成物与剩余物（配平与质量守恒）', '化学']
].map(([id, desc]) => `- ${id}：${desc}`).join('\n');

const SYSTEM_PROMPT = `你是一位资深中小学教研员，擅长设计课堂课件。你必须只输出一个 JSON 对象，不要输出任何解释、markdown 代码块标记或其他文字。

课件结构要求：
- 6 到 9 页；第一页 type 必须是 cover；必须包含 objectives（学习目标）；建议顺序：封面 → 学习目标 → 情境导入 → 新知探究(可含演示页) → 例题/讲解 → 课堂练习 → 小结 → 作业。
- 每页 bullets 不超过 5 条，每条不超过 24 个字，语言精炼，像真实课堂课件。
- 数学课件安排 1-2 页演示页（type 为 demo）；物理/化学课件若主题与演示组件匹配则安排 1 页演示页；语文/英语/其他学科不要用演示页，用文字页营造情境（语文可在 bullets 中写出意境画面描述）。
- 演示页 demo 字段只能从以下目录中选择，选不到合适的就不要放演示页：
${DEMO_CATALOG}

输出 JSON 格式（严格遵守字段名）：
{
  "title": "课件标题",
  "subject": "学科",
  "grade": "年级",
  "textbook": "教材版本",
  "slides": [
    {"type": "cover", "title": "标题", "subtitle": "副标题（可含授课人占位）"},
    {"type": "objectives", "title": "学习目标", "bullets": ["...", "..."]},
    {"type": "text", "title": "页面标题", "bullets": ["...", "..."], "note": "教师备注（可选）"},
    {"type": "demo", "title": "探究：...", "demo": "组件id", "note": "演示要点", "instruction": "操作提示，如：拖动滑块改变 a 的值"},
    {"type": "summary", "title": "课堂小结", "bullets": ["...", "..."]},
    {"type": "homework", "title": "课后作业", "bullets": ["...", "..."]}
  ]
}`;

function buildUserPrompt(input) {
  const { stage, grade, subject, textbook, topic, extra } = input;
  return `请为以下课程生成课件 JSON：
学段：${stage || '初中'}
年级：${grade || ''}
学科：${subject || '数学'}
教材版本：${textbook || '人教版'}
课题：${topic}
${extra ? '补充要求：' + extra : ''}

再次强调：只输出 JSON，第一个字符必须是 {，最后一个字符必须是 }。`;
}

// ---------------- GLM 调用 ----------------

async function callGLM(system, user) {
  if (!GLM_KEY) throw new Error('未配置 GLM API Key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GLM_KEY },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.6,
        max_tokens: 3000
      }),
      signal: controller.signal
    });
    if (!resp.ok) throw new Error('GLM HTTP ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error('GLM API: ' + String(data.error.message || JSON.stringify(data.error)).slice(0, 200));
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  } finally {
    clearTimeout(timer);
  }
}

function extractJSON(text) {
  let t = String(text).trim();
  t = t.replace(/```json/gi, '```').split('```').join('\n');
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) throw new Error('AI 未返回 JSON');
  let body = t.slice(s, e + 1);
  try {
    return JSON.parse(body);
  } catch (err) {
    // 宽容处理：去掉尾逗号再试
    body = body.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(body);
  }
}

const KNOWN_DEMOS = ['parabola', 'line', 'sine', 'triangle', 'phet-projectile', 'phet-waves', 'phet-states', 'phet-reactants'];

function normalizeDeck(raw, input) {
  const slides = Array.isArray(raw.slides) ? raw.slides : [];
  const clean = [];
  for (const s of slides) {
    if (!s || typeof s !== 'object') continue;
    const type = String(s.type || 'text');
    if (type === 'demo') {
      if (KNOWN_DEMOS.includes(s.demo)) {
        clean.push({ type: 'demo', title: str(s.title, '课堂演示'), demo: s.demo, note: str(s.note, ''), instruction: str(s.instruction, '拖动滑块观察变化') });
      } else {
        clean.push({ type: 'text', title: str(s.title, '课堂探究'), bullets: [str(s.note, '课堂演示环节')], note: str(s.instruction, '') });
      }
    } else if (['cover', 'objectives', 'text', 'summary', 'homework'].includes(type)) {
      const item = { type, title: str(s.title, type === 'cover' ? '课件标题' : '页面'), };
      if (Array.isArray(s.bullets) && s.bullets.length) item.bullets = s.bullets.map(b => String(b)).slice(0, 6);
      if (type === 'cover') item.subtitle = str(s.subtitle, '');
      if (s.note) item.note = String(s.note);
      clean.push(item);
    }
  }
  if (clean.length < 3 || clean[0].type !== 'cover') throw new Error('AI 返回结构不完整');
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: str(raw.title, input.topic || '未命名课件'),
    subject: str(raw.subject, input.subject || ''),
    grade: str(raw.grade, input.grade || ''),
    textbook: str(raw.textbook, input.textbook || ''),
    createdAt: new Date().toISOString(),
    source: 'ai',
    slides: clean
  };
}

function str(v, d) { return typeof v === 'string' && v.trim() ? v.trim() : d; }

// 兜底模板（AI 不可用时保证演示可用）
function fallbackDeck(input) {
  const { topic, subject, grade, textbook } = input;
  const isMath = (subject || '').includes('数学');
  const demoSlide = isMath
    ? [{ type: 'demo', title: '探究：图像随参数变化', demo: 'parabola', note: '拖动滑块改变系数，观察开口方向与顶点位置', instruction: '拖动 a / b / c 三个滑块' }]
    : [];
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: topic || '未命名课件',
    subject: subject || '', grade: grade || '', textbook: textbook || '',
    createdAt: new Date().toISOString(),
    source: 'fallback',
    slides: [
      { type: 'cover', title: topic || '未命名课件', subtitle: `${grade || ''} ${subject || ''} · ${textbook || ''}` },
      { type: 'objectives', title: '学习目标', bullets: ['理解本课核心概念', '掌握基本方法并能应用', '通过探究提升学科思维'] },
      { type: 'text', title: '情境导入', bullets: ['从生活场景出发提出问题', '引出本课要研究的对象'] },
      ...demoSlide,
      { type: 'text', title: '新知讲解', bullets: ['核心概念与关键性质', '方法步骤梳理'] },
      { type: 'text', title: '例题与练习', bullets: ['例题：师生共同分析', '练习：学生独立完成并讲评'] },
      { type: 'summary', title: '课堂小结', bullets: ['回顾本课知识要点', '强调易错点'] },
      { type: 'homework', title: '课后作业', bullets: ['完成课本对应习题', '预习下一节内容'] }
    ]
  };
}

// ---------------- HTTP 服务 ----------------

function send(res, code, data, type) {
  const body = type ? data : JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 1024 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

async function handleGenerate(req, res) {
  const input = await readBody(req);
  const attempts = 2;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    let raw = '';
    try {
      raw = await callGLM(SYSTEM_PROMPT, buildUserPrompt(input));
      const deck = normalizeDeck(extractJSON(raw), input);
      console.log('[generate] AI ok:', deck.title);
      return send(res, 200, { ok: true, deck, source: 'ai' });
    } catch (err) {
      lastErr = err;
      console.error('[generate] attempt ' + (i + 1) + ' failed ->', err.message, '| raw:', String(raw).slice(0, 160).replace(/\s+/g, ' '));
    }  }
  send(res, 200, { ok: true, deck: fallbackDeck(input), source: 'fallback', reason: lastErr ? lastErr.message : 'unknown' });
}

async function handleSavePptx(req, res) {
  const { name, b64 } = await readBody(req);
  if (typeof b64 !== 'string' || !b64.length) throw new Error('empty pptx data');
  const safe = String(name || '课件.pptx').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  const dir = path.join(__dirname, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, safe.endsWith('.pptx') ? safe : safe + '.pptx');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('[export] saved:', file);
  send(res, 200, { ok: true, file });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, ai: !!GLM_KEY, model: GLM_MODEL });
  }
  if (url.pathname === '/api/generate' && req.method === 'POST') {
    return handleGenerate(req, res).catch(e => send(res, 400, { ok: false, error: e.message }));
  }
  if (url.pathname === '/api/save-pptx' && req.method === 'POST') {
    return handleSavePptx(req, res).catch(e => send(res, 400, { ok: false, error: e.message }));
  }
  // 静态文件
  let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) return send(res, 403, { ok: false, error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { ok: false, error: 'not found' });
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log('XingTan prototype running at http://localhost:' + PORT);
  console.log('AI generation:', GLM_KEY ? 'enabled (' + GLM_MODEL + ')' : 'disabled (no key, fallback template only)');
});

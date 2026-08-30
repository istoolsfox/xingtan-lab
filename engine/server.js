/**
 * 杏坛数学实验室 · 后端（零依赖）
 * 登录注册（账号隔离）+ token 会话 + 按账号隔离的演示数据 + 日志系统
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('./logger');

const PORT = process.env.PORT || 6174;
const PUB = path.join(__dirname, 'public');
// 数据目录可用 XT_DATA_DIR 覆盖（测试隔离用），默认 engine/data
const DATA = process.env.XT_DATA_DIR ? path.resolve(process.env.XT_DATA_DIR) : path.join(__dirname, 'data');
const ACC_FILE = path.join(DATA, 'accounts.json');
const SCENES_DIR = path.join(DATA, 'scenes');
const SESSION_FILE = path.join(DATA, 'sessions.json');
const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 天

fs.mkdirSync(SCENES_DIR, { recursive: true });

// ---------- 落盘：临时文件 + 原子替换，避免写一半崩溃损坏数据 ----------
function safeWrite(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml'
};

// ---------- 账号存储 ----------
// 无原型对象：即使 username 混入 "__proto__"/"constructor" 也无法污染原型
const emptyMap = () => Object.create(null);
function loadAccounts() {
  try {
    const a = JSON.parse(fs.readFileSync(ACC_FILE, 'utf8'));
    return Object.assign(emptyMap(), a);
  } catch (e) { return emptyMap(); }
}
function saveAccounts(a) { safeWrite(ACC_FILE, JSON.stringify(a, null, 1)); }

// 保留字用户名会导致对象键冲突（__proto__ 等），纯下划线名无意义，一并拒绝
const RESERVED_NAMES = /^(_+|__.*__|__proto__|constructor|prototype)$/i;
const validName = n => typeof n === 'string' && /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(n) && !RESERVED_NAMES.test(n);
const validPwd = p => typeof p === 'string' && p.length >= 4 && p.length <= 64;

function hashPwd(salt, pwd) {
  return crypto.createHash('sha256').update(salt + ':' + pwd).digest('hex');
}

// ---------- 登录限速（内存滑动窗口）：同 IP+用户名 失败 5 次 / 10 分钟 → 锁定 10 分钟 ----------
const LOGIN_WINDOW = 10 * 60 * 1000, LOGIN_MAX_FAILS = 5, LOGIN_LOCK = 10 * 60 * 1000;
const loginFails = new Map(); // key -> {count, firstAt, lockedUntil}
function clientIp(req) {
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
function loginBlocked(req, username) {
  const key = clientIp(req) + '|' + username;
  const rec = loginFails.get(key);
  if (!rec) return false;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return true;
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) { loginFails.delete(key); }
  return false;
}
function recordLoginFail(req, username) {
  const key = clientIp(req) + '|' + username;
  const now = Date.now();
  const rec = loginFails.get(key) || { count: 0, firstAt: now, lockedUntil: 0 };
  if (now - rec.firstAt > LOGIN_WINDOW) { rec.count = 0; rec.firstAt = now; }
  rec.count++;
  if (rec.count >= LOGIN_MAX_FAILS) {
    rec.lockedUntil = now + LOGIN_LOCK;
    log.warn('auth', `login locked: ${key} (${rec.count} fails in window)`);
  }
  loginFails.set(key, rec);
}
function clearLoginFails(req, username) { loginFails.delete(clientIp(req) + '|' + username); }

// ---------- 会话（持久化：服务重启后 token 仍有效） ----------
const sessions = new Map(); // token -> {user, expires}

function loadSessions() {
  try {
    const obj = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    const now = Date.now();
    for (const [t, s] of Object.entries(obj)) {
      if (s && s.expires > now) sessions.set(t, s);
    }
  } catch (e) { /* 首次启动无文件 */ }
}
function saveSessions() {
  try {
    const obj = {};
    sessions.forEach((s, t) => { obj[t] = s; });
    safeWrite(SESSION_FILE, JSON.stringify(obj));
  } catch (e) { log.error('session', 'save sessions failed', e); }
}
loadSessions();

function issueToken(user) {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, { user, expires: Date.now() + SESSION_TTL });
  saveSessions();
  return t;
}
function dropToken(t) {
  if (sessions.delete(t)) saveSessions();
}
function userOf(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.expires < Date.now()) { dropToken(m[1]); return null; }
  return s.user;
}

// ---------- 演示数据 ----------
function scenesFile(user) {
  // 纵深防御：user 理论上已通过注册校验，这里再挡一次，保证永远拼不出穿越路径
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(user)) throw new Error('bad user');
  return path.join(SCENES_DIR, user + '.json');
}
function readScenes(user) {
  try { return JSON.parse(fs.readFileSync(scenesFile(user), 'utf8')); }
  catch (e) { return []; }
}
function writeScenes(user, list) { safeWrite(scenesFile(user), JSON.stringify(list.slice(0, 200))); }

// ---------- HTTP 基础 ----------
function send(res, code, data, type, extraHeaders) {
  const body = type ? data : JSON.stringify(data);
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8' }, extraHeaders || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ---------- 认证接口 ----------
async function handleAuth(url, req, res) {
  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    const { username, password } = await readBody(req);
    if (!validName(username)) return send(res, 400, { ok: false, error: '用户名需 2-20 位（中英文、数字、下划线）' });
    if (!validPwd(password)) return send(res, 400, { ok: false, error: '密码至少 4 位' });
    const accs = loadAccounts();
    if (accs[username]) return send(res, 400, { ok: false, error: '用户名已存在' });
    const salt = crypto.randomBytes(8).toString('hex');
    accs[username] = { salt, hash: hashPwd(salt, password), createdAt: new Date().toISOString() };
    saveAccounts(accs);
    log.audit('register', `user=${username}`);
    return send(res, 200, { ok: true, token: issueToken(username), username });
  }
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const { username, password } = await readBody(req);
    const accs = loadAccounts();
    const a = validName(username) ? accs[username] : null;
    if (loginBlocked(req, String(username || ''))) {
      log.audit('login-locked', `user=${username} ip=${clientIp(req)}`);
      return send(res, 429, { ok: false, error: '失败次数过多，请 10 分钟后再试' });
    }
    if (!a || a.hash !== hashPwd(a.salt, password)) {
      recordLoginFail(req, String(username || ''));
      log.audit('login-fail', `user=${username}`);
      return send(res, 400, { ok: false, error: '用户名或密码错误' });
    }
    clearLoginFails(req, username);
    log.audit('login', `user=${username}`);
    return send(res, 200, { ok: true, token: issueToken(username), username });
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (m) {
      const s = sessions.get(m[1]);
      if (s) log.audit('logout', `user=${s.user}`);
      dropToken(m[1]);
    }
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    const user = userOf(req);
    if (!user) return send(res, 401, { ok: false, error: '未登录' });
    return send(res, 200, { ok: true, username: user });
  }
  return send(res, 404, { ok: false, error: 'not found' });
}

// ---------- 演示接口（需登录，数据按账号隔离） ----------
async function handleScenes(url, req, res) {
  const user = userOf(req);
  if (!user) return send(res, 401, { ok: false, error: '请先登录' });

  if (url.pathname === '/api/scenes' && req.method === 'GET') {
    return send(res, 200, { ok: true, username: user, scenes: readScenes(user) });
  }
  if (url.pathname === '/api/scenes' && req.method === 'POST') {
    const { scene } = await readBody(req);
    if (!scene || !scene.id || !scene.kind) return send(res, 400, { ok: false, error: 'invalid scene' });
    const list = readScenes(user);
    const i = list.findIndex(s => s.id === scene.id);
    if (i >= 0) list[i] = scene; else list.unshift(scene);
    writeScenes(user, list);
    log.audit('scene-save', `user=${user} id=${scene.id} kind=${scene.kind} title=${(scene.title || '').slice(0, 30)}`);
    return send(res, 200, { ok: true, count: list.length });
  }
  if (url.pathname === '/api/scenes/delete' && req.method === 'POST') {
    const { id } = await readBody(req);
    writeScenes(user, readScenes(user).filter(s => s.id !== id));
    log.audit('scene-delete', `user=${user} id=${id}`);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { ok: false, error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const url = new URL(req.url, 'http://localhost');
  // 请求日志：方法、路径、状态码、耗时（静态资源只记 debug，接口记 info）
  res.on('finish', () => {
    const line = `${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - start}ms`;
    if (url.pathname.startsWith('/api/')) log.info('req', line);
    else log.debug('static', line);
  });
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/auth/')) return handleAuth(url, req, res).catch(e => handleApiError(res, e));
    if (url.pathname.startsWith('/api/scenes')) return handleScenes(url, req, res).catch(e => handleApiError(res, e));

    let p;
    try {
      p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    } catch (e) {
      log.warn('static', `bad url encoding: ${req.url}`);
      return send(res, 400, { ok: false, error: 'forbidden' });
    }
    const file = path.normalize(path.join(PUB, p));
    if (!file.startsWith(PUB)) return send(res, 403, { ok: false, error: 'forbidden' });
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, { ok: false, error: 'not found' });
      // 全部静态资源 no-cache：教学服务带宽无虞，正确性优先——
      // 否则发版后浏览器旧 JS 配新 HTML/数据，曾复现"旧 physics.js 无参数防御 + 恶意场景参数杀死渲染循环"
      send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
    });
  } catch (e) {
    log.error('server', 'unhandled request error', e);
    if (!res.headersSent) send(res, 500, { ok: false, error: '服务器内部错误' });
  }
});

function handleApiError(res, e) {
  log.warn('api', `bad request: ${e.message}`);
  if (!res.headersSent) send(res, 400, { ok: false, error: e.message });
}

server.listen(PORT, () => {
  log.info('boot', `XingTan MathLab running at http://localhost:${PORT}`);
});

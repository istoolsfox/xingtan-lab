/**
 * 杏坛数学实验室 · 后端（零依赖）
 * 登录注册（账号隔离）+ token 会话 + 按账号隔离的演示数据
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 6174;
const PUB = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const ACC_FILE = path.join(DATA, 'accounts.json');
const SCENES_DIR = path.join(DATA, 'scenes');
const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 天

fs.mkdirSync(SCENES_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml'
};

// ---------- 账号存储 ----------
function loadAccounts() {
  try { return JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')); }
  catch (e) { return {}; }
}
function saveAccounts(a) { fs.writeFileSync(ACC_FILE, JSON.stringify(a, null, 1)); }

function hashPwd(salt, pwd) {
  return crypto.createHash('sha256').update(salt + ':' + pwd).digest('hex');
}
const validName = n => typeof n === 'string' && /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(n);
const validPwd = p => typeof p === 'string' && p.length >= 4 && p.length <= 64;

// ---------- 会话 ----------
const sessions = new Map(); // token -> {user, expires}

function issueToken(user) {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, { user, expires: Date.now() + SESSION_TTL });
  return t;
}
function userOf(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.expires < Date.now()) { sessions.delete(m[1]); return null; }
  return s.user;
}

// ---------- 演示数据 ----------
function scenesFile(user) { return path.join(SCENES_DIR, user + '.json'); }
function readScenes(user) {
  try { return JSON.parse(fs.readFileSync(scenesFile(user), 'utf8')); }
  catch (e) { return []; }
}
function writeScenes(user, list) { fs.writeFileSync(scenesFile(user), JSON.stringify(list.slice(0, 200))); }

// ---------- HTTP 基础 ----------
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
    return send(res, 200, { ok: true, token: issueToken(username), username });
  }
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const { username, password } = await readBody(req);
    const accs = loadAccounts();
    const a = validName(username) ? accs[username] : null;
    if (!a || a.hash !== hashPwd(a.salt, password)) return send(res, 400, { ok: false, error: '用户名或密码错误' });
    return send(res, 200, { ok: true, token: issueToken(username), username });
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (m) sessions.delete(m[1]);
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
    return send(res, 200, { ok: true, count: list.length });
  }
  if (url.pathname === '/api/scenes/delete' && req.method === 'POST') {
    const { id } = await readBody(req);
    writeScenes(user, readScenes(user).filter(s => s.id !== id));
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { ok: false, error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') return send(res, 200, { ok: true });
  if (url.pathname.startsWith('/api/auth/')) return handleAuth(url, req, res).catch(e => send(res, 400, { ok: false, error: e.message }));
  if (url.pathname.startsWith('/api/scenes')) return handleScenes(url, req, res).catch(e => send(res, 400, { ok: false, error: e.message }));

  let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) return send(res, 403, { ok: false, error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { ok: false, error: 'not found' });
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log('XingTan MathLab running at http://localhost:' + PORT);
});

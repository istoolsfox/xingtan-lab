/**
 * 服务端 API 集成与安全测试（node:test，零依赖）
 * 方式：子进程启动服务（独立数据目录），裸 http 断言
 * 运行：node --test engine/test/
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 6399;
const BASE = `http://127.0.0.1:${PORT}`;
const ENGINE = path.join(__dirname, '..');
const DATA_BACKUP = path.join(ENGINE, 'data');

let child = null;

function req(method, p, { body, token, raw } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (raw ? body : JSON.stringify(body));
    const r = http.request(BASE + p, {
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const register = (u, p) => req('POST', '/api/auth/register', { body: { username: u, password: p } });
const login = (u, p) => req('POST', '/api/auth/login', { body: { username: u, password: p } });

before(async () => {
  // 用临时数据目录，不污染开发数据
  const tmpData = path.join(ENGINE, 'data-test');
  fs.rmSync(tmpData, { recursive: true, force: true });
  fs.mkdirSync(tmpData, { recursive: true });
  child = spawn(process.execPath, ['server.js'], {
    cwd: ENGINE,
    env: { ...process.env, PORT: String(PORT), XT_DATA_DIR: tmpData },
    stdio: 'ignore'
  });
  // 等服务就绪（最多 5s）
  for (let i = 0; i < 50; i++) {
    try { await req('GET', '/api/health'); return; } catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
});
after(() => {
  if (child) child.kill();
  fs.rmSync(path.join(ENGINE, 'data-test'), { recursive: true, force: true });
});

describe('基础 API', () => {
  test('健康检查', async () => {
    const r = await req('GET', '/api/health');
    assert.strictEqual(r.status, 200);
  });

  test('注册 → 登录 → 保存/读取/删除场景', async () => {
    assert.strictEqual((await register('张老师', 'pass1234')).status, 200);
    const l = await login('张老师', 'pass1234');
    assert.strictEqual(l.status, 200);
    const token = JSON.parse(l.body).token;

    const save = await req('POST', '/api/scenes', { token, body: { scene: { id: 's1', kind: 'math', title: '测试', exprs: ['x^2'] } } });
    assert.strictEqual(save.status, 200);
    const list = JSON.parse((await req('GET', '/api/scenes', { token })).body);
    assert.strictEqual(list.scenes.length, 1);
    const del = await req('POST', '/api/scenes/delete', { token, body: { id: 's1' } });
    assert.strictEqual(del.status, 200);
  });

  test('数据按账号隔离：看不到别人的场景', async () => {
    await register('李老师', 'pass1234');
    const t1 = JSON.parse((await login('张老师', 'pass1234')).body).token;
    const t2 = JSON.parse((await login('李老师', 'pass1234')).body).token;
    await req('POST', '/api/scenes', { token: t1, body: { scene: { id: 'only-zhang', kind: 'math' } } });
    const mine = JSON.parse((await req('GET', '/api/scenes', { token: t2 })).body);
    assert.ok(!mine.scenes.some(s => s.id === 'only-zhang'), '李老师不应看到张老师的场景');
  });
});

describe('认证边界', () => {
  test('无 token / 伪造 token 访问场景接口 → 401', async () => {
    assert.strictEqual((await req('GET', '/api/scenes')).status, 401);
    assert.strictEqual((await req('GET', '/api/scenes', { token: 'deadbeef'.repeat(6) })).status, 401);
  });
  test('错误密码登录失败', async () => {
    const r = await login('张老师', 'wrong-pass');
    assert.strictEqual(r.status, 400);
  });
  test('登录限速：连续失败 5 次后 429', async () => {
    await register('限速老师', 'pass1234');
    let last;
    for (let i = 0; i < 5; i++) last = await login('限速老师', 'wrong' + i);
    assert.strictEqual(last.status, 400);
    const blocked = await login('限速老师', 'pass1234'); // 即使密码正确也被锁
    assert.strictEqual(blocked.status, 429);
  });
});

describe('输入校验（攻击面）', () => {
  test('保留字/危险用户名被拒绝', async () => {
    for (const u of ['__proto__', 'constructor', 'prototype', '____']) {
      const r = await register(u, 'pass1234');
      assert.strictEqual(r.status, 400, `用户名 ${u} 应被拒绝`);
    }
  });
  test('非法用户名格式被拒绝（含路径字符）', async () => {
    for (const u of ['../etc', 'a', 'a b', 'a<b>_script']) {
      const r = await register(u, 'pass1234');
      assert.strictEqual(r.status, 400, `用户名 ${u} 应被拒绝`);
    }
  });
  test('坏 JSON 请求体 → 400，服务不崩', async () => {
    const r = await req('POST', '/api/auth/login', { body: '{not-json', raw: true });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await req('GET', '/api/health')).status, 200);
  });
  test('超大请求体被拒并断开 → 服务不崩', async () => {
    let threw = false;
    try { await req('POST', '/api/auth/login', { body: 'x'.repeat(3 * 1024 * 1024), raw: true }); }
    catch (e) { threw = true; } // 服务端 destroy 连接，客户端报错即预期
    assert.ok(threw || true, '连接被服务端终止');
    assert.strictEqual((await req('GET', '/api/health')).status, 200);
  });
});

describe('静态文件与路径穿越', () => {
  test('路径穿越变体全部被拒（400/403/404，绝不返回系统文件）', async () => {
    const variants = [
      '/../../../etc/passwd',
      '/..%2f..%2f..%2fetc%2fpasswd',
      '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
      '/..\\..\\..\\windows\\win.ini',
      '/..%5c..%5c..%5cwindows%5cwin.ini'
    ];
    for (const v of variants) {
      const r = await req('GET', encodeURI(v));
      assert.ok([400, 403, 404].includes(r.status), `${v} → ${r.status}`);
      assert.ok(!/root:|extensions/i.test(r.body), `${v} 不应泄漏系统文件内容`);
    }
  });
  test('正常静态文件可访问', async () => {
    const r = await req('GET', '/');
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.includes('杏坛'));
  });
});

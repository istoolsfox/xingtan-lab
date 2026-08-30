/**
 * 杏坛 · 轻量日志系统（零依赖）
 * - 按天分文件：logs/app-YYYY-MM-DD.log，启动时清理 30 天前的旧日志
 * - 控制台与文件同写；error 级别附堆栈
 * - audit(tag, detail)：登录/注册/保存等业务审计，格式统一可 grep
 * - 任何写入失败都静默降级为控制台输出，日志永远不能影响业务
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const RETAIN_DAYS = 30;
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[process.env.XT_LOG_LEVEL || 'info'] || LEVELS.info;

fs.mkdirSync(LOG_DIR, { recursive: true });

// 启动清理：删除超过保留期的日志文件
(function cleanOld() {
  try {
    const cutoff = Date.now() - RETAIN_DAYS * 24 * 3600 * 1000;
    for (const f of fs.readdirSync(LOG_DIR)) {
      const m = /^app-(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
      if (m && new Date(m[1] + 'T00:00:00Z').getTime() < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, f));
      }
    }
  } catch (e) { /* 清理失败不影响运行 */ }
})();

function fileFor(d) {
  return path.join(LOG_DIR, 'app-' + d.toISOString().slice(0, 10) + '.log');
}

function write(level, tag, msg) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const now = new Date();
  const ts = now.toISOString();
  const line = `${ts} ${level.toUpperCase().padEnd(5)} [${tag}] ${msg}\n`;
  try { fs.appendFile(fileFor(now), line, () => {}); } catch (e) { /* ignore */ }
  if (level === 'error') process.stderr.write(line);
  else process.stdout.write(line);
}

module.exports = {
  debug: (tag, msg) => write('debug', tag, msg),
  info: (tag, msg) => write('info', tag, msg),
  warn: (tag, msg) => write('warn', tag, msg),
  error: (tag, msg, err) =>
    write('error', tag, err && err.stack ? msg + ' :: ' + err.stack : msg),
  // 业务审计：注册/登录/保存/删除等关键动作，一行一条，便于回溯
  audit: (tag, msg) => write('info', 'audit:' + tag, msg),
};

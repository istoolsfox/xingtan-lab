# 杏坛学科实验平台 · 工程规范（AI 与开发者必读）

本文件是项目的工程契约。**修改本项目前必须先读 `docs/06-软件工程总结.md`**（架构、设计模式、SOLID 落地、扩展指南），并遵守以下硬性规则。

## 项目速览

- 中小学教师用的多学科可视化课堂演示引擎。**零构建、零 npm 依赖**：`cd engine && node server.js`，访问 http://localhost:6174。
- 前端模块（IIFE 单例，不互相 import）：`engine/public/{shell,mathlab,chemistry,physics,surface3d}.js`；后端 `engine/server.js`（Node 原生 http）；横切 `engine/logger.js`。
- 文档：需求→选型→设计在 `docs/01~05`，工程基准在 `docs/06`。

## 硬性规则

1. **零依赖**：服务端只用 Node 内置模块；前端只引既有的 CDN 库（JSXGraph/matter.js/GeoGebra）。新依赖必须先论证。
2. **走扩展点，不改引擎**（开闭原则）：
   - 化学新反应 → `chemistry.js` 的 `REACTIONS` 数组加 JSON 式定义；各阶段**原子数量与索引顺序必须一致**；宏观现象需要新场景时加 `drawXxx` 渲染器并注册到 `drawMacro`。
   - 数学新分类/预设 → `mathlab.js` 的 `CATS` + `index.html` 侧边栏按钮。
   - 数学新表达式类型 → `routeExpr` 加分支 + `addXxx` 工厂（用 `baseEntry/finishEntry`）+ `addExpr/reparseEntry` 各一行分派。
   - 新互动演示 → `Demos` 加 `(div, bar) => destroy` 函数并注册 build 映射。
   - 新学科模块 → `index.html` 加页面 + 新建单例模块（暴露 `init/state/applyScene`）+ `shell.js` 接线；**服务端不用改**。
3. **场景兼容**：`MathLab.state()/applyScene()` 是持久化唯一通道。任何新能力必须保证旧场景 JSON 仍能恢复（新类型走 `routeExpr` 同一链路）。
4. **日志**：服务端新增接口/审计点时，用 `logger.js`（`log.info/warn/error/audit`）记录；`logs/` 已 gitignore。日志代码绝不能抛错影响业务。
5. **安全底线**：密码 salt+SHA-256 不动；静态文件路径校验、body 2MB 限制、接口登录校验不删；`data/`、`logs/`、`prototype/config.json` 永不入库。
6. **代码风格**：中文注释，注释讲"为什么"；函数式组合、对象字面量，不引入 class 继承；面向用户的错误消息用中文并由输入框错误区展示，引擎内部错误静默降级（返回 NaN/忽略）。
7. **改完必验**：
   - `node --check` 所有改过的 js；
   - 引擎逻辑写 Node 桩冒烟测试（参考阶段签名一致性、mathlab 16 项断言的做法）；
   - 启动服务用浏览器走一遍受影响模块 + 保存/恢复链路。
8. **架构决策**：重大变更在 `docs/06-软件工程总结.md` 增补 ADR 小节，并同步本文件。

## 常用命令

```bash
cd engine
node server.js          # 启动（默认 6174 端口）
XT_LOG_LEVEL=debug node server.js   # 调试级日志
node --check public/xxx.js          # 语法检查
```

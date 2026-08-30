# 课件演示原型（v0.1）

杏坛教师助手的首个可运行原型：**AI 生成课件 + 学科交互演示 + PPT 导出**。

## 快速开始

双击 `start.bat`（或手动运行 `node server.js`），浏览器访问 http://localhost:6173

- 首次使用需联网（加载 JSXGraph / pptxgenjs / PhET 的 CDN 资源）
- AI 功能需要 `config.json` 里的 GLM Key（已配置；也可用环境变量 `XINGTAN_GLM_KEY` 覆盖）

## 功能清单

| 功能 | 说明 |
| --- | --- |
| AI 生成课件 | 填学段/年级/学科/教材版本/课题 → GLM 生成 6~9 页结构化课件（约 20~30 秒） |
| 教材对齐 | 生成前确认教材版本与年级，解决"内容与教材不符"痛点 |
| 数学交互演示 | JSXGraph 实时仿真：二次函数 a/b/c 滑块、一次函数 k/b、三角函数 A/ω/φ、三角形内角和（顶点可拖动） |
| 物理/化学仿真 | AI 按课题自动嵌入 PhET 官方开源仿真（抛体运动/绳波/物质三态/化学反应），中文界面 |
| 演示模式 | 全屏授课：←/→ 翻页、Esc 退出、F 全屏、页码进度 |
| 导出 PPT | 一键生成可编辑的 .pptx 到 `exports/` 目录（交互页导出为说明页+占位），同时尝试浏览器下载 |
| 我的课件 | localStorage 本地保存最近 30 份，可打开/演示/删除 |
| 兜底模板 | AI 不可用时自动降级为内置模板，演示永不扑空 |

## 目录结构

```
prototype/
├── server.js        # Node 零依赖后端：静态服务 + /api/generate（GLM）+ /api/save-pptx
├── config.json      # GLM API Key 与模型名（glm-4-flash，免费）
├── start.bat        # Windows 一键启动
├── exports/         # 导出的 pptx 落盘位置
└── public/
    ├── index.html   # 页面骨架（CDN 引入 JSXGraph + pptxgenjs）
    ├── style.css    # 界面样式（分学科主题色）
    ├── app.js       # 视图逻辑：首页/编辑器/演示模式/本地存储
    ├── demos.js     # 学科交互组件：4 个 JSXGraph 数学组件 + 4 个 PhET 嵌入
    └── export.js    # PPTX 导出（base64 → 服务端落盘 + 浏览器下载）
```

## 已验证

- ✅ 数学课题（二次函数）→ 自动编排 parabola 交互页，滑块拖动实时更新图像/顶点/对称轴
- ✅ 物理课题（抛体运动）→ 自动编排 PhET 斜抛运动仿真（中文）
- ✅ AI 失败自动重试 1 次 → 仍失败走内置模板
- ✅ 演示模式键盘操作、导出 pptx（PK 校验通过、9 页）

## 下一步（对照 docs/04 产品方案）

- 语文"意境引擎"（文生图 + 音画）
- 化学微观动画（3Dmol.js 分子结构）
- pptx 双向编辑（导入现有课件再加工）
- 演示组件市场（教师分享调好的组件参数）
- 课题管理/比赛管理模块（本次原型未包含）

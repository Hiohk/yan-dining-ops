# 小燕知 · 企业餐务运营助理

面向企业行政 / 助理场景的移动端 H5 餐饮运营助手。用对话完成「安排一次商务宴请」这类任务：
理解需求 → 协调时间 → 推荐餐厅 → 确认用餐方案 → 生成可分享的用餐计划。

它的重点不在「能聊天」，而在**对话产出的东西是结构化卡片，而不是一段文字**。

<p align="center">
  <img src="apps/web/src/assets/mascot-home.png" alt="小燕知" width="240">
</p>

---

## 核心机制：模型输出卡片，前端渲染成可交互界面

普通聊天应用把模型回复当文本渲染。这里多了一层**卡片协议**：

1. 提示词约定模型在回复中内嵌结构化的卡片块（协议版本 `CARD_PROTOCOL_VERSION = 1`）；
2. 前端解析这些块，按 `kind` 分派给对应的 React 组件渲染；
3. 卡片里的选项是**可点的** —— 点一下就是一次真实的选择，直接推进流程，
   而不是让用户再打一遍字。

目前协议里声明了 9 种卡片：

| kind | 用途 | 是否有渲染视图 |
|---|---|---|
| `time_options` | 候选时间段 | ✅ |
| `restaurant_options` | 候选餐厅 | ✅ |
| `dining_plan` | 用餐方案 | ✅ |
| `invitation` | 邀请函 | ✅ |
| `plan_summary` | 用餐计划（可分享的收尾卡） | ✅ |
| `progress` | 流程进度 | ✅ |
| `menu` | 菜单 | ⬜ 协议已定义，视图待补 |
| `invoice` | 发票 | ⬜ 同上 |
| `reimbursement` | 报销 | ⬜ 同上 |

协议类型定义在 [`packages/cards/src/index.ts`](packages/cards/src/index.ts)，
前端渲染在 [`apps/web/src/features/assistant/cards/`](apps/web/src/features/assistant/cards/)，
提示词与卡片的对齐关系见 `apps/api/scripts/apply-agent-prompt.mjs`。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19 · TypeScript · Vite 8 · Tailwind v4 |
| 路由 / 状态 | React Router 7（history 模式）· zustand · TanStack Query |
| 后端 | Node 22 原生 `node:http`（**无框架**）· `node:sqlite` |
| AI | [OpenHex](https://openhex.tech) Agent SDK，SSE 流式对话 |
| 包管理 | pnpm workspace（monorepo） |

后端刻意不引框架：它只做三件事（签发会话令牌、读写画像、读写会话），
用原生 `http` 是几十行的量级，加 Express/Fastify 反而多一层要维护的东西。

## 目录结构

```
apps/
  web/        React SPA（构建产物为纯静态文件，由 nginx 托管）
    src/features/assistant/   对话主流程、卡片渲染、OpenHex 接入层
    src/features/             restaurants / tasks / skills / profile / invitation
  api/        会话令牌网关 + 画像存储
    src/        index.ts（路由）· db.ts（SQLite）· memory.ts（画像）
    scripts/    bootstrap-workspace.mjs · apply-agent-prompt.mjs
packages/
  cards/      卡片协议的 TypeScript 类型定义（纯源码包，无构建步骤）
  tokens/     设计令牌（颜色、间距、字号）
docker-compose.yml    web（nginx）+ api 两个服务
```

`packages/*` 的 `main` 直接指向 `src/index.ts`，由 Vite 一起打包，没有独立构建。

## 本地开发

### 前置

- **Node ≥ 22** —— 后端用了 `node:sqlite`，20 上没有这个模块
- **pnpm 8.15.1** —— 已由根 `package.json` 的 `packageManager` 钉住

> ⚠️ **不要升级 pnpm**。`pnpm-lock.yaml` 是 `lockfileVersion: '6.0'`（pnpm 8 的格式），
> pnpm 9+ 读不了它，会直接以 `ERR_PNPM_LOCKFILE_BREAKING_CHANGE` 失败。
> 要升就整个仓库重生 lockfile，那是一件独立的事。

```bash
pnpm install
```

### 配置

需要两样东西：一个 OpenHex Agent ID（非密钥）和一个工作区 API Key（密钥）。

```bash
# 1. 前端：填 Agent ID（首页点开 Agent，地址栏 /console/ 后面那段 UUID）
cp apps/web/.env.example apps/web/.env

# 2. 后端：跑一次引导脚本，它会建工作区、签发 Key 并写进 apps/api/.env（0600 权限）
OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api bootstrap -- --slug=your-workspace
```

引导脚本需要一把**个人** API Key（`mysta_…`）来签发**工作区** Key（`sk_…`）。
这是两把不同的钥匙：签发会话令牌只接受工作区 Key，而工作区 Key 只能用个人 Key 签发。
脚本跑完就可以把个人 Key 收起来，它不参与运行时。

### 起服务

```bash
pnpm dev          # 前后端一起起
```

- 前端 http://localhost:5173
- 后端 http://127.0.0.1:8000

两个必须知道的点：

- 后端**默认只听 `127.0.0.1`**，只有 Vite 的 `/api` 代理能到它。
  不要为了「方便调试」改成 `0.0.0.0` —— 那等于把「用工作区 Key 换会话令牌」这个端点
  暴露给同局域网的任何人。
- 前端所有后端调用都是**同源相对路径**（`/api/openhex/token` 等），没有 API 基地址变量。
  开发期的同源靠 Vite 代理，生产期靠 nginx 反代，两边行为一致。

### 其它脚本

```bash
pnpm typecheck    # 前后端一起类型检查
pnpm build:web    # 构建前端到 apps/web/dist
```

## 环境变量

| 变量 | 用在哪 | 是否密钥 |
|---|---|---|
| `VITE_OPENHEX_AGENT_ID` | 前端**构建期**，打进 bundle | ❌ 不是密钥 |
| `OPENHEX_WORKSPACE_KEY` | 后端**运行时** | ⚠️ **是**，等同工作区全部权限 |
| `OPENHEX_WORKSPACE_SLUG` | 后端运行时 | ❌ |
| `WEB_PORT` | compose，对外端口，默认 80 | ❌ |
| `PORT` / `HOST` | 后端监听，默认 `8000` / `127.0.0.1` | ❌ |
| `OPENHEX_API_BASE` | 覆盖平台 API 地址，默认官方地址 | ❌ |

## 安全边界

这是整个项目里最需要守住的一条线：

> **浏览器永远拿不到 API Key。**

- 个人 Key（`mysta_…`）只用于一次性引导，不参与运行时；
- 工作区 Key（`sk_…`）只存在于**服务器上那个 `.env`** 里，由后端进程读取；
- 浏览器拿到的只有**后端签发的短时会话令牌**（JWT），放内存、不落 localStorage，
  刷新即重新签发，泄漏面更小；
- `VITE_` 前缀的变量会**原样打进静态产物**，任何人打开浏览器都能读到 ——
  所以只有 Agent ID 这类非密钥能加这个前缀。Agent ID 不是密钥：
  知道它只能「向这个 Agent 发消息」，拿不到账号或工作区权限。

`apps/api/.env` 和 `apps/web/.env` 都同时被 `.gitignore` 和 `.dockerignore` 挡住，
仓库里只提交 `.env.example`，里面全是占位符。

## Docker 部署

```bash
cp .env.example .env      # 填 VITE_OPENHEX_AGENT_ID 和两个工作区变量
docker compose up -d --build
```

架构：

```
浏览器 ──HTTP──> nginx (web 容器 :80)
                  ├─ /            静态 dist/（SPA try_files 回退 index.html）
                  ├─ /assets/*    带内容哈希，长缓存
                  └─ /api/*       反代 → api:8000
浏览器 ──SSE──直连──> api.openhex.tech        （不经 nginx）

api 容器（:8000，不对外暴露端口）
  ├─ 用工作区 Key 调平台签会话令牌
  └─ SQLite 落画像 → 挂卷 api-data
```

几个踩过的点，都已写进注释：

- **api 容器必须 `HOST=0.0.0.0`**。容器内的 `127.0.0.1` 是它自己的网络命名空间的回环，
  同网络的 nginx 容器永远连不上，现象是 502。compose 已注入。
- **`index.html` 必须 `Cache-Control: no-cache`**。它不参与构建哈希，是「指向当前版本产物」
  的唯一指针；一旦被浏览器缓存住，服务器换了产物、客户端还在请求已不存在的旧 chunk。
  带哈希的 `/assets/*` 反过来要长缓存，两者是一对。
- **`.dockerignore` 里必须写 `**/.env` 而不是 `.env`**。不带斜杠的模式只匹配 context 根那一层，
  与 `.gitignore` 的语义不同 —— 写错的后果是 `apps/api/.env` 连同工作区 Key 一起被打进镜像。
- **`node:22-slim` + 绕过 nginx 官方入口脚本**。那个入口会调 `apk manifest nginx` 判断是否要补
  IPv6 监听，调用一旦卡住（网络/只读文件系统），nginx 从未启动但容器显示 `Up`，排查成本极高。

## 现状与已知限制

这是一个持续迭代中的项目，如实记下当前的缺口：

- **没有自动化测试**，只有 `tsc --noEmit` 类型检查。端到端验证靠脚本化驱动真实浏览器。
- **9 种卡片里有 3 种（`menu` / `invoice` / `reimbursement`）只有协议定义、没有渲染视图** ——
  对话流程目前不走它们的渲染路径。
- **明文 HTTP 下分享 / 剪贴板不可用**。`navigator.share` 和 `navigator.clipboard` 是
  浏览器限定的**安全上下文专属** API，明文 HTTP + IP 访问时它们是 `undefined`。
  代码会如实降级为「复制失败，请长按选中」。上 HTTPS 后自动恢复，无需改代码。
  （同一类限制曾导致 `crypto.randomUUID is not a function`，现已改用不受限制的
  `crypto.getRandomValues`。）
- 没有限流、日志轮转、健康告警。

## License

[Apache License 2.0](LICENSE)

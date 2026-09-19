# 后端镜像：会话令牌网关。
#
# ⚠️ build context 是**仓库根**（见 docker-compose.yml 的注释）。
#
# 为什么直接 `tsx src/index.ts` 跑源码，而不是先 tsc 编译成 js：
#   1. tsconfig 是 `noEmit`，本地也是 tsx 直跑（`pnpm start`），镜像里跑同一件事 —— 少一个
#      「本地能跑、镜像里跑不起来」的分叉。
#   2. 这个网关只有一个进程、三个文件，省掉 build 阶段的收益很小。
#   代价是镜像里带着 devDependencies（tsx、typescript），体积偏大，学习部署可接受。
#
# 必须 Node ≥ 22：画像存储用的是 `node:sqlite`（apps/api/src/db.ts），20 上没有。
#
# ⚠️ pnpm 版本由根 package.json 的 `packageManager` 定（corepack 读它），当前是 8.15.1。
#    别升 —— lockfile 是 pnpm 8 的 v6 格式，pnpm 11 读不了，见 web 的 Dockerfile 注释。
FROM node:22-slim
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/cards/package.json packages/cards/
COPY packages/tokens/package.json packages/tokens/
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api

ENV NODE_ENV=production
# 默认绑 127.0.0.1，容器里必须被 compose 的 HOST=0.0.0.0 覆盖 —— 这里只是兜底。
ENV HOST=127.0.0.1
EXPOSE 8000

# 走 package.json 的脚本而不是直接 node：脚本里是 `tsx src/index.ts`，
# 换实现时只改一处（同理，绝不在 Dockerfile 里复制一遍启动命令）。
CMD ["pnpm", "--filter", "@lto/api", "start"]

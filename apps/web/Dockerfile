# 前端镜像：多阶段 —— node 里 build，nginx 里托管。
#
# ⚠️ build context 是**仓库根**，不是 apps/web（见 docker-compose.yml 的注释）。
#    所以下面所有 COPY 路径都从根算起。
#
# 为什么要把 api / packages 的 package.json 也拷进来：pnpm 解 workspace 依赖图时
# 需要所有成员在场。少拷一个，`--frozen-lockfile` 会因为 lockfile 与工作区对不上而失败。

# ⚠️ pnpm 版本由根 package.json 的 `packageManager` 定（corepack 读它），当前是 8.15.1。
#    这个数字**不能随手升**：pnpm-lock.yaml 是 lockfileVersion '6.0'（pnpm 8 的格式），
#    pnpm 11 读不了它，会直接 ERR_PNPM_LOCKFILE_BREAKING_CHANGE 失败；实测过。
#    要升 pnpm，先重生 lockfile，并且全队本机都要跟着升 —— 那是一件独立的事。
#
# ── build ────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# 先只拷清单文件再 install：源码改动不会让这一层缓存失效
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/cards/package.json packages/cards/
COPY packages/tokens/package.json packages/tokens/
RUN pnpm install --frozen-lockfile

COPY apps apps
COPY packages packages

# 构建期注入。Vite 只把 `VITE_` 前缀的变量暴露给客户端，
# 所以这里**只能**放 Agent ID 这类非密钥 —— 写进产物的东西等于公开。
ARG VITE_OPENHEX_AGENT_ID
ENV VITE_OPENHEX_AGENT_ID=$VITE_OPENHEX_AGENT_ID
RUN pnpm --filter @lto/web build

# ── runtime ──────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 绕过官方镜像的入口脚本（/docker-entrypoint.sh 会跑 /docker-entrypoint.d/*.sh）。
#
# 为什么：那个入口对我们**唯一**有用的动作是「给 default.conf 补一行 listen [::]:80」，
# 而它为了判断该不该补，要调 `apk manifest nginx` 算校验和。这个调用一旦卡住或失败
# （apk、网络、只读文件系统，任何一种），`set -e` 就让入口直接退出 —— nginx 从未启动，
# 容器被 restart 策略反复拉起，现象是**日志停在「Getting the checksum」、端口永远连不上**。
# 本地实测踩到过，排查成本很高（容器显示 Up，但里面什么都没监听）。
#
# 我们的配置是**静态**的（没有用 /etc/nginx/templates 的 envsubst 模板），
# 不需要那个入口提供的任何东西。显式写 listen [::]:80 之后就是零损失。
# 净效果：启动路径只剩 nginx 一个进程，不再依赖运行期的 apk 与网络。
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
EXPOSE 80

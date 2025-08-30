# ---- 第 1 阶段：安装依赖 ----
FROM node:20-alpine AS deps

# 安装构建原生模块所需的工具
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# 启用 corepack 并激活 pnpm（Node20 默认提供 corepack）
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 仅复制依赖清单，提高构建缓存利用率
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（含 devDependencies，后续会裁剪）
# 强制重新构建原生模块以确保兼容性
RUN pnpm install --frozen-lockfile && pnpm rebuild bcrypt

# ---- 第 2 阶段：构建项目 ----
FROM node:20-alpine AS builder

# 安装构建工具（构建阶段也需要）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
# 复制全部源代码
COPY . .

# 在构建阶段也显式设置 DOCKER_ENV，
ENV DOCKER_ENV=true

# 生成生产构建
RUN pnpm run build

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-alpine AS runner

# 安装运行时需要的库（用于原生模块）
RUN apk add --no-cache libc6-compat

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# 从构建器中复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 从构建器中复制 scripts 目录
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# 从构建器中复制 start.js
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
# 从构建器中复制 public 和 .next/static 目录
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非特权用户
USER nextjs

EXPOSE 3000

# 使用自定义启动脚本，先预加载配置再启动服务器
CMD ["node", "start.js"] 
# 部署运维

## 生产环境部署

### 服务器目录结构

```
/opt/fsdx-web/
├── docker-compose.yml          # 生产 docker compose 编排文件（由仓库 docker-compose.prod.yml 复制而来）
├── .env                        # 全部配置（DATABASE_URL、JWT_SECRET、LOG_LEVEL）
└── volumes/
    └── app/                    # 应用数据（日志、上传文件）
```

### 首次部署

```bash
# 1. 创建目录结构
mkdir -p /opt/fsdx-web/volumes/app

# 2. 创建配置文件
cp .env.example /opt/fsdx-web/.env
# 编辑 /opt/fsdx-web/.env，修改 DATABASE_URL 和 JWT_SECRET

# 3. 放入 compose 文件（生产环境统一使用 docker-compose.yml 作为默认文件名）
cp docker-compose.prod.yml /opt/fsdx-web/docker-compose.yml

# 4. 拉取镜像并启动
cd /opt/fsdx-web
docker compose pull
docker compose up -d
```

### 服务拓扑

```
宿主机 nginx (80/443, SSL)
    └── proxy_pass http://127.0.0.1:3000
            │
┌───────────┴───────────────┐
│  docker compose (app)      │
│                             │
│  ┌──────────┐              │
│  │   app    │──────────────┼──▶ 宿主机 PostgreSQL
│  │ :3000    │              │
│  │          │              │
│  │ volumes  │              │
│  └──────────┘              │
│       │                     │
│  volumes/app                │
└───────┼─────────────────────┘
```

App 端口绑定 `127.0.0.1:3000`，仅允许宿主机 nginx 反代访问，不直接暴露公网。PostgreSQL 使用宿主实例，多服务共享。

### 环境变量分层

全部通过 compose `environment:` 注入，变量统一在 `.env` 文件管理：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串，指向宿主 PG 实例 |
| `STORAGE_DIR` | compose 硬编码 `/app/data` |
| `JWT_SECRET` | JWT 签名密钥 |
| `LOG_LEVEL` | 日志级别，默认 `info` |

### 部署命令

```bash
# 手动部署指定版本
cd /opt/fsdx-web
TAG=v1.0.0 docker compose pull
TAG=v1.0.0 docker compose up -d

# 查看运行状态
docker compose ps
docker compose logs -f app

# 回滚到指定版本
TAG=<旧版本> docker compose up -d
```

### CI/CD 自动部署

GitLab CI 在 `main` 分支推送后自动构建镜像并部署：

```
git push main
    ↓
构建阶段: docker build → push to GitLab Registry
    ↓
部署阶段: SSH 到服务器 → docker compose pull → docker compose up -d
```

CI 部署使用 `${CI_COMMIT_SHORT_SHA}` 作为镜像 tag，每次部署可追溯到具体 commit。

需要设置 GitLab CI 变量：
- `DEPLOY_USER` — 服务器 SSH 用户
- `DEPLOY_HOST` — 服务器地址
- SSH 密钥配置（GitLab Runner → 目标服务器免密登录）

---

## 启动流程

```
服务器启动
    │
    ▼
server.ts (根目录, Nitro entry)
    │
    ├── bootstrap()                          # src/bootstrap.ts
    │   ├── dotenv 加载 env/.env + env/.env.local
    │   ├── runMigrations()                  程序化数据库迁移（同步等待）
    │   ├── ensurePresetDicts()              fire-and-forget（不阻塞）
    │   ├── ensurePresetConfigs()            fire-and-forget（不阻塞）
    │   ├── ensurePresetTranslations()       fire-and-forget（不阻塞）
    │   ├── ensurePresetEvents() + ensurePresetProperties()
    │   │       └─ .then(loadPresetCache())  链式加载缓存
    │   ├── registerAllTasks()              注册定时任务
    │   ├── 注册 uncaughtException 处理器 → logger.fatal + exit(1)
    │   ├── 注册 unhandledRejection 处理器 → logger.fatal + exit(1)
    │   └── 注册 SIGTERM/SIGINT/SIGQUIT 处理器 → 缓冲刷入（含超时保护）
    │
    ├── createHonoApp()                      # src/hono-app.ts
    │   └── /health 路由 → { status: "ok", uptime }
    │
    └── TanStack Start SSR fetcher            # src/server.ts
        └── handler.fetch(request)
            未匹配的请求 → Hono 返回 404 → Nitro 继续处理
            匹配的请求 → Hono 返回 200+ → 直接响应
```

### 请求路由优先级

```
HTTP 请求
    ↓
Hono (createHonoApp)
    ├── /health → 健康检查
    ├── 其他自定义 API 路由
    └── 404 → 透传
          ↓
    TanStack Start SSR / Server Functions
```

---

## 环境变量

所有环境变量存放于 `env/` 目录：

| 文件 | 说明 | 加载时机 |
|------|------|----------|
| `env/.env` | 默认环境变量 | 优先加载 |
| `env/.env.local` | 本地覆盖配置 | 覆盖 .env（`override: true`） |

通过 `dotenv` 在 `bootstrap()` 中手动加载，不使用 Vite 的内置 `--mode`。应用代码通过 `getEnv()` 获取，禁止直接读取 `process.env`（日志模块例外，因 pino transport worker 兼容性问题）。

### 核心环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | —（必填） |
| `JWT_SECRET` | HS256 签名密钥 | —（必填） |
| `LOG_LEVEL` | 日志级别 | `info` |
| `STORAGE_DIR` | 文件存储目录（上传文件 + 日志） | `.tmp` |
| `NODE_ENV` | 运行环境 | — |

SMTP 邮件配置已从环境变量迁移至系统配置表，通过 `/admin/config` 页面管理。

---

## 定时任务

通过 `src/lib/scheduler/scheduler.ts` 的 `registerTask()` 注册 cron 任务：

| 任务 | Cron | 处理函数 | 说明 |
|------|------|----------|------|
| 清理过期临时文件 | `0 * * * *`（每整点） | `cleanExpiredFiles()` | 扫描 `expired_at < now()` 的 `status='temp'` 文件，删除物理文件 + 软删除记录 |
| 清理过期日志文件 | `0 3 * * *`（每天 3:00） | `cleanExpiredLogs()` | 删除 N 天前的日志文件 |

定时任务在 `bootstrap()` 末尾通过 `registerAllTasks()` 统一注册。

---

## 日志体系

### Pino 多流输出

```
logger.error/warn/info/debug
    │
    ├── 文件流 (info 级别)
    │   └── {STORAGE_DIR}/logs/YYYY-MM-DD.log
    │
    └── 控制台流
        ├── 生产环境: process.stdout (warn 级别)
        └── 开发环境: pino-pretty (info 级别，带颜色)
```

按天自动分割：`createWriteStream` 写入当天日期的日志文件。文件名随进程重启自然切换到新日期。

### SF 错误日志中间件

`src/middleware/sf-error-logger.ts` 注册在 `start.ts` 的 `functionMiddleware` 中，自动覆盖所有 Server Function：

| 错误类型 | 日志级别 | 行为 |
|----------|----------|------|
| `AdminAuthError` (401/403) | warn | 记录状态码 + 消息 |
| `ApiAuthError` | warn | 记录状态码 + 消息 |
| 其他异常 | error | `sanitizeError()` 脱敏后记录 |
| 开发环境成功请求 | debug | 记录耗时 |

中间件 `throw error` 保持原有错误传播，不影响框架 error boundary 和客户端 catch。

### 日志查询

管理端 `/admin/logs` 页面通过 `src/server/logs/logs.server.ts` 提供：
- `getLogDates()` — 列出所有日志文件日期
- `searchLogs(query)` — 按关键词/级别/日期范围搜索
- `getLogRawContent(date)` — 获取指定日期日志原始内容

---

## 文件存储

`src/lib/storage/storage.ts` 提供文件存储抽象层（当前仅本地存储实现）：

```
上传文件
    ↓
uploadFileSFn()
    ↓
sha256 校验 → 秒传检测（相同哈希复用已有文件）
    ↓
物理存储: {STORAGE_DIR}/files/{stored_name}
    ↓
数据库记录: file 表 (status='temp' / 'permanent')
```

文件状态：
- **temp**：临时上传，未关联业务实体，`expired_at` 指定过期时间
- **permanent**：已关联业务实体，不会被定时清理

---

## 优雅关闭

进程监听 `SIGTERM`、`SIGINT` 和 `SIGQUIT` 信号，在退出前执行：

```typescript
const gracefulShutdown = async () => {
    // 刷新缓冲中的事件埋点和操作日志，避免数据丢失
    // 10 秒超时保护，防止缓冲刷入挂起导致进程无法退出
    await Promise.race([
        Promise.all([flushTrackEvents(), flushOperationLogs()]),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("缓冲刷入超时，强制退出")), 10_000),
        ),
    ]);
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("SIGQUIT", gracefulShutdown);
```

---

## 首次部署 — 系统初始化

```
首次访问 /admin
    ↓
admin/init.tsx beforeLoad → checkInitStatus()
    ↓
SELECT FROM admin_user WHERE is_root = true → null
    ↓
重定向到 /admin/init 初始化页面
    ↓
用户填写管理员信息 + 站点设置
    ↓
initSystem() 在事务中执行:
    ├── 再次校验 is_root (防并发)
    ├── INSERT role (超级管理员, permissions: ["**"])
    ├── INSERT admin_user (is_root=true)
    └── INSERT system_config (站点名、SMTP、AI)
    ↓
刷新配置缓存 → 跳转 /admin/login
```

---

## 镜像构建

### 本地构建

```bash
# 默认官方源构建
docker build -t fsdx-cms .

# 使用国内 npm 镜像源加速构建
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t fsdx-cms .
```

### Dockerfile 结构

```
多阶段构建
    │
    ├── builder 阶段 (node:24-slim)
    │   ├── ARG NPM_REGISTRY           # 可选，自定义 npm 镜像源
    │   ├── corepack enable → 启用 pnpm
    │   ├── pnpm install --frozen-lockfile
    │   └── pnpm build → .output/
    │
    └── runner 阶段 (node:24-alpine)
        ├── 非 root 用户 (nodejs:nodejs)
        ├── HEALTHCHECK → GET /health（每 30s）
        ├── VOLUME /app/data（日志 + 上传文件）
        ├── EXPOSE 3000
        └── CMD node .output/server/index.mjs
```

---

## 开发环境 docker compose

项目根目录 `docker-compose.yml` 用于本地开发，`build:` 从源码构建，自带默认配置开箱即用：

```bash
# 直接启动（使用默认配置）
docker compose up -d

# 查看日志
docker compose logs -f app

# 如需自定义，创建 .env 覆盖默认值
cp .env.example .env
```

## 健康检查

```bash
GET /health → { "status": "ok", "uptime": 123.456 }
```

通过 Hono 提供，不经过 TanStack Start SSR 处理链路，轻量快速。

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `server.ts` (根目录) | Nitro 服务入口 |
| `src/bootstrap.ts` | 启动初始化 |
| `src/hono-app.ts` | Hono 应用工厂 + 健康检查 |
| `src/server.ts` | TanStack Start 服务端入口 |
| `src/server/tasks/tasks.server.ts` | 定时任务注册 |
| `src/lib/scheduler/scheduler.ts` | 定时任务调度器 |
| `src/lib/logger/logger.ts` | Pino 日志实例 |
| `src/middleware/sf-error-logger.ts` | SF 错误日志中间件 |
| `src/lib/storage/storage.ts` | 文件存储抽象层 |
| `src/server/init/init.server.ts` | 系统初始化逻辑 |
| `src/server/logs/logs.server.ts` | 日志文件查询 |
| `env/.env.example` | 环境变量模板 |
| `.env.example` | compose .env 变量模板 |
| `Dockerfile` | Docker 多阶段构建 |
| `.dockerignore` | Docker 构建排除规则 |
| `docker-compose.yml` | 开发环境 docker compose（build from source） |
| `docker-compose.prod.yml` | 生产环境 docker compose（pull from registry） |
| `.gitlab-ci.yml` | GitLab CI/CD（构建 + 自动部署） |

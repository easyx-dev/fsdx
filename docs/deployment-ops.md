# 部署运维

## 启动流程

```
服务器启动
    │
    ▼
server.ts (根目录, Nitro entry)
    │
    ├── bootstrap()                          # src/bootstrap.ts
    │   ├── dotenv 加载 env/.env + env/.env.local
    │   ├── 注册 uncaughtException 处理器 → logger.fatal + exit(1)
    │   ├── 注册 unhandledRejection 处理器 → logger.fatal
    │   ├── ensurePresetDicts()              同步等待
    │   ├── ensurePresetConfigs()            同步等待
    │   ├── ensurePresetEvents()             同步等待
    │   ├── ensurePresetProperties()         同步等待
    │   ├── ensurePresetTranslations()       同步等待
    │   ├── loadPresetCache()               异步（不阻塞）
    │   ├── registerAllTasks()              注册定时任务
    │   └── 注册 SIGTERM/SIGINT 处理器 → flushTrackEvents() + flushOperationLogs()
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

进程监听 `SIGTERM` 和 `SIGINT` 信号，在退出前执行：

```typescript
const gracefulShutdown = async () => {
    // 刷新缓冲中的事件埋点和操作日志，避免数据丢失
    await Promise.all([flushTrackEvents(), flushOperationLogs()]);
};
process.on("SIGTERM", () => gracefulShutdown().finally(() => process.exit(0)));
process.on("SIGINT", () => gracefulShutdown().finally(() => process.exit(0)));
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

## 生产构建

```bash
pnpm build      # Vite 生产构建 → .output/
pnpm start      # node .output/server/index.mjs
```

构建时 `importProtection` 规则确保 `bcryptjs`、`drizzle-orm`、`openai` 不会泄漏到客户端 bundle。

---

## Docker 部署

默认使用 Docker 镜像部署，推荐搭配 `docker compose` 一键启动。

### 镜像构建

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
    ├── builder 阶段 (node:24-alpine)
    │   ├── ARG NPM_REGISTRY           # 可选，自定义 npm 镜像源
    │   ├── corepack enable → 启用 pnpm
    │   ├── pnpm install --frozen-lockfile
    │   └── pnpm build → .output/
    │
    └── runner 阶段 (node:24-alpine)
        ├── 非 root 用户 (nodejs:nodejs)
        ├── HEALTHCHECK → GET /health（每 30s）
        ├── VOLUME /app/.tmp（日志 + 上传文件）
        ├── EXPOSE 3000
        └── CMD node .output/server/index.mjs
```

### docker compose 部署

项目根目录提供 `docker-compose.yml`，包含 PostgreSQL + App 两个服务：

```bash
# 1. 创建根目录 .env 文件，填写必填变量
cat > .env << EOF
DB_PASSWORD=your_db_password
JWT_SECRET=your-jwt-secret-at-least-32-characters
LOG_LEVEL=info
PORT=3000
EOF

# 2. 启动所有服务
docker compose up -d

# 3. 查看日志
docker compose logs -f app

# 4. 停止服务
docker compose down
```

服务拓扑：

```
┌──────────────────────────────────────┐
│  docker compose                      │
│                                      │
│  ┌──────────┐     ┌──────────────┐   │
│  │   app    │────▶│     db       │   │
│  │  :3000   │     │ postgres:16  │   │
│  │          │     │  :5432       │   │
│  │ .tmp ◀──┼──┐  │ pgdata ◀─────┼───│── 卷持久化
│  └──────────┘  │  └──────────────┘  │ │
│                │                     │
│  app-data ◀────┘  pgdata ◀──────────┘ │
└──────────────────────────────────────┘
```

> **注意**：首次部署后需访问 `/admin` 完成系统初始化（创建 root 管理员），详见[首次部署 — 系统初始化](#首次部署--系统初始化)。

### 环境变量映射

docker compose 中 App 容器的环境变量自动拼接：

| 变量 | 容器内值 | 来源 |
|------|----------|------|
| `DATABASE_URL` | `postgresql://postgres:${DB_PASSWORD}@db:5432/fsdx_cms_tan` | 自动拼接 |
| `JWT_SECRET` | `${JWT_SECRET}` | 宿主机 `.env` |
| `LOG_LEVEL` | `${LOG_LEVEL:-info}` | 宿主机 `.env` |
| `STORAGE_DIR` | `/app/.tmp` | 硬编码 |

---

## CI/CD 自动构建

### GitHub Actions（`.github/workflows/deploy.yml`）

触发条件：推送到 `main` 分支 / 打 `v*` 标签。

```yaml
流程:
  检出代码 → 登录 GHCR → 生成镜像标签 → docker build & push
```

推送到 **GitHub Container Registry**（`ghcr.io/<owner>/<repo>`）：

| 触发事件 | 镜像标签 |
|----------|----------|
| push `main` 分支 | `latest`、`main` |
| push `v1.0.0` 标签 | `1.0.0`、`v1.0.0` |
| 其他分支 | 分支名 |

使用官方 npm 源构建，无需额外配置。镜像推送到 `ghcr.io`，默认使用 `GITHUB_TOKEN` 认证。

### GitLab CI（`.gitlab-ci.yml`）

触发条件：推送到 `main` 分支 / 打任意标签。

```yaml
流程:
  登录 GitLab Registry → docker build（国内镜像源）→ docker push
```

推送到 **GitLab Container Registry**（`$CI_REGISTRY_IMAGE`）：

| 触发事件 | 镜像标签 |
|----------|----------|
| push `main` 分支 | `latest` |
| push 标签 | `latest` + 标签名 |

构建时通过 `--build-arg NPM_REGISTRY=https://registry.npmmirror.com` 使用国内 npm 镜像源加速依赖安装。

---

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
| `Dockerfile` | Docker 多阶段构建 |
| `.dockerignore` | Docker 构建排除规则 |
| `docker-compose.yml` | Docker Compose 编排（PostgreSQL + App） |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD（构建 → GHCR） |
| `.gitlab-ci.yml` | GitLab CI/CD（构建 → GitLab Registry） |

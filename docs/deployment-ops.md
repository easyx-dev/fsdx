# 部署运维

> 定位：平台机制类 · 人类阅读
> 单一事实来源：`src/bootstrap.ts`（启动流程/优雅关闭）、`src/services/tasks/tasks.server.ts`（定时任务）、`src/lib/logger/logger.ts`（日志）
> 引用关系：← 被 architecture-overview 引用、README「文档」索引；→ 引用启动/任务/日志代码单一事实来源
> 更新触发：启动流程、定时任务、日志策略、部署/环境变量变更时

## 生产环境部署

生产部署由独立子仓库 [fsdx-deploy](https://github.com/easyx-dev/fsdx-deploy.git) 承载（主仓库 `deploy/` 子模块）：生产 compose（内置 PostgreSQL）、一键部署/更新、备份/恢复、迁移预检脚本与运维手册。

- **部署运维手册**（首次部署 / 升级流程 / 回滚 / 定期备份 cron）→ 子仓库 [`deploy/README.md`](../deploy/README.md)
- 主仓库保留镜像构建（见下文「镜像构建」）与开发环境 compose；生产编排与部署脚本不再在此重复维护

### 镜像来源

- GitHub Actions（`.github/workflows/build.yml`）构建推送 `ghcr.io/easyx-dev/fsdx:{latest|commit-sha|tag}`；内网 GitLab CI（`.gitlab-ci.yml`）并存推送内网 registry
- 生产部署镜像地址见子仓库 `docker-compose.yml`（默认 `ghcr.io/easyx-dev/fsdx:${TAG}`）

---

## 启动流程

```
服务器启动
    │
    ▼
app/server.ts (Nitro entry)
    │
    ├── bootstrap()                          # src/bootstrap.ts
    │   ├── init 注入                        # initAi / initMail / initSms / setSchedulerLogger（先于一切）
    │   ├── runMigrations()                 程序化数据库迁移（fail-fast：失败即应用启动失败）
    │   ├── await Promise.all([ensurePresetDicts(), ensurePresetConfigs()])
    │   │       等待预置字典和系统配置完成（同步等待，config 缓存随之热加载）
    │   ├── void ensurePresetTranslations()  fire-and-forget（不阻塞）
    │   ├── void Promise.all([ensurePresetEvents(), ensurePresetProperties()])
    │   │       .then(loadTrackMetaCache())  链式加载 track 元数据缓存（不阻塞）
    │   ├── registerAllTasks()              注册定时任务
    │   ├── 注册 uncaughtException 处理器 → logger.fatal + exit(1)
    │   ├── 注册 unhandledRejection 处理器 → logger.fatal + exit(1)
    │   └── 注册 SIGTERM/SIGINT/SIGQUIT 处理器 → 缓冲刷入（含超时保护）
    │
    └── TanStack Start SSR fetcher            # src/server.ts
        └── handler.fetch(request)
            匹配路由 → 直接响应（页面 / Server Function / Server Route）
            未匹配 → 返回 undefined → Nitro 继续处理静态资源等
```

HTTP 入口（`app/server.ts`）对每个请求 `httpRequestsTotal.inc({ method })` 埋点。

### 请求路由优先级

```
HTTP 请求
    ↓
TanStack Start SSR / Server Functions
    ├── /health（Server Route handler，无鉴权）→ 健康检查 { status, uptime }
    └── /api/metrics（Server Route handler，无鉴权）→ Prometheus 文本
```

---

## 环境变量

环境变量文件位于 `app/` 下（`app/.env`、`app/.env.example`），Vite 以 app 为 root 加载并注入 `process.env`：

| 文件 | 说明 |
|------|------|
| `app/.env` | 运行环境变量（不入库） |
| `app/.env.example` | 环境变量模板 |

应用代码通过 `process.env` 直接读取（日志模块因 pino transport worker 兼容性问题同样直接读取 `process.env`）。

### 核心环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | —（必填） |
| `JWT_SECRET` | HS256 签名密钥 | —（必填） |
| `LOG_LEVEL` | 日志级别 | `info` |
| `STORAGE_DIR` | 文件存储目录（上传文件 + 日志） | `.tmp` |
| `NODE_ENV` | 运行环境 | — |
| `DB_POOL_MAX` | pg 连接池最大连接数 | `10` |
| `DB_POOL_IDLE_TIMEOUT_MS` | 连接空闲回收时间（毫秒） | `30000` |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | 连接获取超时（毫秒） | `2000` |

> 连接池参数在 `src/db/index.ts` 中读取，postgres 驱动默认值见 [node-postgres 文档](https://node-postgres.com/features/pool)。

SMTP 邮件配置存储于系统配置表，通过 `/admin/config` 页面管理。

---

## 定时任务

通过 `@fsdx/core/scheduler` 的 `registerTask()` 注册 cron 任务（调度器日志经 `setSchedulerLogger` 注入）：

| 任务 | Cron | 处理函数 | 说明 |
|------|------|----------|------|
| 清理过期临时文件 | `0 * * * *`（每整点） | `cleanExpiredFiles()` | 扫描 `expired_at < now()` 的 `status='temp'` 文件，删除物理文件 + 软删除记录 |
| 清理过期日志文件 | `0 3 * * *`（每天 3:00） | `cleanExpiredLogs()` | 删除 N 天前的日志文件 |

定时任务在 `bootstrap()` 末尾通过 `registerAllTasks()` 统一注册。

> **时区约定**：cron 执行与日志按天切割均以 `Asia/Shanghai` 为统一时区基准（`@fsdx/core/date-format` 的 `DEFAULT_TASK_TIME_ZONE`），**不依赖服务器系统时区**。部署环境无需设置 `TZ`，服务器时区变更不影响任务执行时间与日志文件名日期。

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

按天自动分割：`createWriteStream` 写入当天日期的日志文件。文件名按 `Asia/Shanghai` 时区生成（与日志清理、定时任务同一时区基准），随进程重启自然切换到新日期。

### SF 错误日志中间件

`src/middleware/sf-error-logger.ts` 注册在 `start.ts` 的 `functionMiddleware` 中，自动覆盖所有 Server Function：

| 错误类型 | 日志级别 | 行为 |
|----------|----------|------|
| `AdminAuthError` / `ClientAuthError` (401/403) | warn | 记录状态码 + 消息 |
| 其他异常 | error | `sanitizeError()` 脱敏后记录 |
| 开发环境成功请求 | debug | 记录耗时 |

- 中间件同时埋入 SF 耗时直方图与结果计数器（`server_function_duration_seconds` / `server_function_requests_total`）
- 错误经 `toClientError()` 归一化后抛出，保证客户端 `err.message` 始终为业务/校验/兜底文案，不影响框架 error boundary 和客户端 catch

### 日志查询

管理端 `/admin/logs` 页面通过 `src/services/logs/logs.server.ts` 提供：
- `getLogDates()` — 列出所有日志文件日期
- `searchLogs(query)` — 按关键词/级别/日期范围搜索
- `getLogRawContent(date)` — 获取指定日期日志原始内容

### 请求 ID 贯通

`requestIdMiddleware`（`src/middleware/request-id.ts`）注册于 requestMiddleware 首位：优先透传上游 `x-request-id`（超长截断至 100），否则生成 UUID，写入 ALS 上下文并回写响应头。logger mixin 自动注入 requestId，操作审计落库 `operation_log.request_id`——日志、审计、埋点可按同一 requestId 全链路串联。

---

## 监控（Prometheus）

`src/lib/metrics/metrics.ts` 为进程内指标注册表（`Counter` + `Histogram`，无第三方依赖），HTTP 入口与 SF 中间件自动埋点：

| 指标 | 类型 | 标签 | 埋点位置 |
|------|------|------|----------|
| `http_requests_total` | Counter | `method` | `app/server.ts` 入口 |
| `server_function_requests_total` | Counter | `result`（success/error） | `sf-error-logger` |
| `server_function_duration_seconds` | Histogram | — | `sf-error-logger` |

拉取端点 `/api/metrics`（Server Route handler，无鉴权）输出 Prometheus text 格式。接入 Prometheus 即可采集，**注意**：
- 无鉴权端点，如对外暴露需在反向代理层加访问控制
- 指标为进程内计数，多实例部署需在实例层聚合（Prometheus 直接抓取多实例再聚合即可）

---

## 文件存储

`@fsdx/core/storage` 提供文件存储抽象层（`StorageAdapter` 接口 + `LocalStorageAdapter`，当前仅本地存储实现），存储基址为 `{STORAGE_DIR}/uploads/`：

```
上传文件
    ↓
uploadFileSFn()
    ↓
sha256 校验 → 秒传检测（相同哈希复用已有文件）
    ↓
物理存储: {STORAGE_DIR}/uploads/{YYYY-MM-DD}/{stored_name}
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

## 单实例与数据一致性边界

- **架构假设单实例**：内存缓存、埋点频控、`BatchWriter` 缓冲、本地文件存储、cron 定时任务均为进程内/本机实现，多实例部署会导致缓存不一致、定时任务重复执行、埋点缓冲各实例分散。
- **崩溃丢数据窗口**：埋点事件与操作日志的 `BatchWriter` 缓冲（5 秒 / 100 条窗口）在进程被 kill -9 或崩溃时丢失；优雅关闭（SIGTERM/SIGINT/SIGQUIT）会强制刷新。
- **fire-and-forget 通知不持久**：邮件 / 短信 / AI 翻译为触发即忘，无持久队列，进程退出即丢失未完成的发送任务。
- **扩容路径**：真正横向扩容前需先外部化状态——Redis 承载缓存与分布式限流、消息队列承载埋点/任务投递、对象存储承载文件、集中式日志。

---

## 首次部署 — 系统初始化

```
首次访问 /admin
    ↓
admin/init/index.tsx beforeLoad → checkInitStatus()
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
docker build -t {项目名} .

# 使用国内 npm 镜像源加速构建
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t {项目名} .
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

```json
GET /health → 200
{
  "status": "ok",
  "uptime": 123.456,
  "timestamp": "2026-08-23T05:28:52.721Z",
  "version": "1.1.0",
  "checks": {
    "database": { "status": "up", "latencyMs": 9 },
    "storage": { "status": "up" }
  }
}
```

通过 TanStack Start Server Route 提供（`src/routes/health.tsx`），无鉴权。就绪语义：数据库连通（`SELECT 1`）与存储目录可写均正常返回 `200`，任一异常返回 `503`，供 Docker healthcheck / Playwright 等待依赖就绪。

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `deploy/`（子模块） | 生产部署运维仓库（fsdx-deploy：compose/脚本/手册） |
| `server.ts`（app 根目录） | Nitro 服务入口 + HTTP 指标埋点 |
| `src/bootstrap.ts` | 启动初始化（init 注入、迁移、预置、定时任务、优雅关闭） |
| `src/server.ts` | TanStack Start 服务端入口 |
| `src/start.ts` | 全局中间件注册（requestId + locale + CSRF + sfErrorLogger） |
| `src/middleware/request-id.ts` | 请求 ID 中间件 |
| `src/lib/metrics/metrics.ts` | Prometheus 进程内指标注册表 |
| `src/routes/api/metrics.tsx` | `/api/metrics` 指标端点（无鉴权） |
| `src/services/tasks/tasks.server.ts` | 定时任务注册 |
| `packages/core/src/infra/scheduler/index.ts` | 定时任务调度器（`@fsdx/core/scheduler`） |
| `src/lib/logger/logger.ts` | Pino 日志单例壳（`createLogger` 在 `@fsdx/core/logger`） |
| `src/middleware/sf-error-logger.ts` | SF 错误日志中间件 |
| `packages/core/src/infra/storage/index.ts` | 文件存储抽象层（`@fsdx/core/storage`） |
| `src/services/init/init.server.ts` | 系统初始化逻辑 |
| `src/services/logs/logs.server.ts` | 日志查询服务 |
| `src/services/logs/log-reader.ts` | 日志文件读取 |
| `src/services/logs/logs-cleanup.server.ts` | 过期日志清理 |
| `app/.env.example` | 环境变量模板 |
| `Dockerfile` | Docker 多阶段构建 |
| `.dockerignore` | Docker 构建排除规则 |
| `docker-compose.yml` | 开发环境 docker compose（build from source） |
| `.gitlab-ci.yml` | GitLab CI/CD（构建 + 自动部署） |

# 架构总览

基于 TanStack Start 的全栈 Web 应用框架，开箱内置 CMS 示例与 RBAC 认证、事件埋点、操作审计、国际化等基础设施。

> 除特别说明外，文件路径均相对 `app/` 目录（单仓库多包，业务代码在 `app/`，库包在 `packages/`）。

## 系统分层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          浏览器                                     │
│      ┌──────────────────┐      ┌──────────────────────────┐        │
│      │   /admin/* (SPA)  │      │    /* (SSR 前台)          │        │
│      │   管理端 (antd)    │      │   客户端 (shadcn/ui)      │        │
│      └────────┬─────────┘      └───────────┬──────────────┘        │
└───────────────┼────────────────────────────┼────────────────────────┘
                │                            │
┌───────────────┼────────────────────────────┼────────────────────────┐
│               │     Nitro (app/server.ts)   │                        │
│               │                            │                        │
│  ┌────────────▼────────────────────────────▼──────────────────┐    │
│  │                   Hono (createHonoApp)                      │    │
│  │  ┌──────────────────┐                                      │    │
│  │  │ /health 等自定义  │  未匹配 (404) → 透传                   │    │
│  │  │ API 路由          │────────────────────┐                 │    │
│  │  └──────────────────┘                    │                 │    │
│  └─────────────────────────────────────────┼─────────────────┘    │
│                                            │                      │
│  ┌─────────────────────────────────────────▼─────────────────┐    │
│  │                TanStack Start (SSR + Server Functions)     │    │
│  ┌────────────▼──────┐  ┌──────────────────▼───────────────┐  │    │
│  │  requestMiddleware │  │  requestMiddleware                │  │    │
│  │  requestId +       │  │  requestId +                     │  │    │
│  │  locale + CSRF     │  │  locale + CSRF                   │  │    │
│  └────────┬───────────┘  └──────────────────┬───────────────┘  │    │
│           │                                 │                  │    │
│  ┌────────▼──────────────────────────────────▼───────────────┐ │    │
│  │              Server Functions (createServerFn)             │ │    │
│  │  ┌──────────────────┐    ┌─────────────────────────┐      │ │    │
│  │  │ 管理端 SFn         │    │ 客户端 / 公开 SFn        │      │ │    │
│  │  │ adminPermGuard()  │    │ (无需鉴权)               │      │ │    │
│  │  └────────┬─────────┘    └───────────┬─────────────┘      │ │    │
│  │           │                          │                     │ │    │
│  │  ┌────────▼──────────────────────────▼─────────────┐      │ │    │
│  │  │  functionMiddleware: sfErrorLogger (覆盖所有 SF)  │      │     │
│  │  └─────────────────────┬───────────────────────────┘      │     │
│  └────────────────────────┼──────────────────────────────────┘     │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │              服务层 (src/services/)                           │    │
│  │  admin-auth / admin-role / admin-user / captcha           │    │
│  │  client-auth / client-role / client-user / config /       │    │
│  │  dashboard / dict / download / file / file-explorer       │    │
│  │  i18n(ui+content 拆分) / init / logs / message / news /    │    │
│  │  operation-log / query / tasks / track(meta/validate/     │    │
│  │  analytics 拆分)                                           │    │
│  └────────────────────────┬──────────────────────────────────┘    │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │          基础库 (@fsdx/core + src/lib 薄壳)                 │    │
│  │  utils: ms / export / match-permission / cn / error-utils │    │
│  │  date-format / cache: MemoryCache │ i18n: types / config  │    │
│  │  infra(服务端): logger / jwt / batch-writer / storage /   │    │
│  │  captcha / semaphore / task-manager / request-context /   │    │
│  │  scheduler / ai / mail / sms                              │    │
│  │  src/lib 单例壳: logger / jwt / metrics / track(SDK)       │    │
│  └────────────────────────┬──────────────────────────────────┘    │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │           PostgreSQL (Drizzle ORM)                         │    │
│  │  17 张表 + 9 个内存缓存实例                                  │    │
│  └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心设计决策

### 1. 双端同构架构

同一套 TanStack Start 服务同时承载**管理端 SPA** 和**客户端 SSR 前台**：

| 维度 | 管理端 (`/admin/*`) | 客户端前台 (`/*`) |
|------|---------------------|-------------------|
| 渲染模式 | SPA (`ssr: false`) | SSR |
| UI 组件库 | Ant Design 6 | shadcn/ui + Tailwind |
| 认证方式 | `adminPermGuard` 中间件 | `beforeLoad` 调用 `getCurrentClientSFn` |
| Cookie | `fsdx_admin_token` | `fsdx_client_token` |
| 错误通知 | antd `message.error` | sonner `toast.error` |

### 2. 服务层与路由层分离（SFn 就近路由）

每类代码有唯一归属，**禁止越层**：

```
src/services/{module}/        # 服务层：业务逻辑 + zod 单一来源
├── {module}.server.ts        # 服务逻辑（可被 .functions.ts / 其他 .server.ts 引用）
├── {module}.schemas.ts       # zod schema 单一来源，服务层用 z.infer 派生类型
├── {module}.cache.ts         # 内存缓存实例（唯一归属）
└── {module}.types.ts         # 模块内部共享类型

src/routes/**/-mods/          # 路由层：UI 组件 + 就近的 SFn
├── *.functions.ts            # 消费该页面的 SFn（createServerFn）
└── 组件/路由局部 schema（*.server.ts 一律归 services/，禁止出现在 -mods/）
```

- `.server.ts` 中的函数**禁止**以 `SFn` 为后缀；`.functions.ts` 中的 `createServerFn`**必须**以 `SFn` 为后缀
- **SFn 就近路由**：RPC 边界随消费页面放入路由 `-mods/`，跨端实体 SFn 各拆到所属端路由；仅无页面消费的跨端共享 SFn（auth / captcha / track SDK / message / dict 选项 / 客户端可见配置 / 初始化状态 / 文件上传列表）留在 `services/<module>/`
- 被服务层 `z.infer` 派生或跨端复用的 schema 必须收 `services`；纯路由局部 schema 可随 SFn 留路由
- 路由文件与组件**禁止**直接 import `.server.ts`，一律经 SFn 调用

> 完整契约、SFn 放置规则、`src/services/` 准入门槛、违规自查 → [server-function](../.agents/skills/server-function/SKILL.md)

### 3. 路由分层

```
__root.tsx                    # HTML shell，按 pathname 前缀分发 AdminRootDocument / SSRRootDocument
├── /                         # 前台首页 (SSR, index.functions.ts)
├── /about                    # 关于页 (SSR)
├── /messages                 # 消息中心 (SSR)
├── /login, /register         # 客户端认证 (SSR)
├── /forgot-password          # 客户端忘记密码 (SSR)
├── /news, /news/$slug        # 新闻列表 / 详情 (SSR)
├── /file/r/$id               # 文件读取路由（公共访问 + 同源校验，inline 预览/打开）
├── /api/metrics              # Prometheus 指标端点（Server Route handler，无鉴权）
└── admin.tsx                 # 管理端父路由（SSR=false），子路由无布局外壳
    ├── admin/init            # 系统初始化
    ├── admin/login           # 管理员登录
    ├── admin/forgot-password # 管理端忘记密码
    └── admin/_admin.tsx      # 管理端鉴权布局（beforeLoad + SSR=false）
        ├── /                 # 仪表盘
        ├── users/admins      # 管理员用户
        ├── users/clients     # 客户端用户
        ├── admin-roles       # 管理端角色
        ├── client-roles      # 客户端角色
        ├── news (list/create/$id/edit)   # 新闻管理
        ├── dicts             # 字典管理
        ├── config            # 系统配置
        ├── files             # 文件管理
        ├── logs              # 运行日志（含 download/$id）
        ├── file-explorer     # 目录浏览（含 download/$）
        ├── operation-logs    # 操作审计
        ├── translations      # 翻译管理（ui.tsx + content.tsx）
        ├── track             # 埋点（query / analytics / event-meta / property-meta）
        ├── messages          # 消息（收件箱 + manage）
        └── demo              # 组件演示（ai / editor / pro-table / upload）
```

路由目录组织约定（`-mods/` companion 收纳、单页 vs 子路由决策矩阵、页面本体必须是路由文件、首页不目录化等）详见 [AGENTS.md](../AGENTS.md)。

### 4. 中间件执行链路

`src/start.ts` 注册全局中间件：

- **requestMiddleware**（按序）：`requestIdMiddleware`（透传/生成 x-request-id，写 ALS + 回写响应头）→ `localeMiddleware` → `createCsrfMiddleware`（仅 ServerFn）
- **functionMiddleware**：`sfErrorLogger`（覆盖所有 SF，鉴权失败记 warn / 系统异常记 error，埋 SF 耗时与结果指标，`toClientError()` 归一化后抛出）
- 各 SFn 内部经 `.middleware([adminPermGuard(perm)])` 等完成鉴权（管理端）或 `clientAuthGuard` / `clientPermGuard`（客户端）

完整中间件链路与 `resolveAdminAuthContext` 解析流程 → [auth-permission-model](auth-permission-model.md)。

### 5. 缓存分层

`MemoryCache<T>` 通用基类在 `@fsdx/core/cache-core`（基于 Map，支持 TTL 过期与命名空间），实例按模块拆分在 `services/<module>/<module>.cache.ts`。全系统共 **9 个实例**（8 个领域数据缓存 + 1 个埋点频控内部实例）：

| 缓存实例 | 所属模块 |
|----------|----------|
| `dictCache` / `configCache` / `configTranslationCache` | `services/dict/`、`services/config/` |
| `uiTranslationCache` | `services/i18n/` |
| `clientUserCache` / `adminUserCache` | `services/client-auth/`、`services/admin-auth/` |
| `trackEventMetaCache` / `trackPropertyMetaCache` | `services/track/` |
| `sessionRateCache`（埋点频控，内部实例） | `services/track/track.validate.ts` |

每个实例只能在唯一服务模块中直接操作；读缓存函数必须懒加载（miss → 查库 → 写缓存 → 返回）。完整设计、生命周期与失效策略 → [缓存体系](cache-system.md)。

### 6. 缓冲写入策略

两类高频写入数据（事件埋点 `trackEvent()`、操作日志 `logOperation()`）统一复用 `@fsdx/core/batch-writer` 的 `BatchWriter`：fire-and-forget 入内存队列，满批/定时刷新、超上限丢弃最旧、进程退出强制刷入（参数见 [AGENTS.md](../AGENTS.md) 与 [事件埋点](event-tracking.md)）。

### 7. 请求链路与可观测性

**请求 ID 贯通**：`requestIdMiddleware`（`src/middleware/request-id.ts`）注册于 requestMiddleware 首位，优先透传上游 `x-request-id`（超长截断至 100）否则生成 UUID，写入 ALS 上下文并回写响应头。logger mixin 自动注入 requestId，操作审计落库 `operation_log.request_id`，实现日志与审计全链路追踪。

**Prometheus 指标**：`src/lib/metrics/metrics.ts` 进程内注册表（`Counter` + `Histogram`，无第三方依赖），预置 3 个指标：

| 指标 | 类型 | 标签 |
|------|------|------|
| `http_requests_total` | Counter | `method` |
| `server_function_requests_total` | Counter | `result`（success/error） |
| `server_function_duration_seconds` | Histogram | — |

- `/api/metrics` 端点（Server Route handler）输出 Prometheus text 格式，无鉴权，对外暴露需在反代层加访问控制
- 埋点位置：`app/server.ts`（HTTP 入口）、`src/middleware/sf-error-logger.ts`（SF 耗时/结果）
- 进程内计数，多实例部署需实例层聚合 → [部署运维](deployment-ops.md)

## 数据流全景

```
用户操作 → 客户端埋点 SDK (track.ts)
    │
    ├─ trackEventSFn() ──→ track.functions.ts
    │                           │
    │                     track.server.ts（校验 track.validate / 元数据 track.meta）
    │                      ├─ 频控（60 条/分钟）+ 时间钳制
    │                      ├─ 校验事件名/属性键 + 值类型（trackEventMetaCache / trackPropertyMetaCache）
    │                      └─ 入缓冲 → 批量写入 track_event 表
    │
    └─ 管理端操作 ──→ logOperation()
                          │
                    operation-log.server.ts
                     └─ 入缓冲 → 批量写入 operation_log 表

管理端查询:
  track_event 表 → searchTrackEvents() / getTrackAnalytics()
  operation_log 表 → searchOperationLogs()
```

## 目录职责矩阵

| 目录 | 定位 | 可导入方 | 特殊规则 |
|------|------|----------|----------|
| `packages/core/` | 纯逻辑库（同构工具 + 服务端基础设施） | 全部 | `infra/` 仅服务端，客户端禁止引用；详见 [core README](../packages/core/README.md) |
| `packages/ui-ssr/` | shadcn 基础组件 | 前台/两端共用 | 只写 tailwind 类名，颜色 token 宿主注入；详见 [ui-ssr README](../packages/ui-ssr/README.md) |
| `packages/ui-spa/` | antd 管理端组件 | 管理端 | antd 为 peerDependency 单实例；详见 [ui-spa README](../packages/ui-spa/README.md) |
| `src/lib/` | 应用级基础设施单例壳 + 客户端 SDK | 全部 | 仅 logger / jwt / metrics / track 四个薄壳，其余基础库在 `@fsdx/core` |
| `src/services/` | 服务端业务逻辑（server + schemas + cache + types）+ 跨端共享 SFn | routes/, services/ 自身 | `.server.ts` 禁止使用 `SFn` 后缀；SFn 就近路由 |
| `src/routes/` | 路由页面 + UI 组件 + 就近 SFn（`-mods/`） | — | SFn 必须用 `.validator(zod)`；禁止直接 import `.server.ts` |
| `src/middleware/` | 请求级中间件（鉴权/权限/locale/request-id/错误日志） | start.ts, routes/ | — |
| `src/permissions/` | RBAC 权限码常量与匹配（admin + client 双端） | 全部 | 客户端禁止导入 `infra/`；详见 [permission](../.agents/skills/permission/SKILL.md) |
| `src/constants/` | 项目级常量 | 全部 | — |
| `src/theme/` | 主题注册表（单一事实来源） | app 内 | — |
| `src/components/` | React 组件 | 全部 | admin/ 用 antd, client/ 用 shadcn/ui |
| `src/db/` | 数据库 Schema | services/ | 客户端禁止导入 (importProtection) |
| `services/*/*.cache.ts` | 内存缓存实例 | 仅所属模块 | 每个实例只能在唯一服务模块中直接操作 |

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `server.ts`（app 根目录） | Nitro 服务入口，bootstrap + Hono 代理 + HTTP 指标埋点 |
| `src/bootstrap.ts` | 启动初始化（init 注入、迁移、预置数据、定时任务、优雅关闭） |
| `src/hono-app.ts` | Hono 应用工厂（/health 路由） |
| `src/server.ts` | TanStack Start 服务端入口（createServerEntry） |
| `src/start.ts` | 全局中间件注册（requestId + locale + CSRF + sfErrorLogger） |
| `src/router.tsx` | TanStack Router 实例 |
| `src/routes/__root.tsx` | 根布局（AdminLayout / SSRLayout 分支） |
| `src/middleware/request-id.ts` | 请求 ID 中间件（x-request-id 透传/生成 + ALS + 响应头） |
| `src/lib/metrics/metrics.ts` | Prometheus 进程内指标注册表 |
| `src/routes/api/metrics.tsx` | `/api/metrics` 指标端点（Server Route，无鉴权） |
| `packages/core/README.md` | @fsdx/core 导出清单与边界 |
| `packages/ui-ssr/README.md` | @fsdx/ui-ssr 组件清单与集成约定 |
| `packages/ui-spa/README.md` | @fsdx/ui-spa 组件清单与集成约定 |
| `docs/auth-permission-model.md` | 认证与权限模型详细文档 |
| `docs/database-design.md` | 数据库设计文档 |
| `docs/cache-system.md` | 缓存体系文档 |
| `docs/event-tracking.md` | 事件埋点文档 |
| `docs/deployment-ops.md` | 部署运维文档 |

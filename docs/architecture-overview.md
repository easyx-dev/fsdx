# 架构总览

基于 TanStack Start 的全栈 Web 应用框架，开箱内置 CMS 示例与 RBAC 认证、事件埋点、操作审计、国际化等基础设施。

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
│               │     Nitro (server.ts)      │                        │
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
│  │  locale + CSRF     │  │  locale + CSRF                    │  │    │
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
│  │  admin-auth / admin-role / captcha / client-auth           │    │
│  │  client-role / config / dict / file / file-explorer        │    │
│  │  i18n / init / logs / message / news / operation-log       │    │
│  │  query / tasks / track                                     │    │
│  └────────────────────────┬──────────────────────────────────┘    │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │          基础库 (@fsdx/core + src/lib 薄壳)                 │    │
│  │  utils: ms / export / match-permission / cn / error-utils │    │
│  │  cache: MemoryCache │ i18n: types / config                 │    │
│  │  infra(服务端): logger / jwt / batch-writer / storage      │    │
│  │  request-context / scheduler / ai / mail / sms / captcha   │    │
│  └────────────────────────┬──────────────────────────────────┘    │
│                           │                                        │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │           PostgreSQL (Drizzle ORM)                         │    │
│  │  17 张表 + 8 个内存缓存实例                                  │    │
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

### 2. 三层代码分离

每个服务端模块遵循三层分离原则：

```
src/services/{module}/
├── {module}.server.ts      # 服务层：纯业务逻辑，可被 .functions.ts 和 其他 .server.ts 引用
├── {module}.functions.ts   # SFn 包装层：createServerFn + validator + 鉴权中间件
└── {module}.schemas.ts     # zod schema 定义
```

- `.server.ts` 中的函数**禁止**以 `SFn` 为后缀
- `.functions.ts` 中的 `createServerFn`**必须**以 `SFn` 为后缀
- 路由层直接引用 `.server.ts` 或 `.functions.ts`，不直接操作数据库

### 3. 路由分层

```
__root.tsx                    # HTML shell，按 pathname 分发 AdminLayout / SSRRootDocument
├── /                         # 前台首页 (SSR)
├── /login, /register         # 客户端认证 (SSR)
├── /forgot-password          # 客户端忘记密码 (SSR)
├── /news/*                   # 新闻浏览 (SSR)
├── /about                    # 关于页面 (SSR)
├── admin.tsx                 # 管理端 Layout Route (SSR=false)
│   ├── admin/init.tsx        # 系统初始化
│   ├── admin/login.tsx       # 管理员登录
│   ├── admin/forgot-password.tsx  # 管理端忘记密码
│   └── admin/_admin.tsx      # 管理端鉴权布局 (beforeLoad)
│       ├── /                 # 仪表盘
│       ├── news/             # 新闻管理
│       ├── users/admins/     # 管理员用户
│       ├── users/clients/    # 客户端用户
│       ├── admin-roles/      # 管理端角色管理
│       ├── dicts/            # 字典管理
│       ├── config/           # 系统配置
│       ├── files/            # 文件管理
│       ├── logs/             # 日志查询
│       ├── operation-logs/   # 操作日志审计
│       ├── translations/     # 翻译管理
│       ├── track/            # 埋点分析
│       └── demo/             # 组件演示
└── api/download/             # 文件/日志下载 API
```

### 4. 中间件执行链路

```
requestMiddleware                    functionMiddleware
┌───────────────────────┐     ┌─────────────────────────┐
│ localeMiddleware      │ →   │ sfErrorLogger           │
│ createCsrfMiddleware  │     │ (异常捕获 + 日志记录)     │
│ (仅 ServerFn)         │     └─────────────────────────┘
└───────────────────────┘
         │
         ▼
  createServerFn
  ┌───────────────────────┐
  │ .middleware([         │
  │   adminPermGuard()    │  ← 管理端 SFn 鉴权
  │ ])                    │
  │ .handler(async () => {│
  │   // 业务逻辑          │
  │ })                    │
  └───────────────────────┘
```

### 5. 缓存分层

```
┌─────────────────────────────────────────────┐
│           MemoryCache<T> (通用基类)           │
│  基于 Map，支持 TTL 过期、命名空间              │
│  @fsdx/core/cache-core                       │
├─────────────────────────────────────────────┤
│  dictCache          字典标签/颜色映射          │
│  configCache        系统配置全量缓存            │
│  uiTranslationCache  UI 翻译 (按 locale)       │
│  configTranslationCache  配置翻译 (按 locale)  │
│  clientUserCache    客户端用户 (TTL 5 分钟)     │
│  adminUserCache     管理员用户 (TTL 5 分钟)     │
│  trackEventMetaCache   元事件名校验              │
│  trackPropertyMetaCache 元属性类型校验            │
└─────────────────────────────────────────────┘
```

缓存实例按模块拆分在 `services/<module>/<module>.cache.ts`，每个实例只能在唯一服务模块中直接操作，详见 [缓存体系](cache-system.md)。

### 6. 缓冲写入策略

两类数据采用相同的缓冲写入模式：

```
Fire-and-forget 调用
        │
        ▼
┌──────────────────┐
│  内存缓冲队列      │  上限 1000 条，超出丢弃最旧
└──────┬───────────┘
       │  触发条件:
       │  • 满 100 条 → 立即批量 INSERT
       │  • 每 5 秒 → 定时刷新
       │  • SIGTERM/SIGINT → 强制刷新
       ▼
  PostgreSQL
```

应用场景：
- **事件埋点** (`trackEvent()`) — `src/services/track/track.server.ts`
- **操作日志** (`logOperation()`) — `src/services/operation-log/operation-log.server.ts`

## 数据流全景

```
用户操作 → 客户端埋点 SDK (track.ts)
    │
    ├─ trackEventSFn() ──→ track.functions.ts
    │                           │
    │                     track.server.ts
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
| `src/lib/` | 应用级基础设施单例壳 + 客户端 SDK | 全部 | 仅 jwt/logger/track 三个薄壳，其余基础库在 `@fsdx/core` |
| `src/services/` | 服务端业务逻辑 | routes/, services/ 自身 | `.server.ts` 禁止使用 `SFn` 后缀 |
| `src/routes/` | 路由页面 + SFn 包装 | — | SFn 必须用 `.validator(zod)` |
| `src/middleware/` | 请求级中间件 | start.ts, routes/ | — |
| `src/components/` | React 组件 | 全部 | admin/ 用 antd, client/ 用 shadcn/ui |
| `src/db/` | 数据库 Schema | services/ | 客户端禁止导入 (importProtection) |
| `services/*/*.cache.ts` | 内存缓存实例 | 仅所属模块 | 每个实例只能在唯一服务模块中直接操作 |

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `server.ts` (根目录) | Nitro 服务入口，bootstrap + Hono 代理 |
| `src/bootstrap.ts` | 启动初始化（env、预置数据、定时任务、优雅关闭） |
| `src/hono-app.ts` | Hono 应用工厂（/health 路由） |
| `src/server.ts` | TanStack Start 服务端入口（createServerEntry） |
| `src/start.ts` | 全局中间件注册（locale + CSRF + sfErrorLogger） |
| `src/router.tsx` | TanStack Router 实例 |
| `src/routes/__root.tsx` | 根布局（AdminLayout / SSRLayout 分支） |
| `packages/core/README.md` | @fsdx/core 导出清单与边界 |
| `packages/ui-ssr/README.md` | @fsdx/ui-ssr 组件清单与集成约定 |
| `packages/ui-spa/README.md` | @fsdx/ui-spa 组件清单与集成约定 |
| `docs/auth-permission-model.md` | 认证与权限模型详细文档 |
| `docs/database-design.md` | 数据库设计文档 |
| `docs/cache-system.md` | 缓存体系文档 |
| `docs/event-tracking.md` | 事件埋点文档 |
| `docs/deployment-ops.md` | 部署运维文档 |

---
name: architecture
description: >
  项目架构与分层规范。当需要理解或修改项目的目录分层、基础设施（缓存/请求上下文/批量缓冲/埋点/审计）、
  模块归属（lib vs services vs routes），或评估某段代码该放哪里时触发。
---

# 架构规范

## 目录分层

| 目录 | 定位 | 示例 |
|------|------|------|
| `packages/core/` | 纯逻辑库（同构工具 + 服务端基础设施） | `@fsdx/core/cache-core`、`@fsdx/core/ms`、`@fsdx/core/logger` |
| `packages/ui-ssr/` | shadcn 基础组件（前台 SSR） | `@fsdx/ui-ssr/ui`、`@fsdx/ui-ssr/theme` |
| `packages/ui-spa/` | antd 管理端组件（antd 单实例） | `@fsdx/ui-spa/table`、`@fsdx/ui-spa/upload` |
| `src/lib/` | 应用级基础设施单例壳 + 客户端 SDK | `src/lib/logger/logger.ts`、`src/lib/jwt/jwt.ts`、`src/lib/metrics/metrics.ts`、`src/lib/track/track.ts` |
| `src/services/` | 领域服务层（`server` 业务逻辑 + `schemas` zod + `cache` + `types`）+ 跨端共享 SFn | `src/services/news/`、`src/services/query/`、`src/services/admin-auth/` |
| `src/constants/` | 项目级常量 | `src/constants/editor-types.ts` |
| `src/validators/` | 跨模块共享的 zod schema | `src/validators/common.schemas.ts` |
| `src/types/` | 跨模块共享类型 | `src/types/query.ts` |
| `src/middleware/` | 请求级中间件（鉴权/权限/locale/错误日志） | `src/middleware/admin-auth.ts` |
| `src/routes/` | 路由层（页面 + UI 组件 + 就近 SFn + beforeLoad 守卫） | `src/routes/admin/_admin/news/` |

**依赖方向**：`routes → services → (core 基础库) → db`，服务层不得反向依赖表现层——`services/**` **禁止** import `routes/**`（含路由 `-mods/`、路由组件与路由局部 schema）；services 的上游仅限表现层入口（routes / middleware / bootstrap / lib SDK）与服务间协作（如 `logCrud`、`query-utils`）。`src/lib/` 禁止引入业务逻辑。`services/<module>/` 是领域服务层的归属：`server`（业务逻辑/DB）+ `schemas`（zod 单一来源，server 用 `z.infer` 派生）+ `cache` + `types`；跨端共享的 SFn（auth/captcha/track/message/...）也可留在 services。`routes/**/-mods/` 放 UI 组件与**就近的 SFn**（SFn + 路由局部 schema 随页面），页面通过 SFn 调服务层，禁止直接 import `*.server.ts`。

> 每个子包的导出清单与边界见 [core](../../../packages/core/README.md) / [ui-ssr](../../../packages/ui-ssr/README.md) / [ui-spa](../../../packages/ui-spa/README.md)。

## 基础设施

### 请求上下文（AsyncLocalStorage）

- `@fsdx/core/request-context`：`runWithRequestContext` / `getRequestContext` / `getRequestOperator`
- 鉴权中间件（admin/client）验证身份后用 `runWithRequestContext({ operator })` 包裹 `next()`；`requestIdMiddleware`（requestMiddleware 首位）用 `runWithRequestContext({ requestId })` 注入请求 ID
- 下游所有异步调用通过 `getRequestOperator()` 读取当前操作者；无上下文（cron/后台任务）兜底返回 system
- 消费方：`logExternalRequest()` 记录外部系统调用时从 ALS 读操作者；`operation_log.request_id` 从 ALS 捕获实现全链路追踪

### 可观测性（请求 ID + Prometheus）

- **请求 ID**：`src/middleware/request-id.ts` 透传/生成 `x-request-id`（超长截断至 100），写 ALS + 回写响应头；logger mixin 自动注入 requestId
- **Prometheus 指标**：`src/lib/metrics/metrics.ts` 进程内注册表（`Counter` + `Histogram`），预置 `http_requests_total` / `server_function_requests_total` / `server_function_duration_seconds`；`/api/metrics` 端点（Server Route，无鉴权）；新增指标须在该模块注册并同步 docs/architecture-overview.md 与 docs/deployment-ops.md

### 批量缓冲写入（BatchWriter）

- `@fsdx/core/batch-writer`：通用缓冲写入器（定时/定量批量 INSERT + 容量上限 + shutdown 强制刷新）
- track 埋点与 operation-log 复用；CRUD 审计与外部调用日志使用独立 writer（互不挤压）
- **禁止**在模块内重复实现缓冲逻辑；新增高频写入场景优先复用 BatchWriter

### 操作日志审计

- `src/services/operation-log/operation-log.server.ts`：`logOperation()` fire-and-forget；SFn 写 CRUD 审计**必须**用 `logCrud()` 一行式封装（自动装配操作人 + targetType 默认值）
- CRUD 审计与外部调用日志独立 writer：CRUD 缓冲上限 1000，外部调用上限 5000
- 操作者身份经 request-context（AsyncLocalStorage）由鉴权中间件注入，无上下文兜底 system；requestId 自动从 ALS 捕获落库（`operation_log.request_id`），实现日志与审计全链路追踪
- `logExternalRequest()` 落库字段语义：`module` = 外部系统标识（调用方传入自身系统代号），`action` = `login` / `request`（按请求类型），`targetType` = 接口来源类型（默认 `openapi`），`targetName` = 接口路径，`detail` 含系统/路径/方法/耗时/成功与否等元数据（不含请求响应体）
- 进程退出时自动刷新缓冲（SIGTERM / SIGINT）

### 内存缓存

- `MemoryCache<T>` 在 `@fsdx/core/cache-core`，实例按模块拆分在 `services/<module>/<module>.cache.ts`
- 每个实例只能在唯一服务模块中直接操作，禁止跨模块 import 缓存实例
- 读缓存必须懒加载：cache miss → 查库 → 写缓存 → 返回
- 详见 [cache](../cache/SKILL.md)

### antd 静态方法桥接

- 管理端 `message`/`modal`/`notification` 统一从 `@fsdx/ui-spa/antd-static` 导入
- **禁止**静态 `import { message } from "antd"`（独立 root 会脱离 StyleProvider layer 与 ConfigProvider 主题）
- `AntdStaticBridge` 已挂载在管理端 `<App>` 内，从 `App.useApp()` 捕获实例
- 调用必须发生在 App 挂载后的交互/副作用中；loader/beforeLoad 阶段调用会抛错（宁抛错不静默）

## Schema 单一来源

- 有入参 SFn 的 zod schema 统一定义在 `.schemas.ts` 文件
- 服务层输入类型用 `z.infer<typeof schema>` 派生，**禁止**手写重复接口 + `as XxxInput` 桥接断言
- 跨路由共享的 schema 放 `src/services/<module>/<module>.schemas.ts`；跨模块共享的放 `src/validators/`

```ts
// ✅ 正确：schema 单一来源，服务层类型派生
export type CreateNewsInput = z.infer<typeof createNewsSchema>;
export function createNews(input: CreateNewsInput) { ... }

// ❌ 错误：手写接口 + as 断言桥接
export interface CreateNewsInput { title: string; ... }
const result = createNews(data as CreateNewsInput);
```

## 违规自查

- 领域实体的 `server`/`schemas`/`cache`/`types` 拆在路由 `-mods/` 里 → 收编到 `services/<module>/`，服务层只保留一处归属
- 实体的 SFn 应就近放在消费页面的路由 `-mods/`，未在页面消费的跨端共享 SFn 才留在 services
- `.functions.ts` handler 中出现 DB 查询/业务逻辑 → 提取到 `.server.ts`
- `lib/` 中出现业务常量/业务类型 → 移到 `constants/` 或 `services/`
- 跨模块直接 `import` 缓存实例 → 改为所属模块导出函数

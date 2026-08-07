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
| `src/lib/` | 无业务逻辑的基础库（缓存、jwt、logger、request-context、batch-writer、i18n 等） | `src/lib/cache/core.ts` |
| `src/services/` | 跨模块共享的服务端业务逻辑（**仅放被 ≥2 个消费者复用的代码**） | `src/services/track/track.server.ts` |
| `src/constants/` | 项目级常量 | `src/constants/editor-types.ts` |
| `src/validators/` | 跨模块共享的 zod schema | `src/validators/common.schemas.ts` |
| `src/utils/` | 纯工具函数（无依赖） | `src/utils/cn.ts` |
| `src/types/` | 跨模块共享类型 | `src/types/query.ts` |
| `src/middleware/` | 请求级中间件（鉴权/权限/locale/错误日志） | `src/middleware/admin-auth.ts` |
| `src/routes/` | 路由层（页面 + 路由级 SFn + beforeLoad 守卫） | `src/routes/admin/_admin/news/` |

**依赖方向**：`routes → services → lib → db`。`lib/` 禁止引入业务逻辑；单路由私有的服务逻辑内聚在路由 `-mods/`，不上提到 `services/`（渐进式提取）。

## 基础设施

### 请求上下文（AsyncLocalStorage）

- `src/lib/request-context/request-context.ts`：`runWithRequestContext` / `getRequestContext` / `getRequestOperator`
- 鉴权中间件（admin/client）验证身份后用 `runWithRequestContext({ operator })` 包裹 `next()`
- 下游所有异步调用通过 `getRequestOperator()` 读取当前操作者；无上下文（cron/后台任务）兜底返回 system
- 消费方：`logExternalRequest()` 记录外部系统调用时从 ALS 读操作者

### 批量缓冲写入（BatchWriter）

- `src/lib/buffer/batch-writer.ts`：通用缓冲写入器（定时/定量批量 INSERT + 容量上限 + shutdown 强制刷新）
- track 埋点与 operation-log 复用；CRUD 审计与外部调用日志使用独立 writer（互不挤压）
- **禁止**在模块内重复实现缓冲逻辑；新增高频写入场景优先复用 BatchWriter

### 内存缓存

- `MemoryCache<T>` 在 `src/lib/cache/core.ts`，实例按模块拆分在 `src/lib/cache/*.cache.ts`
- 每个实例只能在唯一服务模块中直接操作，禁止跨模块 import 缓存实例
- 读缓存必须懒加载：cache miss → 查库 → 写缓存 → 返回
- 详见 [cache](.agents/skills/cache/SKILL.md)

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

- `services/` 中出现只被 1 个消费者使用的模块 → 下移到路由 `-mods/`
- `.functions.ts` handler 中出现 DB 查询/业务逻辑 → 提取到 `.server.ts`
- `lib/` 中出现业务常量/业务类型 → 移到 `constants/` 或 `services/`
- 跨模块直接 `import` 缓存实例 → 改为所属模块导出函数

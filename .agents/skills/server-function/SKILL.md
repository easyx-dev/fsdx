---
name: server-function
description: >
  Server Function 开发指南。当需要创建新的 Server Function、添加 API 端点、
  编写 SFn handler、或区分 .server.ts / .functions.ts 文件职责时触发。
---

# Server Function 开发

## 三层文件分离

项目中与 Server Function 相关的代码按职责严格分离到三种后缀文件：

| 后缀 | 职责 | 包含 createServerFn？ | SFn 后缀？ | 可被谁导入 |
|------|------|----------------------|-----------|-----------|
| `.server.ts` | 纯 DB 查询、业务逻辑 | ❌ 禁止 | ❌ 禁止 | 仅 `.functions.ts` 和 `.server.ts` 之间 |
| `.functions.ts` | `createServerFn` 包装器（RPC 接口） | ✅ 必须 | ✅ 必须 | 任何位置 |
| `.ts` | 类型、常量、Zod Schema | ❌ 无 | ❌ 无 | 任何位置 |

### 决策流程

```
需要对外暴露的 API？
├── 是 → 创建 .functions.ts，用 createServerFn 包装，函数名以 SFn 结尾
│        handler 内部调用 .server.ts 的辅助函数
└── 否 → 创建 .server.ts，纯 async 函数，无 createServerFn

需要共享的类型/Zod Schema？
├── 被服务层 `z.infer` 派生或跨端复用 → 放在 src/services/<module>/<module>.schemas.ts（单一来源）
└── 纯路由局部（仅随 SFn 校验） → 可随 SFn 留在路由 -mods/ 内
```

## SFn 后缀规则

**强制规则**：所有 `createServerFn` 返回的变量名**必须**以 `SFn` 结尾。

```ts
// ✅ createServerFn → 必须以 SFn 结尾
export const getNewsListSFn = createServerFn({ method: "GET" })
  .handler(async () => {});
export const createNewsSFn = createServerFn({ method: "POST" })
  .handler(async () => {});

// ❌ .server.ts 中的普通函数 → 禁止 SFn 后缀
export async function getNewsList(params) { /* ... */ }  // 不是 SFn
export async function createNews(data) { /* ... */ }     // 不是 SFn
```

## Schema 单一来源

有入参 SFn 的 zod schema 统一定义在 `.schemas.ts` 文件。**被服务层 `z.infer` 派生或跨端复用的 schema 放 `src/services/<module>/<module>.schemas.ts`**（单一来源，禁止手写接口 + `as XxxInput` 桥接）；纯路由局部 schema（仅随某个 SFn 校验、无 `z.infer` 耦合）可随 SFn 留在路由 `-mods/`。

```ts
// services/news/news.schemas.ts —— 需要服务层 z.infer 时放这里
export const createNewsSchema = z.object({ title: z.string().min(1), ... });

// services/news/news.server.ts
export type CreateNewsInput = z.infer<typeof createNewsSchema>;
export function createNews(input: CreateNewsInput) { ... }

// routes/.../-mods/news.functions.ts —— 直接传 data，无需 as 断言
.handler(async ({ data }) => createNews(data));
```

## SFn 标准模板

### SFn 就近放路由 -mods/

SFn（RPC 边界）就近放在**消费它的页面**的 `-mods/` 下，随页面组织；schema 从 services 的 `.schemas.ts` 导入（纯路由局部 schema 可内联），业务逻辑从 services 的 `.server.ts` 导入。同一实体被管理端 + 前台两端消费时，SFn 各自拆到对应端的路由 `-mods/`（`routes/admin/_admin/<module>/-mods/` 与 `routes/<module>/-mods/`），仅无页面消费的跨端共享 SFn 才留在 `services/<module>/<module>.functions.ts`。

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
  getProductList,
  getProductById,
  deleteProduct,
} from "#/services/product/product.server";
import { logCrud } from "#/services/operation-log/operation-log.server";

// ── Zod Schema ──
const listSchema = z.object({
  status: z.string().optional(),
  page: z.number().optional(),
  sortField: z.string().optional(),
  sortOrder: z.enum(["ascend", "descend"]).optional(),
});

const idSchema = z.object({ id: z.string().min(1) });

// ── SFn 定义 ──
const getProductListSFn = createServerFn({ method: "GET" })
  .middleware([adminPermGuard(ADMIN_PERMISSIONS.PRODUCT_VIEW)])
  .validator(listSchema)
  .handler(async ({ data: { status, page = 1, sortField, sortOrder } }) => {
    return getProductList({ status, page, pageSize: 20, sortField, sortOrder });
  });

const deleteProductSFn = createServerFn({ method: "POST" })
  .middleware([adminPermGuard(ADMIN_PERMISSIONS.PRODUCT_DELETE)])
  .validator(idSchema)
  .handler(async ({ data: { id }, context }) => {
    const record = await getProductById(id);
    await deleteProduct(id);
    logCrud(context.user, "product", "delete", { id: id, name: record?.name ?? id });
    return { success: true };
  });
```

> 上面的 `listSchema`/`idSchema` 是纯路由局部 schema，内联即可；若 schema 需被服务层 `z.infer` 派生或跨端复用，则从 `#/services/<module>/<module>.schemas` 导入。

## 目录组织规则

`src/lib/` 和 `src/services/` 下**禁止**直接放置文件，所有模块必须组织到独立子目录中：

- `news/news.server.ts`（✅ 正确）
- `news.ts`（❌ 错误）
- 子目录内文件名与目录名对应（如 `news/news.server.ts`）

混合 barrel（同时导出类型和运行时值）应拆分：类型走 `.types.ts`，运行时值走 `.server.ts` 或 `.functions.ts`。

## 服务层归属

`services/<module>/` 的归属依据是「是否为一个独立的领域实体或跨切面基础设施」，**不是消费者数量**。服务层（server/schemas/cache/types）完整收编于此：

| 场景 | 位置 |
|------|------|
| 领域实体服务层（news/dict/config/file/message/track/user/role/...） | `src/services/<module>/`：`server` + `schemas`（z.infer 派生）+ `cache` + `types` |
| 跨切面基础设施（query/operation-log/download/logs/tasks/i18n/captcha/auth/init） | `src/services/<module>/` |
| 实体/页面 SFn（RPC 边界） | 就近放消费页面的路由 `-mods/<name>.functions.ts` |
| 跨端共享、无页面消费的 SFn（auth/captcha/track SDK/message/dict 选项/客户端可见配置/初始化状态） | `src/services/<module>/<module>.functions.ts` |

**硬规则**：
- 实体的 CRUD/导入导出/查询全部收编进 `services/<module>/<module>.server.ts`，禁止拆到路由
- 被服务层 `z.infer` 派生或跨端复用的 schema 收编进 `services/<module>/<module>.schemas.ts`；纯路由局部 schema 可随 SFn 留在路由
- 实体/页面 SFn 就近放路由 `-mods/`；跨端共享、无页面消费的 SFn 才留在 services

## Server Route 例外

文件读取/下载/流式响应路由（如 `routes/file/r.$id.tsx`、`routes/admin/_admin/logs/download.$id.tsx`、`routes/admin/_admin/file-explorer/download.$.tsx`）允许在 `.tsx` 内通过 `server.handlers` 直接写服务端 handler 并引用 `.server.ts`——这是 TanStack Start Server Route 的合法形态，与 SFn 是两套并存范式，**不适用**「SFn 必须放 `.functions.ts`」规则。

下载路由统一通过 `services/download/download.server.ts` 的 `createFileDownloadResponse(source, { filename, mimeType, disposition })` 构造响应（Content-Disposition 走 RFC 5987 `filename*=UTF-8''`），避免各路由重复手写流式转换与头部编码。


## Handler 内部模式

### 必须做的

- **通过 throw 传播错误**：错误会被全局 `sfErrorLogger` 捕获并传播到客户端
- **写操作必须调用 `logCrud()`**：一行式审计封装，fire-and-forget，同步返回，不阻塞业务
- **`context.user` 可安全使用**：`adminPermGuard` 已注入用户信息和权限

```ts
.handler(async ({ data, context }) => {
  // ✅ 直接使用 context.user
  const record = await createProduct({ ...data, createdById: context.user.id });

  // ✅ fire-and-forget 操作审计（自动装配操作人 + targetType）
  logCrud(context.user, "product", "create", {
    id: record.id,
    name: record.name,
  });

  return record;
})
```

### 禁止做的

| 错误模式 | 正确做法 |
|---------|---------|
| `try/catch` 后 `return null` | 抛出错误，让客户端 `catch` 处理 |
| 空 `catch` 块 `catch {}` | 至少 `logger.error` 记录日志 |
| `catch` 后用 `message.error()` | SSR 环境无 DOM，用 `throw` |

```ts
// ❌ 错误：静默吞掉错误
.handler(async ({ data }) => {
  try {
    return await getProductById(data.id);
  } catch {
    return null;  // 前端无法区分"不存在"和"异常"
  }
})

// ✅ 正确：让错误自然传播
.handler(async ({ data }) => {
  return getProductById(data.id);  // 不存在会抛错，前端 catch 处理
})
```

## SFn 调用方模式

### 管理端（`/admin/*`）

```tsx
// 使用 antd message 反馈
async function handleDelete(id: string) {
  try {
    await deleteProductSFn({ data: { id } });
    message.success("删除成功");
    refresh();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "删除失败");
  }
}
```

### 前台 SSR（非 `/admin/*`）

`<Toaster>` 挂载在 `SSRRootDocument` 中，配置 `position="top-center" richColors`。`richColors` 自动为 error 类型着红色。

```tsx
// loader：静默返回降级值 + errorComponent
loader: async () => {
  try {
    return await getNewsListSFn({ data: {} });
  } catch (err) {
    console.error(err);
    return { records: [], total: 0, page: 1, pageSize: 20 };
  }
},
errorComponent: ({ error }) => <ErrorDisplay error={error} />,

// 表单提交：sonner toast 反馈
async function handleSubmit() {
  try {
    await loginSFn({ data: values });
    toast.success("登录成功");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "操作失败");
  }
}
```

## Import 边界完整规则

| 源文件后缀 | → `.server.ts` | → `.functions.ts` | → 路由/组件 | → `.ts`（类型/schema） |
|-----------|---------------|-------------------|------------|----------------------|
| `.server.ts` | ✅ 允许 | ✅ 允许 | ❌ 禁止 | ✅ 允许 |
| `.functions.ts` | ✅ 允许（handler 内调用，客户端构建时被剥离） | ✅ 允许 | ✅ 允许 | ✅ 允许 |
| `.ts` | ✅ 允许 | ✅ 允许 | ✅ 允许 | ✅ 允许 |

**关键规则**：路由文件和组件**禁止**直接 import `.server.ts`。有两种正确方式：
1. 通过 `.functions.ts` 的 SFn 包装（全局复用）
2. 在路由文件中创建局部 SFn，handler 内调用 `.server.ts`（编译器会在客户端构建时移除 handler）

`.server.ts` 允许 import 类型/schema（`.ts` 后缀文件），如 `z.infer` 派生输入类型 —— 这属于类型导入，不违反「路由层禁止直接调服务层」的运行时边界。

## 全局错误日志

所有 SFn 自动被 `src/middleware/sf-error-logger.ts` 覆盖，无需手动在 handler 中添加错误日志：

- 鉴权失败（`AdminAuthError` / `ApiAuthError`）→ `logger.warn`
- 系统异常 → `logger.error`（脱敏后记录）
- 错误始终重新抛出，保证客户端能 `catch` 到

## 常见违规自查

| 问题 | 检查方式 |
|------|---------|
| SFn 后缀用在了 .server.ts 函数上 | 搜索 `.server.ts` 中的 `SFn` |
| handler 返回 null | 检查 handler 中是否有 `return null` |
| 空 catch 块 | 搜索 `catch {}` 或 `catch () {}` |
| 路由直接 import .server.ts | 检查路由文件中的 import 是否含 `.server` |
| .server.ts 中使用了 createServerFn | `.server.ts` 不应出现 `createServerFn` |
| 实体 server/schemas/cache 拆在路由 `-mods/` | 服务层应统一收编进 `services/<module>/` |
| 有页面消费的 SFn 堆在 services（未就近放路由） | SFn 应就近放消费页面的 `-mods/`，仅跨端共享无页面消费的留 services |

## 相关 Skill

- 权限中间件 → [permission](../permission/SKILL.md)
- 创建完整 CRUD → [admin-crud](../admin-crud/SKILL.md)
- 测试 SFn → [test-writing](../test-writing/SKILL.md)

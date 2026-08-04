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
├── 与特定路由绑定 → 放在路由的 -mods/ 目录下（如 -mods/news.schemas.ts）
└── 全局可用 → 放在 src/services/<module>/ 下（如 config.types.ts）
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

## SFn 标准模板

### 路由内 SFn（页面局部）

用于列表页的查询/删除/状态变更等仅当前页面使用的操作。

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
  getProductList,
  getProductById,
  deleteProduct,
} from "#/services/product/product.server";
import { logOperation } from "#/services/operation-log/operation-log.server";

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
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_VIEW)])
  .inputValidator(listSchema)
  .handler(async ({ data: { status, page = 1, sortField, sortOrder } }) => {
    return getProductList({ status, page, pageSize: 20, sortField, sortOrder });
  });

const deleteProductSFn = createServerFn({ method: "POST" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_DELETE)])
  .inputValidator(idSchema)
  .handler(async ({ data: { id }, context }) => {
    const record = await getProductById(id);
    await deleteProduct(id);
    logOperation({
      operatorId: context.user.id,
      operatorName: context.user.username,
      module: "product",
      action: "delete",
      targetType: "product",
      targetId: id,
      targetName: record?.name ?? id,
    });
    return { success: true };
  });
```

### -mods/ 共享 SFn（create / update / getById）

用于创建/编辑/详情页面共用的表单操作。

```ts
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
  createProduct,
  getProductById,
  updateProduct,
} from "#/services/product/product.server";
import { logOperation } from "#/services/operation-log/operation-log.server";
import {
  createProductSchema,
  getProductSchema,
  updateProductSchema,
} from "./product.schemas";

export const getProductByIdSFn = createServerFn({ method: "GET" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_VIEW)])
  .inputValidator(getProductSchema)
  .handler(async ({ data: { id } }) => {
    return getProductById(id);
  });

export const createProductSFn = createServerFn({ method: "POST" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_CREATE)])
  .inputValidator(createProductSchema)
  .handler(async ({ data, context }) => {
    const record = await createProduct({
      ...data,
      createdById: context.user.id,
    });
    logOperation({
      operatorId: context.user.id,
      operatorName: context.user.username,
      module: "product",
      action: "create",
      targetType: "product",
      targetId: record.id,
      targetName: record.name,
    });
    return record;
  });

export const updateProductSFn = createServerFn({ method: "POST" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_EDIT)])
  .inputValidator(updateProductSchema)
  .handler(async ({ data, context }) => {
    const record = await updateProduct(data.id, { ...data });
    logOperation({
      operatorId: context.user.id,
      operatorName: context.user.username,
      module: "product",
      action: "update",
      targetType: "product",
      targetId: data.id,
      targetName: data.name,
    });
    return record;
  });
```

### 全局 .functions.ts SFn（跨页面功能）

仅当 SFn 需要被多个路由复用、且不属于表单操作时才放在 `src/services/<module>/<module>.functions.ts`。典型场景：导出。

```ts
// src/services/product/product.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toCsv, toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getAllProductsForExport, PRODUCT_EXPORT_COLUMNS } from "./product.server";

const exportSchema = z.object({ format: z.enum(["csv", "json"]) });

export const exportProductsSFn = createServerFn({ method: "GET" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_EXPORT)])
  .inputValidator(exportSchema)
  .handler(async ({ data: { format } }) => {
    const records = await getAllProductsForExport();
    if (format === "csv") {
      return {
        format: "csv" as const,
        content: toCsv(records, PRODUCT_EXPORT_COLUMNS),
      };
    }
    return { format: "json" as const, content: toJson(records) };
  });
```

## 目录组织规则

`src/lib/` 和 `src/services/` 下**禁止**直接放置文件，所有模块必须组织到独立子目录中：

- `lib/permissions/permissions.ts`（✅ 正确）
- `lib/permissions.ts`（❌ 错误）
- 子目录内文件名与目录名对应（如 `permissions/permissions.ts`）

混合 barrel（同时导出类型和运行时值）应拆分：类型走 `.types.ts`，运行时值走 `.server.ts` 或 `.functions.ts`。


## Handler 内部模式

### 必须做的

- **通过 throw 传播错误**：错误会被全局 `sfErrorLogger` 捕获并传播到客户端
- **写操作必须调用 `logOperation()`**：fire-and-forget，同步返回，不阻塞业务
- **`context.user` 可安全使用**：`adminPermGuard` 已注入用户信息和权限

```ts
.handler(async ({ data, context }) => {
  // ✅ 直接使用 context.user
  const record = await createProduct({ ...data, createdById: context.user.id });

  // ✅ fire-and-forget 操作日志
  logOperation({
    operatorId: context.user.id,
    operatorName: context.user.username,
    module: "product",
    action: "create",
    targetType: "product",
    targetId: record.id,
    targetName: record.name,
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

| 源文件后缀 | → `.server.ts` | → `.functions.ts` | → 路由/组件 | → `.ts` |
|-----------|---------------|-------------------|------------|--------|
| `.server.ts` | ✅ 允许 | ✅ 允许 | ❌ 禁止 | ❌ 禁止 |
| `.functions.ts` | ❌ 禁止 | ✅ 允许 | ✅ 允许 | ✅ 允许 |
| `.ts` | ✅ 允许 | ✅ 允许 | ✅ 允许 | ✅ 允许 |

**关键规则**：路由文件和组件**禁止**直接 import `.server.ts`。有两种正确方式：
1. 通过 `.functions.ts` 的 SFn 包装（全局复用）
2. 在路由文件中创建局部 SFn，handler 内调用 `.server.ts`（编译器会在客户端构建时移除 handler）

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

## 相关 Skill

- 权限中间件 → [permission](../permission/SKILL.md)
- 创建完整 CRUD → [admin-crud](../admin-crud/SKILL.md)
- 测试 SFn → [test-writing](../test-writing/SKILL.md)

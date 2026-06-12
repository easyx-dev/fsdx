---
name: permission
description: >
  权限系统开发指南。当需要新增权限码、为新模块添加访问控制、
  理解 RBAC 权限模型、或在 SFn 中使用 adminPermGuard 时触发。
---

# 权限系统

## RBAC 模型概述

```
admin_user ──► role ──► permissions（jsonb string[]）
                             │
                             ├── **           （root 用户自动拥有）
                             ├── module:view  （精确匹配）
                             ├── module:*     （分组通配符）
                             └── ...
```

- **Root 用户**：`admin_user.is_root === true` → 自动拥有 `**` 权限，不查角色表
- **普通管理员**：通过 `role_id` 关联角色，角色的 `permissions` 字段（jsonb）存储权限码数组
- **权限匹配优先级**：`**`（超级通配符）→ 精确匹配 → `group:*`（分组通配符）

## PermissionDef 数据结构

```ts
// src/lib/permissions/permissions.ts
{
  code: "news:view",   // 权限码，格式 {module}:{action}
  name: "查看新闻",     // 中文名称，在角色编辑页面展示
  desc: "允许查看新闻列表和详情",  // 详细说明
  group: "news",        // 分组，由 code 的 ":" 前缀自动推导
}
```

`group` 字段用于管理端角色编辑页面的分组展示（基于 `PERMISSIONS_BY_GROUP`）。

## 新增权限码完整流程

### Step 1：在 `permissions.ts` 中添加权限码

编辑 `src/lib/permissions/permissions.ts`，在 `PERMISSIONS` 对象中按模块分组追加：

```ts
export const PERMISSIONS = {
  // ... 已有权限码 ...

  // 产品管理
  PRODUCT_VIEW: definePermission(
    "product:view",
    "查看产品",
    "允许查看产品列表和详情",
  ),
  PRODUCT_CREATE: definePermission(
    "product:create",
    "创建产品",
    "允许创建新的产品",
  ),
  PRODUCT_EDIT: definePermission(
    "product:edit",
    "编辑产品",
    "允许编辑已有产品的内容",
  ),
  PRODUCT_DELETE: definePermission(
    "product:delete",
    "删除产品",
    "允许删除产品（软删除）",
  ),
} as const;
```

### Step 2：在 SFn 中使用权限

> 详细规范参考 [server-function](../server-function/SKILL.md)

```ts
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";

export const getProductListSFn = createServerFn({ method: "GET" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_VIEW)])
  .inputValidator(listSchema)
  .handler(async ({ data }) => { /* ... */ });

export const createProductSFn = createServerFn({ method: "POST" })
  .middleware([adminPermGuard(PERMISSIONS.PRODUCT_CREATE)])
  .inputValidator(createSchema)
  .handler(async ({ data, context }) => { /* ... */ });
```

### Step 3：角色编辑页面自动生效

管理端角色编辑页面（`/admin/roles`）基于 `PERMISSIONS_BY_GROUP` 自动渲染所有权限码的复选框，无需手动添加 UI。新增的权限码会自动出现在对应分组下。

### Step 4：UI 条件渲染（可选）

如果需要在管理端页面中根据权限控制按钮显隐：

```tsx
import { hasPermission, PERMISSIONS } from "#/lib/permissions/permissions";

function AdminPage() {
  const { rolePermissions } = useAdminAuth();

  return (
    <>
      {hasPermission(rolePermissions, PERMISSIONS.PRODUCT_CREATE) && (
        <Button type="primary">新建产品</Button>
      )}
    </>
  );
}
```

## 标准权限集建议

| 操作 | 权限码格式 | definePermission 示例 | 说明 |
|------|-----------|----------------------|------|
| 查看 | `xxx:view` | `("xxx:view", "查看XXX", "...")` | 列表页、详情 |
| 创建 | `xxx:create` | `("xxx:create", "创建XXX", "...")` | 新建表单 |
| 编辑 | `xxx:edit` | `("xxx:edit", "编辑XXX", "...")` | 编辑表单 |
| 删除 | `xxx:delete` | `("xxx:delete", "删除XXX", "...")` | 软删除操作 |

**可选扩展**（按需添加）：

| 操作 | 权限码格式 | 使用场景 |
|------|-----------|---------|
| 发布 | `xxx:publish` | 状态变更（发布/下架/归档） |
| 导出 | `xxx:export` | 导出为 CSV/JSON |
| 导入 | `xxx:import` | 从文件导入 |
| 管理 | `xxx:manage` | 统管编辑 + 删除 + 状态变更等写操作 |

## 权限匹配逻辑

```ts
// src/lib/permissions/permissions.ts — matchPermission()
// 优先级：** → 精确匹配 → group:*

// 1. ** 超级通配符（root 用户）
rolePermissions = ["**"];
matchPermission(rolePermissions, "news:edit");  // ✅ true

// 2. 精确匹配
rolePermissions = ["news:view", "news:edit"];
matchPermission(rolePermissions, "news:edit");  // ✅ true

// 3. 分组通配符 module:*
rolePermissions = ["news:*"];
matchPermission(rolePermissions, "news:edit");  // ✅ true
matchPermission(rolePermissions, "news:delete"); // ✅ true
matchPermission(rolePermissions, "admin:view");  // ❌ false（不同分组）
```

## 权限校验函数速查

| 函数 | 签名 | 使用场景 |
|------|------|---------|
| `hasPermission` | `(rolePermissions, required) => boolean` | 检查单个权限 |
| `hasAnyPermission` | `(rolePermissions, required[]) => boolean` | 检查是否拥有**任一**权限 |
| `hasAllPermissions` | `(rolePermissions, required[]) => boolean` | 检查是否拥有**全部**权限 |

```ts
// 单个按钮：任一权限
{hasAnyPermission(rolePermissions, [
  PERMISSIONS.PRODUCT_EDIT,
  PERMISSIONS.PRODUCT_DELETE,
]) && <Button>操作</Button>}

// 批量操作：全部权限
{hasAllPermissions(rolePermissions, [
  PERMISSIONS.PRODUCT_EDIT,
  PERMISSIONS.PRODUCT_DELETE,
]) && <Button>批量删除</Button>}
```

## 中间件速查

| 中间件 | 校验内容 | 使用场景 |
|--------|---------|---------|
| `adminPermGuard(PERMISSIONS.XXX)` | 登录 + 指定权限 | **所有管理端 SFn**（推荐） |
| `adminAuthGuard` | 仅登录 | 极少数不需要权限校验的接口 |

`adminPermGuard` 内部已组合 `adminAuthGuard`，无需重复加登录校验。

## 元数据工具

```ts
import {
  PERMISSION_META,      // Record<string, PermissionDef>
  ALL_PERMISSIONS,      // PermissionCode[]
  PERMISSIONS_BY_GROUP, // Record<string, PermissionDef[]>
} from "#/lib/permissions/permissions";

// 在角色编辑页面获取权限分组列表
Object.entries(PERMISSIONS_BY_GROUP).map(([group, permissions]) => (
  <Checkbox.Group
    options={permissions.map((p) => ({ label: p.name, value: p.code }))}
  />
));
```

## 相关 Skill

- 在 SFn 中使用权限 → [server-function](../server-function/SKILL.md)
- 创建完整 CRUD 模块 → [admin-crud](../admin-crud/SKILL.md)

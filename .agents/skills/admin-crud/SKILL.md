---
name: admin-crud
description: >
  新增管理端 CRUD 模块完整指南。当需要创建新的后台管理实体
  （如"产品管理""分类管理""公告管理"等带列表/创建/编辑的管理页面）时触发。
  ——引用 db-schema、server-function、permission、test-writing、i18n skill。
---

# 新增管理端 CRUD 模块

## 前置准备

开始前确认以下信息：

```
□ 实体中文名：________（如"产品"）
□ 实体英文名：________（如 Product，PascalCase）
□ 路由路径：________（如 /admin/products，kebab-case 复数）
□ 表名：________（如 product，单数 snake_case）
□ 模块标识：________（如 product，用于 permission code、logOperation module）

□ 是否需要软删除？（deleted_at）     □ 是  □ 否
□ 是否有状态机？（status 列）        □ 是  □ 否，状态值：________
□ 是否需要翻译？（实体字段翻译）      □ 是  □ 否
□ 是否有字典关联？（DictSelect）      □ 是  □ 否，字典 slug：________
□ 是否需要富文本编辑器？              □ 是  □ 否
```

**参考实现**：`src/routes/admin/_admin/news/` —— 完整的 CRUD 模块，对照参考。

## 文件生成清单

按顺序创建以下文件。将 `<ModuleName>` 替换为 PascalCase（如 `Product`），`<module-name>` 替换为 kebab-case（如 `product`）。

| # | 文件 | 用途 | 参考 Skill |
|---|------|------|-----------|
| 1 | `src/db/schema/<module-name>.ts` | Drizzle 表定义 | [db-schema](../db-schema/SKILL.md) |
| 2 | `src/db/schema/index.ts` | 追加 export | — |
| 3 | `src/lib/permissions/permissions.ts` | 追加权限码 | [permission](../permission/SKILL.md) |
| 4 | `src/services/<module-name>/<module-name>.server.ts` | 服务层 helper | — |
| 5 | `src/routes/admin/_admin/<module-name>/-mods/<module-name>.schemas.ts` | Zod Schema | — |
| 6 | `src/routes/admin/_admin/<module-name>/-mods/<module-name>.functions.ts` | SFn 包装器 | [server-function](../server-function/SKILL.md) |
| 7 | `src/routes/admin/_admin/<module-name>/-mods/<ModuleName>Form.tsx` | antd Form 组件 | — |
| 8 | `src/routes/admin/_admin/<module-name>/index.tsx` | 列表页 | — |
| 9 | `src/routes/admin/_admin/<module-name>/create.tsx` | 创建页 | — |
| 10 | `src/routes/admin/_admin/<module-name>/$id/edit.tsx` | 编辑页 | — |
| 11 | `src/services/<module-name>/__tests__/<module-name>.test.ts` | 服务层测试 | [test-writing](../test-writing/SKILL.md) |
| 12 | `src/routes/__tests__/sf-schemas.test.ts` | 追加 Schema 测试 | [test-writing](../test-writing/SKILL.md) |

---

## Step 1：创建 DB Schema

> 详细规范参考 [db-schema](../db-schema/SKILL.md)

创建 `src/db/schema/<module-name>.ts`：

```ts
/**
 * <实体中文名>表
 */
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { adminUser } from "./admin-user";
import { file } from "./file";

export const product = pgTable(
  "product",
  {
    id: uuid().defaultRandom().primaryKey(),

    // 业务列 — 按实际字段替换
    name: varchar({ length: 200 }).notNull(),
    description: text("description"),
    status: varchar({ length: 20 }).default("active").notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),

    // 审计列 — 如果需要
    createdById: uuid("created_by_id").references(() => adminUser.id),
    updatedById: uuid("updated_by_id").references(() => adminUser.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // 软删除 — 按需
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_product_created_at").on(table.createdAt),
  ],
);
```

## Step 2：注册 Schema 导出

编辑 `src/db/schema/index.ts`，在末尾追加：

```ts
export { product } from "./product";
```

## Step 3：添加权限码

> 详细规范参考 [permission](../permission/SKILL.md)

编辑 `src/lib/permissions/permissions.ts`，在 `PERMISSIONS` 对象中追加：

```ts
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
  "允许编辑已有产品",
),
PRODUCT_DELETE: definePermission(
  "product:delete",
  "删除产品",
  "允许删除产品（软删除）",
),
```

**标准集**：每个模块至少需要 `view` / `create` / `edit` / `delete` 四个权限。如果模块无状态机，可以省略 `publish`；无导出功能可省略 `export`。

## Step 4：创建服务层

创建 `src/services/<module-name>/<module-name>.server.ts`。提供纯 DB 操作函数，不包含 `createServerFn`。

```ts
/**
 * <实体中文名>服务层：CRUD 操作
 */
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { product } from "#/db/schema";
import type { PaginatedSortParams } from "#/lib/query/query-utils";
import {
  buildSortClause,
  executePaginatedQuery,
  notDeleted,
  paginationOffset,
} from "#/services/query/query-utils.server";

export type ProductRecord = typeof product.$inferSelect;

// ── 列表查询（分页 + 排序） ──

export async function getProductList(
  params?: PaginatedSortParams & { status?: string },
) {
  const { status, page = 1, pageSize = 20, sortField, sortOrder } = params ?? {};
  const offset = paginationOffset(page, pageSize);

  const conditions = [notDeleted(product.deletedAt)];
  if (status) conditions.push(eq(product.status, status));
  const whereCondition = and(...conditions);

  const sortFieldMap = {
    sortOrder: product.sortOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
  const direction = buildSortClause(
    sortFieldMap, sortField, sortOrder, "sortOrder",
  );

  const orderBy = sortField
    ? [direction]
    : [desc(product.sortOrder), desc(product.createdAt)];

  return executePaginatedQuery(
    db.select().from(product).where(whereCondition).orderBy(...orderBy)
      .limit(pageSize).offset(offset),
    db.$count(db.select().from(product).where(whereCondition)),
    page, pageSize,
  );
}

// ── 单条查询 ──

export async function getProductById(
  id: string,
): Promise<ProductRecord | null> {
  const record = await db.query.product.findFirst({
    where: and(eq(product.id, id), notDeleted(product.deletedAt)),
  });
  return record ?? null;
}

// ── 创建 ──

export async function createProduct(params: {
  name: string;
  description?: string;
  status?: string;
  isPublished?: boolean;
  sortOrder?: number;
  createdById?: string;
}): Promise<ProductRecord> {
  const [record] = await db.insert(product).values({
    name: params.name,
    description: params.description ?? null,
    status: params.status ?? "active",
    isPublished: params.isPublished ?? false,
    sortOrder: params.sortOrder ?? 0,
    createdById: params.createdById ?? null,
  }).returning();

  return record;
}

// ── 更新 ──

export async function updateProduct(
  id: string,
  params: {
    name?: string;
    description?: string;
    status?: string;
    isPublished?: boolean;
    sortOrder?: number;
  },
): Promise<ProductRecord | null> {
  const existing = await getProductById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined) updateData.name = params.name;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.isPublished !== undefined) updateData.isPublished = params.isPublished;
  if (params.sortOrder !== undefined) updateData.sortOrder = params.sortOrder;

  const [updated] = await db.update(product)
    .set(updateData)
    .where(eq(product.id, id))
    .returning();

  return updated ?? null;
}

// ── 软删除 ──

export async function deleteProduct(id: string): Promise<boolean> {
  const existing = await getProductById(id);
  if (!existing) return false;
  await db.update(product)
    .set({ deletedAt: new Date() })
    .where(eq(product.id, id));
  return true;
}
```

**关键点**：
- `updatedAt` 在每次更新时手动设为 `new Date()`
- 更新时用 `Record<string, unknown>` 动态构建，避免 `undefined` 覆盖数据库
- 所有查询使用 `notDeleted()` 过滤软删除记录

## Step 5：创建 Zod Schema

创建 `src/routes/admin/_admin/<module-name>/-mods/<module-name>.schemas.ts`：

```ts
import { z } from "zod";

export const getProductSchema = z.object({
  id: z.string().min(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
});

export const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  isPublished: z.boolean(),
  sortOrder: z.number().int().optional(),
});
```

**注意**：`create` schema 用 `.default()`，`update` schema 通常要求必填（所有值由表单提交）。

## Step 6：创建 SFn 包装器

> 详细规范参考 [server-function](../server-function/SKILL.md)

创建 `src/routes/admin/_admin/<module-name>/-mods/<module-name>.functions.ts`：

```ts
/**
 * <实体中文名>表单 SFn 包装器
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { logOperation } from "#/services/operation-log/operation-log.server";
import {
  createProduct,
  getProductById,
  updateProduct,
} from "#/services/product/product.server";
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

## Step 7：创建 Form 组件

创建 `src/routes/admin/_admin/<module-name>/-mods/<ModuleName>Form.tsx`。这是 create/edit 双模式 antd Form 组件。

```tsx
/**
 * <实体中文名>管理路由自包含表单组件
 * 传入 id 即编辑（自动拉取数据），不传即新建
 */
import {
  Button,
  Form,
  Input,
  InputNumber,
  Spin,
  Switch,
} from "antd";
import { useEffect, useState } from "react";
import { createProductSFn, getProductByIdSFn, updateProductSFn } from "./product.functions";

export interface ProductFormValues {
  name: string;
  description?: string;
  status: "active" | "inactive";
  isPublished: boolean;
  sortOrder?: number;
}

interface ProductFormProps {
  id?: string;
  onSuccess?: (recordId: string) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export function ProductForm({
  id,
  onSuccess,
  onError,
  onCancel,
}: ProductFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(!!id);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!id;

  // 编辑模式：拉取数据回填表单
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const record = await getProductByIdSFn({ data: { id } });
        if (cancelled) return;
        if (record) {
          form.setFieldsValue({
            name: record.name,
            description: record.description,
            status: record.status,
            isPublished: record.isPublished,
            sortOrder: record.sortOrder ?? 0,
          });
        } else {
          onError?.(new Error("记录不存在"));
        }
      } catch (err) {
        if (!cancelled)
          onError?.(err instanceof Error ? err : new Error("加载失败"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, form, onError]);

  const handleSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      if (id) {
        await updateProductSFn({ data: { id, ...values } });
        onSuccess?.(id);
      } else {
        const record = await createProductSFn({ data: values });
        onSuccess?.(record.id);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error("保存失败"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={!isEdit ? { status: "active", isPublished: false } : undefined}
    >
      <Form.Item
        name="name"
        label="名称"
        rules={[{ required: true, message: "请输入名称" }]}
      >
        <Input placeholder="产品名称" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} placeholder="产品描述（可选）" />
      </Form.Item>

      <div className="flex gap-8">
        <Form.Item name="status" label="状态">
          {/* 可用 DictSelect 替代 */}
          <Input placeholder="active" style={{ width: 120 }} />
        </Form.Item>

        <Form.Item name="isPublished" label="发布" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="sortOrder" label="排序" extra="数字越大越靠前">
          <InputNumber min={0} style={{ width: 120 }} />
        </Form.Item>
      </div>

      <Form.Item>
        <div className="flex gap-2">
          <Button type="primary" htmlType="submit" loading={submitting}>
            保存
          </Button>
          {onCancel && <Button onClick={onCancel}>取消</Button>}
        </div>
      </Form.Item>
    </Form>
  );
}
```

**Form 组件规则**：
- 通过 `id` 判断 create / edit 模式
- `useEffect` 中使用 `cancelled` 标志防止组件卸载后的异步更新
- 日期类字段用 `dayjs` 在表单中，提交时转 ISO 字符串
- 通过回调（`onSuccess`/`onError`/`onCancel`）与父页面通信
- `initialValues` 仅在 create 模式设置，edit 模式通过 `setFieldsValue` 填充

## Step 8：创建路由页面

### 列表页（index.tsx）

创建 `src/routes/admin/_admin/<module-name>/index.tsx`：

```tsx
/**
 * <实体中文名>列表页
 */
import {
  PlusOutlined,
} from "@ant-design/icons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button, Drawer, message, Tag } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { ProTable } from "#/components/admin/ProTable";
import { TableOperate } from "#/components/admin/TableOperate";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import type { ProductRecord } from "#/services/product/product.server";
import {
  deleteProduct,
  getProductById,
  getProductList,
} from "#/services/product/product.server";
import { logOperation } from "#/services/operation-log/operation-log.server";
import { ProductForm } from "./-mods/ProductForm";

// ═══ Zod Schema ═══
const listSchema = z.object({
  status: z.string().optional(),
  page: z.number().optional(),
  sortField: z.string().optional(),
  sortOrder: z.enum(["ascend", "descend"]).optional(),
});
const idSchema = z.object({ id: z.string().min(1) });

// ═══ 内联 SFn ═══
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

// ═══ 路由定义 ═══
export const Route = createFileRoute("/admin/_admin/product/")({
  component: ProductListPage,
  loader: async () => getProductListSFn({ data: {} }),
});

function ProductListPage() {
  const initialData = Route.useLoaderData();
  const [data, setData] = useState(initialData);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    try {
      const result = await getProductListSFn({ data: {} });
      setData(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载列表失败");
    }
  }

  const columns = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 200,
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: "排序",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 80,
      sorter: true,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (val: string | null) =>
        val ? dayjs(val).format("YYYY-MM-DD HH:mm") : "—",
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, record: ProductRecord) => (
        <TableOperate>
          <TableOperate.Link to="/admin/product/$id/edit" params={{ id: record.id }} />
          <TableOperate.Custom>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditingId(record.id);
                setDrawerOpen(true);
              }}
            >
              快速编辑
            </Button>
          </TableOperate.Custom>
          <TableOperate.Delete
            recordName="该产品"
            onConfirm={async () => {
              try {
                await deleteProductSFn({ data: { id: record.id } });
                message.success("已删除");
                await refresh();
              } catch (err) {
                message.error(
                  err instanceof Error ? err.message : "删除失败",
                );
              }
            }}
          />
        </TableOperate>
      ),
    },
  ];

  return (
    <AdminPageContent
      title="产品管理"
      extra={
        <Link to="/admin/product/create">
          <Button type="primary" icon={<PlusOutlined />}>
            新建产品
          </Button>
        </Link>
      }
    >
      <ProTable
        dataSource={data.records}
        columns={columns}
        rowKey="id"
        pagination={{
          total: data.total,
          pageSize: data.pageSize,
          current: data.page,
          onChange: async (page) => {
            try {
              const result = await getProductListSFn({
                data: { page },
              });
              setData(result);
            } catch (err) {
              message.error(
                err instanceof Error ? err.message : "加载列表失败",
              );
            }
          },
        }}
      />

      <Drawer
        title="快速编辑"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        destroyOnClose
      >
        {editingId && (
          <ProductForm
            id={editingId}
            onSuccess={() => {
              message.success("已更新");
              setDrawerOpen(false);
              refresh();
            }}
            onError={(err) => message.error(err.message)}
            onCancel={() => setDrawerOpen(false)}
          />
        )}
      </Drawer>
    </AdminPageContent>
  );
}
```

**列表页关键模式**：
- 内联 SFn 定义（list / delete）放在文件顶部，路由 `loader` 自动调用 list SFn
- `Route.useLoaderData()` 获取初始数据，`useState` 维护本地状态以支持客户端刷新
- 使用 `ProTable` 代替原生 `Table`（增强的 antd Table）
- 操作列使用 `TableOperate` 容器组件统一渲染（`Edit` / `Delete` / `Link` / `Custom`）
- `Drawer` + `destroyOnClose` 实现抽屉内快速编辑
- 分页的 `onChange` 重新调用 SFn 并更新本地状态

### 创建页（create.tsx）

创建 `src/routes/admin/_admin/<module-name>/create.tsx`。这是极薄的页面，仅组装 `ProductForm`。

```tsx
/**
 * 新建<实体中文名>页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { message } from "antd";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { ProductForm } from "./-mods/ProductForm";

export const Route = createFileRoute("/admin/_admin/product/create")({
  component: ProductCreatePage,
});

function ProductCreatePage() {
  const navigate = useNavigate();

  return (
    <AdminPageContent title="新建产品" description="创建一个新的产品">
      <div className="max-w-4xl">
        <ProductForm
          onSuccess={(recordId) => {
            message.success("创建成功");
            navigate({
              to: "/admin/product/$id/edit",
              params: { id: recordId },
            });
          }}
          onError={(err) => message.error(err.message)}
          onCancel={() => navigate({ to: "/admin/product" })}
        />
      </div>
    </AdminPageContent>
  );
}
```

### 编辑页（$id/edit.tsx）

创建 `src/routes/admin/_admin/<module-name>/$id/edit.tsx`：

```tsx
/**
 * 编辑<实体中文名>页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { message } from "antd";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { ProductForm } from "../-mods/ProductForm";

export const Route = createFileRoute("/admin/_admin/product/$id/edit")({
  component: ProductEditPage,
});

function ProductEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  return (
    <AdminPageContent title="编辑产品">
      <div className="max-w-4xl">
        <ProductForm
          id={id}
          onSuccess={() => {
            message.success("已更新");
            navigate({ to: "/admin/product" });
          }}
          onError={(err) => message.error(err.message)}
          onCancel={() => navigate({ to: "/admin/product" })}
        />
      </div>
    </AdminPageContent>
  );
}
```

**注意**：edit.tsx 的 `ProductForm` import 路径使用 `../-mods/ProductForm`（相对父目录的 `-mods/`）。

## Step 9：可选 —— 添加实体翻译

> 详细规范参考 [i18n](../i18n/SKILL.md)

如果实体字段需要多语言支持，额外执行以下步骤：

1. 在列表页定义 `XXX_TRANSLATABLE_FIELDS` 数组
2. 在 `.server.ts` 添加 `translate<Entity>Record` / `translate<Entity>Records` 函数
3. 在路由 loader 中调用翻译函数
4. 在列表页集成 `FieldTranslationDrawer`

## Step 10：编写测试

> 详细规范参考 [test-writing](../test-writing/SKILL.md)

### 服务层测试

创建 `src/services/<module-name>/__tests__/<module-name>.test.ts`，使用三段式 mock 模式。需覆盖：
- `getProductList`：正常返回、空列表、按状态筛选
- `createProduct`：成功创建、名称重复
- `updateProduct`：成功更新、记录不存在
- `deleteProduct`：成功删除、记录不存在

### Schema 测试

在 `src/routes/__tests__/sf-schemas.test.ts` 追加 `createProductSchema` 和 `updateProductSchema` 的校验测试（合法通过、字段缺失、字段非法值）。

## 验证清单

完成所有步骤后，按序执行：

```
□ pnpm db:push              # 同步 Schema 到数据库
□ pnpm check                # TypeScript 类型检查 + Biome lint
□ pnpm test -- --run        # 全部测试通过
□ 手动测试：列表页加载
□ 手动测试：创建新记录
□ 手动测试：编辑已有记录
□ 手动测试：删除记录
□ 手动测试：权限校验（用非管理员账号）
□ 检查：操作日志是否记录（/admin/operation-logs）
```

## 参考实现

完整参考：`src/routes/admin/_admin/news/`

```
src/routes/admin/_admin/news/
├── index.tsx              # 列表页（421 行，含状态筛选 + 抽屉编辑 + 导出 + 字段翻译）
├── create.tsx             # 创建页（约 20 行）
├── $id/edit.tsx           # 编辑页（约 30 行）
└── -mods/
    ├── news.schemas.ts    # Zod Schema
    ├── news.functions.ts  # SFn 包装器（create / update / getById）
    └── NewsForm.tsx       # antd Form 组件（210 行）
```

## 相关 Skill 总览

```
admin-crud
├── db-schema          —— Step 1：创建 DB Schema
├── permission         —— Step 3：添加权限码
├── server-function    —— Step 6：SFn 包装器
├── test-writing       —— Step 10：单元测试
└── i18n               —— Step 9：实体翻译（可选）
```

在列表页操作列中通过 `TableOperate.Custom` 包裹 `FieldTranslationDrawer`：

```tsx
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";

// 在 Table columns 的 actions render 中
<TableOperate>
  <TableOperate.Custom>
    <FieldTranslationDrawer
      entityType="product"
      entityId={record.id}
      fields={PRODUCT_TRANSLATABLE_FIELDS}
      originalValues={{
        name: record.name ?? "",
        description: record.description ?? "",
      }}
    />
  </TableOperate.Custom>
  <TableOperate.Edit ... />
  <TableOperate.Delete ... />
</TableOperate>
```

`FieldTranslationDrawer` 固定使用图标触发模式（`TranslationOutlined`，蓝紫渐变，Tooltip "国际化"），无需传递 `trigger` 参数。

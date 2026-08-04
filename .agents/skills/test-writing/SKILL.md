---
name: test-writing
description: >
  单元测试编写指南。当需要为新模块编写 Vitest 测试、修复测试失败、
  理解三段式 vi.hoisted() mock 模式、或设置 mockDb 链式调用时触发。
---

# 单元测试编写

## 测试类型速判

| 被测模块位置 | 测试类型 | Mock 需求 | 测试文件位置 |
|-------------|---------|----------|-------------|
| `src/services/*/*.server.ts` | Service 测试 | 需 mock DB | `src/services/<module>/__tests__/<module>.test.ts` |
| `src/lib/*/`（纯逻辑） | 纯逻辑测试 | 无需 mock | `src/lib/<module>/__tests__/<module>.test.ts` |
| 路由 SFn schema | Schema 测试 | 无需 mock | `src/routes/__tests__/sf-schemas.test.ts` |
| `src/middleware/` | 中间件类型测试 | 无需 mock | `src/middleware/__tests__/<module>.test.ts` |

**判断标准**：被测模块 import 了 `#/db` 或任何 `.server.ts` → Service 测试（需 mock）。

## Service 测试：三段式 Mock 模式

> ⚠️ **顺序至关重要**：所有 mock 必须在源模块 import 之前。源模块的 import 必须放在最后。

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════
// 第 1 段：静态 vi.mock（无运行时依赖的模块）
// ═══════════════════════════════════════════════════
vi.mock("#/lib/logger/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ═══════════════════════════════════════════════════
// 第 2 段：vi.hoisted() 创建 mock 对象
// ═══════════════════════════════════════════════════
const { mockGetContentTranslations } = vi.hoisted(() => {
  return { mockGetContentTranslations: vi.fn() };
});

// 外部服务 mock（使用 hoisted 值）
vi.mock("#/services/i18n/i18n.server", () => ({
  getContentTranslations: mockGetContentTranslations,
}));

const { mockDb } = vi.hoisted(() => {
  const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
  const selectChain = { from: vi.fn(() => ({ where: vi.fn() })) };
  return {
    mockDb: {
      query: {
        // ⚠️ 必须包含所有表的 query 方法
        news: q(), adminUser: q(), clientUser: q(), role: q(),
        dict: q(), dictItem: q(), systemConfig: q(), file: q(),
        captchaCode: q(), event: q(), operationLog: q(),
        presetEvent: q(), presetProperty: q(),
        uiTranslation: q(), contentTranslation: q(),
      },
      $count: vi.fn(),
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn() })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn() })),
      })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
    selectChain,
  };
});

// ═══════════════════════════════════════════════════
// 第 3 段：使用 hoisted 值的 vi.mock
// ═══════════════════════════════════════════════════
vi.mock("#/db", () => ({ db: mockDb }));

// ═══════════════════════════════════════════════════
// 第 4 段：所有 mock 之后才 import 被测模块
// ═══════════════════════════════════════════════════
import {
  getProductList,
  createProduct,
  updateProduct,
  deleteProduct,
} from "#/services/product/product.server";

// ═══════════════════════════════════════════════════
// 测试夹具
// ═══════════════════════════════════════════════════
const productRecord = {
  id: "p-1", name: "测试产品", description: "测试描述",
  status: "active", isPublished: false, sortOrder: 0,
  coverImageId: null,
  createdById: null, updatedById: null,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
};
```

## mockDb 完整模板 —— 必须包含所有表

`mockDb.query` **必须**包含项目中所有表的 query 方法。`.server.ts` 模块之间的交叉引用可能在测试时意外触发其他表查询（如 `logOperation` 内部引用 `operationLog` 表），缺少任何一张表都会导致 `undefined` 错误。

当前项目全部表（15 张）：

```
adminUser, clientUser, role, news, file,
dict, dictItem, systemConfig, captchaCode,
event, operationLog, presetEvent, presetProperty,
uiTranslation, contentTranslation
```

## Mock 链式调用 Setup 速查

### select 查询

```ts
mockDb.select.mockReturnValue({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn().mockResolvedValue([productRecord]),
        })),
      })),
    })),
  })),
});
```

### findFirst（通过 query.xxx.findFirst）

```ts
mockDb.query.product.findFirst.mockResolvedValue(productRecord);
```

### findMany（通过 query.xxx.findMany）

```ts
mockDb.query.product.findMany.mockResolvedValue([productRecord]);
```

### insert

```ts
mockDb.insert.mockReturnValue({
  values: vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([productRecord]),
  })),
});
```

### update

```ts
mockDb.update.mockReturnValue({
  set: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([productRecord]),
    })),
  })),
});
```

### delete

```ts
mockDb.delete.mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});
```

### $count

```ts
mockDb.$count.mockResolvedValue(1);
```

## 测试命名规范

```ts
// describe 名称 = 被测函数名
// it 名称 = 中文场景描述
describe("getProductList", () => {
  beforeEach(() => {
    vi.clearAllMocks();  // ⚠️ 每个测试前必须清理
  });

  it("返回分页的产品列表", async () => {
    // setup mock ...
    const result = await getProductList();
    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("空列表返回 records 空数组", async () => {
    // setup mock 返回空 ...
    const result = await getProductList();
    expect(result.records).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("按状态筛选", async () => {
    // setup mock + 验证筛选参数 ...
  });
});

describe("createProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("成功创建产品并返回记录", async () => {
    // ...
  });

  it("名称重复时抛出错误", async () => {
    // setup mock insert 抛出 ...
    await expect(
      createProduct({ name: "已存在的名称" }),
    ).rejects.toThrow();
  });
});
```

## 覆盖要求

每个导出函数**至少**覆盖以下场景：

| 场景 | 最低数量 | 示例 |
|------|---------|------|
| 正常路径 | 1-2 个 | 正常参数返回预期结果 |
| 边界条件 | 1-2 个 | 空列表、null 值、不存在、默认参数 |
| 错误路径 | 1 个 | DB 异常、参数非法、记录不存在 |

## Schema 测试模板

路由 SFn 的 Zod Schema 统一在 `src/routes/__tests__/sf-schemas.test.ts` 中测试：

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

// 从路由文件中复制 schema 定义
const productCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
});

describe("产品 Schema 校验", () => {
  describe("productCreateSchema", () => {
    it("合法创建参数应通过校验", () => {
      expect(() =>
        productCreateSchema.parse({ name: "新产品" }),
      ).not.toThrow();
    });

    it("缺失 name 应失败", () => {
      expect(() => productCreateSchema.parse({})).toThrow();
    });

    it("空字符串 name 应失败", () => {
      expect(() =>
        productCreateSchema.parse({ name: "" }),
      ).toThrow();
    });

    it("status 非法值应失败", () => {
      expect(() =>
        productCreateSchema.parse({ name: "标题", status: "deleted" }),
      ).toThrow();
    });

    it("默认值生效", () => {
      const result = productCreateSchema.parse({ name: "新产品" });
      expect(result.status).toBe("active");
      expect(result.isPublished).toBe(false);
    });
  });
});
```

## 运行测试

```bash
pnpm test -- --run          # 运行全部测试
pnpm test -- --run <file>   # 运行指定文件
pnpm test                   # watch 模式（开发时推荐）
```

## 常见 Mock 错误

| 错误现象 | 原因 | 修复 |
|---------|------|------|
| `TypeError: Cannot read properties of undefined (reading 'findFirst')` | `mockDb.query` 缺少某张表 | 补充缺少的表的 query 方法 |
| Mock 没有生效，仍调用真实 DB | `import` 在 `vi.mock` 之前 | 将被测模块的 `import` 移到 mock 之后 |
| 测试被上一个测试的 mock 值污染 | 缺少 `vi.clearAllMocks()` | 添加 `beforeEach(() => vi.clearAllMocks())` |
| hoisted 值在 `vi.mock` 中引用不到 | `vi.mock` 回调无法访问外部变量 | 用 `vi.hoisted()` 包裹 mock 对象声明 |
| `select.mockReturnValue` 不生效 | `mockDb.select` 初始定义不正确 | 确保 `select: vi.fn(() => selectChain)` |

## 相关 Skill

- 被测模块是 SFn → [server-function](../server-function/SKILL.md)
- 被测模块是新 CRUD → [admin-crud](../admin-crud/SKILL.md)
- 被测模块是 DB Schema → [db-schema](../db-schema/SKILL.md)

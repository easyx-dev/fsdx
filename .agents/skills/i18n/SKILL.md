---
name: i18n
description: 本项目国际化开发指南。当需要添加多语言支持、翻译 UI 文案、为实体字段新增翻译、或修改语言切换逻辑时触发。
---

# 国际化（i18n）开发指南

本项目采用**中文作为翻译 key**的国际化方案，基于 i18next + react-i18next，支持前台 SSR 页面和管理端翻译管理。

## 架构概览

翻译分为两层，存储在两张数据库表中：

| 层级 | 表 | 用途 | 缓存 | 示例 |
|------|-----|------|------|------|
| UI 翻译 | `ui_translation` | 前端页面固定文案 | 内存全量缓存 | `t("首页")` → "Home" |
| 内容翻译 | `content_translation` | 实体字段翻译（如新闻标题） | 按需查询 | 新闻英文标题、摘要、正文 |

```
请求进入 → localeMiddleware 解析 Cookie
         → __root.tsx beforeLoad 加载 UI 翻译并注入 GlobalStoreProvider
         → 组件调用 useTranslation() / useLocale()
         → 服务端实体翻译通过 translateXxxRecord 按需拼接
```

## 核心概念

### 中文作为翻译 key

不同于传统 key 方案（`t("home.title")`），本项目直接使用**中文原文作为 key**：

```tsx
// ✅ 正确：中文文本直接作为 key
<h1>{t("首页")}</h1>
<p>{t("轻量、安全、可扩展的全栈内容管理解决方案")}</p>

// ❌ 错误：不要使用英文或抽象 key
<h1>{t("home.title")}</h1>
```

i18next 查找逻辑：当前语言为 `zh` 时直接返回 key 本身；其他语言时从翻译资源中查找映射值。

### 支持的语言

定义在 `src/lib/i18n/i18n.types.ts`：

```ts
export const SUPPORTED_LOCALES = ["zh", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "lang";
```

### 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/lib/i18n/i18n.types.ts` | 类型定义、支持语言、Cookie 名 |
| `src/lib/i18n/i18n.config.ts` | i18next 实例创建（`createI18nInstance`） |
| `src/lib/i18n/i18n-context.tsx` | React Context Provider + `useTranslation` / `useLocale` hooks |
| `src/lib/global-store/global-store.tsx` | GlobalStore：组合 locale + translations 并注入 I18nProvider |
| `src/middleware/locale-middleware.ts` | 请求级语言检测中间件 |
| `src/server/i18n/i18n.server.ts` | 翻译查询与维护的核心逻辑 |
| `src/server/i18n/i18n.functions.ts` | Server Function 包装器（含权限守卫） |
| `src/server/i18n/i18n-seed.ts` | 预设英文 UI 翻译种子数据（每次启动增量写入） |
| `src/db/schema/translation.ts` | 数据库表定义 |
| `src/components/admin/FieldTranslationDrawer.tsx` | 实体字段翻译编辑抽屉 |

## 语言检测流程

每次请求按以下顺序确定语言：

1. **`localeMiddleware`**（`src/start.ts` 注册为全局 `requestMiddleware`）：从 `lang` Cookie 读取 locale，无 Cookie 时回退到 `zh`
2. **`__root.tsx` beforeLoad**：根据 `context.locale` 调用 `getLocaleBundle` 加载全量 UI 翻译
3. **`GlobalStoreProvider`**：将 `locale` 和 `translations` 注入组件树
4. **`I18nProvider`**（在 GlobalStoreProvider 内部）：创建 i18next 实例，locale 变化时自动重建

```ts
// src/start.ts — 全局中间件注册
export const startInstance = createStart(() => ({
  requestMiddleware: [localeMiddleware, csrfMiddleware],
}));

// src/routes/__root.tsx — beforeLoad 加载翻译
async beforeLoad({ context }) {
  const { translations } = await getLocaleBundle();
  return { locale: context.locale, translations };
}
```

## 前台组件使用指南

### 获取翻译函数和当前语言

```tsx
import { useTranslation } from "#/lib/i18n/i18n-context";

function MyComponent() {
  const { t, locale } = useTranslation();

  return (
    <div>
      <h1>{t("首页")}</h1>
      <p>{t("暂无数据")}</p>
    </div>
  );
}
```

### 仅获取当前语言

```tsx
import { useLocale } from "#/lib/i18n/i18n-context";

const locale = useLocale(); // "zh" | "en"
```

### 日期格式化

```tsx
new Date(item.publishedAt).toLocaleDateString(locale, {
  year: "numeric",
  month: "long",
  day: "numeric",
});
```

### 语言切换按钮

语言切换通过修改 `lang` Cookie 后刷新页面实现。参见 `src/components/client/Header.tsx` 中 `ClientOnly` 包裹的切换按钮：

```tsx
<ClientOnly>
  <Button
    variant="ghost"
    size="sm"
    onClick={async () => {
      const l = await cookieStore.get("lang");
      await cookieStore.set("lang", l?.value === "zh" ? "en" : "zh");
      window.location.reload();
    }}
  >
    {locale === "zh" ? "EN" : "中文"}
  </Button>
</ClientOnly>
```

注意：
- 必须用 `ClientOnly` 包裹，`cookieStore` 仅在浏览器环境可用
- 切换后需要 `window.location.reload()` 触发完整的 SSR 重新渲染
- 按钮文本本身不翻译（显示当前语言的切换目标语言名）

## 新增 UI 翻译文案

当在组件中新增硬编码的中文文本时，按以下步骤添加翻译支持：

### Step 1：组件中用 t() 包裹

```tsx
// 修改前
<Button>提交</Button>

// 修改后
import { useTranslation } from "#/lib/i18n/i18n-context";
const { t } = useTranslation();
<Button>{t("提交")}</Button>
```

### Step 2：在种子数据中添加翻译

编辑 `src/server/i18n/i18n-seed.ts`，在 `SEED_EN` 数组中追加：

```ts
{ locale: "en", key: "提交", value: "Submit" },
```

种子数据每次启动时写入，基于 `(locale, key)` 唯一约束做 `onConflictDoNothing`，新条目增量追加，已有条目不受影响。

### Step 3：验证

启动应用后可前往 `/admin/translations/ui` 管理页面查看和编辑 UI 翻译。

### 带插值的文案

如果文案包含动态数据，使用 i18next 插值语法：

```tsx
// 种子数据
{ locale: "en", key: "共 {total} 篇", value: "{total} articles" }

// 组件中使用
t("共 {total} 篇", { total: 10 }) // → "10 articles"
```

## 实体字段翻译模式

除了 UI 翻译，实体（如新闻）的字段值也需要支持多语言。例如新闻标题在中文存储为 "重要通知"，在英文需要替换为 "Important Notice"。

### 设计原则

- 默认语言（zh）内容存在主表原字段
- 其他语言翻译写入 `content_translation` 表
- `content_translation` 通过 `(entityType, entityId, fieldName, locale)` 唯一确定一条翻译
- `valueType` 字段复用 `EditorType` 枚举，控制管理端编辑器和渲染方式

### Step 1：定义可翻译字段

在实体对应的管理页面中，定义字段数组供 `FieldTranslationDrawer` 使用：

```tsx
const NEWS_TRANSLATABLE_FIELDS = [
  { name: "title", label: "新闻标题", valueType: "input" as const },
  { name: "summary", label: "新闻摘要", valueType: "text" as const },
  { name: "content", label: "新闻内容", valueType: "rich" as const },
];
```

`valueType` 取值对应 `src/lib/editor-types/editor-types.ts` 中的 `EditorType`。

### Step 2：服务端添加翻译函数

```ts
// src/server/news/news.server.ts
import { getContentTranslations } from "#/server/i18n/i18n.server";

/** 对单条记录应用 content_translation 翻译 */
export async function translateNewsRecord(
  record: NewsRecord,
  locale: Locale,
): Promise<NewsRecord> {
  if (locale === DEFAULT_LOCALE) return record; // 默认语言直接返回

  const translations = await getContentTranslations("news", record.id, locale);

  const result = { ...record };
  for (const [fieldName, ct] of Object.entries(translations)) {
    (result as Record<string, unknown>)[fieldName] = ct.value;
  }
  return result;
}

/** 批量翻译 */
export async function translateNewsRecords(
  records: NewsRecord[],
  locale: Locale,
): Promise<NewsRecord[]> {
  if (locale === DEFAULT_LOCALE) return records;
  return Promise.all(records.map((r) => translateNewsRecord(r, locale)));
}
```

### Step 3：路由 loader 中调用翻译

```tsx
// 路由内的 createServerFn handler 中
const getLatestNews = createServerFn({ method: "GET" }).handler(async () => {
  const locale = getLocaleFromCookie(); // 从 Cookie 读取当前语言
  const { records, ...rest } = await getNewsList({ status: "published", pageSize: 6 });
  return { records: await translateNewsRecords(records, locale), ...rest };
});
```

### Step 4：管理端集成翻译抽屉

在列表页的操作列中添加 `FieldTranslationDrawer`：

```tsx
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";

// 通过 TableOperate.Custom 包裹，固定使用图标触发模式
<TableOperate.Custom>
  <FieldTranslationDrawer
    entityType="news"
    entityId={record.id}
    fields={NEWS_TRANSLATABLE_FIELDS}
    originalValues={{
      title: record.title ?? "",
      summary: record.summary ?? "",
      content: record.content ?? "",
    }}
  />
</TableOperate.Custom>
```

参数说明：
- `entityType`：实体类型标识，与 `content_translation.entity_type` 对应
- `entityId`：实体主键
- `fields`：可翻译字段列表
- `originalValues`：默认语言的原值（展示用，标记为"从主表读取"）
- 触发方式固定为图标模式（`TranslationOutlined`，蓝紫渐变，Tooltip "国际化"），不再支持 `trigger` 参数

## 管理端翻译管理

### UI 翻译管理

路由：`/admin/translations/ui`
权限：`translation:view`（查看）、`translation:manage`（编辑/删除）

功能：按语言筛选、按关键词搜索、创建/编辑/删除 UI 翻译条目。编辑后自动刷新内存缓存。

### 内容翻译管理

路由：`/admin/translations/content`
权限：`translation:view`（查看）、`translation:manage`（编辑/删除）

功能：按实体类型和语言筛选、按关键词搜索、查看/编辑/删除实体字段翻译。

### 权限码

`src/lib/permissions/permissions.ts` 中定义：
- `PERMISSIONS.TRANSLATION_VIEW` — `translation:view`
- `PERMISSIONS.TRANSLATION_MANAGE` — `translation:manage`

## 缓存机制

UI 翻译使用 `MemoryCache` 全量缓存，定义在 `src/lib/cache/cache.ts`：

```ts
export const uiTranslationCache = new MemoryCache<Record<string, string>>({
  name: "ui_translation",
});
```

### 缓存行为

- **载入**：`getUITranslations(locale)` 优先读缓存，未命中时查库并写入缓存（种子数据已在启动阶段通过 `onConflictDoNothing` 预先写入数据库）
- **刷新**：管理端保存/删除 UI 翻译时，调用 `refreshUITranslationCache(locale)` 清除并重新加载
- **范围**：按 locale 独立缓存，`en` 和 `zh` 各一份
- **生命周期**：进程级内存缓存，服务重启后从库重新加载

### 实体翻译无缓存

`content_translation` 按需查询，不缓存。原因是实体翻译数量随业务增长，且查询模式通常按 `(entityType, entityId, locale)` 精确命中，性能可接受。

### 系统配置翻译缓存
`content_translation` 中 `entityType === "system_config"` 的翻译使用 `configTranslationCache` 独立缓存：
- **载入**：`getConfig()` 解析客户端可见配置当前语言的值时，优先读 `configTranslationCache`
- **刷新**：实体翻译保存/删除时，若 `entityType === "system_config"`，自动调用 `refreshConfigTranslationCache(locale)` 刷新
- **范围**：按 locale 独立缓存，key 为 `entityId`
- **生命周期**：进程级内存缓存，服务重启后从库重新加载

## 添加新语言

目前仅支持 `zh` 和 `en`。如需添加新语言（例如 `ja`），需要以下改动：

1. `src/lib/i18n/i18n.types.ts` — `SUPPORTED_LOCALES` 数组追加 `"ja"`
2. `src/components/admin/FieldTranslationDrawer.tsx` — `LOCALE_LABELS` 追加语言标签
3. `src/server/i18n/i18n-seed.ts` — 为新语言添加 `SEED_XX` 数组并追加到 `SEED_DATA`
4. 管理端翻译页面自动支持新语言（语言选择器基于 `SUPPORTED_LOCALES` 渲染）

## 常见任务速查

| 任务 | 操作 |
|------|------|
| 前台组件显示翻译文本 | `import { useTranslation }` → `const { t } = useTranslation()` → `t("中文")` |
| 获取当前语言 | `import { useLocale }` → `const locale = useLocale()` |
| 新增 UI 翻译条目 | 组件用 `t()` 包裹 → 在 `i18n-seed.ts` 添加翻译 → 管理端可编辑 |
| 为实体添加字段翻译 | 服务端添加 `translateXxxRecord` → loader 调用翻译 → 管理端集成 `FieldTranslationDrawer` |
| 刷新 UI 翻译缓存 | 管理端保存翻译时自动刷新；手动调用 `refreshUITranslationCache(locale)` |
| 切换语言 | 修改 `lang` Cookie → `window.location.reload()` |
| 添加新支持语言 | 修改 `SUPPORTED_LOCALES` → 添加种子数据 → 更新语言标签 |
| AI 自动翻译字段 | `FieldTranslationDrawer` 中点击 AI 翻译按钮 → 调用 `aiTranslateFieldFn` 使用 fast 模型翻译 |
| 导出/导入翻译 | 访问翻译管理页面 → 使用导出/导入按钮（需 `translation:export` / `translation:import` 权限） |
| 查看/编辑 UI 翻译 | 访问 `/admin/translations/ui`（需 `translation:view` 权限） |
| 查看/编辑实体翻译 | 访问 `/admin/translations/content`（需 `translation:view` 权限） |

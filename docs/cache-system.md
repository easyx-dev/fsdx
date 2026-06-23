# 缓存体系

## 概述

系统使用基于 `Map` 的**内存缓存**实现，通过 `MemoryCache<T>` 通用类提供统一接口。所有缓存在服务进程内存中，重启即清空，通过启动时的 `ensurePreset*` 系列函数重新加载。

## MemoryCache 通用类

```
src/lib/cache/cache.ts

class MemoryCache<T> {
    constructor(options?: { defaultTTL?: number; name?: string })

    get(key: string): T | undefined      // 获取值（自动处理过期）
    set(key: string, value: T, ttl?: number): void  // 写入值
    delete(key: string): void             // 删除单个键
    has(key: string): boolean             // 检查键是否存在（含过期判断）
    clear(): void                         // 清空全部
    keys(): string[]                      // 获取所有有效键
    size: number                          // 有效条目数
    cleanup(): number                     // 手动清理过期项
}
```

**核心特性：**
- 基于 `Map<string, CacheEntry<T>>`，O(1) 读写
- `get()` 时自动检查 TTL 过期，过期项自动删除并返回 `undefined`
- `set()` 支持传入 `ttl` 覆盖默认值，`ttl=0` 表示永不过期
- `cleanup()` 遍历全量清理过期项，返回清理数量
- 构造时 `name` 参数用于调试和日志区分

---

## 7 个缓存实例

### 字典缓存 (`dictCache`)

| 属性 | 值 |
|------|-----|
| Key | `dictSlug`（如 `"news_status"`） |
| Value | `Record<string, { label: string; color?: string \| null }>` |
| TTL | 无（永不过期） |
| 加载 | `loadDictCache()` → `dictCache.set(dictSlug, {...})` |
| 查询 | `getDictLabel(slug, value)`、`getDictMap(slug)`、`getDictOptions(slug)` |

字典缓存在启动时全量加载，管理端修改字典后通过 Server Function 主动刷新。

### 系统配置缓存 (`configCache`)

| 属性 | 值 |
|------|-----|
| Key | 固定 `"all"` |
| Value | `CachedConfig[]`（数组） |
| TTL | 无（永不过期） |
| 加载 | `loadConfigCache()` → `configCache.set("all", rows)` |
| 查询 | `getConfig(key)` 返回 `string` |

SMTP 邮件配置从数据库读取而非环境变量，通过此缓存获取。管理端修改配置后触发缓存刷新。

### UI 翻译缓存 (`uiTranslationCache`)

| 属性 | 值 |
|------|-----|
| Key | `locale`（如 `"en"`、`"zh"`） |
| Value | `Record<string, string>`（`{ 中文Key: 翻译值 }`） |
| TTL | 无（永不过期） |
| 加载 | `loadUITranslations()` |
| 查询 | `getUITranslations(locale)` |

启动时加载所有语言的 UI 翻译，管理端修改翻译后触发局部刷新。

### 配置翻译缓存 (`configTranslationCache`)

| 属性 | 值 |
|------|-----|
| Key | `locale` |
| Value | `Record<string, string>`（`{ configId: translatedValue }`） |
| TTL | 无（永不过期） |
| 加载 | `loadConfigTranslationCache()` |
| 刷新 | `refreshConfigTranslationCache(locale?)` |

为系统配置项（如站点名称）提供多语言翻译支持。

### 客户端用户缓存 (`clientUserCache`)

| 属性 | 值 |
|------|-----|
| Key | `userId` |
| Value | `{ id, username, email, avatar, status }` |
| TTL | **5 分钟** |

用于减少 `getCurrentClient()` 的数据库查询频率。缓存失效场景：
- 管理员修改客户端用户状态 → 主动 `clientUserCache.delete(userId)`
- 管理员删除客户端用户 → 主动清除
- TTL 自然过期

### 预设事件缓存 (`presetEventCache`)

| 属性 | 值 |
|------|-----|
| Key | 事件名称（如 `"PageView"`） |
| Value | `boolean`（`true` 表示在预设中） |
| TTL | 无（永不过期） |

用于 `trackEvent()` 中快速校验上报事件名是否在预设中，避免每次查询数据库。

### 预设属性缓存 (`presetPropertyCache`)

| 属性 | 值 |
|------|-----|
| Key | 属性键（如 `"page_name"`、`"$ip"`） |
| Value | `string`（数据类型，如 `"string"`、`"number"`） |
| TTL | 无（永不过期） |

用于 `trackEvent()` 中校验上报属性的键是否存在及其值的类型是否匹配。

---

## 缓存生命周期

### 启动阶段

```mermaid
sequenceDiagram
    participant Bootstrap as bootstrap.ts
    participant Server as server/
    participant Cache as MemoryCache
    participant DB as PostgreSQL

    Bootstrap->>Server: ensurePresetDicts()
    Bootstrap->>Server: ensurePresetConfigs()
    Bootstrap->>Server: ensurePresetEvents()
    Bootstrap->>Server: ensurePresetProperties()
    Bootstrap->>Server: ensurePresetTranslations()
    Bootstrap->>Server: loadPresetCache() (async)
    Server->>DB: 全量加载预设事件/属性
    Server->>Cache: presetEventCache.set() / presetPropertyCache.set()

    Note over Cache: 其他缓存 (dict/config/translation)<br/>在首次访问时懒加载或启动时加载
```

### 运行阶段

```
管理端修改数据
    ↓
Server Function handler
    ↓
更新数据库 + 主动刷新对应缓存实例
    ↓
下次读取命中新缓存
```

### 关闭阶段

无需特殊处理，进程退出后内存自动释放。

---

## 缓存失效策略

| 缓存 | 失效方式 | 触发场景 |
|------|----------|----------|
| `dictCache` | `loadDictCache()` 全量重载 | 字典/条目 CRUD |
| `configCache` | `loadConfigCache()` 全量重载 | 系统配置 CRUD |
| `uiTranslationCache` | `refreshUITranslationCache(locale?)` | UI 翻译增删改 |
| `configTranslationCache` | `refreshConfigTranslationCache(locale?)` | 配置翻译修改 |
| `clientUserCache` | `clientUserCache.delete(userId)` | 用户状态变更/删除 |
| `presetEventCache` | `invalidatePresetCache()` + 下次懒加载 | 预设事件增删改 |
| `presetPropertyCache` | `invalidatePresetCache()` + 下次懒加载 | 预设属性增删改 |

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/lib/cache/cache.ts` | `MemoryCache<T>` 通用类 + 7 个缓存实例定义 |
| `src/lib/cache/__tests__/cache.test.ts` | 缓存单元测试（225 行） |
| `src/server/config/config.server.ts` | `loadConfigCache()` / 配置缓存管理 |
| `src/server/dict/dict.server.ts` | `loadDictCache()` / 字典缓存管理 |
| `src/server/i18n/i18n.server.ts` | UI 翻译缓存管理 |
| `src/server/client-auth/client-auth.server.ts` | 客户端用户缓存使用 |
| `src/server/event/event.server.ts` | 预设事件/属性缓存管理 |

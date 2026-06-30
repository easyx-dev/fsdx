# 事件埋点系统

## 架构概览

系统提供从**客户端采集 → 服务端校验 → 缓冲写入 → 查询分析**的完整埋点链路。

```
┌──────────────────────────────────────────────────────────────┐
│                        客户端 (Browser)                       │
│                                                              │
│  init() / setUserId() / track() / startRouteTracking()      │
│       │                                                      │
│       ▼                                                      │
│  trackEventSFn()  ──── Server Function ────►                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                        服务端                                 │
│                                                              │
│  trackEvent(input)                                           │
│       │                                                      │
│       ├─ 校验事件名 (presetEventCache)                        │
│       ├─ 校验属性键 (presetPropertyCache)                      │
│       └─ 校验属性值类型 (isValidPropertyValue)                 │
│              │                                               │
│              ▼                                               │
│  ┌─────────────────────┐                                     │
│  │   内存缓冲队列        │  上限 1000 条                        │
│  │   eventBuffer[]      │                                     │
│  └────────┬────────────┘                                     │
│           │  5 秒 / 100 条 / SIGTERM                         │
│           ▼                                                  │
│  event 表 (PostgreSQL)                                       │
│       │                                                      │
│       ├── searchEvents()      分页查询                        │
│       ├── getEventAnalytics() 趋势/分布/Top页面                │
│       └── getEventNames()     事件名列表                       │
└──────────────────────────────────────────────────────────────┘
```

---

## 客户端 SDK

位于 `src/lib/track/track.ts`，核心 API：

### 初始化

```typescript
import { init, setUserId, track } from '#/lib/track/track'

// 初始化（自动采集 PageView 并生成 sessionId）
init({ autoPageView: true })

// 登录后设置用户 ID
setUserId(userId)

// 手动上报事件
track('Click', { element_id: 'btn-submit', element_text: '提交' })
```

### 自动采集

| 采集项 | 来源 | 说明 |
|--------|------|------|
| `sessionId` | `sessionStorage` | Base36 时间戳 + 随机数，跨 Tab 独立 |
| `url` | `window.location.href` | 当前完整 URL |
| `referer` | `document.referrer` | 来源页面 |
| `page_name` | `document.title` | 页面标题 |
| `$screen_size` | `window.screen` | 屏幕分辨率 `WxH` |
| PageView 事件 | 初始化 + pushState/popstate | SPA 路由导航自动采集 |

### 路由追踪

通过 `startRouteTracking()` 劫持 `history.pushState` 和 `popstate` 事件，在 SPA 导航时自动上报 `PageView`。注意 `replaceState` 不触发（非导航行为）。

---

## 服务端 `trackEvent()` 校验链

```mermaid
flowchart TD
    Input(["trackEvent(input)"])
    CacheReady{"presetCacheLoaded ?"}
    CacheReady -->|否| PushToBuffer1["pushToBuffer → 入缓冲"]
    CacheReady -->|是| CheckEvent{"事件名在<br/>presetEventCache ?"}
    CheckEvent -->|否| Drop1["❌ 丢弃 + warn 日志<br/>'事件名不在预设中'"]
    CheckEvent -->|是| LoopProps["遍历 input.properties"]
    LoopProps --> CheckKey{"属性键在<br/>presetPropertyCache ?"}
    CheckKey -->|否| Drop2["❌ 丢弃 + warn 日志<br/>'属性键不在预设中'"]
    CheckKey -->|是| IsSysProp{"$ 开头 ?"}
    IsSysProp -->|是| NextProp["跳过类型校验"]
    IsSysProp -->|否| CheckType{"值类型匹配<br/>presetPropertyCache ?"}
    CheckType -->|否| Drop3["❌ 丢弃 + warn 日志<br/>'属性值类型校验失败'"]
    CheckType -->|是| NextProp
    NextProp --> MoreProps{"还有属性 ?"}
    MoreProps -->|是| LoopProps
    MoreProps -->|否| PushToBuffer2["pushToBuffer → 入缓冲<br/>满 100 条触发批量 flush"]
    PushToBuffer1 --> Buffer
    PushToBuffer2 --> Buffer
    Buffer["内存缓冲 eventBuffer[]"]
```

### 属性值类型校验

支持 6 种数据类型，每种有独立的校验逻辑和安全限制：

| 类型 | 允许值 | 限制 |
|------|--------|------|
| `string` | string | 最大 10000 字符 |
| `number` | number (finite) | ±1e15 范围 |
| `boolean` | boolean | — |
| `date` | ISO 字符串 或 毫秒时间戳 | 不超过未来一年 |
| `array` | 基本类型元素数组 | 最多 100 项，禁止嵌套对象 |
| `object` | 纯对象（非数组/null） | 深度 ≤5，键数 ≤50，禁止 `__proto__`/`constructor`/`prototype` |

---

## 缓冲写入策略

```
写入入口: pushToBuffer(input)
    ├─ 缓冲未满 → 追加到 eventBuffer[]
    ├─ 缓冲命中 BATCH_SIZE(100) → 立即 flushEventBuffer("batch")
    ├─ 缓冲命中 MAX_BUFFER_SIZE(1000) → 丢弃最旧条目 + warn 日志
    └─ 定时器 FLUSH_INTERVAL(5000ms) → 定时 flushEventBuffer("timer")

刷新过程: flushEventBuffer(source)
    ├─ 复制当前批次 [...eventBuffer]
    ├─ db.insert(event).values(batch) 批量 INSERT
    ├─ 成功后 eventBuffer.splice(0, batch.length) 移除已写入项
    └─ 失败后保留缓冲，记录 error 日志

强制刷新: flushTrackEvents() (进程退出时调用)
    ├─ 清除定时器
    └─ flushEventBuffer("shutdown")
```

---

## 预置事件与属性

### 9 个预置事件

| 事件名 | 标签 | 分类 |
|--------|------|------|
| `PageView` | 页面浏览 | 页面交互 |
| `Click` | 元素点击 | 页面交互 |
| `FormSubmit` | 表单提交 | 用户行为 |
| `Search` | 搜索行为 | 用户行为 |
| `Login` | 用户登录 | 用户行为 |
| `Register` | 用户注册 | 用户行为 |
| `Logout` | 用户退出 | 用户行为 |
| `Share` | 内容分享 | 内容互动 |
| `Scroll` | 页面滚动 | 页面交互 |

### 16 个预置属性

| 属性键 | 标签 | 类型 | 说明 |
|--------|------|------|------|
| `$ip` | IP 地址 | string | 服务端提取 |
| `$user_agent` | User Agent | string | — |
| `$browser` | 浏览器 | string | — |
| `$os` | 操作系统 | string | — |
| `$device_type` | 设备类型 | string | Desktop/Mobile/Tablet |
| `page_name` | 页面名称 | string | 客户端自动采集 |
| `url` | 页面地址 | string | 客户端自动采集 |
| `referer` | 来源地址 | string | 客户端自动采集 |
| `$screen_size` | 屏幕分辨率 | string | 客户端自动采集 |
| `$language` | 浏览器语言 | string | 客户端自动采集（navigator.language） |
| `element_id` | 元素 ID | string | — |
| `element_text` | 元素文本 | string | — |
| `scroll_depth` | 滚动深度 | number | 页面滚动深度百分比 |
| `form_name` | 表单名称 | string | 被提交的表单名称 |
| `search_query` | 搜索关键词 | string | 用户执行的搜索关键词 |
| `share_platform` | 分享平台 | string | 内容分享的目标平台 |

`$` 前缀属性为系统属性，校验时仅检查键是否存在，不做值类型校验（由服务端补齐）。

---

## 查询与分析

### 事件查询

`searchEvents(query)` — 支持按事件名、用户 ID、会话 ID、关键词、日期范围筛选，分页返回 `EventQueryResult`。

### 事件分析

`getEventAnalytics(query)` — 返回 `AnalyticsResult`：

| 字段 | 说明 |
|------|------|
| `timeSeries` | 按小时/天聚合的时间序列趋势 |
| `eventDistribution` | 各事件类型数量分布 |
| `topPages` | PageView 事件中 Top 20 页面 |
| `uniqueUsers` | 独立用户数（userId 优先，fallback sessionId） |
| `totalEvents` | 总事件数 |

---

## 预设管理

管理端 `/admin/events/preset-events/` 和 `/admin/events/preset-properties/` 页面支持：
- 查看预设事件/属性列表
- 新增自定义事件/属性
- 编辑事件/属性（`is_preset = true` 的不可删除）
- 操作后自动使缓存失效，下次访问重新加载

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/lib/track/track.ts` | 客户端埋点 SDK |
| `src/server/event/event.server.ts` | 服务端：校验、缓冲、查询、分析、预设管理 |
| `src/server/event/event.functions.ts` | Server Function 包装器 |
| `src/server/event/event.types.ts` | 类型定义 |
| `src/db/schema/event.ts` | event 表 Schema |
| `src/db/schema/preset-event.ts` | preset_event 表 Schema |
| `src/db/schema/preset-property.ts` | preset_property 表 Schema |
| `src/lib/cache/cache.ts` | presetEventCache / presetPropertyCache 缓存实例 |
| `src/routes/admin/_admin/events/query.tsx` | 事件查询页面 |
| `src/routes/admin/_admin/events/analytics.tsx` | 事件分析页面 |

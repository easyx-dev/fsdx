# @fsdx/core

纯逻辑库，无 React 依赖。提供同构纯工具（`utils/`、`i18n/`、`cache/`）与服务端基础设施（`infra/`），是 ui-ssr / ui-spa / app 三者的公共底座。

## 定位与边界

| 项 | 约定 |
|----|------|
| 是否含 React | 否，纯 TS 逻辑 |
| 全局单例 | 零全局单例：`createLogger` / `createJwt` 只导出工厂，应用级单例由宿主 app 提供 |
| 客户端引用安全 | `utils/`、`i18n/`、`cache/` 为同构纯逻辑，客户端可安全引用 |
| 服务端保护 | `infra/` 仅服务端；`vite.config.ts` 的 import-protection 拦截 `bcryptjs` / `drizzle-orm` / `openai` 进入客户端 bundle，客户端组件禁止引用 `infra/` 对应模块 |
| 反向依赖 | core 内不得出现 `#/services`、`#/db`、`#/routes` 反向引用 |

## 目录分层与 subpath 导出

`package.json` 的 `exports` 将每个模块扁平映射为一个 subpath，无根桶。跨包引用一律使用 `@fsdx/core/<subpath>`。

### utils/（同构纯工具）

| subpath | 源文件 | 关键导出 |
|---------|--------|----------|
| `@fsdx/core/ms` | `src/utils/ms/index.ts` | `ms(value, options?)` 时间字符串 ⇄ 毫秒互转；`parse` / `parseStrict` / `format` |
| `@fsdx/core/export` | `src/utils/export/index.ts` | `toCsv(rows, columns)`（带 UTF-8 BOM，Excel 兼容）、`toJson(data)`、`downloadFile(content, filename, mimeType)` |
| `@fsdx/core/match-permission` | `src/utils/match-permission/index.ts` | `matchPermission(rolePermissions, requiredCode)` 权限码匹配（`**` → 精确 → `group:*` 三级优先级） |
| `@fsdx/core/cn` | `src/utils/cn/index.ts` | `cn(...inputs)` className 合并（clsx + tailwind-merge） |
| `@fsdx/core/error-utils` | `src/utils/error-utils/index.ts` | `sanitizeError(error)` 错误脱敏（日志/外部输出前使用） |
| `@fsdx/core/date-format` | `src/utils/date-format/index.ts` | `DEFAULT_TASK_TIME_ZONE`（`Asia/Shanghai`，业务统一时区）、`DATE_ONLY_REGEX`、`toDateString(date)`、`parseDateOnly(dateStr)`、`toDayRange(dateStr)`（按业务时区解析天边界，不依赖服务器时区） |

### cache/

| subpath | 源文件 | 关键导出 |
|---------|--------|----------|
| `@fsdx/core/cache-core` | `src/cache/cache-core/index.ts` | `MemoryCache<T>` 泛型内存缓存：`get` / `set(key, value, ttl?)` / `delete` / `has` / `clear` / `keys` / `size`，`defaultTTL` 与 `name` 可配置，`ttl=0` 永不过期，`get()` 自动清理过期项 |

### i18n/

| subpath | 源文件 | 关键导出 |
|---------|--------|----------|
| `@fsdx/core/i18n-types` | `src/i18n/i18n-types/index.ts` | `SUPPORTED_LOCALES`（`["zh", "en"]`）、`Locale`、`DEFAULT_LOCALE`（`"zh"`）、`LOCALE_COOKIE`（`"lang"`）、`Translations`（中文原文作为 key 的翻译映射） |
| `@fsdx/core/i18n-config` | `src/i18n/i18n-config/index.ts` | `createI18nInstance(locale, translations, fallbackLng?)` 创建 i18next 实例；插值前缀统一为 `{key}`；SSR 下需每次请求新建实例避免跨请求污染 |

### infra/（仅服务端，init 依赖注入）

| subpath | 源文件 | 关键导出 | 注入方式 |
|---------|--------|----------|----------|
| `@fsdx/core/logger` | `src/infra/logger/index.ts` | `createLogger(opts)` pino 工厂（`LoggerOptions`：level / storageDir / isProd） | 工厂模式，无全局注入 |
| `@fsdx/core/jwt` | `src/infra/jwt/index.ts` | `createJwt({ secret, logger })` → `JwtModule`（`signToken` / `verifyToken`，HS256，7 天有效） | 工厂模式 |
| `@fsdx/core/storage` | `src/infra/storage/index.ts` | `StorageAdapter` 接口、`LocalStorageAdapter`、`storage` 单例（写 `{STORAGE_DIR}/uploads/`） | 单例壳 |
| `@fsdx/core/captcha` | `src/infra/captcha/index.ts` | `create(userOptions?)` 生成 SVG 图片验证码、`createMathExpr(userOptions?)` 算式验证码、`captchaText(options?)` 生成验证码文本 | 纯函数，无注入 |
| `@fsdx/core/batch-writer` | `src/infra/batch-writer/index.ts` | `BatchWriter<T>` 通用批量缓冲写入器（满 `batchSize` 立即刷 / 定时 `flushInterval` 刷 / 超 `maxBufferSize` 丢弃最旧 / `shutdown()` 强制刷） | 构造注入 `insertFn` + logger |
| `@fsdx/core/request-context` | `src/infra/request-context/index.ts` | `runWithRequestContext(ctx, fn)`（AsyncLocalStorage）、`getRequestContext()`、`getRequestOperator()`（无上下文兜底 `system`）、`RequestOperator` / `OperatorType` 类型 | 纯函数 |
| `@fsdx/core/scheduler` | `src/infra/scheduler/index.ts` | `registerTask(task)`、`stopTask(name)`、`stopAllTasks()`、`getTaskNames()`（cron；任务支持 `timeZone` 字段，默认 `Asia/Shanghai`） | `setSchedulerLogger(logger)` 注入日志 |
| `@fsdx/core/ai` | `src/infra/ai/index.ts` | `initAi({ getConfig, logger })`、`deepChat` / `fastChat` / `deepChatStream` / `fastChatStream`（deep 失败自动降级 fast、空内容参数变化重试）、`truncateJsonForLlm`（OpenAI 兼容，配置指纹变更自动重建客户端） | `initAi` fail-fast |
| `@fsdx/core/semaphore` | `src/infra/semaphore/index.ts` | `Semaphore` 并发限流（`acquire` / `release` / `activeCount` / `queueLength`）、`SemaphoreTimeoutError`；许可打满时有界排队，队列满 / 等待超时拒绝 | 纯逻辑类 |
| `@fsdx/core/task-manager` | `src/infra/task-manager/index.ts` | `createTaskManager<TState, TEvent>()` 内存任务管理器（状态机 + TTL 惰性清理 + 事件缓冲 / SSE 订阅与断线回放） | 纯逻辑工厂 |
| `@fsdx/core/mail` | `src/infra/mail/index.ts` | `initMail({ getConfig, logger })`、`sendMail(options)`、`sendCaptchaMail(...)`（nodemailer SMTP） | `initMail` fail-fast |
| `@fsdx/core/sms` | `src/infra/sms/index.ts` | `initSms({ getConfig, logger })`、`sendSms(phone, code)`（阿里云，服务商工厂模式） | `initSms` fail-fast |

> `ai` / `mail` / `sms` 依赖系统配置表的 `ai_*` / `smtp_*` / `sms_*` 键，由宿主 `bootstrap.ts` 调用对应 `init*` 注入 `getConfig` 回调与 logger；未 init 直接调用会抛错（fail-fast，禁止静默降级）。

## 主要外部依赖

`clsx` / `tailwind-merge`（cn）、`jose`（jwt）、`pino` + `pino-pretty`（logger）、`i18next`（i18n-config）、`cron`（scheduler）、`nodemailer`（mail）、`openai`（ai）、`@alicloud/*`（sms）、`opentype.js`（captcha 字体）。

## 测试

`pnpm --filter @fsdx/core test`。各模块测试就近放置在 `__tests__/` 子目录，覆盖 utils / cache / i18n / infra 全部导出。

## 相关文档

- 应用层架构与目录职责：[docs/architecture-overview.md](../../docs/architecture-overview.md)
- 缓存体系（实例归属与懒加载约定）：[docs/cache-system.md](../../docs/cache-system.md)
- 数据库 Schema（业务层，位于 app）：[docs/database-design.md](../../docs/database-design.md)
- 组件库：[@fsdx/ui-ssr](../ui-ssr/README.md)（shadcn）、[@fsdx/ui-spa](../ui-spa/README.md)（antd）

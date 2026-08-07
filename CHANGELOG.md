# CHANGELOG

## [Unreleased]

### Breaking Changes

- **单人多角色改造（双端 RBAC）**：`admin_user.role_id` / `client_user.client_role_id` 单角色外键 → `admin_role_ids` / `client_role_ids`（jsonb string[]，多角色权限取并集）
  - 迁移 `0001_curious_maximus.sql`：新增 jsonb 数组列并回填旧单角色数据后删除旧列
  - 管理员/客户端用户管理页角色字段改多选；新增 `/admin/client-roles` 客户端角色管理页（含 `client-role:view/create/edit/delete` 权限码与菜单项）
  - `AdminUser.roleName` → `roleNames: string[]`；`getAdminRolePermissions` / `getClientRolePermissions` 改为按角色 id 数组合并权限

- **Monorepo 重构**：单仓库单应用 → 单仓库多包（pnpm workspace）
  - 目录迁移：`src/` 整体移入 `app/src/`（`@fsdx/web`），根 `package.json` 改为 `--filter` 编排壳；`server.ts`/`public/`/`drizzle/`/配置文件移入 `app/`
  - 新增 `@fsdx/core`（subpath exports，`pure/` 同构 + `node/` 仅服务端）：ms / export / cache-core / match-permission / error-utils / i18n-types / i18n-config / cn / logger / jwt / storage / captcha / batch-writer / request-context / scheduler / ai / mail / sms
  - 新增 `@fsdx/ui-ssr`（shadcn button/card/badge/input/textarea + AutofillBlocker）与 `@fsdx/ui-spa`（antd 基础组件，antd 为 peerDependency）
  - logger 改 `createLogger` 工厂：app 保留 `#/lib/logger/logger` 单例壳，27 处引用零改动；jwt 改 `createJwt` 工厂 + app 惰性单例壳，`COOKIE_NAMES` 迁至 `src/constants/cookie-names.ts`
  - ai/mail/sms 改 `initX` 依赖注入（bootstrap 注入 `getConfig` + logger），未 init 直接调用抛错；scheduler 改 `setSchedulerLogger`
  - `matchPermission` 迁入 core；`OperatorType` 迁入 core request-context，`db/schema/operation-log.ts` re-export；`log-reader.ts` 就近迁至 `services/logs/`
  - antd-static 迁入 ui-spa，app 保留 `#/components/antd-static` 壳 re-export；Tailwind 经 `@source` 扫描 ui 包源码类名

### Refactor

- **用户/认证/日志/操作日志向 bom-easy 对齐**：
  - 中间件：新增 `clientPermRouteGuard`（客户端 Server Route 权限守卫，捕获 `ClientAuthError` 转状态码 JSON）；`/api/download/log/$id` 改用 `adminPermRouteGuard` 中间件，删除 `api-auth.ts`（`verifyAdminPerm`/`ApiAuthError`），`sf-error-logger` 同步移除 `ApiAuthError` 分支
  - 操作日志：`logExternalRequest()` 落库字段语义对齐——`module`=外部系统标识（调用方传入）、`action`=`login`/`request`（按请求类型）、`targetType`=接口来源类型（默认 `openapi`，调用方可指定）、`targetName`=接口路径，`detail` 含 system/success 并展开 extra
  - 鉴权：`getCurrentAdmin`/`getCurrentClient` 将未删除约束下沉到 SQL 层（`and(eq, isNull)`），保留 JS 侧防御校验；管理员找回密码重置后补 `clearAdminUserCache`
  - 基础设施：`sanitizeError()` 递归脱敏 `error.cause`（含非 Error 对象，防敏感字段透传 + 循环/深度防护）
  - 测试补强：操作日志 `logCrud`/`logExternalRequest` 覆盖（默认 admin、ALS 上下文、system 兜底），admin/client `getCurrent*` 的 where 条件哨兵断言（EQ + ISNULL 防 `&&` 吞条件）
- **埋点模块重构为神策简化模型（track 命名体系）**：表/服务/路由/权限码统一更名
  - 表：`event`→`track_event`（列 `event`→`name`）、`preset_event`→`track_event_meta`、`preset_property`→`track_property_meta`，Schema 合并为 `src/db/schema/track.ts`
  - 服务：`src/services/event/`→`src/services/track/`，`trackEvent()` 增加 per-session 频控（60 条/分钟）与时间钳制（过去 1 天 ~ 未来 5 分钟）
  - 路由：`/admin/events/*`→`/admin/track/*`（`/admin/track/query`、`/admin/track/analytics`、`/admin/track/event-meta`、`/admin/track/property-meta`），菜单「预设事件/预设属性」→「元事件/元属性」
  - 权限码：`event:view/query/manage`→`track:view/query/manage`
  - SDK 入参：`trackEventSFn` payload 字段 `event`→`name`
  - 预置清单裁剪：元事件 9→5、元属性 16→11，`ensurePreset*` 增补清理逻辑
- **管理端角色改名 `role`→`admin_role`**：表、`admin_user.role_id`→`admin_role_id`、模块 `src/services/admin-role/`、路由 `/admin/admin-roles`、权限码 `role:*`→`admin-role:*`、审计模块名 `admin_role`
- **DB 迁移基线重置**：统一 generate+migrate（移除 db:push），重建 `drizzle/0000_initial.sql`（17 张表全量建表，允许清库）

### Refactor

- 目录分层：新增 `src/constants/`、`src/validators/`、`src/utils/`、`src/types/`；`lib/query` 类型迁入 `types/query.ts`；删除 `format-date` 改用 dayjs 内联
- 缓存拆分：`lib/cache/cache.ts`→`core.ts` + 按模块 `*.cache.ts` 实例文件，新增 `adminUserCache`
- 新增 `lib/request-context`（AsyncLocalStorage 操作者身份）+ `lib/buffer/batch-writer`（通用缓冲写入器，event/operation-log 复用）
- 操作日志：`logCrud()` 一行式审计封装 + `logExternalRequest()`（从 ALS 读操作者），`operation_log` 新增 `operator_type` 列；32 处 CRUD 审计调用迁移
- 中间件统一：`resolveAdminAuthContext()` 一步校验 + `adminPermRouteGuard`（Server Route）+ api-auth 复用；中间件不直接查 DB，委托 `getAdminUserForAuth()`/`getClientUserForAuth()`（带缓存）
- 新增客户端 RBAC 框架：`client_role` 表 + `client-permissions.ts` + `clientAuthGuard`/`clientPermGuard`，init 种子 `client-super-admin`/`normal-user`，注册分配默认角色
- Schema 单一来源：admins/clients/admin-role 服务输入类型改 `z.infer` 派生，消除 `as XxxInput` 桥接断言
- 分层违规清理：captcha/file/forgot-password 的 DB 逻辑从 `.functions.ts` 提取到 `.server.ts`；news `generateSlug` 去重（消除循环依赖）
- antd-static 桥接：message/modal/notification 经 `App.useApp` 捕获，31 处静态 message 调用迁移；AdminProvider 加 `<StyleProvider layer>` + 品牌色 `#00b96b`
- 样式分层：两份 global.css 预声明 `@layer theme, base, antd, components, utilities` + 裸 `a` 语义色兜底
- 新增 `sfn-helpers.ts`（safeSfnCall/unwrapSfn）+ `hooks/use-sfn-call.ts` + `PermissionTags` + `useCrudPage`

### Features

- **消息中心（message）**：`message` 表（`recipient_type` + `recipient_id` 无外键）+ 服务层 10 函数 + 三组 SFn（客户端自助/管理端收件箱/管理端管理）+ 前台 `/messages`（shadcn/ui SSR）+ 管理端 `/admin/messages`（收件箱）与 `/admin/messages/manage`（管理）+ Header/AdminLayout 消息铃铛（30 秒轮询）+ `message:view/send/delete` 权限
- **文件资源管理器（file-explorer）**：`STORAGE_DIR` 目录浏览 + 路径穿越防护 + 写保护 + `/admin/file-explorer` 页面 + `/api/download/file-explorer/*` 下载路由 + `file_explorer:*` 权限
- **lib/ms + MSInput**：vercel/ms 移植（parse/parseStrict/format/ms）+ 4 个测试文件 + antd 时长输入组件
- 修复既有测试失败：jwt 测试 logger mock 缺 `debug`；news 测试 i18n.server mock 缺 `applyTranslations`（改用 `importOriginal`）

### Fix

- **中间件 import-protection 告警**：`resolveAdminAuthContext`/`resolveClientAuthContext` 下沉到 `middleware/*.server.ts`，中间件 guard 在 `.server()` 回调内动态导入；客户端构建剥离回调后不再残留 `.server` 依赖（此前 admin 侧因函数被 export 无法被死代码消除而告警）
- **AdminRootDocument `<title>` 告警**：`{siteName} 管理后台` 两个 children 改为模板字符串，消除 React title 数组警告

### Infrastructure

- PostgreSQL + Drizzle ORM（17 张表，uuid 主键，软删除，timestamptz）
- Vitest 测试（79 个测试文件，822 条测试）
- 迁移流程：`pnpm db:generate` + `pnpm db:migrate`（bootstrap 启动自动执行）

### Refactor

- **权限模块迁至顶层 `src/permissions/`**：权限码从 `src/constants/permissions/` 提升为顶层领域模块（与 `src/db/` 同级），30 处 `#/constants/permissions/*` 引用改为 `#/permissions/*`，同步更新 AGENTS.md 与 skill 文档路径
- **权限命名全对称（破坏性重构）**：`permissions.ts` → `admin-permissions.ts`，符号全量加 `Admin` 前缀（`PERMISSIONS`→`ADMIN_PERMISSIONS`、`PermissionDef`→`AdminPermissionDef`、`hasPermission`→`hasAdminPermission` 等），与 `client-permissions.ts` 的 `Client*` 命名对齐
- **权限码分隔符规范化**：`file_explorer:*`→`file-explorer:*`、`dict:*_item`→`dict:*-item`；审计模块名 `file_explorer`/`admin_role` 同步为 kebab（`operation_log.module` 数据格式变更）
- **组件命名规范化**：`components/admin/nav-config.tsx` → `NavConfig.tsx`

## [1.0.0] - 2026-06-23

### Features

- 基于 TanStack Start 的全栈 Web 应用框架，内置 CMS 示例
- 双端同构：管理端 SPA（`/admin`）+ 客户端 SSR 前台（`/`）
- 双用户认证体系（管理员 + 客户端用户），JWT + bcryptjs
- RBAC 权限模型：角色 → 权限码 → 管理端 SFn 鉴权中间件
- 管理员 CRUD（`/admin/users/admins`）含角色分配、密码重置
- 客户端用户 CRUD（`/admin/users/clients`）含状态管理
- 角色管理（`/admin/roles`）含权限码多选
- 新闻管理（`/admin/news`）含 RichEditor 富文本编辑
- 字典管理（`/admin/dicts`）含标签颜色、预置字典保护
- 系统配置（`/admin/config`）含站点设置、SMTP、AI 配置分组
- 文件管理（`/admin/files`）含上传、秒传、临时/永久状态
- 操作日志审计（`/admin/operation-logs`）含缓冲批量写入
- 日志查询（`/admin/logs`）按关键词/级别/日期搜索
- 翻译管理（`/admin/translations`）含 UI 翻译 + 内容翻译
- 事件埋点分析（`/admin/events`）含 9 个预设事件 + 15 个预设属性管理 + 查询分析
  - 客户端自动采集系统属性（$browser、$os、$device_type、$user_agent、$language、$screen_size）
  - 服务端自动注入 $ip（x-forwarded-for）和 $user_agent（请求头）
  - 登录/注册/退出埋点已接入（Login、Register、FormSubmit、Logout 事件）
- 仪表盘统计（`/admin`）新闻/用户/文件概览
- 组件演示（`/admin/demo`）编辑器 + AI 聊天
- 系统初始化（`/admin/init`）首次部署自动引导
- 国际化（i18next）：zh/en，支持 UI 固定文案 + 实体字段翻译
- 邮件发送（nodemailer）：SMTP 配置存于系统配置表
- AI 集成（OpenAI 兼容）：深度思考 + 快速模型，翻译 + 聊天
- AI 翻译（`/admin/translations`）一键多语言翻译
- 图片验证码：SVG 生成 + 校验，防机器注册
- 邮箱验证码：发送 + 校验，频率限制
- 客户端注册/登录/登出：邮箱验证码 + TanStack Form + shadcn/ui
- 内存缓存：config/dict/uiTranslation/clientUser/presetEvent/presetProperty 共 7 个实例
- 文件存储抽象层：本地存储实现
- 定时任务（cron）：每小时清理过期临时文件 + 每天凌晨清理过期日志
- 缓冲写入策略：事件埋点 + 操作日志（5 秒/100 条/上限 1000 条）
- 优雅关闭：SIGTERM/SIGINT 刷新缓冲队列
- 健康检查：`GET /health`（Hono）
- SF 错误日志中间件：自动覆盖所有 Server Function
- CSRF 保护：基于 Origin/Referer/Sec-Fetch-Site 校验
- Import Protection：防止 bcryptjs/drizzle-orm/openai 泄漏到客户端
- 环境变量：zod schema 校验 + dotenv 手动加载
- 文件/日志下载 API（`/api/download/`）

### Infrastructure

- PostgreSQL + Drizzle ORM（15 张表，uuid 主键，软删除，timestamptz）
- pino 日志（按天文件流 + 控制台美化）
- Vitest 测试（40 个测试文件，502 条测试）
- Biome lint/format + TypeScript strict
- Vite 8 构建 + Tailwind CSS 4 + shadcn/ui
- Ant Design 6（管理端）+ shadcn/ui（前台）
- WangEditor 5 富文本编辑器 + Monaco 代码编辑器

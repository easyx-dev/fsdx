# Monorepo 重构

> **执行状态：已完成**（2026-08）。本文为原方案；实际落地与本文的差异如下，以代码为准：

| 决策点 | 本文方案 | 实际落地 |
|--------|----------|----------|
| 包数量 | 4 包（core / components / ui-ssr / ui-spa） | 3 包（core / ui-ssr / ui-spa），`components` 包取消，AutofillBlocker 并入 ui-ssr |
| logger 模式 | `initLogger` 全局注入 | `createLogger` 工厂 + app `#/lib/logger/logger` 单例壳（27 处引用零改动） |
| core 导出 | 单一 `exports` 桶 | subpath exports（无根桶），`pure/`（同构）+ `node/`（服务端）分层 |
| antd-static | 归 ui-spa | 归 ui-spa，app 直接经 `@fsdx/ui-spa/antd-static` 导入 |
| i18n.types | 留 app | 入 core/pure |
| COOKIE_NAMES | 留 app | 拆至 `src/constants/cookie-names.ts` |
| AdminPageContent | 留 ui-spa | 留 ui-spa（用户决策） |
| cn.ts | 入 ui-ssr | 入 core/pure（依赖 clsx/tailwind-merge，多包共享） |

本文仍保留作为重构背景与决策依据。

---

本文将 fsdx-web 从「单仓库单应用」重构为「单仓库多包」（monorepo）的落地实施文档，覆盖目标结构、包边界、init 依赖注入模式、拆分决策、迁移步骤、配置变更、验证与回滚。

## 背景与目标

原项目为单体应用，`src/lib/`、`src/components/` 与业务代码混居一处。重构动机：

| 动机 | 说明 |
|------|------|
| 多项目复用基础设施 | 让 `lib/` 的纯逻辑（ms/logger/cache 等）能被其他 fsdx 项目复用 |
| 独立版本/发布 | 每个包独立版本号，changesets 仓库内管理 |
| 视图层打薄 | 拆除纯 UI 基础组件，`app/` 只保留核心业务 |
| 强制代码边界 | 通过包边界让分层不可跨越，替代靠 AGENTS.md 人工约束 |

### 核心决策

| 决策点 | 结论 |
|--------|------|
| 仓库根 | 原地升级 fsdx-web，保留 git 历史，不新建总仓 |
| app 形态 | 根目录下一个独立 workspace 包 `app/`（`@fsdx/web`），`src/` 整体移入 `app/src/` |
| 包粒度 | 4 个包：core / components / ui-ssr / ui-spa |
| 构建方式 | 源码直引：app 的 Vite 直接解析包源码，无预构建 |
| 版本管理 | changesets，仅仓库内版本管理 |
| UI token | 宿主 app 注入 CSS 变量 token，包内只写 tailwind 类名 |
| antd | ui-spa 包将 antd 列为 peerDependency，app 提供单一实例 |
| 外部依赖注入 | 有外部依赖的模块（jwt/ai/mail/sms/logger）采用 init 依赖注入 |

## 目标结构

```
fsdx-web/                        # monorepo 根 = app（git 历史保留）
├── package.json                 # 根编排（scripts 用 --filter）
├── pnpm-workspace.yaml          # packages: ["app", "packages/*"]
├── tsconfig.base.json           # 共享编译配置
├── biome.json                   # includes 覆盖全部
├── .changeset/                  # changesets 仓库内版本管理
├── .gitlab-ci.yml               # CI 适配 workspace
├── Dockerfile / docker-compose  # 部署适配 workspace
├── .env.example                 # 环境变量模板
├── app/                         # @fsdx/web —— 应用 package
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json            # extends ../tsconfig.base.json
│   ├── vitest.config.ts
│   ├── drizzle.config.ts
│   ├── drizzle/                 # 迁移文件（17 张表基线）
│   └── src/                     # 原 src/ 整体移入（#/* → ./src/* 不变）
└── packages/
    ├── core/                    # @fsdx/core —— 纯逻辑库（无 React）
    ├── components/              # @fsdx/components —— 纯原生零依赖组件
    ├── ui-ssr/                  # @fsdx/ui-ssr —— shadcn + tailwind token
    └── ui-spa/                  # @fsdx/ui-spa —— antd 管理端组件
```

`app/src/` 内的 `#/*`、`@/*` 别名继续指向 `./src/*`，代码引用零改动。

## 包内容与边界

### @fsdx/core —— 纯逻辑库（无 React）

`src/lib/` 拆入 core 的模块分两类：

**无需 init（纯函数/类，零业务依赖）**

| 模块 | 外部依赖 | 说明 |
|------|----------|------|
| `ms` | 无 | 时间字符串与毫秒互转（vercel/ms 移植） |
| `export` | 无 | CSV / JSON 序列化 |
| `cache/core.ts` | 无 | `MemoryCache<T>` 通用类（实例留 app） |
| `buffer/batch-writer` | logger | 通用批量缓冲写入器 |
| `storage` | node | 文件存储抽象层（本地实现） |
| `captcha` | opentype.js + 字体文件(80K) | 图片验证码生成，字体资源随包 |
| `i18n.config` | i18next | i18next 实例创建工厂（locale 常量留 app） |
| `request-context` | node:async_hooks | 请求级上下文（AsyncLocalStorage） |
| `matchPermission` | 无 | 权限码匹配纯函数 |

**需 init 注入（依赖外部配置/资源）**

| 模块 | init 签名 | 注入内容 |
|------|-----------|----------|
| `logger` | `initLogger({ level, storageDir, isProd })` | 日志级别、存储目录、生产环境标志 |
| `jwt` | `initJwt({ secret, logger })` | JWT_SECRET、日志实例 |
| `ai` | `initAi({ getConfig, logger })` | 配置读取回调（ai_base_url 等）、日志实例 |
| `mail` | `initMail({ getConfig, logger })` | 配置读取回调（smtp_*）、日志实例 |
| `sms` | `initSms({ getConfig, logger })` | 配置读取回调（sms_*）、日志实例 |
| `scheduler` | `initScheduler({ logger })` | 日志实例 |

### @fsdx/components —— 纯原生零依赖组件

| 组件 | 依赖 | 说明 |
|------|------|------|
| `AutofillBlocker` | 仅 react | 阻止浏览器自动填充的隐藏诱饵输入框 |

与 ui-ssr、ui-spa 并列。`Logo` 不拆，留在 app（依赖 public 静态资源路径）。

### @fsdx/ui-ssr —— shadcn + tailwind token

| 内容 | 说明 |
|------|------|
| `components/ui/*` | button / card / badge / input / textarea 五个 shadcn 基础组件 |
| `utils/cn.ts` | className 合并工具 |

依赖：react、clsx、tailwind-merge、class-variance-authority、@radix-ui/react-slot。颜色 token 由宿主 app 通过 Tailwind `@source` 扫描包源码注入。

### @fsdx/ui-spa —— antd 管理端组件

| 组件 | 说明 |
|------|------|
| `AdminPageContent` | 管理端页面容器（吸顶标题栏 + 内容区） |
| `antd-static/index` | antd 静态方法桥接（message/modal/notification） |
| `TableOperate` | 表格操作列容器（Edit/Delete/Link/Custom） |
| `ProTable` | 管理端 ProTable 封装 |
| `PermissionTags` | 权限标签展示 |
| `JsonImportButton` | JSON 导入按钮 |
| `CodeEditor` | Monaco 代码编辑器 |
| `upload/FileUploadRender`、`upload/PhotoWall` | 纯展示的 antd 上传组件 |
| `MSInput` | 时间字符串输入（依赖 `@fsdx/core` 的 ms） |

antd 为 **peerDependency**（app 提供单一实例，AntdStatic 桥接必须同实例）。外部依赖 @monaco-editor/react 随包。

### 留在 app（不拆）

| 位置 | 内容 |
|------|------|
| `src/db/` | 全部 schema、migrate、index |
| `src/services/` | 全部服务端业务逻辑 |
| `src/routes/` | 全部路由页面 + SFn |
| `src/middleware/` | 全部鉴权中间件 |
| `lib/global-store/` | React store（zustand + SFn） |
| `lib/track/` | 客户端埋点 SDK（依赖 track SFn） |
| `lib/i18n/i18n-context.tsx` | React Context + global-store |
| `lib/cache/*.cache.ts` | 6 个缓存实例（依赖业务 schema） |
| `lib/permissions/` | 业务权限码 + hasPermission/hasAnyPermission/hasAllPermissions + PermissionDef/PermissionCode/PERMISSION_META/ALL_PERMISSIONS/PERMISSIONS_BY_GROUP/definePermission |
| `lib/i18n/i18n.types.ts` | `SUPPORTED_LOCALES`/`DEFAULT_LOCALE`/`LOCALE_COOKIE`（app 特有约定） |
| `components/admin/` | 业务组件（AdminProvider/AdminLayout/DictSelect/RichEditor/FieldTranslationDrawer 等） |
| `components/client/` | 前台组件（Header/Footer/ClientAuthProvider 等） |
| `components/Logo.tsx`、`Document.tsx`、`ErrorFallback.tsx` | 应用级组件 |

## init 依赖注入模式

### 设计动机

ai/mail/sms/jwt 等模块依赖外部配置（系统配置表、env），直接 import `#/services/config` 会把业务层带进 core。改为 **init 依赖注入**：core 提供纯逻辑，app 启动时注入回调。

```
core 包内                          app 端
┌─────────────────────┐           ┌──────────────────────────┐
│ let _getConfig:     │           │ bootstrap.ts             │
│   ((k: string) =>   │           │  initAi({                │
│    Promise<string>) │ ←──注入───│    getConfig, logger     │
│   ) | null          │           │  })                      │
│                     │           └──────────────────────────┘
│ export function     │
│   initAi(deps) {    │           services/config/config.server.ts
│   _getConfig =      │ ──┐       │  export async function
│     deps.getConfig  │   └────── │    getConfig(key) {...}
│ }                   │           └──────────────────────────┘
│ export async func   │
│   chat(...) {       │           // 未 init 时调用
│   assertInit()      │           // throw new Error(
│   ...               │           //   "AI 模块未初始化，请先调用 initAi")
│ }                   │
└─────────────────────┘
```

### 统一规则

1. **fail-fast**：未 init 直接调用时抛错，提示先调用对应 init，禁止静默降级
2. **bootstrap 集中注入**：app 启动时统一注入，服务起来前完成
3. **注入顺序**：先 `initLogger`，再注入依赖 logger 的模块（ai/mail/sms/jwt/scheduler）
4. **配置变更重建**：core 内部保留 fingerprint 指纹比对逻辑（如 SMTP 配置变更自动重建 transporter）
5. **core 禁止反向依赖**：core 内不得出现 `#/services`、`#/db`、`#/routes` 引用

### bootstrap 注入示例

```ts
// app/src/bootstrap.ts（示意）
initLogger({ level, storageDir, isProd });
initJwt({ secret: process.env.JWT_SECRET, logger });
initAi({ getConfig, logger });
initMail({ getConfig, logger });
initSms({ getConfig, logger });
initScheduler({ logger });
```

### 未 init 行为

| 场景 | 行为 |
|------|------|
| 未调用 init 直接调用业务函数 | 抛错 fail-fast |
| 已 init 但配置缺失（如 smtp_host 为空） | 保留现有降级逻辑（邮件返回 false） |
| 配置变更 | fingerprint 变化时重建外部客户端 |

## 拆分决策记录

### 1. 权限模块拆分

`src/lib/permissions/permissions.ts` 混合了纯逻辑与业务码，拆分策略：

| 内容 | 归属 | 说明 |
|------|------|------|
| `matchPermission` | @fsdx/core | 纯函数，只依赖 `string[]` |
| `PERMISSIONS` | 留 app | 业务权限码（news/admin/dict/config...） |
| `PermissionDef`/`PermissionCode` | 留 app | 类型定义在 `PERMISSIONS` 之上 |
| `PERMISSION_META`/`ALL_PERMISSIONS`/`PERMISSIONS_BY_GROUP` | 留 app | 从 `PERMISSIONS` 派生 |
| `hasPermission`/`hasAnyPermission`/`hasAllPermissions` | 留 app | 入参类型绑定 `PermissionDef` |
| `definePermission` | 留 app | 业务工厂 |
| `client-permissions.ts` | 留 app | 复制品工厂删除，改 import core 的 `matchPermission` |

### 2. OperatorType 解耦

`request-context` 依赖 `db/schema/operation-log` 的 `OperatorType`（`"admin" | "client" | "system"`，type-only）。该类型移入 @fsdx/core，`db/schema/operation-log.ts` 改为 re-export，保持 app 内引用不变。

### 3. COOKIE_NAMES 拆分

`jwt` 模块的 `COOKIE_NAMES`（`fsdx_admin_token`/`fsdx_client_token`）是 app 特有的 Cookie 命名约定，留在 app。core 只提供签发/校验函数，`COOKIE_NAMES` 由 app 的 services/middleware 层持有。

### 4. antd 单实例

ui-spa 包将 antd 声明为 peerDependency。原因：antd 静态方法桥接（antd-static）必须在 app 的 `<App>` 上下文内工作，若存在两份 antd 实例会导致 message/modal 脱离 ConfigProvider。

### 5. UI token 宿主注入

ui-ssr 包内组件只写 tailwind 类名（`bg-primary`、`border-input` 等），不包含样式文件。颜色 token（CSS 变量）由 app 的 `global.css` 定义，app 的 vite 配置用 Tailwind `@source` 扫描 `../packages/ui-ssr/src` 使其类名可编译。

### 6. 业务耦合模块不拆

ai/mail/sms/global-store/track/i18n-context 等原判定为「依赖 services」的模块，通过 init 注入已可将 ai/mail/sms 拆入 core；global-store、track、i18n-context 因强依赖 SFn/React 仍留 app。

## 迁移步骤

按顺序执行，每步以验证收尾。

### Step 1：根目录初始化

1. 编辑 `pnpm-workspace.yaml`，加 `packages: ["app", "packages/*"]`
2. 创建根 `package.json`（编排脚本用 `--filter`），根 `name` 可保留 `fsdx-web`
3. 创建 `tsconfig.base.json`（抽出共享 compilerOptions）
4. 创建 `.changeset/` 配置
5. 更新 `biome.json` includes 覆盖 `app/**` 与 `packages/**`

**验证**：`pnpm install` 正常解析 workspace

### Step 2：app 包迁移

1. `git mv src app/src`
2. 将 `vite.config.ts`、`tsconfig.json`、`vitest.config.ts`、`drizzle.config.ts`、`drizzle/`、`.env` 移入 `app/`
3. 创建 `app/package.json`（name: `@fsdx/web`）
4. `app/tsconfig.json` extends `../tsconfig.base.json`
5. `app/vite.config.ts` 确认 `routesDirectory` 指向 `./app/src/routes`

**验证**：`git mv` 后 import 路径无断裂（`#/*` → `./src/*` 在 `app/` 内不变）

### Step 3：@fsdx/core 建包

1. 创建 `packages/core/`（package.json、tsconfig、exports）
2. 迁移 Tier1 纯模块：ms/export/cache.core/batch-writer/storage/captcha/i18n.config/request-context/matchPermission
3. 迁移 Tier2 模块并改造 init 注入：logger/jwt/ai/mail/sms/scheduler
4. 解耦 `OperatorType` 入包，`db/schema` re-export
5. core 依赖（jose/pino/opentype.js/i18next/nodemailer/@alicloud/cron/openai）声明在 core 的 package.json

**验证**：core 内无 `#/services`、`#/db`、`#/routes` 引用；core 独立测试通过

### Step 4：components / ui-ssr / ui-spa 建包

1. `packages/components/`：迁移 AutofillBlocker
2. `packages/ui-ssr/`：迁移 cn + 5 个 shadcn 组件
3. `packages/ui-spa/`：迁移 antd 组件，antd 为 peerDependency，MSInput 依赖 `@fsdx/core`

**验证**：各包零业务依赖，ui-ssr 类名依赖 tailwind token

### Step 5：app 改造

1. `bootstrap.ts` 集中 init 注入（先 logger 后其余）
2. 改 import 引用：`#/lib/{jwt,ms,logger,...}` → `@fsdx/core`；`#/components/ui/*`、`#/utils/cn` → `@fsdx/ui-ssr`；B 组 antd 组件 → `@fsdx/ui-spa`；`#/lib/permissions/permissions` 的 matchPermission → `@fsdx/core`
3. `app/package.json` 加 `@fsdx/*` workspace 依赖
4. `app/vite.config.ts` 加 resolve.alias 指向包源码 + Tailwind `@source`
5. `app/vitest.config.ts` include 覆盖 `src/**` 与 `packages/**/*.test.*`

**验证**：`pnpm check` 通过

### Step 6：CI/Docker 适配

1. `.gitlab-ci.yml`：安装阶段 workspace 安装，构建工作目录切到 `app/`
2. `Dockerfile`：COPY 根配置 + app + packages，构建产物指向 `app/.output`
3. `.env.example` 保持根目录，构建时注入

**验证**：本地 `pnpm --filter @fsdx/web build` 成功

### Step 7：根脚本编排

根 `package.json` scripts 用 `--filter` 统一调度：

```json
{
  "dev": "pnpm --filter @fsdx/web dev",
  "build": "pnpm --filter @fsdx/web build",
  "test": "pnpm -r test",
  "check": "pnpm -r check",
  "db:generate": "pnpm --filter @fsdx/web db:generate",
  "db:migrate": "pnpm --filter @fsdx/web db:migrate",
  "db:studio": "pnpm --filter @fsdx/web db:studio"
}
```

**验证**：根目录 `pnpm dev`、`pnpm build`、`pnpm test`、`pnpm db:*` 全部可用

### Step 8：文档同步

1. 更新 `AGENTS.md`：工程结构、命令、包边界、init 注入约定
2. 更新 `README.md` 文档索引
3. 更新 `docs/architecture-overview.md` 目录职责矩阵
4. 更新 `CHANGELOG.md`

## 配置变更清单

| 文件 | 变更 |
|------|------|
| `pnpm-workspace.yaml` | `packages: ["app", "packages/*"]` |
| 根 `package.json` | 编排脚本（--filter）、changesets 脚本 |
| `tsconfig.base.json` | 共享 compilerOptions（新文件） |
| `app/package.json` | name=`@fsdx/web`，加 4 个 workspace 依赖 |
| `app/tsconfig.json` | extends base，paths 加 `@fsdx/*` → 包源码 |
| `app/vite.config.ts` | resolve.alias 指向包源码；Tailwind `@source` 扫描 ui-ssr/ui-spa |
| `app/vitest.config.ts` | include 覆盖 `src/**` + `packages/**/*.test.*` |
| `app/drizzle.config.ts` | schema 路径不变（`./src/db/schema/`） |
| `biome.json` | includes 加 `app/**`、`packages/**` |
| `.gitlab-ci.yml` | workspace 安装、工作目录切 `app/` |
| `Dockerfile` | COPY 根配置 + app + packages |
| `.env.example` | 不变（根目录） |

## 验证与验收

| 检查项 | 命令 | 预期 |
|--------|------|------|
| 类型 + 规范 | `pnpm check` | tsc --noEmit + biome 全部通过 |
| 单元测试 | `pnpm test` | 全部测试通过（含 core 包测试） |
| 生产构建 | `pnpm build` | client + server 均 built |
| 开发冒烟 | `pnpm dev` | `/health` ok、首页 200 |
| 样式编译 | dev 打开前台 | ui-ssr 组件类名正常渲染（bg-primary 等 token 生效） |
| antd 单实例 | dev 打开管理端 | antd 组件正常，无双实例警告 |
| init 注入 | dev 启动日志 | bootstrap init 顺序正确，无「未初始化」报错 |
| 客户端构建 | `pnpm build` | 无 import-protection 报错（core 无 `.server`，风险低） |

## 风险与回滚

### 风险清单

| 风险 | 影响 | 缓解 |
|------|------|------|
| Tailwind `@source` 未扫描到 ui-ssr 类名 | ui-ssr 组件样式丢失 | dev 冒烟重点验证，确认 vite 配置 @source |
| antd 双实例 | AntdStatic 桥接失效，message/modal 脱离主题 | ui-spa 用 peerDependency 保证单实例 |
| init 注入顺序错误 | 依赖 logger 的模块拿到未初始化 logger | bootstrap 先 initLogger，再 init 其他 |
| `OperatorType` 解耦遗漏 | request-context 反向依赖 db | 迁移后 grep 校验 core 无 `#/db` 引用 |
| captcha 字体资源丢失 | 验证码渲染失败 | 字体文件随包，构建后冒烟验证码 |
| `matchPermission` 拆分遗漏 | permissions 反向依赖 core 自洽性 | 迁移后 grep 校验 |
| 客户端 import protection | core 若含 `.server` 泄漏到客户端 | core 为纯逻辑无 `.server`，构建验证 |

### 回滚策略

本次重构为**目录移动 + 包抽取**，无数据库变更（drizzle 迁移文件未动）：

1. 代码回滚：`git revert` 对应 commit
2. 数据库：无迁移，无需回滚
3. 若 init 注入导致运行问题：临时在 bootstrap 注释注入语句，各模块按需恢复直接读 env/import services

## 参考文档索引

| 文档 | 说明 |
|------|------|
| [架构总览](architecture-overview.md) | 系统分层架构、数据流、路由体系 |
| [认证与权限](auth-permission-model.md) | 双用户体系、RBAC、JWT、中间件链路 |
| [数据库设计](database-design.md) | 表结构、列命名约定、约束汇总 |
| [缓存体系](cache-system.md) | MemoryCache 设计、缓存实例、生命周期 |
| [事件埋点](event-tracking.md) | 客户端 SDK、服务端校验、缓冲写入 |
| [部署运维](deployment-ops.md) | 启动流程、定时任务、日志、优雅关闭 |

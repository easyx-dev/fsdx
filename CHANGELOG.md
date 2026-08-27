# CHANGELOG

## [Unreleased]

### Features

- **新增自定义 head 配置**：预置 `custom_head_config` 系统配置（`clientVisible`、`json` 类型），管理端可直接编辑 JSON（结构同 TanStack head()：`{ meta, links, scripts, styles }`，如百度统计、JSON-LD）；`parseCustomHeadConfig` 解析并校验 `scripts/styles.children` 为字符串，前台 `SSRRootDocument` head 全局注入，管理端不生效
- **资源管理器页面 UI 优化 + 夜间模式适配**：
  - 顶部面包屑改为可编辑路径输入框（`AdminPageContent` 新增可选 `titleTrailing` 插槽，路径输入 + 前往按钮，回车/按钮跳转，`normalizePath` 规范化输入）
  - 表格名称列定宽 320px，操作列不再强制 240px 宽度（按内容自适应，保留 `fixed: right`）；空态增加图标
  - 硬编码颜色全部替换为 antd 语义色 token（`--ant-color-text*`/`warning`）与 `--s-surface-tertiary`/`--s-text`，文本预览区明暗双主题自适应
  - 侧边栏菜单「目录浏览」更名为「资源管理器」（与页面标题一致）
- **接入 PWA manifest + 浏览器主题色跟随**：
  - 前台 `SSRRootDocument` head 引入 `/manifest.json`（theme_color/background_color 对齐前台亮色表面 `#ffffff`，start_url/scope 归一至 `/`），提供「添加到主屏幕 / 图标 / 地址栏主题色」能力
  - `ThemeScheme` 新增 `themeColor` 字段（与各端 `--s-surface` 同色，见 themes.ts 双写注释），`applyThemeToDom` 同步更新 `<meta name="theme-color">`，明暗切换 / 跨标签页 / 系统偏好联动时浏览器地址栏颜色跟随；前台与管理端 head 均挂载 meta，管理端不接 manifest
- **前台图标品牌色修正 + 暗色可见性适配**：
  - `favicon.svg` 描边与 F 文字由 antd 蓝 `#1677ff` 改为中性灰 `#212121`；`logo192.png` / `logo512.png` 由 React 默认青色原子 logo 重绘为中性灰六边形 F（Python 标准库几何渲染，一次性脚本见 `.tmp/`）
  - `Logo` 组件拆分 `ClientLogo`（前台）/ `AdminLogo`（管理端）并统一改为内联 SVG：前台 `currentColor` + `text-foreground` 随明暗主题自动取前景色，解决深灰 `logo.svg` 在暗色下不可见；管理端 fill 取 `--s-primary`、F 取 `--s-primary-fg`，随亮暗品牌色自动切换，替代固定棕色的 `logo-admin.svg`
  - `favicon.svg` 保留供亮色模式、新增 `favicon-dark.svg`（前台暗色主色 `#f5f5f5`），前台 head 双 favicon 按 `prefers-color-scheme` 切换
  - 删除不再引用的 `logo.svg`、`logo-admin.svg` 与无消费方的 `drizzle.svg` 死资源
- **管理端侧边栏菜单优化**：
  - `nav-config.ts` 重新组合分组：合并「用户管理 + 权限管理」为「用户与权限」，文件类、翻译类、日志类各自独立成组，解决原「系统管理」9 项杂物袋问题
  - 菜单命名对齐：角色管理 → 管理端角色（与客户端角色对称）、文件资源管理器 → 目录浏览、日志查询 → 运行日志；同组内重复图标差异化（IdcardOutlined/AuditOutlined/FileSearchOutlined/GlobalOutlined）
  - 菜单渲染自 AdminLayout 抽至 `AdminNav.tsx`（`AdminNav` + `useNavCollapse`）：分组支持折叠（CSS grid 0fr↔1fr 动画），折叠状态持久化到 localStorage（key `admin-nav-collapsed-groups`），路由切换自动展开包含激活项的分组，侧边栏图标模式下强制展开全部分组
  - 滚动条样式统一：`admin.global.css` 新增 `--s-scrollbar-thumb` 语义令牌（亮暗自适应）与 `.scrollbar-thin` 类，应用于侧边栏导航与 `AdminPageContent` 内容区

### Infrastructure

- **[infra] 系统配置新增布尔值类型**：`EditorType` 新增 `boolean`（管理端编辑渲染 Switch，列表用「是/否」彩色标签展示，存储仍为 `"true"`/`"false"` 字符串），`smtp_secure` 预置项改用该类型，消除管理端手拼 true/false；`ensurePresetConfigs` 对已存在预置项仅同步 valueType（value 等其余字段不受影响），已部署系统重启即生效

- **[infra] 认证 Cookie Secure 标志可配置化**：新增 `COOKIE_SECURE` 环境变量（未设置时生产默认开启），admin/client 登录 Cookie 的 `secure` 标志由 `isCookieSecure()` 统一决策；线上未启用 HTTPS 时设 `COOKIE_SECURE=false` 即可正常登录（此前仅 `NODE_ENV === "production"` 判定，无法显式关闭，http:// 访问下浏览器不保存 Cookie、登录后被立即打回登录页）；`.env.example`、dev docker-compose、部署文档同步，生产 compose 透传在部署子仓库（fsdx-deploy）同步

- **[infra] 生产部署子仓库（fsdx-deploy）+ 迁移 fail-fast**：
  - 新增 `deploy/` 子模块（[fsdx-deploy](https://github.com/easyx-dev/fsdx-deploy.git)，回灌自 bom-easy 部署实践）：生产 compose（内置 postgres + app，镜像 `ghcr.io/easyx-dev/fsdx`）、`deploy.sh` 一键部署（等待健康检查 = 迁移结果）、`backup.sh`/`restore.sh` 备份恢复、`preflight-migrations.sh` 迁移预检与运维手册
  - bootstrap `runMigrations()` 改 **fail-fast**（失败即应用启动失败，原 warn 容错移除），生产部署由子仓库健康检查捕获迁移结果
  - 新增 GitHub Actions（`.github/workflows/build.yml`）构建推送 `ghcr.io/easyx-dev/fsdx:{latest|sha|tag}`，与内网 GitLab CI 并存
  - `deployment-ops.md` 生产部署章节收敛为指向子仓库 README；AGENTS/guide 同步
  - 影响：数据库迁移失败不再静默容错（本地 dev 与生产均 fail-fast）；生产部署运维迁移至 `deploy/` 子仓库

- **[infra] 文档事实生成与校验（doc-facts，回灌自 bom-easy `/backport` 试点）**：新增 `app/scripts/doc-facts.ts` + `gen-doc-facts.ts` + `check-doc-facts.ts`，从代码单一事实来源生成 `docs/generated/{permissions,tables}.md`（`pnpm doc:gen`），`pnpm doc:check` 挂入 `pnpm check` 自动拦截文档数字漂移（如「17 张表」「9 个缓存实例」「61 个权限常量」）；documentation-architecture 将 docs/generated 由「预留」落实为已实现机制并补充事实变更流程

- **[infra] 模板命名面收敛化改造 + 衍生项目协同进化协议**：
  - **运行期标识收敛**（可被衍生项目吸收）：Cookie 名收敛为集中常量 `COOKIE_NAMES`（`src/constants/cookie-names.ts`，中性默认 `admin_token`/`client_token`，移除 `fsdx_*` 硬编码）；e2e 库名由 `DATABASE_URL` 派生 + `_e2e` 后缀（`E2E_DB_NAME` 可覆盖）；e2e 账号邮箱默认 example.com 域（`E2E_ADMIN_EMAIL`/`E2E_CLIENT_EMAIL` 可覆盖）
  - **部署文档路径示例中性化**：`/opt/{项目名}/` 占位、镜像 tag 示例改 `{项目名}`
  - **新增衍生项目协同进化协议**：`docs/project-ecosystem.md`（定位模型 + 演进方向判定准则 + 命名面映射 + 基线管理）；`.agents/skills/` 新增 derive-project / upstream-sync；`.agents/commands/` 新增 /derive、/import-upstream、/backport；`.agents/checklists/` 新增 derive / upstream-sync 两份清单；AGENTS.md 新增「衍生项目与协同进化」章节（命名收敛硬规则、`[infra]` 标记、回灌净化）
  - 影响：衍生项目可据 CHANGELOG `[infra]` 条目吸收基建变更；模板 Cookie 名变化，既有部署需重新登录

- **版本发布流程 + CHANGELOG 归档机制**：
  - `app/package.json`（`@fsdx/web`）新增 `version` 字段（起始 `1.1.0`，即下一个待发布版本），版本号统一 `v1.x.y` 与 git tag 一致，根 `package.json` 为 workspace 编排壳不设版本
  - 新增 `.agents/commands/deploy.md` 发布命令：联动提交 → 确定版本（未发布直接用当前版本，已发布则 bump patch）→ 更新 CHANGELOG（Unreleased 升版 + 归档）→ 打 tag（含 commit 摘要）→ 推送
  - AGENTS.md 新增「变更日志（CHANGELOG）」章节：主文件只保留 `[Unreleased]` + 最近 3 个版本 + 「历史版本」索引，更早版本归档至 `docs/archive/changelog/`
  - `[1.0.0]` 历史版本归档至 `docs/archive/changelog/v1.0.0.md`，主 CHANGELOG 历史索引链接指向归档

- **favicon ?url import 缓存治理**：favicon.svg / favicon-dark.svg / favicon-admin.svg 自 `public/` 移入 `src/assets/` 并以 `?url` import（`Document.tsx` 内联为带 hash 的资源，图标变更不再受浏览器 URL 缓存影响）；`manifest.json` 移除对已删除 `favicon.svg` 的图标引用（PWA 图标保留 png）
- **新增 check-architecture 架构审计命令**：`.agents/commands/check-architecture.md` 按 8 维度（分层/路由/SFn/组件/类型与 DB/安全/错误处理/测试）全量扫描并输出分级报告；配套 `.agents/checklists/` 新增 sfn / route / component 三份精简检查清单
- **AGENTS.md 新增「对话效率」章节**：约定控制单会话上下文体积（阶段化会话 / explore 子代理 / read 限定行范围 / bash 输出瘦身 / 长文档按需读取），对齐 bom-easy 项目治理实践

- **`@fsdx/core` 基础设施补齐（对照 bom-easy lib 查漏）**：
  - **`ai` 模块能力对齐**：重构拆分（types / client / chat / chat-stream / truncate，subpath 与既有 API 签名不变）；`ChatOptions` 新增 `extraBody`（如 DeepSeek thinking 控制，思考关闭时不传 temperature）；`deepChat` / `fastChat` 补齐 deep 失败自动降级 fast 重试、空内容参数变化重试（去 `max_tokens` → 改 `temperature=0`，带递增退避），客户端初始化同步超时与 SDK 重试；新增流式 `deepChatStream` / `fastChatStream`（逐 token 回调 + `reasoning_content` 思考流 + 降级通知）；新增 `truncateJsonForLlm` 大体积 JSON 结构截断。**行为变化**：空内容重试后仍为空时 `deepChat`/`fastChat` 直接抛错（原返回空串），`aiTranslateFieldSFn` 捕获后转友好提示，避免用户看到原始错误
  - **新增 `@fsdx/core/semaphore`**：`Semaphore` 并发限流（许可打满有界排队，队列满 / 等待超时抛 `SemaphoreTimeoutError`）
  - **新增 `@fsdx/core/task-manager`**：`createTaskManager` 内存任务管理器（pending/running/done/failed 状态机 + TTL 惰性清理 + 事件缓冲 / SSE 订阅与断线回放），供后台任务进度复用
  - **captcha 补齐 `createMathExpr`**：算式验证码生成（`+`/`-`/`+-` 随机），配套 `random.ts` 新增 `mathExpr` 原语
  - 全部新增/增强模块补齐 vitest 测试（ai 降级/重试/流式/截断、semaphore 并发与超时、task-manager 状态机与事件、captcha 算式）

- **Playwright e2e 测试体系接入（关键页面回归）**：
  - 新增 `@playwright/test`（app devDependency）+ `app/playwright.config.ts` + `app/e2e/`（helpers/scripts/specs），根命令 `pnpm e2e`（app 内 `pnpm e2e`）
  - 专用隔离数据库 `fsdx_web_e2e`（与开发库彻底隔离）：`e2e/scripts/prepare.ts` 负责建库、重置 public/drizzle schema、直接执行 drizzle 迁移 SQL（迁移记录写入 `drizzle.__drizzle_migrations`，与 bootstrap 的 `runMigrations` 读取路径一致，避免服务启动时重跑迁移）并种子 root 管理员 / 客户端用户 / 预置角色，服务启动时 bootstrap 自动补齐预置配置/字典/翻译；webServer 运行在独立端口 3100，避免与本地 dev server 冲突
  - 前台 SSR 5 个 spec（首页/Hero/Header、登录、注册、忘记密码、Header 登录态）：注册/忘记密码通过 `seedCaptcha()` 直插 `captcha_code` 绕开图片验证码弹窗与 SMTP 邮件链路，确定性通过
  - 后台 SPA 5 个 spec（登录、管理员用户、客户端用户、管理端角色、客户端角色）：覆盖列表/搜索/新建（含权限选择器）/编辑/重置密码/删除
  - `biome.json` 纳入 `**/e2e/**`，`app/tsconfig.json` 纳入 e2e 类型检查；`.gitignore` 增加 `test-results/`、`playwright-report/`

- **`/health` 健康检查端点迁移至 Server Route 并升级为就绪探活**：
  - 由 Hono 自定义路由（`hono-app.ts`）迁移为 TanStack Start Server Route（`routes/health.tsx`），Hono 层保留为空壳预留自定义 API 路由
  - 响应升级为通用健康检查风格：`status / uptime / timestamp / version / checks`，`checks` 并发探测数据库连通（`SELECT 1`，含 `latencyMs`）与存储目录可写；全部可用返回 `200`，任一异常返回 `503`（readiness 语义），供 Docker healthcheck / Playwright 正确等待依赖就绪
  - 检查逻辑位于 `src/services/health/health.server.ts`（含 vitest 覆盖）；版本号由 Vite `define` 从 `app/package.json` 构建时注入 `__APP_VERSION__`（`env.d.ts` 声明、`vitest.config.ts` 同步注入测试值）

- **[infra] 移除 Hono 自定义 API 层，回归纯 TanStack Start**：
  - 删除 Hono（`hono` / `@hono/node-server` 依赖）与 `src/hono-app.ts`，`app/server.ts`（Nitro entry）回归薄壳：bootstrap + HTTP 指标埋点 + 直接透传 TanStack Start SSR
  - 自定义 API 一律走 Server Function / Server Route（`/health`、`/api/metrics`、下载端点已有先例）；将来出现开放 REST / webhook 等非自身前端消费场景时再按需引入
  - `http_requests_total` 入口埋点修复：指标注册表挂载于 globalThis，解决 Nitro 入口与 SSR 渲染器分别打包 metrics.ts 导致入口计数不可见的问题（配套 vitest 覆盖跨模块图共享）
  - 影响：依赖减少、入口分流逻辑简化；请求行为等价（未匹配路由仍由 Nitro 兜底）

### Fix

- **前台登录后 Header 登录态不刷新**：客户端登录成功仅 `navigate` 到首页，`ClientAuthProvider` 不重挂载导致 Header 仍显示未登录；登录页 `onSubmit` 成功后补充调用 `useClientAuth().refetch()`，使用户名/消息/退出入口即时更新

- **统一 Asia/Shanghai 时区基准（定时任务/日志切割/按天查询）**：
  - `@fsdx/core` 新增 `@fsdx/core/date-format`（dayjs 实现）：`DEFAULT_TASK_TIME_ZONE`（`Asia/Shanghai`）、`DATE_ONLY_REGEX`、`toDateString` / `parseDateOnly` / `toDayRange`，天边界解析不依赖服务器时区（`TZ=UTC` 下已验证）
  - 定时任务：`registerTask` 支持 `timeZone` 字段，`CronJob` 默认按 `Asia/Shanghai` 调度（原依赖服务器本地时区，UTC 服务器上「每天 3:00」会偏成北京时间 11:00）
  - 日志体系：pino 日志文件名按天切割与 `cleanExpiredLogs()` 清理截止统一按 `Asia/Shanghai` 计算，与任务调度时区一致
  - 按天查询：operation-log 列表、埋点事件列表与事件分析的 `startDate/endDate` 边界改用 `toDayRange`（原 `new Date("YYYY-MM-DD")` 按 UTC 解析导致窗口偏移，事件查询页传 `endOf("day")` 再 +1 天造成边界溢出）；schema 增加 `YYYY-MM-DD` 格式校验；事件查询/分析页改传 date-only，与操作日志一致

### Refactor

- **路由目录组织边界补强 + forgot-password 服务层收编**：
  - AGENTS.md「路由目录组织」补边界与决策矩阵：路由文件 = 可独立访问的视图（有 URL / 进菜单 / 可深链分享 / 前进后退可达），页面本体必须建成路由文件，禁止塞进 `-mods/`；`-mods/` 收纳范围 = 就近 SFn + 路由局部 schema + 组件（表单/弹窗/列定义）+ 纯函数/常量，`*.server.ts` 一律归 `services/`；单页 vs 子路由决策矩阵（单视图页内 Tab/state、≥2 静态视图每视图一路由共用 `-mods/`、动态数量视图参数路由 `$xxx.tsx`）替代原两行决策表
  - architecture / server-function skill 违规自查与 docs/architecture-overview.md 同步（`-mods/` 目录树去掉 `.server.ts`，补页面本体禁入 `-mods/` 与多视图拆分自查）
  - **forgot-password 残留 `-mods/*.server.ts` 收编**：`resetClientPassword` / `resetAdminPassword`（自助验证码重置）重命名为 `resetClientPasswordByEmail` / `resetAdminPasswordByEmail` 收编至 `services/client-user/` / `services/admin-user/`（与既有管理端重置他人密码同名函数区分），SFn 导入路径更新，测试随迁至 `services/<module>/__tests__/`，删除路由 `-mods/` 内 `forgot-password.server.ts`
  - 自助重置函数健壮性对齐：bcrypt rounds 10 → 12（与同文件 CRUD 重置一致），update 改 `.returning()` 校验影响行数——用户被删除时不再静默返回成功

- **routes/services 分层重构（服务层收 services，SFn 就近路由）**：
  - 分层契约：`services/<module>/` 收**服务层**（`server` 业务逻辑 + `schemas` zod 单一来源 + `cache` + `types`），被服务层 `z.infer` 派生或跨端复用的 schema 必须收 services，纯路由局部 schema 可随 SFn 留在路由；`routes/**/-mods/` 放 UI 组件 + **就近的 SFn**（RPC 边界随消费页面，跨端实体 SFn 各拆到所属端路由），仅无页面消费的跨端共享 SFn（auth/captcha/track SDK/message/dict 选项/客户端可见配置/初始化状态/文件上传列表查询）留在 services
  - **news / dict / config**：路由 `-mods/` 的 `server` 收编至 `services/<module>/`，消除 `ensureUniqueSlug` / `MAX_RECOMMENDED` 重复实现（`checkRecommendedLimit` 统一按「新增数量」校验，修正 update 允许第 6 条推荐的越界）；`dict.server.ts` 补齐原缺失的 update 分支；SFn 就近回到各自路由 `-mods/`（news 拆管理端 + 前台两端），实体 schema 收 `*.schemas.ts`
  - **admin-role / client-role / admin-user / client-user / dashboard / logs / operation-log / translations / track（event-meta / property-meta / analytics / query）**：`server` + `schemas` 收编至 `services/<module>/`；SFn 就近回到对应路由 `-mods/`
  - **file / init / 登录**：删除/转永久、初始化、登录 SFn 回到各自路由 `-mods/`；文件上传/列表查询、`checkInitStatusSFn`、`getCurrentAdminSFn` / `logoutSFn`、`getCurrentClientSFn` / `clientLogoutSFn` 等跨端共享 SFn 保留在 services
  - **认证登录**：`adminLoginSFn` / `clientLoginSFn` 回归路由 login `-mods/`（登录 schema 为纯路由局部，内联）
  - 相关测试同步随迁（importConfigs / importDicts / ensureUniqueSlug 随被测模块至 `services/<module>/__tests__/`；路由局部 schema 测试改从路由 functions 导入）；路由组件仅从就近路由 `-mods/*.functions` 导入 SFn
  - `dict` / `dashboard` 的导入导出类型与统计类型抽至 `*.types.ts`（消除 `.server.ts` 反向 import `.functions.ts` 的分层倒置）
  - **dict 缓存失效内聚**：`updateDictRecord` / `createDictItemData` / `updateDictItemRecord` / `deleteDictItemRecord` / `importDicts` 在 server 层内部统一调用 `loadDictCache()`，删除 SFn handler 中的外置缓存刷新，与 `createDict` / `deleteDict` 的缓存所有权一致
  - 同步改写 architecture / server-function / admin-crud 三个 skill（双份 hardlink 副本）的分层契约、SFn 放置规则、Schema 归属与违规自查；修正 server-function skill 中 `.functions.ts → .server.ts` 误标为禁止的 Import 边界（实际为允许，handler 客户端构建剥离）
  - 文档路径时效更新：`auth-permission-model.md` 中 admin-user / client-user 服务层路径改指 `services/`；db-sqlite / test-writing skill 中 `dicts.server` 路径与 schema 导入示例同步修正

- **components 目录规范化重组**：
  - `admin/` 按职责分层：表单/输入控件（DictSelect、DictTag、PermissionSelector、RichEditor、FieldTranslationDrawer、editor-type/、upload/）统一收进 `admin/forms/`，管理端 zustand store 就近收进 `admin/stores/`，并新增 `index.ts` 统一出口
  - `NavConfig.tsx` → `admin/nav-config.ts` 改纯数据（icon 存组件引用，渲染处实例化）；`AdminThemeContext`/`useAdminTheme` 自 AdminLayout 拆出至 `admin-theme.ts`
  - `global-store/` 与 `i18n-context.tsx` 合并为 `providers/`，`useLocale` 改从 `I18nContext` 读取解除模块级循环依赖
  - 埋点 SDK 自 `components/track/` 迁至 `lib/track/track.ts`
  - `client/`、`providers/`、`admin/` 新增目录级 barrel；Header/Footer 默认导出改具名导出；全库约 48 处导入收敛为短路径
  - 删除无消费方的 `hooks/use-sfn-call.ts`

- **ui 包按域分桶导出 + app 上传/验证码组件抽离**：
  - ui-spa exports 收敛：`./table`（ProTable + TableOperate）、`./editor`（CodeEditor + RichEditor）、`./upload`（文件/图片上传 + 文件库弹窗），删除逐文件导出；`json-import-button` 内部改引 `./editor`
  - ui-ssr exports 收敛：`./ui`（shadcn 五件套）、`./theme`（ThemeToggle + useThemeMode）、`./form`（AutofillBlocker + ImageCaptchaModal），`use-theme-mode` 测试随迁 `theme/__tests__/`
  - FileUpload / ImageUpload / SelectFileModal 迁入 ui-spa，上传与文件库查询改 SFn 回调注入；app 保留同名薄壳接 `uploadFileSFn`/`getFileListSFn`，删除 app `SelectFileModal.tsx`
  - 前台图片验证码弹窗迁入 ui-ssr `ImageCaptchaModal`（SFn/错误/消息回调注入 + 内置 SVG 刷新图标），CaptchaInput 改薄壳，ui-ssr 不新增 sonner/lucide-react 依赖

- **单元测试查漏补缺**：
  - 修复 3 处假测试：track / files / register 的 schema 测试本地复制副本 → 改为导出真实 schema 并 import（`trackEventSchema`、`sendCaptchaWithImageSchema` 新增导出，translations import schema 提取命名导出）
  - 修复 `tasks.test.ts` 死 mock 与用例顺序依赖，改为真实执行 handler 覆盖清理分支；精简 ms 模块重复测试（index/parse-strict 收敛为分发与代表性用例）；清理 storage 测试无关环境变量
  - 补齐核心缺口：`getAdminUserForAuth` / `getClientUserForAuth`（鉴权 RBAC 解析）、track 上报校验链路（频控/事件名校验/属性类型/时间钳制）、`uploadFile`、file-explorer 写保护全路径、i18n 缓存与导入导出、log-reader 真实文件读取、图片验证码与短信发送、config/dict/news 分支
  - 补齐 4 组 schema 测试（message / client-role / file-explorer / translations import），track 新增测试专用 `resetTrackMetaCacheForTest` 重置缓存状态
  - core 包新增 logger / jwt / ch-to-path 测试，scheduler onTick 真实执行修复假覆盖；ui-ssr 补 use-theme-mode 系统偏好联动与跨标签页同步、新增 theme-toggle 三态测试
  - 弱断言修复：`buildSortClause` / `notDeleted` 补语义断言（防排序注入）、file 状态筛选、i18n upsert 分支、config getConfigList
  - 测试约定对齐：schema 测试就近放置（路由/模块 `__tests__/`），移除集中 `sf-schemas.test.ts` 约定（AGENTS.md 与 skills 同步）

- **路由目录组织优化**：
  - 测试目录统一：admin news / translations 的路由层测试自 `-mods/__tests__/` 迁至路由目录 `__tests__/`（对齐 AGENTS.md「schema 就近放置」约定，admin-crud skill 同步改为路由目录表述）
  - 仪表盘 companion 重命名：`_admin/-mods/index.functions.ts` / `index.server.ts` → `dashboard.functions.ts` / `dashboard.server.ts`，消除 `index` 通用命名
  - 超限页面拆分（均入对应 `-mods/`）：
    - `dicts`：抽 `DictFormModal` / `DictItemFormModal` / `DictListPanel` / `dictColumns` / `dictUtils`（684 → 335 行）
    - `file-explorer`：抽 `FileModals`（新建/重命名/预览）/ `fileExplorerColumns` / `fileExplorerUtils`（613 → 353 行）
    - `config`：抽 `ConfigFormModal` / `configColumns`（472 → 307 行）
    - `news`：抽 `newsColumns`（405 → 217 行）
    - `messages/manage`：抽 `SendMessageModal` / `messageManageColumns`（400 → 253 行）

- **下载路由回归模块 + 下载响应统一服务**：
  - 读取/下载/流式响应路由自 `routes/api/download/` 迁至所属模块：`routes/file/r.$id.tsx`（`/file/r/$id`）、`routes/admin/_admin/logs/download.$id.tsx`（`/admin/logs/download/$id`）、`routes/admin/_admin/file-explorer/download.$.tsx`（`/admin/file-explorer/download/*`），删除 `routes/api/` 目录；⚠️ **URL 变化**：原 `/api/download/*` 全部变更，旧书签/外链需更新
  - 新增 `services/download/download.server.ts`：`toWebStream` + `createFileDownloadResponse`，Content-Disposition 统一走 RFC 6266 `filename` + RFC 5987 `filename*=UTF-8''` 双头，修正中文文件名编码不一致
  - `file/r/$id` 保持前台公共访问（无登录守卫），新增 `createCsrfMiddleware` 同源校验防跨站盗链（放行 `same-origin`/`none`，拒绝 `cross-site`/`same-site`）；`logs` / `file-explorer` 下载路由保留 `adminPermRouteGuard` 管理端权限
  - ui-spa 上传组件回调 `downloadUrl` 更名 `readUrl`（该 URL 全程用于内联预览/打开，`/file/r/` 语义），`ImageUpload` / `FileUpload` / `SelectFileModal` 同步

- **Drizzle 升级 v0 → v1（rc.4）+ 移除 Relational Queries v1**：
  - `drizzle-orm` / `drizzle-kit` 升至 `1.0.0-rc.4`（v1 最新 rc，drizzle-kit 移入 devDependencies）；迁移目录重建为 v3 结构（每迁移一文件夹，去除 journal.json），开发库重建基线（17 张表）
  - ⚠️ **既有环境升级注意**：迁移历史已整体重建，任何已应用旧 `0000/0001` 迁移的库（其他开发机、预发/生产）需先重置库（`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 并清空 `drizzle` schema 迁移表）再启动，否则 bootstrap 的 `runMigrations()` 会对已存在的表执行建表而 fail-fast 崩溃；如需保留数据，须手工将新基线迁移 hash 回填进 `__drizzle_migrations`
  - 移除 RQBv1：全库 54 处 `db.query/tx.query.*.findFirst/findMany` 改为标准 query builder（`db.select().from(...).where(...).limit(1)`），回调式 where 内联为 eq/isNull/inArray/or，`getFileInfo` 的 columns 投影改 select 投影；`db` 实例不再传入 schema
  - 测试 mock 重构：mockDb 统一为可 await 的 select 查询链（`mockRows` 控制行数组），20 个测试文件同步；test-writing / admin-crud skill 示例更新；`noThenProperty` 规则仅在测试文件范围关闭（有意实现的 thenable）；删除死代码 `test-utils/db-mock.ts`
  - `db:migrate` 改走程序化迁移（新增 `src/db/migrate-cli.ts`）：drizzle-kit v1.0.0-rc.4 的 migrate 命令存在 CREATE SCHEMA 断连 bug（ECONNRESET），程序化路径与生产 bootstrap 的 `runMigrations()` 完全一致
  - `drizzle.config.ts` 的 schema 指向 `src/db/schema/index.ts`：目录扫描会重复收集表导致 `drizzle-kit generate` 失败

### Docs

- **文档体系边界治理（对齐 bom-easy documentation-architecture）**：
  - 新增 `docs/documentation-architecture.md` 作为文档边界模型 SSOT：六层体系（AGENTS → guide → skills → commands → checklists → docs）、内容性质→归属映射表、事实 SSOT 表、引用图、文档元信息块约定、维护规则
  - AGENTS.md 新增「文档体系」章节（L0-L5 分层 + 归属判定 + 事实不复制 + 引用单向可追踪），README 文档索引补收录
  - 新增 `.agents/guide.md` 任务导航：任务 → skills/docs/commands/checklists 映射 + 文档索引
  - docs/ 6 篇平台类文档头部补元信息块（定位 / SSOT / 引用关系 / 更新触发）
  - 数量/清单类事实收敛：README 与 docs 中「17 张表」「9 个缓存实例」「61 个权限常量」等改为「当前值 + 以代码为准」标注，数字准确性由权威文档兜底

- **文档全面校准 + 去重收敛**（对齐请求 ID 贯通、Prometheus 指标、routes/services 分层重构、i18n/track 服务拆分、TS 7 / Biome 2.5 等代码现状）：
  - 事实校准：AGENTS / README 技术栈版本（TypeScript 7、Biome 2.5）、删除已移除的 `pnpm changeset` 命令、README 命令表精简为常用项；缓存实例数 8 → **9**（新增 track 频控 `sessionRateCache`）；迁移失败行为按代码改为 `try/catch` + `logger.warn` 容错（非 fail-fast）；Server Route 例外补充 `routes/api/metrics.tsx`；`operation_log` ER 图补充 `request_id` 列并注明该表 camelCase 列命名例外；`dict` 缓存启动加载描述修正为懒加载；`configTranslationCache` 归属修正为 `services/config/`；i18n 拆分后路径更新（`i18n-ui.server.ts` / `i18n-content.server.ts`）；track 服务子文件索引（meta/validate/analytics）；SF 错误日志移除已删除的 `ApiAuthError`、补充 `ClientAuthError` 与埋指标/`toClientError` 归一化；环境变量补充 `DB_POOL_*` 连接池参数；文件存储物理路径修正为 `{STORAGE_DIR}/uploads/{date}/{name}`；登录时序图 SFn 命名统一 `SFn` 后缀
  - 新增基础设施入文档：请求 ID 贯通（requestIdMiddleware / `x-request-id` / `operation_log.request_id`）与 Prometheus 指标（`/api/metrics`、3 个预置指标、进程内聚合边界）写入 AGENTS / architecture-overview / deployment-ops / architecture skill
  - 去重收敛：技术栈版本、命令表、缓存实例清单、中间件执行链路、单实例一致性边界、服务层三层契约等重复声明各收敛为单一事实来源 + 交叉引用（auth-permission-model / server-function skill / cache-system / deployment-ops 各为权威载体，其余改链接）
  - skills 同步：cache 实例表 8→9 并与 cache-system 互标同步提示；server-function 全局错误日志改 `AdminAuthError`/`ClientAuthError` + `toClientError`；architecture 补 `lib/metrics`、请求 ID、Prometheus；permission 补权限清单引用
- **新增数据库迁移 skills（db-sqlite / db-mysql）**：
  - 沉淀 PostgreSQL → SQLite 完整迁移指南为 `db-sqlite` skill：基于 drizzle v1.0-rc.4 + node:sqlite 异步驱动基态，覆盖驱动选型、pg-core→sqlite-core 类型映射、约束差异（部分唯一索引/ON UPDATE CASCADE/降序索引）、**事务同步化（node-sqlite 'sync' kind 事务回调必须同步，否则提前提交）**、时间序列 SQL 改写、日期类型 Date→number、测试 mock 终结符适配与迁移执行流程
  - 新增 `db-mysql` skill：mysql2 异步驱动，事务与普通查询全部保持 await、日期保持 Date，迁移面最小；覆盖 uuid→char(36)、jsonb→json、json 列默认值限制等 MySQL 特有差异
  - db-schema skill 相关链接、AGENTS.md 数据库章节同步补齐目标库速查与 drizzle v1 基态说明
- **子包文档补齐 + 文档/技能对齐**：
  - 新增三个子包 README（`packages/core/README.md` / `packages/ui-ssr/README.md` / `packages/ui-spa/README.md`），含 subpath 导出清单、宿主集成约束与依赖边界；根 README、AGENTS.md、architecture-overview 建立对子包文档的引用
  - 删除已完成的历史方案 `docs/monorepo-restructure.md`（其包边界内容由三个子包 README 承接）
  - docs 事实对齐：README（17 张表 / 8 个缓存实例 / `db:push`→`db:generate`+`db:migrate`）、cache-system（`@fsdx/core/cache-core` 与实例路径、启动时序）、database-design（`admin_role_ids` / `client_role_ids` JSONB 多角色，无外键）、auth-permission-model（客户端 RBAC、61 个权限常量、`resolveAdminAuthContext` 现状实现）、event-tracking（预置 5 事件 / 11 属性、路径与函数名）、deployment-ops（core 基础设施路径、env 位于 `app/`）
  - skills 对齐：8 个 skill 修正过时路径与流程（core subpath 迁移、`@fsdx/ui-spa/table` 与 `antd-static` 导入、`logCrud` 一行式审计、mockDb 17 张表清单、`db:generate`+`db:migrate` 迁移流程）
  - **文档瘦身**：AGENTS.md 552 → 276 行（与 skill 重复的细节压缩为「硬规则 + skill 链接」，删除已修复的历史节；`src/services/` 准入门槛、就近原则、Server Route 例外补入 server-function skill，jsonb `$type` 约定补入 db-schema skill，`logExternalRequest` 字段语义补入 architecture skill）；`auth-permission-model.md` 640 → 552 行（删除重复性角色关系/客户端缓存 flow 与散乱文字，保留并时效修正整体架构、管理员登录、客户端注册登录、系统初始化四张图，按查考级组织）
  - 文档 review 修正：README 快速开始 env 路径指向 `app/.env.example`；i18n skill「支持的语言」片段去掉与导入重复的本地声明；cache-system 启动时序图更正 dict 缓存为懒加载（仅 config/track 元数据启动热加载）
- **文档引用源与事实校准（`.agents` 为引用权威，`.opencode` 不再作为文档引用来源）**：
  - AGENTS 命令表 `/deploy` 与 CHANGELOG 条目中 `.opencode/commands/*` 引用改为 `.agents/commands/*`；软链机制描述保留并明确内容以 `.agents/` 为准
  - 事实修正：缓存清单口径统一（`sessionRateCache` 位于 `track.validate.ts`，AGENTS / cache-system / README 三处一致）；`operation_log` 操作者列名 `operator_id`→`operatorId`（camelCase 例外）；auth-permission-model 登录/初始化页路径补 `index.tsx`、bcrypt cost 表述补自助重置=12（明确排除 init 的 cost=10）；deployment-ops init 页路径修正
  - 规则层补全：db-schema skill 补 `track_event_meta` / `track_property_meta` varchar 主键例外；test-writing skill 补按子模块/子功能拆分测试文件命名说明；命令表补 `/check-architecture`；documentation-architecture skills 清单补全至 10 个（AGENTS core 目录树模块明细已移交给 core README，见下条收敛记录）
  - 清理 `.opencode/` 未入库残留（node_modules / package.json / package-lock.json / .DS_Store），仅保留指向 `.agents/` 的软链视图
- **工程结构描述收敛（消除重复罗列）**：
  - AGENTS「工程结构」树去重：`lib/` 段删文件明细（薄壳名保留在注释）、core 段删模块明细只留 `utils/i18n/cache/infra` 四桶分层（导出清单指向 core README），避免与包 README 双份维护
  - architecture-overview 删除「目录职责矩阵」与「关键文件索引」两节（前者职责/规则与 AGENTS 树及既有章节重复，后者前 10 行即 AGENTS 树注释、后 9 行系文档导航）：改为「目录职责」引用段（指向 AGENTS 工程结构/包边界/依赖方向）+「相关文档」导航表，文件级职责不再重复罗列
  - architecture-overview「系统分层架构」图与「路由分层」树收敛为概览：删除 services 22 个模块名、core 模块清单与「17 张表 + 9 个缓存」等易漂移枚举（图内改指向 `src/services/`、core README、database-design、cache-system），路由树改分组概览并以 `src/routes/`（`routeTree.gen.ts`）为 SSOT
- **文档体系统一治理（doc:check 守门补强 + markdown 风格成文）**：
  - CHANGELOG 结构重整：历史积压条目拆为 `[v1.1.0] - 2026-08-24` 版本段并合并重复分类标题，恢复「每个分类仅一个块」规则；AGENTS / deploy command 的 CHANGELOG 规则一致
  - doc:check 守门补强：新增 skill 数量事实（`computeFacts` 扫描 `.agents/skills`，拦截「N 个 skill」漂移），扫描范围扩展至 `.agents/` 规则文档、子包 README 与 deploy README（CHANGELOG 为历史记录不参与当前事实比对）
  - documentation-architecture 新增「markdown 风格规范」章节（文件结构/标题层级/表格/代码块/中文排版/CHANGELOG 结构/skill 与 command 结构模板），AGENTS 文档体系章节补引用；修正 skill 清单 10→12（补 derive-project / upstream-sync）
  - deploy command 补 H1 标题，与其余 command 结构对齐

### 依赖升级

- **major 版本升级（批次 C）**：
  - **typescript 6→7.0.2**：原生 Go 移植编译器（约 10x 加速），仅使用 CLI `tsc --noEmit` 无程序化 API 依赖，tsconfig 无已弃用选项（bundler 解析/显式 types/无 baseUrl）零适配，app 全量 tsc 降至约 1s
  - **openai 6→7.4.0**：要求 Node 22+（运行时 v24 满足），`ai.ts` 调用无需改动
  - **nodemailer 8→9.0.4**：破坏性变更仅涉远程内容 TLS 校验与 `NoAuth`→`ENOAUTH` 错误码，`mail.ts` 不受影响（@types/nodemailer 保持 8.x 兼容）
  - **lucide-react 0.577→1.29.0**：1.x 为 0.x 重编号，peer 兼容 React 19，所用图标名全部保留
  - **jsdom 28→30.0.1**：3 处 `@vitest-environment jsdom` 测试验证通过
  - **@types/node 22→24**：对齐 node v24 运行时（非 26，避免超前类型）
  - **@biomejs/biome 2.4.5→2.5.7**：新规则自动修复（`organizeImports` 导出排序、`useOptionalChain` 5 处语义等价变换），schema 同步 2.5.7
- **批量升级 patch + minor 依赖（29 个）**：
  - TanStack 全家桶：react-router 1.170.21、react-start 1.168.38、router-plugin 1.168.26、react-form/react-form-start 1.33.3、router-devtools 1.167.1、react-devtools 0.10.9、devtools-vite 0.8.3
  - React 生态：react/react-dom 19.2.8、@types/react 19.2.18、@vitejs/plugin-react 6.0.5、vite 8.2.1
  - antd 生态：antd 6.5.3、@ant-design/icons 6.3.2
  - 核心库：i18next 26.3.6、react-i18next 17.0.11、jose 6.2.8、hono 4.13.0、@hono/node-server 2.1.0、pg 8.22.0、dompurify 3.4.13、isomorphic-dompurify 3.22.0、@alicloud/dysmsapi20170525 4.6.0
  - 构建/工具：tailwindcss 4.3.3、vitest 4.1.10、tsx 4.23.9、monaco-editor 0.56.0、nitro 260610-beta、@radix-ui/react-slot 1.3.3、@types/pg 8.20.4、@types/nodemailer 8.0.1
- **antd 6.5.3 已官方修复 Card/Image 复合组件 JSX 声明缺陷**：删除 `app/src/types/antd-fix.d.ts` 与 `packages/ui-spa/src/antd-fix.d.ts`，移除 `Select`/`DictSelect` 的 `role="combobox"` 及 `UploadFile` aria 空串等绕过
- **workspace peer 对齐单实例**：ui-spa/ui-ssr 的 `react`/`react-dom` peer 收紧至 `^19.2.8`，ui-spa 的 `antd`/`@ant-design/icons`/`@tanstack/react-router`/`monaco-editor` peer 同步对齐 app 实际版本
- **共享依赖上移根 package.json**（私有 monorepo，版本统一在根管理）：
  - `dependencies`：`react`/`react-dom`/`i18next`（app + ui 包 / core 多包直接使用）；`devDependencies`：共享工具链 `vitest`/`@types/react*`/`@types/node`/`@testing-library/*`/`jsdom`
  - app 删除 16 个冗余声明（`pino`/`jose`/`openai` 等仅经 `@fsdx/core` 间接使用，不直接 import）
  - core/ui-ssr/ui-spa 移除 `react`/`react-dom` peer 声明，单实例由根 `node_modules` 唯一副本保证（依赖根 hoisting 隐式解析）
  - ui-spa 保留 `antd`/`@ant-design/icons`/`@tanstack/react-router`/`monaco-editor`/`@wangeditor/*`/`dayjs` peer（单实例约束不变）
- **移除 changeset 工具链**：库包全部 `private: true` 不发布，删除根 `changeset`/`version`/`release` 脚本、`@changesets/cli` 依赖与 `.changeset/` 目录

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
  - antd-static 迁入 ui-spa，app 删除 `#/components/antd-static` 壳、各端直接经 `@fsdx/ui-spa/antd-static` 导入；Tailwind 经 `@source` 扫描 ui 包源码类名

## [v1.1.0] - 2026-08-24

### Features

- **消息中心（message）**：`message` 表（`recipient_type` + `recipient_id` 无外键）+ 服务层 10 函数 + 三组 SFn（客户端自助/管理端收件箱/管理端管理）+ 前台 `/messages`（shadcn/ui SSR）+ 管理端 `/admin/messages`（收件箱）与 `/admin/messages/manage`（管理）+ Header/AdminLayout 消息铃铛（30 秒轮询）+ `message:view/send/delete` 权限
- **文件资源管理器（file-explorer）**：`STORAGE_DIR` 目录浏览 + 路径穿越防护 + 写保护 + `/admin/file-explorer` 页面 + `/api/download/file-explorer/*` 下载路由 + `file_explorer:*` 权限
- **lib/ms + MSInput**：vercel/ms 移植（parse/parseStrict/format/ms）+ 4 个测试文件 + antd 时长输入组件
- 修复既有测试失败：jwt 测试 logger mock 缺 `debug`；news 测试 i18n.server mock 缺 `applyTranslations`（改用 `importOriginal`）

### Infrastructure

- PostgreSQL + Drizzle ORM（17 张表，uuid 主键，软删除，timestamptz）
- Vitest 测试（79 个测试文件，822 条测试）
- 迁移流程：`pnpm db:generate` + `pnpm db:migrate`（bootstrap 启动自动执行）

### Fix

- **中间件 import-protection 告警**：`resolveAdminAuthContext`/`resolveClientAuthContext` 下沉到 `middleware/*.server.ts`，中间件 guard 在 `.server()` 回调内动态导入；客户端构建剥离回调后不再残留 `.server` 依赖（此前 admin 侧因函数被 export 无法被死代码消除而告警）
- **AdminRootDocument `<title>` 告警**：`{siteName} 管理后台` 两个 children 改为模板字符串，消除 React title 数组警告
- **登录/注册/找回密码页 tsc 报错**：`form.Subscribe` 的 `selector` 泛型推断被 `NoInfer` + 默认值阻断（TS 6），改为全量 FormState 订阅（去掉 selector），`state.canSubmit`/`state.isSubmitting`/`state.values.email` 直接读取，消除 FormState 类型不匹配

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
- **主题体系重构（对齐 bom-easy）**：
  - 具名主题注册表 `app/src/theme/themes.ts`：每个端一个主题预设（`ThemePreset`），`data-theme` 承载完整主题名（如 `admin-brown-light`）；管理端棕 `#795548`、前台中性灰
  - CSS 令牌链路：新增 `shared-tokens.css` 共享中性令牌（`--t-*`），两端 `--t-brand-*` 品牌色阶 → `--s-*` 语义令牌 → `@theme` 映射；`@custom-variant dark (&:is([data-theme$="-dark"] *))` 统一暗色变体，废弃 `.dark` class 双轨
  - `use-theme-mode` 重写为 `useSyncExternalStore`（跨标签页 + 系统主题联动），签名改为 `useThemeMode(preset)`，返回 `scheme`（dataTheme + antd 主色）
  - 管理端品牌色由绿 `#00b96b` 换棕 `#795548`（暗色 `#a1887f`），antd `colorPrimary`/`colorInfo` 从注册表读取（`colorInfo` 派生 Link 链接色）；`borderRadius: 0` 直角风格，Tailwind radius 全 0（保留 `rounded-full`）
  - 管理端侧边栏主题按钮保持三态循环（亮/暗/跟随系统）
  - `AdminRootDocument` 补齐主题 init 脚本（修复首屏闪烁），两个 `<head>` 增加内联 `@layer` 顺序声明；init 脚本由 `themes.ts` 注册表推导 storageKey 与 dataTheme，杜绝脚本与注册表手工双写漂移
  - `use-theme-mode` 的 DOM 应用改为直接读取 localStorage/媒体查询最新值（规避 SSR 水合首帧用服务端快照覆盖主题），`storage` 监听按主题键过滤
  - 硬编码颜色清理：`#1677ff`→`var(--s-primary)`、`zinc/blue/gray`→语义令牌类；Monaco 暗色检测改 `data-theme` 判断；内联非零圆角归零
  - 管理端 logo/favicon 蓝 `#1677ff`→棕 `#795548`；前台 storageKey `theme`→`client-theme`
- **AdminPageContent 挪回 app**：布局组件（标题栏 + 内容区）自 `@fsdx/ui-spa` 迁至 `app/src/components/admin/AdminPageContent.tsx`，26 处路由页面导入改 `#/components/admin/AdminPageContent`，ui-spa 移除对应导出；标题栏定高改 CSS 变量 `--admin-header-height`，内容区高度按 `calc(100vh - var(--admin-header-height))` 计算内部滚动，便于子元素按已知高度布局
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
- **权限模块迁至顶层 `src/permissions/`**：权限码从 `src/constants/permissions/` 提升为顶层领域模块（与 `src/db/` 同级），30 处 `#/constants/permissions/*` 引用改为 `#/permissions/*`，同步更新 AGENTS.md 与 skill 文档路径
- **权限命名全对称（破坏性重构）**：`permissions.ts` → `admin-permissions.ts`，符号全量加 `Admin` 前缀（`PERMISSIONS`→`ADMIN_PERMISSIONS`、`PermissionDef`→`AdminPermissionDef`、`hasPermission`→`hasAdminPermission` 等），与 `client-permissions.ts` 的 `Client*` 命名对齐
- **权限码分隔符规范化**：`file_explorer:*`→`file-explorer:*`、`dict:*_item`→`dict:*-item`；审计模块名 `file_explorer`/`admin_role` 同步为 kebab（`operation_log.module` 数据格式变更）
- **组件命名规范化**：`components/admin/nav-config.tsx` → `NavConfig.tsx`

## 历史版本

- [v1.0.0 - 2026-06-23](docs/archive/changelog/v1.0.0.md)

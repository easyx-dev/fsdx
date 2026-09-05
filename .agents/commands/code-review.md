---
description: 全量代码审查命令：扫描全项目，按 10 维度审查并输出分级报告 + 一致性/规范化备忘录（Style Guide），目标让全仓库像一个人写的
---
# /code-review

> 全量代码审查命令：**默认全量扫描整个项目（`app/` + `packages/`，含路由/服务/组件/schema/lib 包），不做 diff 限定**。按 10 维度审查并输出严重度分级报告，同时从「一致性/命名」视角归并同源偏离并沉淀可复用的 Style Guide，目标是让全仓库看起来只由一个人写成。凡出现「同一种东西两种命名/两种写法」，无论是否可运行，一律视为偏离并列出。

## 适用场景

- 全量代码审计（阶段）与技术债评估
- 重构前的违规诊断
- 代码评审（Code Review）前的一致性检查
- 新人接手项目前的全面了解
- 多人协作时统一书写风格的裁决依据

## 输入（默认全量，可选收窄）

**默认审查范围：整个项目。** 不传参数即全量扫描；以下参数用于显式收窄：

| 参数 | 说明 | 示例 |
|------|------|------|
| 范围 | 只审查某目录/模块 | `app/src/routes/admin/_admin/news` |
| 维度 | 只审查部分维度 | `命名` |
| 严重度 | 只报告指定级别以上 | `high` |
| `--diff` | 仅审查 git 改动 | `--diff` |

### 关于 `--diff`（仅查 diff 需额外说明）

- 默认行为是**全量扫描**；**只有**显式传入 `--diff` 且说明「本次只想要 diff 相关检查、不需要全量基线」时才收窄到 `git diff`（未暂存 + 已暂存，必要时结合 `--cached`/HEAD）。
- `--diff` 模式需在报告开头声明「本次为 diff 审查，非全量基线」，避免与全量结果混淆；未传 `--diff` 一律按全量执行。

## 审查前置约定（规则即事实，以 AGENTS.md 与现有代码为判据）

- **文件/目录命名**：路由 `kebab-case`（`news/$slug.tsx`）；路径参数 `$id/$slug/download.$`；布局分组 `_admin.tsx`；伴生文件进 `-mods/`；`-mods/` 内逻辑文件 `模块名.类型.ts`（kebab，如 `config.functions.ts`/`newsColumns.tsx`，不允许 camelCase 如 `dictUtils.ts`）；服务层按 `.server.ts`/`.schemas.ts`/`.functions.ts`/`.types.ts`/`.cache.ts` 后缀分层。
- **三层分离（硬规则）**：`.server.ts`（服务逻辑，禁止 `SFn` 后缀）/`.functions.ts`（SFn 包装，**必须** `SFn` 后缀）/`.schemas.ts`（zod 单一来源）。依赖单向 `routes → services → (lib/db)`；`services/**` 禁止 import `routes/**`；`.server.ts` 禁止 import `.functions.ts`；路由/组件禁止直接 import `.server.ts`；SFn 必须 `createServerFn({ method }).validator(schema)`，调用方 `{ data: ... }` 传参。
- **组件命名**：`components/admin/`（antd 数据密集）、`components/client/`（shadcn 展示）、`components/providers/`（global-store/i18n-context）。Props 接口必须 `XxxProps`（禁止裸 `Props`）；布尔 Props `is/has/should` 前缀；对外回调 `onXxx`、内部实现 `handleXxx`；Hook 统一 `useXxx`。
- **管理端表格操作列必须用 `TableOperate` 容器**，操作按钮统一「图标 + 文字」，`Delete` 内置信 `Popconfirm`。
- **主题/样式**：颜色仅语义令牌（`primary`/`primary-fg`/`foreground`/`background-secondary`/`border`/`divider`/`accent`…），禁止硬编码色值；圆角归 0（仅圆形元素 `rounded-full`）；主题三态 `useAdminTheme()`/`useThemeMode()`。
- **命名面收敛**：禁止硬编码 `fsdx_*`；Cookie 名走 `src/constants/cookie-names.ts` 集中常量。
- **代码体积**：函数 >60 行、文件 >400 行即需拆分（按职责拆，禁止压缩排版）。

## 审查维度（10 维度全量扫描）

#### ① 分层合规 → [architecture](../skills/architecture/SKILL.md)
- 组件/路由是否直接 import `.server.ts`；`.server.ts` 是否出现在客户端 bundle
- `services/**` 是否反向 import `routes/**`；`.server.ts` 是否反向 import `.functions.ts`
- 跨包引用是否走 `@fsdx/*` subpath（禁止 `#/*` 跨包）；共享逻辑归属（core/ui-ssr/ui-spa/services）是否正确

#### ② 路由合规 → [AGENTS.md「路由」章节](../../AGENTS.md)
- 页面本体是否建成路由文件（禁止塞进 `-mods/`）；`-mods/` 是否只收纳非视图 companion
- `*.server.ts` 是否误放路由（应归 `services/`）；beforeLoad 是否有鉴权守卫
- 路由文件是否独立可访问视图（URL/菜单/深链/前进后退可达）

#### ③ SFn 合规 → [server-function](../skills/server-function/SKILL.md)
- `createServerFn` 是否以 `SFn` 后缀命名；是否都有 zod `validator`（FormData 上传类允许裸函数类型守卫）
- 是否都有鉴权 middleware（`adminPermGuard`/`clientPermGuard`）；handler 是否有静默返回 null
- `.functions.ts` 未引用的包装器是否已删（死代码）；路由/组件是否直接从 `.server.ts` 导入

#### ④ 组件合规 → [AGENTS.md「组件约定」章节](../../AGENTS.md)
- admin/ 下是否混用 Tailwind 同源组件（应 antd）；client/ 下是否混用 antd 同类组件（应 shadcn/ui）
- 表格操作列是否用 `TableOperate`；操作按钮是否统一「图标 + 文字」；圆角是否归零；颜色是否走语义令牌
- `message`/`modal`/`notification` 是否经 `@fsdx/ui-spa/antd-static` 导入

#### ⑤ 类型/DB 合规 → [db-schema](../skills/db-schema/SKILL.md)
- 是否有 `as any`/`as unknown as` 绕过类型；jsonb 是否都 `.$type<>()` 显式类型
- DB 列命名是否遵循硬规则（`id`/`created_at`/`xxx_id`/`sort_order` 等）；timestamp 是否 `{ withTimezone: true }`
- 是否误用 `db.query.*`（RQB v1 已移除）；是否有 `db:push` 残留（一律 `db:generate` + `db:migrate`）

#### ⑥ 安全合规 → [AGENTS.md「安全 (EHRB)」](../../AGENTS.md) + [permission](../skills/permission/SKILL.md)
- SFn 是否都有鉴权 middleware（`adminPermGuard`/`adminPermRouteGuard`）；是否硬编码密钥/`process.env` 泄漏到客户端
- CSRF 中间件是否覆盖所有 SFn；权限码是否走 `src/permissions/` 常量，Root 自动 `**`
- 是否有危险操作（rm -rf /、DROP TABLE 等）

#### ⑦ 错误处理 → [AGENTS.md「错误处理与通知」](../../AGENTS.md)
- 7 类静默失败违规（空 catch、吞异常等）；loader/beforeLoad 失败是否有 `errorComponent`
- 通知分层是否正确（管理端 antd message / 前台 sonner toast）；SFn 是否走统一错误处理（`sfErrorLogger` 自动覆盖）

#### ⑧ 测试覆盖 → [test-writing](../skills/test-writing/SKILL.md)
- 每个 `src/services/` 和 `src/shared-services/` 模块是否有 `__tests__/`；每个导出函数是否覆盖正常/边界/错误路径
- 测试是否为三段式 `vi.hoisted()` + `vi.mock()`；路由层 schema 校验测试是否就近放置

#### ⑨ 命名与一致性 → 文末「一致性 · Style Guide」
（面向「像一个人写的」风格统一，同源偏离先归并再标注影响面）
- `-mods/` 内逻辑文件是否 kebab（禁止 camelCase，如 `dictUtils.ts`/`fileExplorerUtils.ts`）
- Props 接口是否 `XxxProps`（禁止裸 `Props`）；布尔 `is/has/should`；回调 `onXxx`/`handleXxx`；Hook `useXxx`
- SFn 是否 `xxxSFn`；服务动词 `get/create/update/delete` 统一；常量 `SCREAMING_SNAKE_CASE`；schema `xxxCreateSchema` 对称
- 同一模块后缀是否同层统一、无同义漂移（`.analytics` vs 短后缀）；语义令牌/圆角归零从一致性角度归并

#### ⑩ 注释规范 → [AGENTS.md「语言规范」章节](../../AGENTS.md)
- 注释/文档/页面文字/git commit 是否均用**简体中文**
- 文件级注释是否**存在且位于文件第一行**（概述文件/模块职责，不写文件名）
- 函数、关键逻辑、复杂算法、业务规则是否有中文注释；简单赋值/显而易见是否**无多余注释**
- 类型与方法是否有注释，且**贴近业务语义、无模板化表述**；同一概念前后用语是否一致

## 汇总报告格式

```markdown
## 全量代码审查报告

### 基线
- TypeScript: ✅/❌   Biome: ✅/❌   测试: ✅/❌ (N passed, N failed)

### 🔴 Critical (N) / 🟠 High / 🟡 Medium / 🔵 Low
| # | 文件 | 违规 | 规则来源 | 修复方案 |

### 按模块统计
| 模块 | Critical | High | Medium | Low |

### 一致性/规范化备忘录 (Style Guide)
按文末「一致性 · Style Guide」六块（命名/分层/状态/错误处理/样式/注释与文档）输出简短清单；
只写本仓库已认可规则，不引入与现有约定冲突的新规。

### 修复路线图
1. 立即修 Critical（安全+数据）  2. 本周 High（架构+错误）
3. 下周 Medium（命名+类型）  4. 后续 Low（风格+文档）
```

## 输出要求（CR 视角，面向「像一个人写的」）

直接输出审查报告，无需客套寒暄，按以下格式：
1. **【现状与规则偏离清单】**：表格列出（文件/组件/函数 | 当前实现 | 冲突规则 | 建议统一规则）；同源偏离先归并，标注影响面（仅该文件/全模块/全仓库）。
2. **【高优先级重构建议】**：按「影响维护性 + 是否阻碍多人协作」排序的 3~5 项具体动作，含重命名示例（`旧名 → 新名`）。
3. **【推荐规范备忘录 (Style Guide)】**：按本项目主导风格沉淀简短规则清单，分「命名/分层/状态/错误处理/样式/注释与文档」六块。

## 一致性 · Style Guide（SSOT）

### 命名
- 文件/目录：`kebab-case`；`-mods/` 逻辑文件 `模块名.类型.ts`，组件 `PascalCase`；Props `XxxProps`（禁裸 `Props`）
- 布尔 `is/has/should`；回调 `onXxx`（对外）/`handleXxx`（内部）；Hook `useXxx`；SFn `xxxSFn`；服务动词 `get/create/update/delete`；常量 `SCREAMING_SNAKE_CASE`；schema `xxxCreateSchema` 对称

### 分层
- 依赖单向 `routes → services → (lib/db)`；`services/**` 不引 `routes/**`；`.server.ts` 不引 `.functions.ts`；组件不直接引 `.server.ts`
- `components/admin` ↔ `client` ↔ `providers` 不串层；纯逻辑下沉 `@fsdx/lib`；`#/*` 仅 app 内、跨包 `@fsdx/*`

### 状态
- `useXxx` 统一；`MemoryCache<T>` 实例只在其所属模块直接操作（懒加载 miss→查库→写缓存→返回）；不重复造轮子

### 错误处理
- 管理端 `message/modal/notification` 只经 `@fsdx/ui-spa/antd-static`；前台 `sonner toast`；SFn 错误经 `toClientError()` 归一化再抛；禁止吞错静默失败

### 样式
- 颜色仅语义令牌；圆角归 0（仅圆形元素 `rounded-full`）；主题三态 `useAdminTheme()`/`useThemeMode()`

### 注释与文档
- 注释/文档/页面文字/git commit 均用简体中文；文件级注释置于文件第一行（概述职责，不写文件名）
- 函数/关键逻辑/复杂算法/业务规则加中文注释，简单赋值不加；类型与方法有注释且贴近业务语义、无模板化表述

## 注意事项

- **默认全量扫描整个项目**；仅显式传 `--diff` 且说明意图时才收窄，否则勿只审 diff。
- 审查基于 AGENTS.md 与 `.agents/skills/` 规则，以现有代码为准（代码与文档不一致以代码为准）。
- 每条违规引用具体规则来源；同源偏离归并后标注影响面；只报「真实不一致」，不报「个人偏好」。
- Biome/tsc/import-protection 已自动兜底的（格式/import 顺序/类型/包边界）从简，重点审语义越界。
- 本命令为唯一全量审查入口，聚合分层 / 命名 / 契约各维度扫描。

## 完成标准

- [ ] 默认全量范围已扫描（或已按 `--diff` 收窄并在报告开头声明）
- [ ] 10 维度全部扫描；违规按严重度分级并按模块统计
- [ ] 偏离清单按「当前实现 → 冲突规则 → 建议规则」三列对齐，同源偏离已归并标注影响面
- [ ] 高优先级重构建议含具体重命名示例
- [ ] Style Guide 只沉淀本仓库认可规则，不引入冲突新规

## 引用关联

- `.agents/skills/`：architecture / server-function / db-schema / permission / test-writing / cache / i18n / admin-crud
- `.agents/checklists/`：`sfn-checklist` / `route-checklist` / `component-checklist`
- AGENTS.md：路由、组件约定、错误处理与通知、安全、数据库、内存缓存约定、接口约定（Server Function）

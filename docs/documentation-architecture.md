# 文档体系架构

> 本文档是**文档体系的边界模型单一事实来源**：定义每类文档的角色、内容边界、事实归属（SSOT）与引用关系，保证「一份事实只有一个 owner，其余只引用」可执行、可自查。
> 规则本体见 [AGENTS.md](../AGENTS.md)；任务导航见 [.agents/guide.md](../.agents/guide.md)。

## 1. 目标

- 每份文档有明确角色与内容边界，不重复维护同一事实
- 「数量/清单」类事实一律指向代码或生成物，从机制上消灭数字漂移
- 文档间引用单向、可追踪；索引层（guide.md / README.md）只做导航不重复内容
- 数字写入文档时标注「以代码为准」，事实变更时手动同步引用方文档（校验守门见 AGENTS「开发边界」）

## 2. 文档体系分层

```
L0  AGENTS.md           规则本体（唯一自动加载）
                         只放跨模块规则、约定、索引；清单/机制详解一律外迁
L1  .agents/guide.md    任务导航（任务 → 读什么/用什么），不重复规则
L2  .agents/skills      「怎么做/禁止什么」规则展开（10 个：架构/服务函数/权限/缓存/数据库/测试/国际化/CRUD，另含 db-sqlite/db-mysql 衍生技能）
L3  .agents/commands    固定流程执行（deploy 发布 / check-architecture 审计，引用 skills / docs）
L4  .agents/checklists  验证清单（skills 的浓缩：sfn / route / component）
L5  docs/               背景与设计（人类向），按性质分四子类：
    ├─ 平台机制类   architecture-overview / database-design / auth-permission-model /
    │               cache-system / event-tracking / deployment-ops / project-ecosystem
    ├─ 决策档案类   （ADR，当前暂无，新增时置于 docs/decisions.md）
    ├─ archive/     历史档案（被推翻的设计、已完成计划）
    └─ generated/   事实快照（doc-facts 脚本生成：`pnpm doc:gen`，禁止手改；`pnpm check` 自动校验漂移）
```

> fsdx-web 无 `.agents/templates` 层（代码骨架由 skills 内嵌示例承载）。skills / commands / checklists 实体均在 `.agents/` 下；`.opencode/` 内为指向 `.agents/` 的软链视图（`.opencode/skills` / `.opencode/commands`），供 opencode 工具识别与加载（opencode 约定仅识别这两类）；checklists 为 AI 自查参考，无 opencode 软链视图，内容修改一律以 `.agents/` 为准。

## 3. 内容性质 → 归属映射

写内容前先按此表判定归属层：

| 内容性质 | 归属层 | 判据 | 典型例子 |
|---------|--------|------|---------|
| 规则 / 禁令 / 约定 | AGENTS.md + skills | 代码审查即时依赖、低频变更 | SFn 命名后缀、JSONB `.$type` 约束、`TableOperate` 操作列 |
| 机制 / 设计解释（为什么） | docs 平台类 | 讲「为什么」，低频变更 | 缓存失效策略、BatchWriter 动机、认证模型 |
| 事实清单（数量 / 有哪些） | 代码 或 docs/generated | 高频变更，防漂移 | 表清单、权限码、缓存实例、定时任务、预置埋点 |
| 流程 / 步骤执行 | .agents/commands | 固定顺序的多步操作 | 版本发布、架构审计 |
| 验证条目 | .agents/checklists | 规则的浓缩可勾选项 | SFn 自查、路由自查 |
| 被推翻的设计 / 已完成计划 | docs/archive | 只追溯，不引用为现行依据 | 迁移方案、重构计划 |

## 4. 事实 SSOT 表

每个事实有唯一 owner，其余文档只能引用（链接/指向），禁止复制清单：

| 事实 | 唯一 owner（代码） | 可读快照 | 引用方（只引用，不复制） |
|------|-------------------|---------|--------------------------|
| 权限码清单 | `src/permissions/admin-permissions.ts` + `client-permissions.ts` | [docs/generated/permissions.md](generated/permissions.md)（`pnpm doc:gen`） | auth-permission-model、AGENTS、architecture-overview |
| 数据表清单 / 数量 | `src/db/schema/`（index.ts 汇总） | [docs/generated/tables.md](generated/tables.md)（`pnpm doc:gen`） | database-design、architecture-overview、README、AGENTS |
| 内存缓存实例 | `src/services/*/*.cache.ts`（领域缓存）+ `src/services/track/track.validate.ts`（频控内部实例 `sessionRateCache`） | — | cache-system、architecture-overview、AGENTS |
| 路由树 | `src/routeTree.gen.ts` + `src/routes/` | — | architecture-overview（仅概览）、routing 约定在 AGENTS |
| 定时任务清单 | `src/services/tasks/tasks.server.ts` | — | deployment-ops |
| 预置埋点（事件/属性） | `src/services/track/*` 的 `PRESET_*` | — | event-tracking、database-design |
| 预置数据（字典/配置） | `src/services/dict` / `src/services/config` 的 `ensurePreset*` | — | database-design |
| 主题家族 / 品牌色 | `src/theme/themes.ts` + `global.css` | — | AGENTS 视觉章节 |
| 技术栈版本 | `package.json` | — | AGENTS、README（标注"以 package.json 为准"） |

> 事实数字（表数、缓存实例数、权限码数、测试条数等）写入文档时，必须与代码一致并标注「以代码为准」；新增事实时按 AGENTS「开发边界」同步更新引用方文档。

## 5. 引用图（谁引用谁）

```
AGENTS.md ──规则──► .agents/skills（architecture / server-function / db-schema / cache / permission / ...）
  │        ──事实──► 代码（schema / permissions / cache / tasks）
  ▼
.agents/guide.md ──导航──► skills / docs
  │
  ├─ .agents/commands ──执行──► skills（规则）+ docs（背景）
  ├─ .agents/checklists ──浓缩──► skills（每个条目标注来源 skill）
  └─ docs ──背景──► 代码（单一事实来源，反向链接）

docs/ 内部：
  architecture-overview ──概览──► database-design / cache-system / auth-permission-model / deployment-ops / event-tracking（均只引用不复制）
```

## 6. 文档元信息块约定

每份 docs 头部加一行块引用，让边界可自查：

```markdown
> 定位：平台机制类 · 人类阅读
> 单一事实来源：src/db/schema/index.ts（数据表清单，另见 AGENTS「数据库」章节）
> 引用关系：← 被 architecture-overview 引用；→ 引用代码单一事实来源
> 更新触发：数据表 / 列定义变更时
```

字段含义：
- **定位**：所属子类（平台机制 / 决策档案 / 规则 / 流程 / 验证）+ 读者（人类 / AI 执行）
- **单一事实来源**：本文件引用的外部事实在代码哪里，或声明自身为 owner
- **引用关系**：谁引用本文件（←）、本文件引用谁（→）
- **更新触发**：什么代码变更需要同步本文件

**Skills 不引入该块**：`.agents/skills/**/SKILL.md` 使用结构化 frontmatter（`name` + `description`），其 `description` 已承担「何时触发」职责，边界以第 3 节归属映射为准。

## 7. 维护规则

### 新增文档

1. 按第 3 节映射表判定归属层；不确定时按「机制解释 → docs/平台类」「操作步骤 → commands」「规则 → skills」
2. 若内容含数量/清单类事实，删除并改为指向代码
3. 填写第 6 节元信息块
4. 同步 `.agents/guide.md` 的 Docs / Skills 索引
5. 若 README 需要收录，同步 README 文档索引

### 事实变更（改表/权限码/缓存等）

1. 修改代码
2. 运行 `pnpm doc:gen` 重新生成 docs/generated 快照
3. 触发更新引用方文档的元信息块「更新触发」中的对应项
4. 若引用方文档中有残留的硬编码数量，手动同步为「当前值 + 以代码为准」标注（`pnpm check` 内置 doc:check 自动拦截漂移）

### 已弃用 / 历史内容

- 模块废弃或设计被推翻时，正文保留但头部标注「已废弃/已弃用，仅作历史参考」，并在现行方案处加链接；不删除（历史可追溯）
- 一次性计划完成后归档至 `docs/archive/`

## 8. 当前文档清单

> 完整清单与角色见 [.agents/guide.md](../.agents/guide.md) 的索引；README 文档索引仅导航不重复内容。

---
description: 全量架构审计命令：扫描全项目，按 8 个维度检查合规性并输出分级报告
---
# check-architecture

> 全量架构审计命令：扫描全项目，按 8 个维度检查合规性。

## 适用场景

- 定期代码质量审计
- 重构前的违规诊断
- 新人接手项目前的全面了解
- 技术债评估

## 输入

无（全量扫描）。

可选参数：

| 参数 | 说明 | 示例 |
|------|------|------|
| 维度 | 只扫描指定维度 | `安全` |
| 严重度 | 只报告指定级别以上 | `high` |

## 输出

全量审计报告（Markdown 格式），包含：
- 8 个维度的扫描结果
- 按严重度分级的违规清单
- 按模块分组的违规统计
- 修复路线图

## 执行步骤

### 阶段一：自动化基线

```bash
pnpm check   # 全部包 TypeScript + Biome
pnpm test    # 全部包 Vitest 测试
```

记录基线结果。

### 阶段二：按维度扫描

#### ① 分层合规 → [architecture](../skills/architecture/SKILL.md)

扫描：
- 组件/路由是否直接 import `.server.ts`
- `.server.ts` 是否出现在客户端 bundle
- `services/**` 是否反向 import `routes/**`
- `.server.ts` 是否反向 import `.functions.ts`
- 跨包引用是否走 `@fsdx/*` subpath（禁止 `#/*` 跨包）
- 新增共享逻辑归属是否正确（core / ui-ssr / ui-spa / services）

#### ② 路由合规 → [AGENTS.md「路由」章节](../../AGENTS.md)

扫描：
- 页面本体是否建成路由文件（禁止塞进 `-mods/`）
- `-mods/` 是否只收纳非视图 companion（SFn/schema/组件/纯函数/常量）
- `*.server.ts` 是否误放路由（应归 `services/`）
- beforeLoad 是否有鉴权守卫（`getCurrentAdminSFn`/`getCurrentClientSFn`）
- 路由文件是否为独立可访问视图（URL/菜单/深链/前进后退可达）

#### ③ SFn 合规 → [server-function](../skills/server-function/SKILL.md)

扫描：
- 所有 `createServerFn` 是否以 `SFn` 后缀命名
- 是否都有 zod `validator`（FormData 上传类 SFn 允许裸函数类型守卫）
- 是否都有鉴权 middleware（`adminPermGuard`/`clientPermGuard`）
- handler 是否有静默返回 null
- `.functions.ts` 未引用的包装器是否已删（死代码）
- 路由/组件是否直接从 `.server.ts` 导入

#### ④ 组件合规 → [AGENTS.md「组件约定」章节](../../AGENTS.md)

扫描：
- admin/ 下是否混用 Tailwind 同源组件（应 antd）
- client/ 下是否混用 antd 同类组件（应 shadcn/ui）
- 表格操作列是否用 `TableOperate` 容器包裹
- 操作按钮是否统一「图标 + 文字」风格
- 圆角是否归零（仅圆形元素可用 `rounded-full`）
- 颜色是否走语义令牌类（禁止硬编码色值）
- `message`/`modal`/`notification` 是否经 `@fsdx/ui-spa/antd-static` 导入

#### ⑤ 类型/DB 合规 → [db-schema](../skills/db-schema/SKILL.md)

扫描：
- 是否有 `as any` / `as unknown as` 绕过类型
- jsonb 列是否都有 `.$type<>()` 显式类型
- DB 列命名是否遵循硬规则（`id`/`created_at`/`xxx_id`/`sort_order` 等）
- timestamp 是否都有 `{ withTimezone: true }`
- 是否误用 `db.query.*`（RQB v1 已移除，用标准 query builder）
- 是否有 `db:push` 残留（一律 `db:generate` + `db:migrate`）

#### ⑥ 安全合规 → [AGENTS.md「安全 (EHRB)」](../../AGENTS.md) + [permission](../skills/permission/SKILL.md)

扫描：
- SFn 是否都有鉴权 middleware（`adminPermGuard`/`adminPermRouteGuard`）
- 是否硬编码密钥/`process.env` 泄漏到客户端
- CSRF 中间件是否覆盖所有 SFn
- 权限码是否走 `src/permissions/` 常量，Root 自动 `**`
- 是否有命令阻断类危险操作（rm -rf /、DROP TABLE 等）

#### ⑦ 错误处理 → [AGENTS.md「错误处理与通知」](../../AGENTS.md)

扫描：
- 7 类静默失败违规（空 catch、吞异常等）
- loader/beforeLoad 失败是否有 `errorComponent`
- 通知分层是否正确（管理端 antd message / 前台 sonner toast）
- SFn 调用是否走统一错误处理（`sfErrorLogger` 已自动覆盖）

#### ⑧ 测试覆盖 → [test-writing](../skills/test-writing/SKILL.md)

扫描：
- 每个 `src/services/` 和 `src/lib/` 模块是否有 `__tests__/`
- 每个导出函数是否覆盖正常/边界/错误路径
- 测试是否为三段式 `vi.hoisted()` + `vi.mock()` 结构
- 路由层 schema 校验测试是否就近放置

### 阶段三：汇总报告

```markdown
## 全量代码审计报告

### 基线
- TypeScript: ✅/❌
- Biome: ✅/❌
- 测试: ✅/❌ (N passed, N failed)

### 🔴 Critical (N)
| # | 文件 | 违规 | 规则来源 | 修复方案 |
|---|------|------|---------|---------|

### 🟠 High (N)
...

### 🟡 Medium (N)
...

### 🔵 Low (N)
...

### 按模块统计
| 模块 | Critical | High | Medium | Low |
|------|----------|------|--------|-----|

### 修复路线图
1. 立即修复 Critical（安全+数据）
2. 本周修复 High（架构+错误）
3. 下周修复 Medium（命名+类型）
4. 后续修复 Low（风格+文档）
```

### 阶段四：修复规划

- 按严重度排序生成修复任务
- 每个任务关联对应的 skill/命令
- 输出修复路线图

## 注意事项

- 审计基于 AGENTS.md 与 `.agents/skills/` 规则
- 每条违规必须引用具体规则来源（skill/AGENTS 章节）
- 修复方案必须具体可执行
- Critical 级别必须立即修复

## 完成标准

- [ ] 8 个维度全部扫描
- [ ] 违规按严重度分级
- [ ] 按模块分组统计
- [ ] 每条违规引用规则来源
- [ ] 修复路线图生成

## 引用关联

- `.agents/skills/`：architecture / server-function / db-schema / permission / test-writing / cache / i18n / admin-crud
- AGENTS.md：路由、组件约定、错误处理与通知、安全、数据库、内存缓存约定

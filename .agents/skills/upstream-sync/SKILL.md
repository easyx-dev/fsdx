---
name: upstream-sync
description: >
  上游（fsdx-web 模板）与下游（衍生项目）双向同步的判定与移植准则。
  当需要把上游基建变更吸收到衍生项目（/import-upstream），把衍生项目实践
  回灌上游（/backport），或判断某个改动属于「基建」还是「业务」时触发。
  背景模型与命名面策略见 docs/project-ecosystem.md。
---

# 上游 ↔ 下游 双向同步

## 演进方向判定准则

所有同步操作的第一步是**分类**：判断一个改动属于「基建（可跨项目流通）」还是「业务（留在项目内）」。

**层次判定**：
- 基建层：`@fsdx/core` 库、认证/RBAC/权限、缓存、埋点、审计、i18n、文件存储、日志、错误处理、部署/CI、UI 基础组件、测试基础设施、文档体系、命名收敛化改造；
- 业务层：CMS 示例业务模块（news/dict/file-explorer 等）、具体业务表/字段、具体业务路由、示例内容。

**性质判定**（命中任一「是」即为基建）：
1. 脱离本项目的业务示例是否依然成立？
2. 是否不依赖任何具体业务表/字段/路由？
3. 是否对所有衍生系统都有价值？
4. 是否仅为缺陷修复且不引入业务语义？

**反例排除**（以下情况不回灌 / 不吸收）：
- 需要联动业务示例一起改（已耦合业务）；
- 只对该衍生项目有意义；
- 依赖下游独有依赖（技术栈不一致）。

## 变更可发现性（CHANGELOG `[infra]`）

- 上游基建变更一律记入 CHANGELOG 的 `Infrastructure` / `Fix` 分类，条目加 `[infra]` 前缀，描述注明「可被衍生项目吸收」的影响面；
- commit 约定 `feat(infra)` / `fix(infra)` scope（仅辅助，不作为唯一事实）；
- **候选吸收清单** = 上游 CHANGELOG 自基线起的 `[infra]` 条目，经判定准则复核，代码 diff 兜底佐证。

## 基线管理（UPSTREAM.md）

每个衍生项目根目录维护 `UPSTREAM.md`，记录上游仓库、上次吸收的 commit、配置映射表（Cookie 名/库名/包名等）、同步历史。

**基线失效处理**：衍生项目可能重写/删除 git 历史，导致基线 commit 失效。此时回退到**代码事实对比**：
1. `git rev-parse` 校验记录的基线 commit 仍存在；
2. 失效则依据 CHANGELOG 自记录日期起的 `[infra]` 条目 + 关键基建文件 diff 判定吸收范围；
3. 更新基线时同时记录 commit sha 与日期双保险。

## 下游吸收上游（`/import-upstream`，在衍生项目内执行）

1. 读 `UPSTREAM.md`：确认基线 + 配置映射；
2. `git fetch upstream`，取基线后的差异；
3. 用判定准则分类 → 筛出基建候选（CHANGELOG `[infra]` + diff 佐证）；
4. 按配置映射表应用：**B 面**——Cookie 名改集中常量、e2e 库名/账号改 env 值，A/C/D/F 面清单替换翻译（见 derive-project skill）；
5. 逐个移植 → `pnpm check` / `pnpm test`；
6. 更新 `UPSTREAM.md` 基线 + 同步历史；衍生项目 CHANGELOG 注明「吸收自上游 vX」。

## 上游吸收下游（`/backport`，在本项目内执行）

1. 收集候选：用户主动提出，或定期 review 衍生项目仓库的变更；
2. 用判定准则判断是否值得回灌；
3. **净化三步**：
   - 去业务化：移除仅对下游有意义的业务代码/字段/路由；
   - 去命名化：把下游特有命名翻译回模板中性命名（Cookie 名 → `admin_token`/`client_token`、库名 → `app_web`、包名 → `@fsdx/*`）；
   - 通用化：对齐模板既有技术栈、分层约定（core/services/routes 归属、SFn 规范、UI 选型）；
4. 移植 → `pnpm check` / `pnpm test`；
5. 记入本项目 CHANGELOG（`[infra]` 标记）。

## 常见场景

| 场景 | 处理 |
|------|------|
| 上游修复了一个认证缺陷 | 基建 → 下游应吸收（`/import-upstream`） |
| 下游实现了一个通用工具函数 | 基建 → 回灌上游并归入 `@fsdx/core`（`/backport`） |
| 下游新增业务表/业务页面 | 业务 → 不回灌 |
| 上游新增 CMS 示例模块 | 业务 → 下游不吸收 |
| 下游调整了品牌色/站点名 | 品牌 → 不回灌（模板保持默认品牌） |

> 详细背景见 [docs/project-ecosystem.md](../../../docs/project-ecosystem.md)；更名流程见 [derive-project](../derive-project/SKILL.md)；验证见 [upstream-sync-checklist](../../checklists/upstream-sync-checklist.md)。

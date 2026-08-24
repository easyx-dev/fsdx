---
description: 上游吸收下游：在 fsdx-web 内把衍生项目（如 bom-easy）的基建实践/缺陷修复净化后回灌，并记入 CHANGELOG [infra]
---
# /backport

> 在 **fsdx-web（上游）** 内执行：吸收衍生项目的基建实践与缺陷修复。

## 适用场景

- 衍生项目实现了值得推广的通用能力（工具函数、基础设施、缺陷修复）
- 定期 review 衍生项目仓库，寻找可回灌的基建候选

## 执行步骤

1. 收集候选：用户主动提出，或 review 衍生项目仓库的变更记录；
2. 用判定准则（[upstream-sync](../skills/upstream-sync/SKILL.md)「演进方向判定准则」）判断是否值得回灌：
   - 基建（跨项目流通）→ 继续；
   - 业务/品牌（留在下游）→ 记录不采纳原因；
3. **净化三步**：
   - 去业务化：移除仅对下游有意义的业务代码/字段/路由；
   - 去命名化：下游特有命名翻译回模板中性命名（Cookie 名 → `admin_token`/`client_token`、库名 → `app_web`、包名 → `@fsdx/*`）；
   - 通用化：对齐模板既有技术栈与分层约定（core/services/routes 归属、SFn 规范、UI 选型、测试三段式）；
4. 移植代码 → `pnpm check` + `pnpm test`；
5. 记入本项目 CHANGELOG（`Infrastructure` / `Fix` 分类，条目加 `[infra]` 前缀，注明「可被衍生项目吸收」与影响面）。

## 完成标准

- [ ] 回灌内容通过判定准则且完成净化三步
- [ ] `pnpm check` / `pnpm test` 通过
- [ ] CHANGELOG 已记录（`[infra]` 标记）
- [ ] 未采纳的候选记录原因（可记于同步说明或回复）

## 引用关联

- [upstream-sync](../skills/upstream-sync/SKILL.md)（判定准则 + 净化三步）
- [upstream-sync-checklist](../checklists/upstream-sync-checklist.md)（验证清单）
- [docs/project-ecosystem.md](../../docs/project-ecosystem.md)（背景模型）

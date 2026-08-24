---
description: 下游吸收上游：在衍生项目内拉取 fsdx-web 模板的基建变更（CHANGELOG [infra] 条目），按配置映射翻译后移植并更新 UPSTREAM.md 基线
---
# /import-upstream

> 在**衍生项目**内执行：吸收上游（fsdx-web）的基建变更。

## 适用场景

- 上游发布了新版本，希望把基建改进/缺陷修复吸收到当前衍生项目
- 定期同步上游变更，避免衍生项目基建落后

## 前置条件

- 当前目录为**衍生项目**（非 fsdx-web 本身）
- 项目根目录存在 `UPSTREAM.md`（首次派生时由 `/derive` 创建）

## 执行步骤

1. 读 `UPSTREAM.md`：确认基线（commit + 日期）与配置映射；
2. `git fetch upstream`（若 remote 缺失先 `git remote add upstream <仓库地址>`）；
3. 校验基线有效性：`git rev-parse upstream/基线commit`——失效（历史被重写）则回退**代码事实对比**（依据 [upstream-sync](../skills/upstream-sync/SKILL.md)「基线管理」）；
4. 取候选：上游 CHANGELOG 自基线起的 `[infra]` 条目 + 对应代码 diff；
5. 用判定准则（[upstream-sync](../skills/upstream-sync/SKILL.md)「演进方向判定准则」）筛出基建候选，跳过业务示例相关条目；
6. 逐个移植：**B 面**——Cookie 名改集中常量、e2e 库名/账号改 env 值，A/C/D/F 面按配置映射清单替换翻译；
7. `pnpm check` + `pnpm test`；
8. 更新 `UPSTREAM.md`：基线 commit、同步历史（吸收内容对应上游条目、跳过内容及原因）；衍生项目 CHANGELOG 注明「吸收自上游 vX」。

## 完成标准

- [ ] 基建候选全部移植或明确记录跳过原因
- [ ] `pnpm check` / `pnpm test` 通过
- [ ] `UPSTREAM.md` 基线已更新（commit + 日期）
- [ ] 衍生项目 CHANGELOG 记录本次吸收来源

## 引用关联

- [upstream-sync](../skills/upstream-sync/SKILL.md)（判定准则 + 基线回退 + 移植）
- [upstream-sync-checklist](../checklists/upstream-sync-checklist.md)（验证清单）
- [docs/project-ecosystem.md](../../docs/project-ecosystem.md)（背景模型）

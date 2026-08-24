# 项目定位与衍生项目协同进化

> 定位：平台机制类 · 人类阅读 + AI 执行参考
> 单一事实来源：本文件为「衍生协同」机制的 owner；命名面等事实指向代码（标注以代码为准）
> 引用关系：← 被 [.agents/guide.md](../.agents/guide.md) 导航；→ 引用 `src/constants/cookie-names.ts`、`app/e2e/helpers/env.ts`、CHANGELOG
> 更新触发：衍生项目清单变化、命名面收敛改造、同步协议迭代时

## 1. 项目定位

fsdx-web 承担**双重角色**：

1. **独立产品**：内置 CMS 示例、双端认证、埋点、审计等基础设施，可独立部署运行；
2. **基座模板（upstream）**：以本项目为模板二次开发衍生项目（downstream），并在两者之间双向吸收最佳实践与缺陷修复，实现互相整合进化。

> 衍生项目清单以实际仓库为准（当前：bom-easy）。新增衍生项目时同步登记到第 7 节。

**协同进化的核心问题**：如何判断一个改动属于「基建（应跨项目流通）」还是「业务（留在项目内）」。判定准则见第 2 节。

## 2. 演进方向判定准则

所有同步操作（吸收 / 回灌）的第一步都是**分类**。两个维度：

### 2.1 层次判定

- **基建层**：`@fsdx/core` 库、认证/RBAC/权限、缓存、埋点、审计、i18n、文件存储、日志、错误处理、部署/CI、UI 基础组件、测试基础设施、文档体系本身、命名面收敛化改造。
- **业务层**：CMS 示例业务模块（news / dict / file-explorer 等）、具体业务表/字段、具体业务路由、示例内容。

### 2.2 性质判定

命中任一「是」即为基建，可跨项目流通：

1. 脱离本项目的业务示例是否依然成立（把 news/dict 删掉它还能跑吗）？
2. 是否不依赖任何具体业务表/字段/路由？
3. 是否对所有衍生系统都有价值？
4. 是否仅为缺陷修复且不引入业务语义？

### 2.3 反例排除

以下情况**不**回灌 / 不吸收：

- 需要联动业务示例一起改（说明已耦合业务）；
- 只对该衍生项目有意义；
- 依赖下游独有依赖（技术栈不一致）。

## 3. 命名面收敛与更名映射

**总原则**：运行期标识中**随环境变化的才配置注入**（e2e 库名/账号），**随项目变化的用集中常量**（Cookie 名，与包名/主题名同等对待）；无法配置化的面保留清单替换机制。

| 面 | 内容 | 策略 | 事实落点 |
|----|------|------|---------|
| A 包名面 | workspace 包名 `@fsdx/*`、各 package.json、imports、pnpm-lock | 清单替换（全局替换 + `pnpm install` 再生锁文件） | 各 `package.json`（以代码为准） |
| B 运行标识面 | **Cookie 名**（`src/constants/cookie-names.ts` 集中常量）、**e2e 库名/账号邮箱**（env 注入） | Cookie 名集中常量（更名点）；e2e 配置 env 化 | `src/constants/cookie-names.ts`、`app/e2e/helpers/env.ts`、`app/e2e/helpers/db.ts` |
| C 部署面 | 容器名、镜像名、CI 配置 | 清单替换（与项目绑定，模板保持默认） | docker-compose*、.gitlab-ci.yml（以代码为准） |
| D 品牌面 | 站点名（系统配置，已收敛）、品牌色、主题名、favicon/logo、版权 | 站点名配置化；其余清单替换 | `src/theme/themes.ts` + global.css、系统配置 |
| E 数据面 | e2e 账号（随 B 收敛）、预置数据默认值 | 配置化 + 清单 | 以代码为准 |
| F 文档面 | README/docs 中的路径示例 | **中性化占位**（如 `/opt/{项目名}/`） | docs/（本文件为示例） |

> 更名与同步时的命名翻译，按面逐项执行。B 面 Cookie 名改集中常量、e2e 配置改 env 值，A/C/D/F 面走清单替换。

## 4. 变更可发现性（CHANGELOG `[infra]` 标记）

**主渠道：CHANGELOG.md**。由于衍生项目可能重写/删除 git 历史，不可依赖 git log 作为唯一事实：

- 凡属基建层的变更，CHANGELOG 条目加 `[infra]` 前缀（置于 `Infrastructure` / `Fix` 分类），描述注明「可被衍生项目吸收」的影响面；
- commit 约定 `feat(infra)` / `fix(infra)` scope（仅辅助）；
- **下游候选吸收清单** = 上游 CHANGELOG 自基线起的 `[infra]` 条目，经第 2 节准则复核，代码 diff 兜底佐证。

## 5. 基线管理（UPSTREAM.md）

每个衍生项目根目录维护 `UPSTREAM.md`，记录：

- 上游仓库地址与 remote 名；
- 上次吸收的上游 commit（历史重写则回退 CHANGELOG `[infra]` 条目 + 代码 diff 对比）；
- **配置映射表**：本项目 env/命名 ↔ 上游默认值（如 Cookie 名、库名、包名）；
- 同步历史：日期 / 吸收内容 / 跳过内容及原因。

模板仅在本文件第 7 节登记衍生项目清单，基线状态一律以衍生项目内 `UPSTREAM.md` 为准（避免单点维护）。

## 6. 同步流程

### 6.1 下游吸收上游（`/import-upstream`，在衍生项目内执行）

1. 读 `UPSTREAM.md`：基线 + 配置映射；
2. 取上游候选：CHANGELOG `[infra]` 条目 + 代码 diff 佐证（基线失效走第 5 节回退策略）；
3. 第 2 节准则分类 → 筛出基建候选；
4. 按配置映射表应用：B 面——Cookie 名改集中常量、e2e 库名/账号改 env 值，A/C/D/F 面清单替换翻译；
5. 逐个移植 → `pnpm check` / `pnpm test`；
6. 更新 `UPSTREAM.md` 基线 + 记录；衍生项目 CHANGELOG 注明「吸收自上游 vX」。

### 6.2 上游吸收下游（`/backport`，在本项目内执行）

1. 收集候选（用户主动提出 / 定期 review 衍生项目仓库变更）；
2. 第 2 节准则判断是否值得回灌；
3. **净化三步**：去业务化（移除仅对下游有意义的业务代码）→ 去命名化（翻译回模板中性命名）→ 通用化（对齐模板既有技术栈/分层约定）；
4. 移植 → `pnpm check` / `pnpm test`；
5. 记入本项目 CHANGELOG（`[infra]` 标记）。

## 7. 衍生项目登记

| 项目 | 定位 | 关系 |
|------|------|------|
| bom-easy | 基于本模板的衍生业务系统 | 已多次反向回灌（主题体系、文档体系、操作审计、core 基础设施等），作为回灌与吸收的试点对象 |

> 清单以实际为准；每个衍生项目的同步基线与其内部 `UPSTREAM.md` 为准，此处仅登记。

## 8. 相关资源

| 资源 | 说明 |
|------|------|
| [AGENTS.md](../AGENTS.md)「衍生项目与协同进化」 | 规则本体（命名收敛、`[infra]` 标记、净化规则） |
| [.agents/skills/derive-project](../.agents/skills/derive-project/SKILL.md) | 派生新项目更名全流程 |
| [.agents/skills/upstream-sync](../.agents/skills/upstream-sync/SKILL.md) | 双向同步判定与移植准则 |
| [.agents/commands/derive.md](../.agents/commands/derive.md) | `/derive` 命令 |
| [.agents/commands/import-upstream.md](../.agents/commands/import-upstream.md) | `/import-upstream` 命令 |
| [.agents/commands/backport.md](../.agents/commands/backport.md) | `/backport` 命令 |

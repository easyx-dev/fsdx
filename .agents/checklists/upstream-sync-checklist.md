# 上游同步检查清单

> 双向同步（/import-upstream 吸收上游、/backport 回灌上游）时逐项检查。规则来源：upstream-sync skill + AGENTS「衍生项目与协同进化」。

## 判定

- [ ] 候选改动经层次判定（基建层 / 业务层）
- [ ] 性质判定 4 问全过或命中「是」（脱离业务示例成立 / 不依赖业务表 / 对所有衍生系统有价值 / 纯缺陷修复）
- [ ] 已排除反例（耦合业务示例 / 仅下游有意义 / 依赖下游独有依赖）

## 移植（吸收方向 /import-upstream）

- [ ] 基线已确认（commit + 日期），失效时已走代码事实回退
- [ ] 候选来自 CHANGELOG `[infra]` 条目 + 代码 diff 佐证
- [ ] B 面按配置映射翻译（Cookie 名集中常量、e2e 配置改 env 值），A/C/D/F 面按配置映射翻译
- [ ] 业务示例相关条目已跳过并记录原因

## 移植（回灌方向 /backport）

- [ ] 净化三步完成：去业务化 → 去命名化 → 通用化
- [ ] 命名已翻译回模板中性值（Cookie 名 `admin_token`/`client_token`、库名 `app_web`、包名 `@fsdx/*`）
- [ ] 对齐模板分层与 SFn/测试约定

## 验证与记录

- [ ] `pnpm check` 通过
- [ ] `pnpm test` 通过
- [ ] 基线已更新（commit + 日期），同步历史记录了吸收/跳过内容
- [ ] CHANGELOG 已记录（`[infra]` 标记 + 影响面）

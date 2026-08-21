---
description: 版本发布：联动 commit 流程提交业务变更、确定新版本号、更新 CHANGELOG、打 tag（含 commit 摘要）、推送
---
依次执行以下步骤：

1. 执行 `git status --porcelain` 检查是否有未提交变更：
   - 若有未提交变更，执行 git-commit skill 流程：审查变更 → 按逻辑分组暂存 → 生成 Conventional Commits 中文提交信息 → 逐组提交
   - 若工作区干净，继续下一步
2. 确定新版本号：
   - 读取 app/package.json（@fsdx/web）当前版本号，记为 `{当前版本}`
   - 检查是否存在对应 tag：`git rev-parse -q --verify refs/tags/v{当前版本}`
   - 若 tag 已存在（当前版本已发布过）：将补丁版本号（PATCH）加 1 作为新版本号（例如 1.1.0 → 1.1.1），更新 app/package.json 的 version 字段
   - 若 tag 不存在（当前版本尚未发布，如仓库初始状态 `1.1.0`）：直接以当前版本作为新版本号，不改动 version 字段
3. 更新 CHANGELOG.md（规则见 AGENTS.md「变更日志（CHANGELOG）」章节）：
   - 把 `[Unreleased]` 升为 `[v{新版本号}] - {当天日期}`（日期格式如 `2026-08-21`），顶部新增空 `[Unreleased]` 段
   - 主文件只保留 `[Unreleased]` + 最近 3 个版本 + 「历史版本」索引链接，更早版本归档到 `docs/archive/changelog/v1.x.x.md`（保留各版本标题），并同步更新归档文件头注的版本范围与主文件历史索引链接
4. 生成 commit 摘要（新版本 tag 的 message 正文）：
   - 有上一个 tag 时：`git log --oneline $(git describe --tags --abbrev=0)..HEAD`
   - 无 tag（首次发布）时：`git log --oneline`（全量提交）
5. `git add app/package.json CHANGELOG.md && git commit -m "chore: release v{新版本号}"`
6. 将第 4 步生成的 commit 摘要拼接到 tag message，执行 `git tag -a v{新版本号} -m "chore: release v{新版本号}"$'\n\n'"{commit 摘要}"`
7. `git push && git push --tags`

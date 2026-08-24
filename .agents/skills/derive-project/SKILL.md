---
name: derive-project
description: >
  基于 fsdx-web 模板派生新项目的完整更名指南。当需要以本项目为模板创建
  新业务系统、执行项目更名、处理命名面（包名/运行标识/部署/品牌/文档）时触发。
  与 upstream-sync 配合使用，保证衍生项目可持续吸收上游基建变更。
  背景模型见 docs/project-ecosystem.md。
---

# 派生新项目：完整更名流程

## 前置准备：填写命名决策表

开始前先确定并填写以下命名，后续所有替换以此为准：

```
□ 项目名：________（如 myapp-web，kebab-case）
□ 包名前缀：________（如 @myapp，替换 @fsdx）
□ 管理端 Cookie 名：________（默认 admin_token，如 myapp_admin_token）
□ 客户端 Cookie 名：________（默认 client_token，如 myapp_client_token）
□ 数据库名：________（如 myapp_web；e2e 库自动派生 myapp_web_e2e）
□ e2e 账号邮箱：________（默认 root@example.com / client01@example.com）
□ 容器名：________（默认 fsdx-app，如 myapp）
□ 镜像名：________（默认 ucas/fsdx-web，如 myapp-web）
□ 部署路径：________（文档示例默认 /opt/{项目名}/）
□ 站点名：________（系统配置，初始化时填写）
□ 品牌色：________（默认 admin 棕 #795548 / client 中性灰）
```

## 命名面总览（A~F）

| 面 | 内容 | 策略 | 事实落点（以代码为准） |
|----|------|------|------------------------|
| A 包名面 | `@fsdx/*` 包名、imports、锁文件 | 全局替换 + 再生锁文件 | 各 `package.json` |
| B 运行标识面 | Cookie 名（集中常量）、e2e 库名/邮箱（env） | Cookie 名改集中常量；e2e 改 env | `app/src/constants/cookie-names.ts`、`app/e2e/helpers/env.ts`、`app/e2e/helpers/db.ts` |
| C 部署面 | 容器名、镜像名、CI | 清单替换 | docker-compose*、.gitlab-ci.yml |
| D 品牌面 | 品牌色、主题名、favicon/logo、版权 | 清单替换（站点名走系统配置） | `app/src/theme/themes.ts`、global.css |
| E 数据面 | e2e 账号（随 B）、预置数据默认值 | 随 B / 按需 | 以代码为准 |
| F 文档面 | README/docs 路径示例 | 中性占位（默认 `/opt/{项目名}/`） | README、docs/ |

> B 面拆分：Cookie 名是**集中常量**（`src/constants/cookie-names.ts`，更名点之一，与包名/主题名同等对待）；e2e 库名/邮箱已 env 化，更名时**改 env 值即可，无需改代码**。

## 执行步骤

### Step 1：A 包名面

1. 改根 `package.json` 与各包（`app/`、`packages/core`、`packages/ui-ssr`、`packages/ui-spa`）的 `name`；
2. 全局搜索替换 `@fsdx/` → `@{包名前缀}/`（跳过 `node_modules`、`.git`、`pnpm-lock.yaml`、`docs/archive`）；
3. `pnpm install` 再生 `pnpm-lock.yaml`；
4. 检查 `tsconfig*.json`、`vite.config.ts`、`biome.json` 中是否引用旧包名。

### Step 2：B 运行标识面

1. `app/src/constants/cookie-names.ts`：改 `COOKIE_NAMES.ADMIN_TOKEN` / `CLIENT_TOKEN` 为项目 Cookie 名（集中修改点）；
   > ⚠️ 若与其他基于本模板的项目**部署在同一域名**，必须更名 Cookie——模板默认 `admin_token`/`client_token` 过于通用，同域名下会互相覆盖登录态；
2. `app/.env` 与 `app/.env.example`：改 `DATABASE_URL` 库名；如需独立 e2e 账号邮箱，设 `E2E_ADMIN_EMAIL` / `E2E_CLIENT_EMAIL` / `E2E_DB_NAME`；
3. `docker-compose.yml` 的 `DATABASE_URL` 默认值同步改库名。

### Step 3：C 部署面

1. `docker-compose.yml` / `docker-compose.prod.yml`：`container_name`、镜像名；
2. `.gitlab-ci.yml`：镜像仓库地址与镜像名；
3. 部署目录（若沿用文档默认则无需改，文档已用 `/opt/{项目名}/` 占位）。

### Step 4：D 品牌面

1. `app/src/theme/themes.ts`：品牌色与 `data-theme` 主题名；
2. 对应 global.css 的 `--t-brand-*` 令牌（保持 `themes.ts` 与 CSS 同色）；
3. 站点名在系统初始化页面配置；favicon/logo/版权文案按项目替换。

### Step 5：E 数据面

- 检查预置数据默认值（如预置管理员账号名、字典条目）是否需要按项目调整。

### Step 6：F 文档面

1. README 标题与描述；docs 中路径/示例（已中性化的占位无需改，如 `/opt/{项目名}/`）；
2. 若模板文档残留 `fsdx` 字样（README 一级标题等），一并替换为项目名。

## 创建 UPSTREAM.md

在项目根目录创建 `UPSTREAM.md`，记录上游与配置映射（供 `/import-upstream` 使用）：

```markdown
# 上游同步记录
- 上游仓库：<fsdx-web 仓库地址>
- remote 名：upstream
- 基线：<首次派生时的上游 commit>
- 配置映射：
  - cookie-names.ts COOKIE_NAMES.ADMIN_TOKEN → {管理端 Cookie 名}
  - cookie-names.ts COOKIE_NAMES.CLIENT_TOKEN → {客户端 Cookie 名}
  - DATABASE_URL 库名 → {数据库名}
  - E2E_DB_NAME / E2E_ADMIN_EMAIL / E2E_CLIENT_EMAIL → {e2e 配置}
  - @fsdx/* → @{包名前缀}/*
- 同步历史：（首次派生时为空）
```

## 验证清单

- [ ] 全仓 `grep -r "fsdx" --exclude-dir=node_modules --exclude-dir=.git --exclude=pnpm-lock.yaml` 仅剩历史文档（archive/changelog）与上游引用；
- [ ] `pnpm install` 成功，锁文件无 `@fsdx/` 残留（除 history 引用）；
- [ ] `pnpm check` 通过；
- [ ] `pnpm test` 通过；
- [ ] `pnpm dev` 启动，登录/退出流程 Cookie 名为新常量值。

> 详细验证见 [derive-checklist](../../checklists/derive-checklist.md)。同步准则见 [upstream-sync](../upstream-sync/SKILL.md)，背景模型见 [docs/project-ecosystem.md](../../../docs/project-ecosystem.md)。

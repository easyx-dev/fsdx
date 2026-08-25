# fsdx-web

基于 TanStack Start 构建的全栈 Web 应用框架。开箱内置 CMS 示例、RBAC 认证、事件埋点、国际化等基础设施，支持管理端和客户端前台，可快速扩展为任意业务系统。

## 技术栈

TanStack Start · React 19 · TypeScript · PostgreSQL + Drizzle ORM · Ant Design 6 · shadcn/ui · Tailwind CSS 4 · i18next · JWT + bcryptjs · Pino · Vite · Biome · Vitest

> 各技术版本号以 [AGENTS.md](AGENTS.md) 技术栈表为准。

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量（位于 app/ 下）
cp app/.env.example app/.env
# 编辑 app/.env 填写 DATABASE_URL 和 JWT_SECRET

# 生成并运行数据库迁移
pnpm db:generate
pnpm db:migrate

# 启动开发服务器 (端口 3000)
pnpm dev
```

首次部署访问 `/admin`，系统自动跳转到初始化页面。

## 双端入口

| 端 | 入口 | UI | 渲染模式 |
|----|------|-----|---------|
| 管理端 | `/admin` | Ant Design | SPA |
| 客户端前台 | `/` | shadcn/ui + Tailwind | SSR |

## 命令

常用开发命令如下，完整命令表（含 `pnpm e2e`、`pnpm db:pull`、`pnpm lint:fix` 等）见 [AGENTS.md](AGENTS.md)：

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览生产构建 |
| `pnpm test` | 运行测试 |
| `pnpm check` | TypeScript + Biome + 文档事实校验（doc:check） |
| `pnpm lint` | Biome 检查 |
| `pnpm lint:fix` | Biome 自动修复 |
| `pnpm format` | Biome 格式化 |
| `pnpm db:generate` | 生成数据库迁移文件 |
| `pnpm db:migrate` | 运行数据库迁移 |
| `pnpm db:studio` | 启动 Drizzle Studio |

## 子包文档

单仓库多包（pnpm workspace），`app/` 为应用包，`packages/*` 为被源码直引的库包：

| 包 | 说明 |
|----|------|
| [@fsdx/core](packages/core/README.md) | 纯逻辑库：同构纯工具（ms/export/cn/match-permission/date-format）+ 服务端基础设施（logger/jwt/ai/mail/sms/semaphore/task-manager 等），无 React |
| [@fsdx/ui-ssr](packages/ui-ssr/README.md) | shadcn 基础组件（前台 SSR），颜色 token 由宿主注入 |
| [@fsdx/ui-spa](packages/ui-spa/README.md) | antd 管理端组件（表格/上传/编辑器/静态方法桥接），antd 单实例 |

## 文档

| 文档 | 说明 |
|------|------|
| [架构总览](docs/architecture-overview.md) | 系统分层架构、数据流、路由体系 |
| [数据库设计](docs/database-design.md) | 表清单（以 `src/db/schema/` 为准）ER 图、列命名约定、约束汇总 |
| [认证与权限](docs/auth-permission-model.md) | 双用户体系、RBAC、JWT、中间件链路 |
| [缓存体系](docs/cache-system.md) | MemoryCache 设计、缓存实例清单（8 个领域缓存位于 `src/services/*/*.cache.ts`，含 `track.validate.ts` 频控内部实例）、生命周期 |
| [事件埋点](docs/event-tracking.md) | 客户端 SDK、服务端校验、缓冲写入、查询分析 |
| [部署运维](docs/deployment-ops.md) | 启动流程、定时任务、日志、优雅关闭 |
| [项目生态与衍生协同](docs/project-ecosystem.md) | 基座模板定位、衍生项目双向同步、命名面收敛、回灌净化 |
| [文档体系架构](docs/documentation-architecture.md) | 文档角色/边界、事实 SSOT、引用图、维护规则 |

## 开发约定

详见 [AGENTS.md](AGENTS.md)。

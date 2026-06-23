# fsdx-cms

基于 TanStack Start 构建的全栈 Web 应用框架。开箱内置 CMS 示例、RBAC 认证、事件埋点、国际化等基础设施，支持管理端和客户端前台，可快速扩展为任意业务系统。

## 技术栈

TanStack Start + React 19 · TypeScript 6 · Hono · PostgreSQL + Drizzle ORM · Ant Design 6 · shadcn/ui · Tailwind CSS 4 · i18next · JWT + bcryptjs · Pino · Vite 8 · Biome 2.4 · Vitest 4

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp env/.env.example env/.env.local
# 编辑 env/.env.local 填写 DATABASE_URL 和 JWT_SECRET

# 推送数据库 Schema
pnpm db:push

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

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览生产构建 |
| `pnpm test` | 运行测试 |
| `pnpm check` | TypeScript + Biome 检查 |
| `pnpm lint` | Biome 检查并自动修复 |
| `pnpm format` | Biome 格式化 |
| `pnpm db:push` | 推送 Schema 到数据库 |
| `pnpm db:generate` | 生成数据库迁移文件 |
| `pnpm db:migrate` | 运行数据库迁移 |
| `pnpm db:studio` | 启动 Drizzle Studio |

## 文档

| 文档 | 说明 |
|------|------|
| [架构总览](docs/architecture-overview.md) | 系统分层架构、数据流、路由体系 |
| [数据库设计](docs/database-design.md) | 14 张表 ER 图、列命名约定、约束汇总 |
| [认证与权限](docs/auth-permission-model.md) | 双用户体系、RBAC、JWT、中间件链路 |
| [缓存体系](docs/cache-system.md) | MemoryCache 设计、7 个缓存实例、生命周期 |
| [事件埋点](docs/event-tracking.md) | 客户端 SDK、服务端校验、缓冲写入、查询分析 |
| [部署运维](docs/deployment-ops.md) | 启动流程、定时任务、日志、优雅关闭 |

## 开发约定

详见 [AGENTS.md](AGENTS.md)。

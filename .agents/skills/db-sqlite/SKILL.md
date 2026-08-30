---
name: db-sqlite
description: >
  数据库迁移至 SQLite 指南（drizzle v1 + node:sqlite 异步驱动）。当以本项目为模板
  衍生新项目、需要把 PostgreSQL 切换为 SQLite，或评估 SQLite 作为目标库时触发。
  基于 drizzle v1.0（rc.4）+ query builder 风格基态，覆盖驱动选型、Schema 类型映射、
  事务同步化、时间序列 SQL 改写、测试适配与迁移执行流程。
---

# 数据库迁移：PostgreSQL → SQLite

## 快速索引

| 需求 | 跳转 |
|------|------|
| 选型依据与前置条件 | → [基态与选型](#0-基态与选型) |
| 依赖与配置改动 | → [依赖变更](#1-依赖变更) / [配置文件变更](#2-配置文件变更) |
| Schema 类型映射 | → [Schema 迁移](#3-schema-迁移) |
| db 客户端与迁移器 | → [DB 客户端](#4-db-客户端) |
| 为什么普通查询不用改 | → [查询层](#5-查询层异步保持) |
| ILIKE / db.execute / 时间序列 | → [服务端 SQL 适配](#6-服务端-sql-适配) |
| 时间戳从 Date 改 number | → [日期时间处理](#7-日期时间处理) |
| **事务必须同步化（关键陷阱）** | → [事务改造](#8-事务改造关键陷阱) |
| 测试 mock 适配 | → [测试迁移](#9-测试迁移) |
| e2e helpers 由 pg 改 node:sqlite 直连 | → [9.5 e2e 改造](#95-e2e-改造3-个文件pg--node-sqlite-文件路径直连) |
| 迁移前预扫描 / 迁移后校验 / 安全改写脚本 | → [迁移辅助脚本](#102-迁移辅助脚本scriptsdb-migrationts) |
| 删除旧迁移、重建基线 | → [迁移执行流程](#10-迁移执行流程) |
| 生产部署适配（deploy 子仓库裁剪） | → [10.1 部署适配](#101-生产部署适配deploy-子仓库) |
| node:sqlite 常见报错 | → [常见错误排查](#11-常见错误排查) |

## 0. 基态与选型

### 0.1 当前基态（本项目）

本项目已是 **drizzle v1.0.0-rc.4 + PostgreSQL**：

- `db.query/tx.query`（Relational Queries v1）已全部移除，全库为标准 query builder 风格（`db.select().from().where()`、`db.insert().values().returning()`），**本项目不定义 `defineRelations`**
- 迁移目录为 v3 结构（每迁移一个文件夹 + `snapshot.json`），`db:migrate` 走 `migrate-cli.ts` 程序化迁移（drizzle-kit v1 migrate 存在 CREATE SCHEMA 断连 bug）
- `drizzle.config.ts` 的 `schema` 指向 `src/db/schema/index.ts`

**本次迁移只做「pg → sqlite 方言切换」，不涉及 drizzle 版本升级与 RQB 迁移。**

### 0.2 驱动选型：node:sqlite（Node 原生）

| 维度 | node:sqlite（推荐） | better-sqlite3 |
|------|------|------|
| 驱动形态 | `SQLiteAsyncDatabase<'sync'>`，**普通查询是异步 API** | 0.x 同步驱动需终结符 `.all()/.run()/.get()` |
| 事务 | 回调**必须同步**（同 better-sqlite3） | 回调同步 |
| 依赖 | 零依赖（`node:sqlite` 内置于 Node） | 原生模块，需 `pnpm approve-builds` |
| Node 要求 | **>= 22.5**（本机 v24 满足） | 无特殊要求 |
| 实验警告 | Node 24 启动打印一次 ExperimentalWarning，可忽略 | 无 |

选择 node:sqlite 的核心收益：**非事务查询保持 `await db.select()` 风格，服务层代码零改动**；无需原生模块编译；与 drizzle v1.0 的 RQB v1 移除基态完全兼容。

### 0.3 硬性前置条件

- Node.js **>= 22.5.0**（`node:sqlite` 引入版本；24 稳定）
- 目标平台为单机/单实例部署（SQLite 是嵌入式数据库，不适合多写并发场景）

## 1. 依赖变更

```bash
# 移除 PostgreSQL 驱动
pnpm remove pg @types/pg

# 无需安装任何 SQLite 驱动（node:sqlite 为 Node 内置）
# 无需 pnpm approve-builds
```

drizzle-orm / drizzle-kit 保持 `1.0.0-rc.4` 不动（`node-sqlite` 驱动仅存在于 drizzle v1，0.x 无此驱动）。

## 2. 配置文件变更

### 2.1 `drizzle.config.ts`

```diff
- dialect: 'postgresql',
+ dialect: 'sqlite',
  dbCredentials: {
-   url: process.env.DATABASE_URL || "",
+   url: process.env.DATABASE_URL || "./data/data.db",
  },
```

注意：SQLite 的 `url` 是**文件路径**，不需要 `file:` 协议前缀（那是 libsql/Turso 的写法）。`schema` 保持指向 `./src/db/schema/index.ts` 不变。

### 2.2 `app/.env.example`

```diff
- # PostgreSQL 连接 URL（必填）
- DATABASE_URL="postgresql://postgres:your-password@host.docker.internal:5432/fsdx_web"
+ # SQLite 数据库文件路径（必填）
+ DATABASE_URL="./data/data.db"
```

### 2.3 `src/env.d.ts`

仅更新注释，变量名保持不变：

```diff
- /** PostgreSQL 连接 URL */
+ /** SQLite 数据库文件路径 */
  DATABASE_URL: string;
```

### 2.4 `.gitignore`

`.gitignore` 已忽略 `.data`（第 16 行）。若数据库文件放在 `./data/`，新增一行：

```
data/
```

### 2.5 `app/vitest.config.ts`

```diff
- DATABASE_URL: "postgres://test:test@localhost:5432/testdb",
+ DATABASE_URL: ":memory:",
```

`node:sqlite` 的 `DatabaseSync` 支持 `:memory:` 内存库，测试无需真实文件。注意：测试全部 mock 了 `#/db`，`DATABASE_URL` 仅供真实驱动初始化兜底。

## 3. Schema 迁移

### 3.1 import 源变更

所有 `src/db/schema/*.ts` 文件（13 个，17 张表）：

```diff
- import { pgTable, uuid, varchar, timestamp, boolean, jsonb, integer, bigint, index, uniqueIndex, unique, sql } from "drizzle-orm/pg-core";
+ import { sqliteTable, text, integer, index, uniqueIndex, unique, sql } from "drizzle-orm/sqlite-core";
```

### 3.2 列类型映射表

| PostgreSQL (pg-core) | SQLite (sqlite-core) | 说明 |
|---|---|---|
| `pgTable("table_name")` | `sqliteTable("table_name")` | 表定义 |
| `uuid().defaultRandom().primaryKey()` | `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())` | UUID 主键，text 存储，`$defaultFn` 在 drizzle v1.0 保留 |
| `uuid("column_name")` | `text("column_name")` | UUID 外键/普通列 |
| `timestamp("col", { withTimezone: true }).defaultNow().notNull()` | `integer("col", { mode: "number" }).$defaultFn(() => Date.now()).notNull()` | Unix 毫秒时间戳，JS 类型为 `number` |
| `timestamp("col", { withTimezone: true }).notNull().defaultNow()` | `integer("col", { mode: "number" }).notNull().$defaultFn(() => Date.now())` | `.defaultNow()` / `.notNull()` 顺序无关 |
| `timestamp({ withTimezone: true })` | `integer({ mode: "number" })` | 无列名版本（如 `operation_log.createdAt`） |
| `jsonb("col").$type<T>()` | `text("col", { mode: "json" }).$type<T>()` | JSON 数据，`$type` 必须保留（drizzle v1 `forbidJsonb`，SQLite 无 jsonb） |
| `boolean("col")` | `integer("col", { mode: "boolean" })` | 布尔值（存 0/1），JS 类型仍为 `boolean` |
| `bigint({ mode: "number" })` | `integer({ mode: "number" })` | 大整数（`file.size`） |
| `varchar({ length: N })` | `text()` | SQLite 忽略长度约束，列名照常写：`varchar("name")` → `text("name")` |
| `text()` / `integer()` | `text()` / `integer()` | 不变 |

> ⚠️ **`$defaultFn` 是客户端侧默认，不生成 DB 级 DEFAULT**：pg 的 `.defaultNow()` 会落库为 `DEFAULT now()`，sqlite 的 `$defaultFn` 仅由 drizzle 在写入时 JS 计算填值，迁移 SQL 中**没有** `DEFAULT` 子句（且 `.notNull()` 仍在）。因此**绕过 drizzle 的原始 SQL `INSERT`**（e2e 种子数据、数据灌入脚本、SQLite CLI）若不显式填写 `id` / `created_at` / `updated_at` 会直接违反主键/`NOT NULL` 约束。处理方式：原始 SQL 须显式填值（`id` 用 `random()`、时间戳用 `unixepoch()` 毫秒），或改用 drizzle query builder（自动触发 `$defaultFn`）——e2e 种子即因此采用后者。
>
> ⚠️ **无列名 `integer({ mode: "number" })` → 列名即 JS 属性名**：`timestamp({ withTimezone: true })`（无列名，如 `operation_log.createdAt`）迁移后列名保持 camelCase `createdAt`，生成 SQL 为 `` `createdAt` integer NOT NULL ``、索引落在 `createdAt` 上——与 AGENTS.md「operation_log 历史表为 camelCase 列名例外」对齐，**勿改成 `created_at`**。

### 3.3 约束差异处理

**部分唯一索引（Partial Unique Index）**

SQLite **原生支持**部分唯一索引，drizzle sqlite-core 的 `IndexBuilder` 也暴露 `.where()`（已验证 `sqlite-core/indexes.d.ts`）。本项目案例（`admin_user.is_root` 单 root 约束）**保留不动**：

```ts
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const adminUser = sqliteTable(
	"admin_user",
	{ /* ...列定义... */ },
	(table) => [
		uniqueIndex("idx_admin_user_single_root")
			.on(table.isRoot)
			.where(sql`${table.isRoot} = true`),
	],
);
```

生成的 SQL 为 `CREATE UNIQUE INDEX ... ON admin_user (is_root) WHERE "admin_user"."is_root" = true`，与 pg 语义等价。应用层 `init.server.ts` 的 `checkInitStatus()` 校验仍保留作为快速路径。

**ON UPDATE CASCADE**

SQLite **原生支持** `ON UPDATE CASCADE`，drizzle sqlite-core 的 `references()` 也支持（`UpdateDeleteAction` 含 `'cascade'`，已验证 `sqlite-core/foreign-keys.d.ts`）。本项目案例（`dict_item.dictSlug` 引用 `dict.slug`）**保留不动**：

```ts
dictSlug: varchar("dict_slug", { length: 50 })
	.references(() => dict.slug, { onUpdate: "cascade" })
	.notNull(),
```

> 若目标 drizzle-kit 版本对 sqlite 生成 `ON UPDATE CASCADE` 存在兼容问题，可降级移除该约束并在应用层处理关联条目（`dict.server.ts` 的 update 路径已覆盖）。

**降序索引（DESC Index）**

drizzle 的 sqlite-core 索引构建器**不暴露列的 `.desc()` 方法**（已验证 `sqlite-core/indexes.d.ts`，`on()` 只接受裸列对象），尽管 SQLite 3.3+ 本身支持 DESC 索引。本项目 2 处（`track.ts`）全部降为默认 ASC：

```diff
- index("idx_track_event_time").on(table.time.desc()),
- index("idx_track_event_name_time").on(table.name, table.time.desc()),
+ index("idx_track_event_time").on(table.time),
+ index("idx_track_event_name_time").on(table.name, table.time),
```

功能等价：查询里 `orderBy(time.desc())` 照常工作，SQLite 可倒序扫描 ASC 索引。

### 3.4 示例：完整表迁移

**迁移前（admin_user）**：

```ts
import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const adminUser = pgTable(
	"admin_user",
	{
		id: uuid().defaultRandom().primaryKey(),
		username: varchar({ length: 50 }).unique().notNull(),
		email: varchar({ length: 255 }).unique().notNull(),
		passwordHash: varchar("password_hash", { length: 255 }).notNull(),
		avatar: varchar({ length: 500 }),
		adminRoleIds: jsonb("admin_role_ids").$type<string[]>().default([]).notNull(),
		isRoot: boolean("is_root").default(false).notNull(),
		status: varchar({ length: 20 }).default("active").notNull(),
		lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("idx_admin_user_single_root").on(table.isRoot).where(sql`${table.isRoot} = true`),
	],
);
```

**迁移后**：

```ts
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const adminUser = sqliteTable(
	"admin_user",
	{
		id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
		username: text().unique().notNull(),
		email: text().unique().notNull(),
		passwordHash: text("password_hash").notNull(),
		avatar: text("avatar"),
		adminRoleIds: text("admin_role_ids", { mode: "json" }).$type<string[]>().default([]).notNull(),
		isRoot: integer("is_root", { mode: "boolean" }).default(false).notNull(),
		status: text("status").default("active").notNull(),
		lastLoginAt: integer("last_login_at", { mode: "number" }),
		createdAt: integer("created_at", { mode: "number" }).$defaultFn(() => Date.now()).notNull(),
		updatedAt: integer("updated_at", { mode: "number" }).$defaultFn(() => Date.now()).notNull(),
		deletedAt: integer("deleted_at", { mode: "number" }),
	},
	(table) => [
		uniqueIndex("idx_admin_user_single_root")
			.on(table.isRoot)
			.where(sql`${table.isRoot} = true`),
	],
);
```

## 4. DB 客户端

### 4.1 `src/db/index.ts`

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

/** 数据库实例类型（无 relations，查询一律使用 query builder） */
export type Db = NodeSQLiteDatabase;

/** 从 db.transaction 回调参数推导事务实例类型，规避与内部 SQLiteAsyncTransaction 的协变/逆变偏差 */
type TxOf<D> = D extends {
	transaction: (fn: (tx: infer T) => unknown, ...args: never[]) => unknown;
}
	? T
	: never;

/** 事务实例类型（无 relations，查询一律使用 query builder） */
export type Tx = TxOf<Db>;

/** 从 DATABASE_URL 提取数据库文件路径（去除可选的 file: 前缀） */
function getDbPath(): string {
	const url = process.env.DATABASE_URL || "./data/data.db";
	return url.replace(/^file:/, "");
}

function createDb(): Db {
	const dbPath = getDbPath();
	// node:sqlite 不会自动创建父目录，先确保数据目录存在（:memory: 无目录跳过）
	if (dbPath !== ":memory:") {
		mkdirSync(dirname(dbPath), { recursive: true });
	}
	const sqlite = new DatabaseSync(dbPath);
	// WAL 提升并发读性能；foreign_keys 由 node:sqlite 默认开启（enableForeignKeyConstraints 默认 true）
	sqlite.exec("PRAGMA journal_mode = WAL");
	return drizzle({ client: sqlite });
}

let _dbInstance: Db | null = null;

/** 懒加载 db 实例的 Proxy：所有属性访问触发时初始化，延迟 db 实例初始化至首次属性访问 */
export const db: Db = new Proxy({} as Db, {
	get(_, prop) {
		if (!_dbInstance) {
			_dbInstance = createDb();
		}
		return (_dbInstance as unknown as Record<string | symbol, unknown>)[prop];
	},
});

/** 事务助手：统一 db.transaction 用法（同步回调，node:sqlite 事务不可 async） */
export function withTransaction<T>(fn: (tx: Tx) => T): T {
	return db.transaction(fn as never) as T;
}
```

要点：

- 传显式 `{ client: sqlite }` 是为了在打开后执行 pragma；`sqlite.exec()` 是 `DatabaseSync` 的同步方法
- `drizzle(process.env.DATABASE_URL)` 字符串简写同样可用，但无法设置 WAL pragma
- **不要传 `schema` 参数**：本项目 RQB v1 已移除（不定义 `defineRelations`），`typeof schema` 不满足 `NodeSQLiteDatabase<TRelations>` 的 `TablesRelationalConfig` 约束，`drizzle({ client, schema })` 直接编译报错——保持无 schema，查询用 query builder 即可
- `Tx` 用 `TxOf<Db>` 从 `db.transaction` 回调参数反向推导，避免手写 `SQLiteAsyncTransaction<'sync', ...>` 的类型偏差
- `withTransaction` 的 `as never`/`as T` 双 cast 是 node-sqlite 'sync' kind 下 `db.transaction` 返回条件类型（`T extends Promise ? DrizzleTypeError : T`）无法与普通泛型 `T` 直接统一的必要规避，属薄壳内的局部豁免
- **必须加 `mkdirSync`**：`node:sqlite` 不自动创建父目录，`data/` 已在 `.gitignore`，全新 checkout 下不加会启动即崩

### 4.2 `src/db/migrate.ts`

```ts
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { logger } from "#/lib/logger/logger";

function getDbPath(): string {
	const url = process.env.DATABASE_URL || "./data/data.db";
	return url.replace(/^file:/, "");
}

export async function runMigrations() {
	const migrationsFolder = resolve(process.cwd(), "drizzle");
	if (!existsSync(migrationsFolder)) {
		logger.warn({ migrationsFolder }, "迁移目录不存在，跳过数据库迁移");
		return;
	}
	const dbPath = getDbPath();
	// node:sqlite 不会自动创建父目录，先确保数据目录存在（:memory: 无目录跳过）
	if (dbPath !== ":memory:") {
		mkdirSync(dirname(dbPath), { recursive: true });
	}
	const sqlite = new DatabaseSync(dbPath);
	sqlite.exec("PRAGMA journal_mode = WAL");
	const migrationDb = drizzle({ client: sqlite });

	logger.info({ migrationsFolder }, "开始执行数据库迁移");
	// node-sqlite/migrator 的 migrate() 是同步方法，await 无害
	migrate(migrationDb, {
		migrationsFolder,
		migrationsTable: "__drizzle_migrations",
	});
	logger.info("数据库迁移完成");
}
```

`migrate-cli.ts`（`pnpm db:migrate`）**保持不变**——它只是调用 `runMigrations()`，程序化迁移路径与生产 bootstrap 一致。

## 5. 查询层（异步保持）

node:sqlite 驱动对外是 `SQLiteAsyncDatabase<'sync'>`：`select()/insert()/update()/delete()/$count` 全部返回 Promise（`QueryPromise`），**`await` 风格原样保留**。

本项目基态已是标准 query builder（RQB v1 已移除），因此**非事务查询代码零改动**：

```ts
// 全部保持不动
const [root] = await db.select().from(adminUser).where(eq(adminUser.isRoot, true)).limit(1);
const [record] = await db.insert(dict).values(params).returning();
await db.update(news).set({ ... }).where(eq(news.id, id));
const total = await db.$count(db.select().from(message).where(whereCondition));
```

> ⚠️ 只有 **`db.transaction()` 回调**是例外（见第 8 节）。`$count` 在 'sync' kind 下返回同步 number，`await` 一个 number 无害，`executePaginatedQuery` 的 `Promise.all` 依旧成立。

## 6. 服务端 SQL 适配

### 6.1 `ilike()` → `like()`

PostgreSQL 的 `ILIKE` 在 SQLite 不存在；SQLite 的 `LIKE` 对 ASCII 默认不区分大小写。

```diff
- import { and, eq, gte, ilike, lt, or } from "drizzle-orm";
+ import { and, eq, gte, like, lt, or } from "drizzle-orm";

- ilike(event.event, `%${keyword}%`)
+ like(event.event, `%${keyword}%`)
```

影响文件（8 个，各 1~4 处）：`admin-user`、`admin-role`、`client-user`、`client-role`、`file`、`message`、`operation-log`、`track.analytics`。

### 6.2 `db.execute()` → `db.all()`

`db.execute()` 是 node-postgres 专用 API，sqlite 驱动不可用，改用 `db.all()`，结果直接是行数组（无 `.rows`）。

```diff
- const timeSeriesResult = await db.execute(sql`SELECT ...`);
- (timeSeriesResult as unknown as { rows: ...[] }).rows ?? []
+ const timeSeriesResult = await db.all(sql`SELECT ...`);
+ timeSeriesResult
```

影响：`track.analytics.ts` 的 `getTrackAnalytics`（约 4 段聚合 SQL 中的时间序列趋势段）。

### 6.3 时间序列聚合查询

```diff
// PostgreSQL
- SELECT TO_CHAR(${trackEventTable.time} AT TIME ZONE 'Asia/Shanghai', ${timeFormat}) AS date,
-        COUNT(*)::int AS count
-  WHERE ${trackEventTable.time} >= ${start.toISOString()}
-    AND ${trackEventTable.time} < ${end.toISOString()}
-  GROUP BY date ORDER BY date

// SQLite（Unix 毫秒 + strftime，手动加 8 小时转上海时区）
+ SELECT strftime('%Y-%m-%d %H:00', ${trackEventTable.time} / 1000, 'unixepoch', '+8 hours') AS date,
+        COUNT(*) AS count
+  WHERE ${trackEventTable.time} >= ${start.getTime()}
+    AND ${trackEventTable.time} < ${end.getTime()}
+  GROUP BY date ORDER BY date
```

小时/日粒度分别用 `'%Y-%m-%d %H:00'` / `'%Y-%m-%d'`（替换原 `timeFormat` 变量）。

### 6.4 JSON 字段访问

```diff
// PostgreSQL JSONB 操作符
- sql`${trackEventTable.properties}->>'page_name'`
- sql`${trackEventTable.properties}::text ILIKE ${`%${keyword}%`}`

// SQLite（text json 存储）
+ sql`json_extract(${trackEventTable.properties}, '$.page_name')`
+ like(trackEventTable.name, `%${keyword}%`)  // JSON 文本直接 LIKE 的模糊匹配见 6.5 说明
```

### 6.5 类型转换移除

SQLite 是动态类型，无需显式转换：

```diff
- COUNT(*)::int
+ COUNT(*)

- CASE WHEN ... THEN ${trackEventTable.userId}::text ELSE ... END
+ CASE WHEN ... THEN ${trackEventTable.userId} ELSE ... END
```

`count(*)::int` 在本项目 `track.analytics.ts` 的事件分布 / Top 页面 / 独立用户数 / 总事件数段出现，全部去除 `::int`。

> `properties` 模糊搜索（`properties::text ILIKE`）在 SQLite 下 `json_extract` 语义不等价，建议改为对 `name`/已知标量字段 `like` 匹配；如需对 JSON 全文模糊，可对整列 `like(trackEventTable.properties, `%${keyword}%`)`（text 存储直接匹配子串）。

### 6.6 结果行数字段 `rowCount` → `changes`

node-postgres 的 `update()/insert()` 返回 `{ rowCount }`；node-sqlite 返回 `StatementResultingChanges`（字段为 `changes: number | bigint`，无 `rowCount`）。本项目 `message.server.ts` 的 5 处读写结果行数需改：

```diff
- return (result.rowCount ?? 0) > 0;
+ return Number(result.changes) > 0;

- return result.rowCount ?? 0;
+ return Number(result.changes);

- return result.rowCount ?? rows.length;
+ return Number(result.changes);
```

影响：`message.server.ts` 的 `markAsRead` / `markAllRead` / `deleteMessage` / `sendMessages` / `deleteMessageById`（5 处）；对应 `message.test.ts` 的 mock 由 `{ rowCount: N }` 改 `{ changes: N }`。

## 7. 日期时间处理

Schema 时间戳列从 `timestamp`（JS `Date`）变为 `integer({ mode: "number" })`（JS `number`，Unix 毫秒），所有写操作与比较必须传 `Date.now()` / 毫秒值。

### 7.1 写入操作

```diff
- .set({ updatedAt: new Date(), deletedAt: new Date() })
+ .set({ updatedAt: Date.now(), deletedAt: Date.now() })

- .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
+ .values({ ...data, createdAt: Date.now(), updatedAt: Date.now() })
```

### 7.2 查询条件

```diff
- gte(trackEventTable.time, new Date(startDate))
+ gte(trackEventTable.time, new Date(startDate).getTime())

- lt(file.expiredAt, new Date())
+ lt(file.expiredAt, Date.now())

- gt(captchaCode.expiredAt, new Date())
+ gt(captchaCode.expiredAt, Date.now())
```

### 7.3 字符串日期解析

```diff
- const publishedAtValue = params.publishedAt ? new Date(params.publishedAt) : null;
+ const publishedAtValue = params.publishedAt ? new Date(params.publishedAt).getTime() : null;
```

### 7.4 读取时格式化

读取结果为 `number`，需包一层 `new Date()` 再调用日期方法：

```diff
- (r.publishedAt ?? r.createdAt).toISOString()
+ new Date(r.publishedAt ?? r.createdAt).toISOString()
```

### 7.5 类型定义更新

显式声明的类型中 timestamp 字段从 `Date` 改为 `number`：

```diff
export interface EventRecord {
  id: string;
- time: Date;
+ time: number;
- createdAt: Date;
+ createdAt: number;
}
```

**替换范围与豁免**：全局搜索 `new Date(`（注意不是只有 `new Date()`，还包括 `new Date(expr)`），分类处理：

- `new Date()` 在 Drizzle `.set()` / `.values()` / `gt()` / `lt()` / `gte()` 中 → `Date.now()`
- `new Date(Date.now() ± X)`（如 captcha `expiredAt`、file 临时文件过期时间）→ `Date.now() ± X`
- `new Date(params.xxx)`（字符串转时间戳，如 news `publishedAt`）→ `new Date(params.xxx).getTime()`
- 纯 JS 日期计算（`logs-cleanup.server.ts` 的 `toDateString(new Date())`、`track.validate.ts` 的 `new Date(value)` 校验）**保留不动**
- 搜索范围覆盖**所有 `.ts`**（含非 `.server.ts` 的 `track.meta.ts`、`i18n-seed.ts`），本项目约 30 处写操作点

> 可先用迁移脚本的 `audit` 子命令一次性列出全部 `new Date(` 位置再逐一甄别（见 [§10.2](#102-迁移辅助脚本scriptsdb-migrationts)）。

### 7.6 路由层 SFn 与前端日期消费点

时间戳变 `number` 后，`.server.ts` 之外还有两类消费点需甄别（audit 会列出，但要人工判断）：

- **需改（入参转换）**：
  - SFn 序列化层：如 `operation-logs.functions.ts` 的 `mapDateField`——`createdAt` 已是 `number`，须补 `typeof value === "number" ? new Date(value).toISOString() : String(value)` 分支（见 §11.8）
  - SFn 把字符串/Date 转成 DB 写入值：如 `news.functions.ts` 的 `new Date(data.publishedAt)` → `.getTime()`、发版补写 `updateData.publishedAt = new Date()` → `Date.now()`
- **无需改（number 可直接 `new Date(num)`）**：前端渲染点 `new Date(item.createdAt).toLocaleString(...)` / `new Date(e.time).toISOString()`（`routes/messages.tsx`、`admin/_admin/messages/index.tsx`、`admin/_admin/track/query.tsx`、`admin/_admin/operation-logs/index.tsx` `new Date(entry.createdAt)`）——`new Date()` 接受 number，`toISOString`/`toLocaleString` 行为一致，勿画蛇添足
  
## 8. 事务改造（关键陷阱）

### 8.1 为什么必须同步化

node:sqlite 的 resultKind 是 `'sync'`，事务运行时**同步调用回调**：

```js
const result = transaction(tx);  // 同步执行
this.run(sql`commit`);           // 立即 COMMIT
return result;
```

若回调是 `async`：回调体在第一个 `await` 处挂起 → **`COMMIT` 立即执行 → 后续操作落在事务外**（静默数据 bug）。TS 类型会拦截（`Result<'sync', T> = T` 非 Promise），但运行时行为如此，切勿用 `as any` 绕过。

### 8.2 纯 Drizzle 操作：同步回调 + 终结符

```diff
// 迁移前（PostgreSQL，async 回调）
- const now = new Date();
- await db.transaction(async (tx) => {
-     await tx.update(dictItem).set({ deletedAt: now }).where(eq(dictItem.dictSlug, existing.slug));
-     await tx.update(dict).set({ deletedAt: now }).where(eq(dict.id, id));
- });

// 迁移后（node-sqlite，同步回调）
+ const now = Date.now();
+ db.transaction((tx) => {
+     tx.update(dictItem).set({ deletedAt: now }).where(eq(dictItem.dictSlug, existing.slug)).run();
+     tx.update(dict).set({ deletedAt: now }).where(eq(dict.id, id)).run();
+ });
```

事务内 Drizzle 操作终结符对照：

| 操作 | PostgreSQL（await） | node-sqlite 事务内 |
|---|---|---|
| 查询一行 | `await tx.select().from(t).where(...).limit(1)` | `tx.select().from(t).where(...).limit(1).all()` |
| 查询多条 | `await tx.select()...` | `...all()` |
| 插入（要返回值） | `await tx.insert(t).values(...).returning()` | `tx.insert(t).values(...).returning().all()` |
| 插入（不要返回值） | `await tx.insert(t).values(...)` | `tx.insert(t).values(...).run()` |
| 更新 | `await tx.update(t).set(...).where(...)` | `tx.update(t).set(...).where(...).run()` |
| 删除 | `await tx.delete(t).where(...)` | `tx.delete(t).where(...).run()` |

> `.all()/.get()/.run()/.values()` 终结符在 async 构建器上均可用；`insert().returning().all()` 返回行数组。

### 8.3 含异步操作：手动 BEGIN/COMMIT

当事务内需要执行非 Drizzle 的异步操作（如 `bcrypt.hash()`、`upsertConfig()` 等），使用手动事务，异步操作留在事务内 await：

```ts
import { sql } from "drizzle-orm";

db.run(sql.raw("BEGIN"));
try {
	// 同步 Drizzle 操作（终结符）
	const [existingRoot] = db.select().from(adminUser).where(eq(adminUser.isRoot, true)).limit(1).all();

	// 异步操作可在事务内 await（手动事务不限制回调）
	const passwordHash = await bcrypt.hash(admin.password, 10);
	await upsertConfig("site_name", siteName, "站点名称", "input", "站点设置");

	db.run(sql.raw("COMMIT"));
} catch (err) {
	db.run(sql.raw("ROLLBACK"));
	throw err;
}
```

注意：手动事务内必须使用顶层 `db`（`tx` 由 `db.transaction()` 创建，手动模式下不存在），所有操作经 `db` + 终结符执行。

> ⚠️ **提前 return 的分支须先 `ROLLBACK`**：手动事务没有回调收尾，任何在 `try` 内直接 `return` / `throw`（非依赖外层 catch 的路径）都会让事务悬挂。例如 `initSystem` 侦测到已初始化时应先 `db.run(sql.raw("ROLLBACK"))` 再 `return`，不能直接返回：

```ts
db.run(sql.raw("BEGIN"));
try {
	const [existingRoot] = db.select().from(adminUser).where(eq(adminUser.isRoot, true)).limit(1).all();
	if (existingRoot) {
		db.run(sql.raw("ROLLBACK"));   // 早退必须先回滚
		return { success: false, message: "系统已初始化，禁止重复操作" };
	}
	// ...其余操作...
	db.run(sql.raw("COMMIT"));
} catch (err) {
	db.run(sql.raw("ROLLBACK"));
	throw err;
}
```

### 8.4 本项目 4 处事务清单

| 文件 | 位置 | 处理方式 |
|------|------|---------|
| `src/services/dict/dict.server.ts` `deleteDict` | `db.transaction(async (tx) => ...)` | 同步回调（8.2 示例） |
| `src/services/dict/dict.server.ts` `importDicts` | 同上 | 同步回调；内部 `tx.select().from()` → `.all()`、`tx.insert().values()` → `.run()` |
| `src/services/i18n/i18n-content.server.ts` `importContentTranslations` | 同上 | 同步回调；`tx.select().limit(1)` → `.get()`、`tx.update().set().where()` → `.run()`、`tx.insert().values()` → `.run()` |
| `src/services/init/init.server.ts` `initSystem` | 内含 `bcrypt.hash` + `upsertConfig`×N + `loadConfigCache` | 手动 BEGIN/COMMIT（8.3），`upsertConfig`/`loadConfigCache` 保持 await |

## 9. 测试迁移

测试改动**不止事务相关**，共三类，覆盖约 10 个测试文件。建议先用脚本 `audit` 列出全部 `new Date(`/`rowCount`/`withTransaction` 命中，再逐类处理。

**第一类：事务 mock 同步化**（3 个文件，改动最大）

被测代码的事务回调由 async 变同步后，tx mock 需补齐 `.all()/.get()/.run()` 终结符，且行数组要 `mockReturnValue`（同步）而非 `mockResolvedValue`（异步）。以 `init.test.ts` 为例：

```diff
// mockTx 的 createChain 已具备 then 拦截；事务内不再 await，需要终结符
- txRows.mockReset().mockResolvedValue([]);
+ txRows.mockReset().mockReturnValue([]);          // 终结符 .all() 同步返回行数组
  mockDb.transaction.mockImplementation(async (cb) => {
      const { tx, txRows } = mockTx();
      txRows.mockReturnValue([]);
      tx.insert = mockInsertReturning({ id: "role-1", ... });
      return cb(tx);                                // 同步回调，返回同步值
  });
```

涉及文件：
- `init.test.ts`：`initSystem` 改手动 BEGIN/COMMIT，不再走 `withTransaction`——mock 改用顶层 `mockDb.run` + `mockRows`，删掉 `mockTx`/`transaction` 包装
- `dict.test.ts`：`importDicts` 事务内 select 走 `.all()/.get()`，需独立 `txRows`（`mockReturnValueOnce`）+ tx 链加 `.all()/.get()`、update/insert 加 `.run()`
- `i18n.test.ts`：`importContentTranslations` 同上，tx select 链加 `.get()`、insert 加 `.run()`

**第二类：时间戳类型断言**（`new Date()` 夹具 + `toBeInstanceOf(Date)` → `toBeTypeOf("number")`）

涉及文件：`news.test.ts`（`publishedAt`/`createdAt` 断言）、`captcha.test.ts`（`expiredAt` 类型）、`config.test.ts`（`updatedAt: expect.any(Date)` → `expect.any(Number)`）、`file.test.ts`（`expiredAt.getTime()` → 直接比数字）、`operation-logs.test.ts`（`mapDateField` 数字入参）。mock 夹具里的 `createdAt: new Date()` 在 `any` 语境下不报错，可不动，但显式类型化的夹具（如 news 的 `newsRecord`）必须改 `Date.now()`。

**第三类：结果字段 / API 改名**（`rowCount` → `changes`、`db.execute` → `db.all`）

涉及文件：`message.test.ts`（`{ rowCount: N }` → `{ changes: N }`，`sendMessages` 兜底用例改名）、`health.test.ts`（`mockDb.execute` → `mockDb.all`）、`track.test.ts`（`mockDb.execute` → `mockDb.all` + 时间序列结果形状 + `batch[].time` 改 number）。

> 事务内终结符走 `.all()`，mock 链需在 `limit()` 之后挂 `.all()` 返回 `txRows()` 的值（同步）。若被测代码同时保留 `await` 风格（如手动事务内的顶层 `db`），对应 `select` 链继续用 `then` 拦截即可。

### 9.5 e2e 改造（3 个文件，pg → node:sqlite 文件路径直连）

e2e 用 `DATABASE_URL` 直连数据库塞种子/验证码，`DATABASE_URL` 从连接 URL 变为**文件路径**后，`new URL()` 推导隔离库会崩，且 pg 专用 API（`Pool`/`Client`/`rowCount`/`serial`）全部不可用。逐文件处理（`playwright.config.ts` 的 `getE2eDbUrl()` 名保留、返回值即文件路径，**无需改动**）：

- **`e2e/helpers/env.ts`**：删除 `E2E_DB_NAME` 的 `new URL(loadAppEnv().DATABASE_URL)` 推导与 `getMaintenanceDbUrl()`（SQLite 无「建库/维护连接」概念）；改为文件路径推导——基础库路径去 `file:` 前缀后，以 `_e2e` 后缀生成隔离库（`data.db` → `data_e2e.db`），`E2E_DB_URL` 可覆盖：

```ts
export function getE2eDbUrl(): string {
	return process.env.E2E_DB_URL ?? getE2eDbPath(); // getE2eDbPath 由 base 路径 + _e2e 推导
}
```

- **`e2e/helpers/db.ts`**：pg `Pool` → `DatabaseSync` + `drizzle({ client })`（懒加载单例）；`seedBaseData` / `seedCaptcha` / `seedClientUser` 改用 **drizzle query builder**（**不要手写原始 SQL**——`created_at`/`updated_at` 已无 DB 默认，见 §3.2 `$defaultFn` 警告），事务含 `bcrypt.hash` 异步操作走手动 `BEGIN/COMMIT`（§8.3）；`is_root`/`email_verified` 布尔列存 `true`/`false`（drizzle `integer({ mode: "boolean" })` 转换）
- **`e2e/scripts/prepare.ts`**：删除 `ensureE2eDb()`（`CREATE DATABASE`）与 `getMaintenanceDbUrl` 使用；`resetE2eSchema()` 改为删除隔离库文件（含 `-wal`/`-shm` 伴生文件）整体重置；`migrateE2eDb()` 改用 `drizzle-orm/node-sqlite/migrator` 的 `migrate()`（替代手工遍历 SQL + sha256 哈希回填 `drizzle.__drizzle_migrations`，与 bootstrap `runMigrations()` 同路径）：

```ts
import { migrate } from "drizzle-orm/node-sqlite/migrator";
sqlite.exec("PRAGMA journal_mode = WAL");
migrate(drizzle({ client: sqlite }), { migrationsFolder, migrationsTable: "__drizzle_migrations" });
```

> e2e 文件被 `tsc` 与 `audit`/`verify` 门禁覆盖（`app/e2e` 在扫描目录内），改动后应通过 `pnpm check` 与 `verify`。

## 10. 迁移执行流程

```bash
# 0. 预扫描：列出全部「必改/甄别」命中，锁定改动面（见 §10.2）
pnpm --filter @fsdx/web exec tsx ../.agents/skills/db-sqlite/scripts/db-migration.ts audit

# 1. 移除 pg 依赖
pnpm remove pg @types/pg

# 2. 删除旧 PostgreSQL 迁移文件
rm -rf app/drizzle/

# 3. 创建数据目录
mkdir -p app/data/

# 4. 生成新的 SQLite 迁移
DATABASE_URL="./data/data.db" pnpm --filter @fsdx/web db:generate

# 5. 审查生成的 migration.sql（确认 17 张表 CREATE TABLE + 无破坏性操作）

# 6. 执行程序化迁移（开发环境；与生产 bootstrap 路径一致）
DATABASE_URL="./data/data.db" pnpm --filter @fsdx/web db:migrate

# 7. 迁移后校验：断言「必改」模式 0 命中 + 配置断言（见 §10.2）
pnpm --filter @fsdx/web exec tsx ../.agents/skills/db-sqlite/scripts/db-migration.ts verify

# 7.1 重建 doc 事实产物（schema 表定义函数改名后 doc-facts 正则失配，须人工同步 + 重新生成，见下方说明）
#   ① 改 app/scripts/doc-facts.ts 的 buildTableFileMap() 正则：pgTable( → sqliteTable(
#   ② 重新生成 docs/generated/{permissions,tables}.md
pnpm --filter @fsdx/web doc:gen

# 8. 全量回归
pnpm check && pnpm test

# 9. 更新 CHANGELOG（基建变更按 AGENTS.md 在 [Unreleased] Infrastructure 追加 [infra] 条目，说明影响面）
```

> ⚠️ **doc-facts 必须人工同步**：`app/scripts/doc-facts.ts` 的 `buildTableFileMap()` 用 `/pgTable\(\s*"([^"]+)"/` 映射表名 → schema 文件。全部 schema 改 `sqliteTable(` 后正则失配，`tables.md` 的「Schema 文件」列全部变空，且 `doc:check` 与生成物同向漂移**仍会通过**（校验脚本和提交物一起漂移，掩盖文档 SSOT 退化）。务必改正则并重新 `doc:gen`；`doc-check` 此形态不拦截，需人工复核 `tables.md` 中有无空列。

> ⚠️ **不要用 `db:push`**：push 直接建表会跳过迁移记录，随后 bootstrap 的 `runMigrations()` 对已存在的表重复执行 `CREATE TABLE` 而 fail-fast（`table already exists`），与项目「禁止 db:push」约定冲突。SQLite 目标统一走 `db:migrate`（`migrate-cli.ts` → `runMigrations()`）。

生产部署：bootstrap `runMigrations()` 启动时自动执行（`data/` 目录需存在且可写，迁移失败 = 进程启动即崩，fail-fast）。

> ⚠️ 迁移目录整体重建后，任何应用过旧 PostgreSQL 迁移的库已不适用（SQLite 是新库，无此问题）；SQLite 库如有残留表（`table already exists`），删除 `data/data.db` 后重启。

### 10.2 迁移辅助脚本（scripts/db-migration.ts）

本 skill 内置一个零依赖（纯 `node:fs/path/url`）的辅助脚本，位于 `.agents/skills/db-sqlite/scripts/db-migration.ts`，经 `tsx` 运行、仓库根由脚本位置自推导（不依赖 cwd）。三个子命令：

```bash
pnpm --filter @fsdx/web exec tsx ../.agents/skills/db-sqlite/scripts/db-migration.ts audit
pnpm --filter @fsdx/web exec tsx ../.agents/skills/db-sqlite/scripts/db-migration.ts verify
pnpm --filter @fsdx/web exec tsx ../.agents/skills/db-sqlite/scripts/db-migration.ts fix --ilike --execute --rowcount [--write]
```

| 子命令 | 作用 | 退出码 |
|--------|------|--------|
| `audit`（默认） | 扫描 `app/src`/`app/e2e`/`app/scripts` 与固定配置文件，按「必改/甄别」两级输出 file:line 清单 | 存在「必改」命中即 1 |
| `verify` | 断言「必改」模式 0 命中 + 固定配置断言（`package.json` 无 pg、`drizzle.config.ts` 为 sqlite、schema 无 pg-core） | 任一失败即 1 |
| `fix` | 安全机械改写（默认 dry-run 预览，加 `--write` 落盘，幂等） | 未知目标/缺参数即 1 |

**「必改」模式**（迁移必须处理，供 audit/verify 门禁）：`ilike`、`db.execute`、`rowCount`、`pg`/`node-postgres`/`pg-core` 导入、`pgTable(`（正则 `/pgTable\\?\(/` 同时命中源码调用 `pgTable("...` 与正则字面量形态 `pgTable\(`，如 doc-facts.ts 的映射正则）、`postgresql://`、`TO_CHAR`、`AT TIME ZONE`、`->>`、`::int`/`::text`/`::bigint`。

**「甄别」模式**（仅列出位置，需人工判断）：`new Date(`、`withTransaction`、`db.transaction`、`timestamp(`/`jsonb(`/`uuid(`/`boolean(`。

**`fix` 的边界**：只做三件无歧义替换——`--ilike`（`ilike`→`like`，app/src 全量）、`--execute`（仅 health 的 `db.execute(sql\`SELECT 1\`)` → `db.all(...)`）、`--rowcount`（仅 message 模块的 `result.rowCount ?? X` → `Number(result.changes)`）。**不做**事务同步化、schema 类型映射、时间序列 SQL、jsonb 运算符、测试 mock 改造——这些仍需按本 skill 各节人工完成，脚本只负责「发现 + 兜底校验」。

> `fix` 只改服务端源码的精确形态，测试 mock 里的 `{ rowCount: N }` 等仍需按 §9 手工调整。

### 10.1 生产部署适配（deploy 子仓库）

切 SQLite 后生产部署**不再需要 PostgreSQL 容器**，`deploy/` 子仓库须针对性裁剪（针对 [docs/project-ecosystem.md](../../../docs/project-ecosystem.md) 部署子仓库方案）：

1. **compose 裁剪**：删除 `db` 服务与 `volumes/db`，仅保留 `app`；`DATABASE_URL` 改指向挂载卷内 SQLite 文件（`./data/data.db`，即 `volumes/app/data.db`），移除 `POSTGRES_*` env，保留 `STORAGE_DIR=/app/data`
2. **备份/恢复脚本**：
   - `backup.sh`：去掉 pg_dump 两步——数据库与应用数据**同源**（`volumes/app` 内含 `data.db`），直接打包 `volumes/app` 即可。在线一致快照用容器内 `node:sqlite` 的 `VACUUM INTO`（**镜像无 `sqlite3` CLI**，勿用 `sqlite3 .backup`）：
     ```bash
     docker compose exec app node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/data.db');db.exec(\"VACUUM INTO '/tmp/db.bak'\")"
     docker cp fsdx-app:/tmp/db.bak backup/db-$(date +%Y%m%d%H%M%S).bak
     ```
     简单场景可停 app 后整体 tar
   - `restore.sh`：无需 pg_restore，恢复 `volumes/app`（含 `data.db`）即完成
   - `preflight-migrations.sh`：无需连 db 容器——迁移记录在 SQLite 库内（`drizzle.__drizzle_migrations`），核对方式改为容器内 `node:sqlite` 查询（勿用 `sqlite3` CLI）：
     ```bash
     docker compose exec app node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/data.db');for(const r of db.prepare('SELECT name FROM drizzle.__drizzle_migrations').all())console.log(r.name)"
     ```
     与镜像 `/app/drizzle` 文件夹比对；SQLite 全新库无孤儿记录问题
3. **迁移 fail-fast 语义不变**：`runMigrations()` 对 `data/data.db` 执行，文件不可写或迁移失败即应用启动失败，`deploy.sh` 健康检查自然捕获
4. **数据卷**：SQLite 单文件持久化在 `volumes/app/data.db`，升级备份/恢复只需此目录（无需单独 db 卷）

> 镜像无需改动：`node:sqlite` 内置 Node，drizzle 迁移文件已 COPY 进镜像；`data/` 属主 1001 对齐由 `deploy.sh` 的 chown 处理。

## 11. 常见错误排查

### 11.1 `Transaction function cannot return a promise`

**原因**：`db.transaction()` 回调是 `async`。node-sqlite 'sync' kind 事务同步执行，回调返回 Promise 会提前 COMMIT。
**处理**：按第 8 节改同步回调 + 终结符；含异步操作改手动 BEGIN/COMMIT。

### 11.2 `Property 'execute' does not exist`

**原因**：`db.execute()` 是 node-postgres 专用，sqlite 驱动无此方法。
**处理**：改用 `await db.all(sql)`，结果直接是行数组。

### 11.3 `NodeSQLiteDatabase` 相关类型/运行时报错

**原因**：Node 版本 < 22.5（`node:sqlite` 不存在）。
**处理**：升级 Node 到 22.5+（本项目 v24）。

### 11.4 启动打印 `ExperimentalWarning: SQLite is an experimental feature`

**原因**：`node:sqlite` 在部分 Node 版本仍标记实验特性。
**处理**：可忽略；需要静默时设 `NODE_OPTIONS=--no-warnings`（不推荐全局关闭）。

### 11.5 `table already exists`

**原因**：库中已有表，`runMigrations()` 尝试重复建表。
**处理**：删除 `data/data.db` 后重启（SQLite 全新库场景）。

### 11.6 `.all() cannot be used without .returning()`

**原因**：`insert().values(...).all()` 未声明 `returning()`。
**处理**：需要返回值用 `returning().all()`；不需要返回值用 `.run()`。

### 11.7 迁移后时间字段全是 1970 年

**原因**：时间戳列仍是 `Date` 值写入（`new Date()` 传入 `integer mode:number` 列，被当作数字 0 处理）。
**处理**：按第 7 节全部改 `Date.now()` / `.getTime()`。

### 11.8 `instanceof Date` 在 SFn 中失效

**原因**：时间戳字段已是 `number`，不再是 `Date` 实例。
**处理**：`typeof x === "number" ? new Date(x).toISOString() : String(x)`。

## 12. 变更文件总览

| 分类 | 数量 | 说明 |
|------|------|------|
| 配置文件 | 5 | drizzle.config.ts、app/.env.example、src/env.d.ts、.gitignore、vitest.config.ts |
| Schema 文件 | 13 | 全部 `src/db/schema/*.ts`（17 张表），pg-core → sqlite-core |
| DB 客户端 | 2 | src/db/index.ts、src/db/migrate.ts（migrate-cli.ts 不动） |
| 服务端 SQL | 9 | `ilike→like`（8 个文件）、`db.execute→db.all` + 时间序列改写（track）、`rowCount→changes`（message） |
| 日期时间 | ~30 处 | `new Date()`/`new Date(expr)` → `Date.now()`/`.getTime()`，类型 `Date` → `number` |
| 事务 | 4 | dict/dicts/i18n 同步回调；init 手动 BEGIN/COMMIT |
| 测试 | ~10 | 三类：事务 mock 终结符（init/dict/i18n）、时间戳断言（news/captcha/config/file/operation-logs）、`rowCount`/`db.execute` 改名（message/health/track） |
| e2e | 3 | e2e/helpers/{db,env}.ts + e2e/scripts/prepare.ts 由 pg 改 node:sqlite 文件路径直连 |
| 辅助脚本 | 1 | `.agents/skills/db-sqlite/scripts/db-migration.ts`（audit/verify/fix） |
| 迁移文件 | 1 | 删除旧 drizzle/，生成 SQLite 新基线 |

## 相关 Skill

- 新增/修改数据库表、列命名规则 → [db-schema](../db-schema/SKILL.md)
- 衍生项目选用 MySQL 目标库 → [db-mysql](../db-mysql/SKILL.md)
- Server Function 三层分离（迁移不影响 SFn 层） → [server-function](../server-function/SKILL.md)
- 测试 mock 三段式模板 → [test-writing](../test-writing/SKILL.md)

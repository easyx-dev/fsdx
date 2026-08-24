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

### 3.3 约束差异处理

**部分唯一索引（Partial Unique Index）**

PostgreSQL 的 `uniqueIndex().on(column).where(condition)` SQLite 不支持。本项目案例（`admin_user.is_root` 单 root 约束）：

```diff
- import { sql } from "drizzle-orm";
- uniqueIndex("idx_admin_user_single_root").on(table.isRoot).where(sql`${table.isRoot} = true`),
+ // 移除数据库层约束，由应用层校验
```

应用层兜底已存在：`init.server.ts` 的 `checkInitStatus()` 与事务内二次校验（`where: eq(adminUser.isRoot, true)`），删除约束后保持逻辑不变。

**ON UPDATE CASCADE**

SQLite **原生支持** `ON UPDATE CASCADE`，drizzle sqlite-core 的 `references()` 也支持（`UpdateDeleteAction` 含 `'cascade'`，已验证 `sqlite-core/foreign-keys.d.ts`）。本项目案例（`dict_item.dictSlug` 引用 `dict.slug`）**保留不动**：

```ts
dictSlug: varchar("dict_slug", { length: 50 })
	.references(() => dict.slug, { onUpdate: "cascade" })
	.notNull(),
```

> 若目标 drizzle-kit 版本对 sqlite 生成 `ON UPDATE CASCADE` 存在兼容问题，可降级移除该约束并在应用层处理关联条目（`dicts.server.ts` 的 update 路径已覆盖）。

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
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
);
```

## 4. DB 客户端

### 4.1 `src/db/index.ts`

```ts
import { DatabaseSync } from "node:sqlite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-sqlite";
import * as schema from "./schema/index";

/** 从 DATABASE_URL 提取数据库文件路径（去除可选的 file: 前缀） */
function getDbPath(): string {
	const url = process.env.DATABASE_URL || "./data/data.db";
	return url.replace(/^file:/, "");
}

function createDb() {
	const sqlite = new DatabaseSync(getDbPath());
	// WAL 提升并发读性能；foreign_keys 由 node:sqlite 默认开启（enableForeignKeyConstraints 默认 true）
	sqlite.exec("PRAGMA journal_mode = WAL");
	return drizzle({ client: sqlite, schema });
}

let _dbInstance: ReturnType<typeof createDb> | null = null;

/** 懒加载 db 实例的 Proxy：所有属性访问触发时初始化，延迟 db 实例初始化至首次属性访问 */
export const db = new Proxy({} as any, {
	get(_, prop) {
		if (!_dbInstance) {
			_dbInstance = createDb();
		}
		return (_dbInstance as any)[prop];
	},
}) as unknown as ReturnType<typeof createDb>;
```

要点：

- 传显式 `{ client: sqlite }` 是为了在打开后执行 pragma；`sqlite.exec()` 是 `DatabaseSync` 的同步方法
- `drizzle(process.env.DATABASE_URL)` 字符串简写同样可用，但无法设置 WAL pragma
- 懒加载 Proxy 结构保持不变

### 4.2 `src/db/migrate.ts`

```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
	const sqlite = new DatabaseSync(getDbPath());
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

影响文件（8 个，各 1~4 处）：`admin-role`、`client-role`、`file`、`i18n`、`message`、`news`（无 ilike，但含 `db.$count`）、`operation-log`、`track` 的 `.server.ts`。

### 6.2 `db.execute()` → `db.all()`

`db.execute()` 是 node-postgres 专用 API，sqlite 驱动不可用，改用 `db.all()`，结果直接是行数组（无 `.rows`）。

```diff
- const timeSeriesResult = await db.execute(sql`SELECT ...`);
- (timeSeriesResult as unknown as { rows: ...[] }).rows ?? []
+ const timeSeriesResult = await db.all(sql`SELECT ...`);
+ timeSeriesResult
```

影响：`track.server.ts` 的 `getTrackAnalytics`（约 4 段聚合 SQL 中的时间序列趋势段）。

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

`count(*)::int` 在本项目 `track.server.ts` 的事件分布 / Top 页面 / 独立用户数 / 总事件数段出现，全部去除 `::int`。

> `properties` 模糊搜索（`properties::text ILIKE`）在 SQLite 下 `json_extract` 语义不等价，建议改为对 `name`/已知标量字段 `like` 匹配；如需对 JSON 全文模糊，可对整列 `like(trackEventTable.properties, `%${keyword}%`)`（text 存储直接匹配子串）。

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

**替换范围与豁免**：全局搜索 `new Date()`，仅在 Drizzle `.set()` / `.values()` / `gt()` / `lt()` / `gte()` 等调用中替换为 `Date.now()`；纯 JS 日期计算（如 `logs-cleanup.server.ts` 的文件截止时间、`track.server.ts` 的 `end.setDate(end.getDate() + 1)`）保留不动。本项目约 30 处写操作点。

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

### 8.4 本项目 4 处事务清单

| 文件 | 位置 | 处理方式 |
|------|------|---------|
| `src/services/dict/dict.server.ts` `deleteDict` | `db.transaction(async (tx) => ...)` | 同步回调（8.2 示例） |
| `src/services/dict/dict.server.ts` `importDicts` | 同上 | 同步回调；内部 `tx.select().from()` → `.all()`、`tx.insert().values()` → `.run()` |
| `src/services/i18n/i18n.server.ts` `importContentTranslations` | 同上 | 同步回调；`tx.select().limit(1)` → `.all()`、`tx.update().set().where()` → `.run()`、`tx.insert().values()` → `.run()` |
| `src/services/init/init.server.ts` `initSystem` | 内含 `bcrypt.hash` + `upsertConfig`×N + `loadConfigCache` | 手动 BEGIN/COMMIT（8.3），`upsertConfig`/`loadConfigCache` 保持 await |

## 9. 测试迁移

当前测试 mock 为可 await 的 select 查询链（`mockRows` 控制行数组，`then` 属性拦截），**node:sqlite 异步 API 下保持有效**：

- `mockRows.mockResolvedValue([...])` 不变
- `mockDb.$count.mockResolvedValue(n)` 不变（同步 number 被 await 也无害）
- `insert/update/delete` 链式 mock 不变

**唯一需要调整的是事务相关测试**：被测代码的事务回调变为同步后，mock 的 `transaction.mockImplementation(async (cb) => cb(tx))` 仍可工作（`cb(tx)` 返回的值被 async 包装），但 tx 内 mock 需补齐终结符节点。以 `init.test.ts` 为例：

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

> 事务内终结符走 `.all()`，mock 链需在 `limit()` 之后挂 `.all()` 返回 `txRows()` 的值（同步）。若被测代码同时保留 `await` 风格（如手动事务内的顶层 `db`），对应 `select` 链继续用 `then` 拦截即可。

## 10. 迁移执行流程

```bash
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
```

> ⚠️ **不要用 `db:push`**：push 直接建表会跳过迁移记录，随后 bootstrap 的 `runMigrations()` 对已存在的表重复执行 `CREATE TABLE` 而 fail-fast（`table already exists`），与项目「禁止 db:push」约定冲突。SQLite 目标统一走 `db:migrate`（`migrate-cli.ts` → `runMigrations()`）。

生产部署：bootstrap `runMigrations()` 启动时自动执行（`data/` 目录需存在且可写，迁移失败 = 进程启动即崩，fail-fast）。

> ⚠️ 迁移目录整体重建后，任何应用过旧 PostgreSQL 迁移的库已不适用（SQLite 是新库，无此问题）；SQLite 库如有残留表（`table already exists`），删除 `data/data.db` 后重启。

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
| 服务端 SQL | 8 | `ilike→like`（7 个文件）、`db.execute→db.all` + 时间序列改写（track） |
| 日期时间 | ~30 处 | `new Date()` → `Date.now()` / `.getTime()`，类型 `Date` → `number` |
| 事务 | 4 | dict/dicts/i18n 同步回调；init 手动 BEGIN/COMMIT |
| 测试 | 4 | 事务相关测试 mock 终结符适配（init/dict/dicts/i18n） |
| 迁移文件 | 1 | 删除旧 drizzle/，生成 SQLite 新基线 |

## 相关 Skill

- 新增/修改数据库表、列命名规则 → [db-schema](../db-schema/SKILL.md)
- 衍生项目选用 MySQL 目标库 → [db-mysql](../db-mysql/SKILL.md)
- Server Function 三层分离（迁移不影响 SFn 层） → [server-function](../server-function/SKILL.md)
- 测试 mock 三段式模板 → [test-writing](../test-writing/SKILL.md)

/**
 * 数据库客户端：基于 pg.Pool + drizzle
 * 连接池参数显式化，可从环境变量覆盖；withTransaction 统一事务助手
 */
import {
	drizzle,
	type NodePgDatabase,
	type NodePgTransaction,
} from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** 数据库实例类型（无 schema 模式，查询一律使用 query builder） */
export type Db = NodePgDatabase;

/** 事务实例类型（无 relations，传空关系表） */
export type Tx = NodePgTransaction<Record<string, never>>;

/** 创建 pg 连接池：参数从环境变量读取，未配置时使用默认值 */
function createPool(): Pool {
	return new Pool({
		connectionString: process.env.DATABASE_URL,
		max: Number(process.env.DB_POOL_MAX ?? "10"),
		idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? "30000"),
		connectionTimeoutMillis: Number(
			process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? "2000",
		),
	});
}

/** 数据库实例（单例；pg.Pool 在首次查询时才真正建立连接，无惰性代理） */
export const db: Db = drizzle({ client: createPool() });

/** 事务助手：统一 db.transaction 用法，供服务层复用 */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
	return db.transaction(fn);
}

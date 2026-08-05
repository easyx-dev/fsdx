/**
 * 数据库程序化迁移：启动时自动执行 drizzle/ 下的 SQL 迁移文件，幂等安全
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "#/lib/logger/logger";

export async function runMigrations() {
	const migrationsFolder = resolve(process.cwd(), "drizzle");
	if (!existsSync(migrationsFolder)) {
		logger.warn({ migrationsFolder }, "迁移目录不存在，跳过数据库迁移");
		return;
	}
	const migrationDb = drizzle(process.env.DATABASE_URL!);

	logger.info({ migrationsFolder }, "开始执行数据库迁移");
	await migrate(migrationDb, {
		migrationsFolder,
		migrationsTable: "__drizzle_migrations",
	});
	logger.info("数据库迁移完成");
}

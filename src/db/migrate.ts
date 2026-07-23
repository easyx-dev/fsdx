/**
 * 数据库程序化迁移：启动时自动执行 drizzle/ 下的 SQL 迁移文件，幂等安全
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
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

	// db:push 直接同步时无迁移记录，auto-migrate 会因表已存在而报错，先检测跳过
	try {
		const result = await migrationDb.execute(
			sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_user')`,
		);
		const rows = result.rows as { exists: boolean }[];
		if (rows[0]?.exists) {
			logger.info("数据库表已存在（可能通过 db:push 创建），跳过自动迁移");
			return;
		}
	} catch {
		// 数据库不可达时退回到 migrate 逻辑，由 migrate 报明确的错误
		logger.debug("数据库预检查询失败，回退到迁移逻辑");
	}

	logger.info({ migrationsFolder }, "开始执行数据库迁移");
	await migrate(migrationDb, {
		migrationsFolder,
		migrationsTable: "__drizzle_migrations",
	});
	logger.info("数据库迁移完成");
}

/**
 * 系统初始化服务：首次启动时的超级管理员创建与配置写入
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser, role } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { loadConfigCache, upsertConfig } from "#/server/config";

/** 初始化表单数据 */
export interface InitData {
	admin: {
		username: string;
		password: string;
		email: string;
	};
	siteName?: string;
	smtp?: {
		host?: string;
		port?: number;
		secure?: boolean;
		user?: string;
		pass?: string;
		from?: string;
	};
}

/**
 * 检查系统是否已初始化
 * 通过查询 is_root = true 的管理员用户是否存在来判断
 */
export async function checkInitStatus(): Promise<boolean> {
	const root = await db.query.adminUser.findFirst({
		where: eq(adminUser.isRoot, true),
	});
	return !!root;
}

/**
 * 系统初始化：创建超级管理员角色、root 用户、写入系统配置
 * 已初始化时直接返回失败，通过事务保证并发安全
 */
export async function initSystem(data: InitData): Promise<{
	success: boolean;
	message: string;
}> {
	const { admin, siteName, smtp } = data;

	// 使用事务包裹，避免并发初始化
	return db.transaction(async (tx) => {
		// 事务内再次校验：防止并发场景下重复初始化
		const existingRoot = await tx.query.adminUser.findFirst({
			where: eq(adminUser.isRoot, true),
		});

		if (existingRoot) {
			return { success: false, message: "系统已初始化，禁止重复操作" };
		}

		// 1. 创建超级管理员角色
		const [superRole] = await tx
			.insert(role)
			.values({
				name: "超级管理员",
				slug: "super-admin",
				permissions: ["**"],
				description: "拥有全部权限的超级管理员角色",
			})
			.returning();

		logger.info({ roleId: superRole.id }, "超级管理员角色已创建");

		// 2. 创建 root 管理员用户
		const passwordHash = await bcrypt.hash(admin.password, 10);
		const [rootUser] = await tx
			.insert(adminUser)
			.values({
				username: admin.username,
				email: admin.email,
				passwordHash,
				roleId: superRole.id,
				isRoot: true,
				status: "active",
			})
			.returning();

		logger.info(
			{ userId: rootUser.id, username: rootUser.username },
			"Root 管理员用户已创建",
		);

		// 3. 写入站点名称配置
		if (siteName) {
			await upsertConfig("site_name", siteName, "站点名称");
		}

		// 4. 写入 SMTP 配置（用户可选填写）
		if (smtp) {
			if (smtp.host)
				await upsertConfig("smtp_host", smtp.host, "SMTP 服务器地址");
			if (smtp.port !== undefined)
				await upsertConfig("smtp_port", String(smtp.port), "SMTP 端口");
			await upsertConfig(
				"smtp_secure",
				smtp.secure ? "true" : "false",
				"是否使用 SSL/TLS",
			);
			if (smtp.user) await upsertConfig("smtp_user", smtp.user, "SMTP 用户名");
			if (smtp.pass) await upsertConfig("smtp_pass", smtp.pass, "SMTP 密码");
			if (smtp.from)
				await upsertConfig("smtp_from", smtp.from, "发件人邮箱地址");
		}

		// 5. 重新加载配置缓存，确保 getConfig 能读取到最新值
		await loadConfigCache();

		logger.info("系统初始化完成");
		return { success: true, message: "系统初始化完成，请使用创建的账号登录" };
	});
}

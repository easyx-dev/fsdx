// @ts-nocheck
/**
 * 种子数据：创建默认超级管理员角色和初始管理员账号
 * 运行方式：npx tsx src/db/seed.ts
 */

import bcrypt from "bcryptjs";
import { config } from "dotenv";

// 必须在任何数据库模块导入前加载环境变量
config({ path: "env/.env.local" });

async function seed() {
	// ESM 中动态导入确保 db 模块初始化时环境变量已加载
	const [{ eq }, { db }, { adminUser, role }] = await Promise.all([
		import("drizzle-orm"),
		import("#/db/index"),
		import("#/db/schema"),
	]);
	const { news } = await import("#/db/schema");

	console.log("开始创建种子数据...");

	// 检查是否已有角色
	const existingRole = await db.query.role.findFirst({
		where: eq(role.slug, "super-admin"),
	});

	let superAdminRoleId = existingRole?.id;

	if (!existingRole) {
		const [newRole] = await db
			.insert(role)
			.values({
				name: "超级管理员",
				slug: "super-admin",
				permissions: [
					"news:view",
					"news:create",
					"news:edit",
					"news:delete",
					"admin:view",
					"admin:create",
					"admin:edit",
					"admin:delete",
					"client:view",
					"role:view",
					"role:create",
					"role:edit",
					"role:delete",
					"dict:view",
					"dict:edit",
					"config:view",
					"config:edit",
					"file:view",
					"file:upload",
					"file:delete",
					"log:view",
					"dashboard:view",
				],
				description: "拥有全部权限的超级管理员角色",
			})
			.returning();
		superAdminRoleId = newRole.id;
		console.log("超级管理员角色已创建");
	} else {
		console.log("超级管理员角色已存在，跳过创建");
	}

	// 检查是否已有管理员
	const existingAdmin = await db.query.adminUser.findFirst({
		where: eq(adminUser.username, "admin"),
	});

	if (!existingAdmin) {
		const passwordHash = await bcrypt.hash("admin123", 10);
		await db.insert(adminUser).values({
			username: "admin",
			email: "admin@example.com",
			passwordHash,
			roleId: superAdminRoleId,
			status: "active",
		});
		console.log("初始管理员账号已创建: admin / admin123");
	} else {
		console.log("管理员账号已存在，跳过创建");
	}

	// 预置新闻
	console.log("开始创建示例新闻...");
	const existingNews = await db.query.news.findFirst({
		where: eq(news.slug, "hello-world"),
	});

	if (!existingNews) {
		await db.insert(news).values({
			title: "欢迎使用 CMS 内容管理系统",
			slug: "hello-world",
			summary: "这是第一篇示例新闻，演示 CMS 系统的前台展示效果。",
			content: JSON.stringify({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: "欢迎使用 CMS 内容管理系统！这是一篇示例新闻，用于演示前台的 SSR 渲染效果。",
							},
						],
					},
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "您可以登录 " },
							{ type: "text", marks: [{ type: "bold" }], text: "管理后台" },
							{ type: "text", text: "，在新闻管理模块中创建和编辑内容。" },
						],
					},
				],
			}),
			status: "published",
			isPinned: true,
			publishedAt: new Date(),
		});
		console.log("示例新闻已创建: 欢迎使用 CMS 内容管理系统");
	} else {
		console.log("示例新闻已存在，跳过创建");
	}

	console.log("种子数据创建完成");
}

seed()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("种子数据创建失败:", err);
		process.exit(1);
	});

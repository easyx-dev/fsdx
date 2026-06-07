/**
 * SF 层 zod Schema 验证测试
 * SF handler 需 TanStack Start 运行时上下文，暂无法在纯 vitest 下直接调用
 * SF handler 的核心逻辑已通过 Server 服务层测试覆盖（参数委托相同）
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════
// 复制路由文件中的 schema（保持与源码一致）
// ═══════════════════════════════════════════════════════════

const loginSchema = z.object({
	username: z.string().min(1).max(50),
	password: z.string().min(1).max(100),
});

const registerSchema = z.object({
	username: z.string().min(1).max(50),
	email: z.string().email(),
	password: z.string().min(6).max(100),
	captcha: z.string().length(6),
});

const sendCaptchaSchema = z.object({
	email: z.string().email(),
});

const newsSlugSchema = z.object({
	slug: z.string().min(1),
});

const newsListSchema = z.object({
	status: z.string().optional(),
	page: z.number().optional(),
});

const newsIdSchema = z.object({
	id: z.string().min(1),
});

const newsStatusSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["draft", "published", "archived"]),
});

const newsCreateSchema = z.object({
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	isPinned: z.boolean().default(false),
});

const newsUpdateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published", "archived"]),
	isPinned: z.boolean(),
});

const dictCreateSchema = z.object({
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(50),
	description: z.string().optional(),
});

const configCreateSchema = z.object({
	key: z.string().min(1).max(100),
	value: z.string().min(1),
	description: z.string().optional(),
});

const fileListSchema = z.object({
	status: z.string().optional(),
});

// ── 系统初始化 ──
const initSchema = z
	.object({
		username: z.string().min(1).max(50),
		password: z.string().min(6).max(100),
		confirmPassword: z.string().min(1),
		email: z.string().email(),
		siteName: z.string().default("FSDX CMS"),
		smtpHost: z.string().optional(),
		smtpPort: z.number().int().optional(),
		smtpSecure: z.boolean().optional(),
		smtpUser: z.string().optional(),
		smtpPass: z.string().optional(),
		smtpFrom: z.string().optional(),
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

// ── 字典管理 ──
const dictSlugSchema = z.object({ dictSlug: z.string().min(1) });
const updateDictSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
});
const dictItemCreateSchema = z.object({
	dictId: z.string().min(1),
	label: z.string().min(1).max(100),
	value: z.string().min(1).max(100),
	sortOrder: z.number().default(0),
	extraType: z.string().optional(),
	extra: z.string().optional(),
	color: z.string().optional(),
});
const dictItemUpdateSchema = z.object({
	id: z.string().min(1),
	label: z.string().max(100).optional(),
	value: z.string().max(100).optional(),
	sortOrder: z.number().optional(),
	status: z.string().optional(),
	extraType: z.string().optional(),
	extra: z.string().optional(),
	color: z.string().optional(),
});

// ── 系统配置 ──
const updateConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().optional(),
	description: z.string().optional(),
});

// ── 角色管理 ──
const roleListSchema = z.object({ keyword: z.string().optional() });
const roleCreateSchema = z.object({
	name: z.string().min(1).max(50),
	slug: z.string().min(1).max(50),
	permissions: z.array(z.string()).default([]),
	description: z.string().optional(),
});
const roleUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(50).optional(),
	slug: z.string().min(1).max(50).optional(),
	permissions: z.array(z.string()).optional(),
	description: z.string().optional(),
});

// ── 管理员用户管理 ──
const adminUserCreateSchema = z.object({
	username: z.string().min(1).max(50),
	email: z.string().email().max(255),
	password: z.string().min(6).max(100),
	roleId: z.string().min(1),
});
const adminUserUpdateSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1).max(50).optional(),
	email: z.string().email().max(255).optional(),
	roleId: z.string().optional(),
	status: z.string().optional(),
});
const resetPwdSchema = z.object({
	id: z.string().min(1),
	password: z.string().min(6).max(100),
});

// ── 客户端用户管理 ──
const clientUserCreateSchema = z.object({
	username: z.string().min(1).max(50),
	email: z.string().email().max(255),
	password: z.string().min(6).max(100),
});
const clientUserUpdateSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1).max(50).optional(),
	email: z.string().email().max(255).optional(),
	status: z.string().optional(),
	emailVerified: z.boolean().optional(),
});

// ── 日志查询 ──
const searchLogsSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	keyword: z.string().optional(),
	level: z.string().optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

// ── 前台新闻列表分页 ──
const publishedNewsSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	pageSize: z.number().int().min(1).max(50).optional().default(12),
});

// ═══════════════════════════════════════════════════════════
// 验证测试
// ═══════════════════════════════════════════════════════════
describe("loginSchema（clientLogin / adminLogin 共用）", () => {
	it("合法输入校验通过", () => {
		expect(
			loginSchema.safeParse({ username: "admin", password: "pw" }).success,
		).toBe(true);
	});

	it("空用户名失败", () => {
		expect(
			loginSchema.safeParse({ username: "", password: "pw" }).success,
		).toBe(false);
	});

	it("空密码失败", () => {
		expect(
			loginSchema.safeParse({ username: "admin", password: "" }).success,
		).toBe(false);
	});

	it("超长用户名失败", () => {
		expect(
			loginSchema.safeParse({ username: "a".repeat(51), password: "pw" })
				.success,
		).toBe(false);
	});
});

describe("newsListSchema", () => {
	it("无参数默认通过", () => {
		expect(newsListSchema.safeParse({}).success).toBe(true);
	});
});

describe("newsIdSchema", () => {
	it("有效 id 通过", () => {
		expect(newsIdSchema.safeParse({ id: "n-1" }).success).toBe(true);
	});

	it("空 id 失败", () => {
		expect(newsIdSchema.safeParse({ id: "" }).success).toBe(false);
	});
});

describe("newsUpdateSchema", () => {
	it("合法更新输入通过", () => {
		expect(
			newsUpdateSchema.safeParse({
				id: "n-1",
				title: "更新标题",
				isPinned: true,
				status: "published",
			}).success,
		).toBe(true);
	});

	it("缺少必填字段失败", () => {
		expect(newsUpdateSchema.safeParse({ id: "n-1" }).success).toBe(false);
	});
});

describe("registerSchema", () => {
	it("合法注册输入校验通过", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "u@t.com",
				password: "123456",
				captcha: "123456",
			}).success,
		).toBe(true);
	});

	it("邮箱格式错误失败", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "bad",
				password: "123456",
				captcha: "123456",
			}).success,
		).toBe(false);
	});

	it("密码不足 6 位失败", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "u@t.com",
				password: "12345",
				captcha: "123456",
			}).success,
		).toBe(false);
	});

	it("验证码不是 6 位失败", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "u@t.com",
				password: "123456",
				captcha: "12345",
			}).success,
		).toBe(false);
	});
});

describe("sendCaptchaSchema", () => {
	it("合法邮箱校验通过", () => {
		expect(sendCaptchaSchema.safeParse({ email: "u@t.com" }).success).toBe(
			true,
		);
	});

	it("非法邮箱校验失败", () => {
		expect(sendCaptchaSchema.safeParse({ email: "not-email" }).success).toBe(
			false,
		);
	});
});

describe("newsSlugSchema（前台新闻详情）", () => {
	it("有效 slug 通过", () => {
		expect(newsSlugSchema.safeParse({ slug: "hello-world" }).success).toBe(
			true,
		);
	});

	it("空 slug 失败", () => {
		expect(newsSlugSchema.safeParse({ slug: "" }).success).toBe(false);
	});
});

describe("newsCreateSchema", () => {
	it("最小字段创建通过", () => {
		const result = newsCreateSchema.safeParse({ title: "新闻标题" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status).toBe("draft");
			expect(result.data.isPinned).toBe(false);
		}
	});

	it("标题为空失败", () => {
		expect(newsCreateSchema.safeParse({ title: "" }).success).toBe(false);
	});

	it("非法 status 失败", () => {
		expect(
			newsCreateSchema.safeParse({ title: "x", status: "deleted" }).success,
		).toBe(false);
	});
});

describe("newsStatusSchema", () => {
	it("合法状态变更", () => {
		expect(
			newsStatusSchema.safeParse({ id: "n-1", status: "published" }).success,
		).toBe(true);
	});

	it("非法状态失败", () => {
		expect(
			newsStatusSchema.safeParse({ id: "n-1", status: "unknown" }).success,
		).toBe(false);
	});
});

describe("dictCreateSchema", () => {
	it("合法输入通过", () => {
		const result = dictCreateSchema.safeParse({
			name: "新闻状态",
			slug: "news_status",
		});
		expect(result.success).toBe(true);
	});

	it("name 为空失败", () => {
		expect(dictCreateSchema.safeParse({ name: "", slug: "s" }).success).toBe(
			false,
		);
	});
});

describe("configCreateSchema", () => {
	it("合法输入通过", () => {
		expect(
			configCreateSchema.safeParse({ key: "site_name", value: "My CMS" })
				.success,
		).toBe(true);
	});

	it("value 为空失败", () => {
		expect(configCreateSchema.safeParse({ key: "k", value: "" }).success).toBe(
			false,
		);
	});
});

describe("fileListSchema", () => {
	it("无参数通过", () => {
		expect(fileListSchema.safeParse({}).success).toBe(true);
	});

	it("带 status 参数通过", () => {
		expect(fileListSchema.safeParse({ status: "temp" }).success).toBe(true);
	});
});

describe("initSchema（系统初始化）", () => {
	it("合法输入校验通过", () => {
		const result = initSchema.safeParse({
			username: "admin",
			password: "123456",
			confirmPassword: "123456",
			email: "admin@example.com",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.siteName).toBe("FSDX CMS");
		}
	});

	it("两次密码不一致失败", () => {
		const result = initSchema.safeParse({
			username: "admin",
			password: "123456",
			confirmPassword: "654321",
			email: "admin@example.com",
		});
		expect(result.success).toBe(false);
	});

	it("邮箱格式错误失败", () => {
		expect(
			initSchema.safeParse({
				username: "admin",
				password: "123456",
				confirmPassword: "123456",
				email: "invalid",
			}).success,
		).toBe(false);
	});

	it("密码不足 6 位失败", () => {
		expect(
			initSchema.safeParse({
				username: "admin",
				password: "12345",
				confirmPassword: "12345",
				email: "admin@example.com",
			}).success,
		).toBe(false);
	});
});

describe("dictSlugSchema", () => {
	it("有效 dictSlug 通过", () => {
		expect(dictSlugSchema.safeParse({ dictSlug: "d-1" }).success).toBe(true);
	});

	it("空 dictSlug 失败", () => {
		expect(dictSlugSchema.safeParse({ dictSlug: "" }).success).toBe(false);
	});
});

describe("updateDictSchema", () => {
	it("全字段更新通过", () => {
		expect(
			updateDictSchema.safeParse({
				id: "d-1",
				name: "新名称",
				description: "新描述",
			}).success,
		).toBe(true);
	});

	it("仅更新 description 通过", () => {
		expect(
			updateDictSchema.safeParse({ id: "d-1", description: "新描述" }).success,
		).toBe(true);
	});

	it("缺少 id 失败", () => {
		expect(updateDictSchema.safeParse({ name: "x" }).success).toBe(false);
	});
});

describe("dictItemCreateSchema", () => {
	it("最小字段创建通过", () => {
		const result = dictItemCreateSchema.safeParse({
			dictId: "d-1",
			label: "标签",
			value: "val",
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.sortOrder).toBe(0);
	});

	it("label 为空失败", () => {
		expect(
			dictItemCreateSchema.safeParse({
				dictId: "d-1",
				label: "",
				value: "val",
			}).success,
		).toBe(false);
	});
});

describe("dictItemUpdateSchema", () => {
	it("部分字段更新通过", () => {
		expect(
			dictItemUpdateSchema.safeParse({
				id: "di-1",
				label: "新标签",
				sortOrder: 10,
			}).success,
		).toBe(true);
	});

	it("缺少 id 失败", () => {
		expect(dictItemUpdateSchema.safeParse({ label: "x" }).success).toBe(false);
	});
});

describe("updateConfigSchema", () => {
	it("合法更新通过", () => {
		expect(
			updateConfigSchema.safeParse({
				id: "c-1",
				value: "new value",
				description: "desc",
			}).success,
		).toBe(true);
	});

	it("仅更新 description 通过", () => {
		expect(
			updateConfigSchema.safeParse({
				id: "c-1",
				description: "desc",
			}).success,
		).toBe(true);
	});

	it("缺少 id 失败", () => {
		expect(updateConfigSchema.safeParse({ value: "v" }).success).toBe(false);
	});
});

describe("roleListSchema", () => {
	it("无参数通过", () => {
		expect(roleListSchema.safeParse({}).success).toBe(true);
	});

	it("带关键词通过", () => {
		expect(roleListSchema.safeParse({ keyword: "admin" }).success).toBe(true);
	});
});

describe("roleCreateSchema", () => {
	it("合法输入通过", () => {
		const result = roleCreateSchema.safeParse({
			name: "编辑者",
			slug: "editor",
			permissions: ["news:read", "news:create"],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.permissions).toEqual(["news:read", "news:create"]);
		}
	});

	it("permissions 默认空数组", () => {
		const result = roleCreateSchema.safeParse({
			name: "查看者",
			slug: "viewer",
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.permissions).toEqual([]);
	});

	it("name 为空失败", () => {
		expect(roleCreateSchema.safeParse({ name: "", slug: "e" }).success).toBe(
			false,
		);
	});
});

describe("roleUpdateSchema", () => {
	it("部分字段更新通过", () => {
		expect(
			roleUpdateSchema.safeParse({
				id: "r-1",
				permissions: ["news:read"],
			}).success,
		).toBe(true);
	});

	it("slug 不可为空字符串", () => {
		expect(roleUpdateSchema.safeParse({ id: "r-1", slug: "" }).success).toBe(
			false,
		);
	});

	it("缺少 id 失败", () => {
		expect(roleUpdateSchema.safeParse({ name: "x" }).success).toBe(false);
	});
});

describe("adminUserCreateSchema", () => {
	it("合法输入通过", () => {
		expect(
			adminUserCreateSchema.safeParse({
				username: "admin",
				email: "admin@example.com",
				password: "123456",
				roleId: "r-1",
			}).success,
		).toBe(true);
	});

	it("缺少 roleId 失败", () => {
		expect(
			adminUserCreateSchema.safeParse({
				username: "admin",
				email: "admin@example.com",
				password: "123456",
			}).success,
		).toBe(false);
	});

	it("邮箱格式错误失败", () => {
		expect(
			adminUserCreateSchema.safeParse({
				username: "admin",
				email: "bad",
				password: "123456",
				roleId: "r-1",
			}).success,
		).toBe(false);
	});
});

describe("adminUserUpdateSchema", () => {
	it("部分字段更新通过", () => {
		expect(
			adminUserUpdateSchema.safeParse({
				id: "u-1",
				status: "disabled",
			}).success,
		).toBe(true);
	});

	it("缺少 id 失败", () => {
		expect(adminUserUpdateSchema.safeParse({ username: "x" }).success).toBe(
			false,
		);
	});
});

describe("resetPwdSchema（管理员/客户端用户共用）", () => {
	it("合法输入通过", () => {
		expect(
			resetPwdSchema.safeParse({ id: "u-1", password: "newpwd1" }).success,
		).toBe(true);
	});

	it("密码不足 6 位失败", () => {
		expect(
			resetPwdSchema.safeParse({ id: "u-1", password: "12345" }).success,
		).toBe(false);
	});

	it("缺少 id 失败", () => {
		expect(resetPwdSchema.safeParse({ password: "123456" }).success).toBe(
			false,
		);
	});
});

describe("clientUserCreateSchema", () => {
	it("合法输入通过", () => {
		expect(
			clientUserCreateSchema.safeParse({
				username: "user",
				email: "user@example.com",
				password: "123456",
			}).success,
		).toBe(true);
	});

	it("密码不足 6 位失败", () => {
		expect(
			clientUserCreateSchema.safeParse({
				username: "user",
				email: "user@example.com",
				password: "12345",
			}).success,
		).toBe(false);
	});
});

describe("clientUserUpdateSchema", () => {
	it("部分字段更新通过", () => {
		expect(
			clientUserUpdateSchema.safeParse({
				id: "u-1",
				emailVerified: true,
			}).success,
		).toBe(true);
	});

	it("缺少 id 失败", () => {
		expect(clientUserUpdateSchema.safeParse({ username: "x" }).success).toBe(
			false,
		);
	});
});

describe("searchLogsSchema", () => {
	it("无参数通过", () => {
		expect(searchLogsSchema.safeParse({}).success).toBe(true);
	});

	it("全部参数通过", () => {
		expect(
			searchLogsSchema.safeParse({
				startDate: "2025-01-01",
				endDate: "2025-01-31",
				keyword: "error",
				level: "error",
				page: 1,
				pageSize: 20,
			}).success,
		).toBe(true);
	});
});

describe("publishedNewsSchema（前台新闻列表分页）", () => {
	it("无参数使用默认值", () => {
		const result = publishedNewsSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.pageSize).toBe(12);
		}
	});

	it("pageSize 超过 50 失败", () => {
		expect(publishedNewsSchema.safeParse({ pageSize: 100 }).success).toBe(
			false,
		);
	});

	it("page 小于 1 失败", () => {
		expect(publishedNewsSchema.safeParse({ page: 0 }).success).toBe(false);
	});

	it("自定义分页通过", () => {
		const result = publishedNewsSchema.safeParse({ page: 2, pageSize: 6 });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(2);
			expect(result.data.pageSize).toBe(6);
		}
	});
});

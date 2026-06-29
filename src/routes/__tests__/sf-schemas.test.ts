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
	imageToken: z.string().min(1),
	imageCode: z.string().min(1),
});

const newsSlugSchema = z.object({
	slug: z.string().min(1),
});

const newsListSchema = z.object({
	status: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
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
	description: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	isPinned: z.boolean().default(false),
	publishedAt: z.string().optional(),
	sortOrder: z.number().int().optional(),
});

const newsUpdateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	description: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published", "archived"]),
	isPinned: z.boolean(),
	publishedAt: z.string().optional().nullable(),
	sortOrder: z.number().int().optional(),
});

const dictCreateSchema = z.object({
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(50),
	description: z.string().optional(),
});

const configCreateSchema = z.object({
	key: z.string().min(1).max(100),
	value: z.string().min(1),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().optional(),
	description: z.string().optional(),
});

const fileListSchema = z.object({
	status: z.string().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

// ── 系统初始化 ──
const initSchema = z
	.object({
		username: z.string().min(1).max(50),
		password: z.string().min(6).max(100),
		confirmPassword: z.string().min(1),
		email: z.string().email(),
		siteName: z.string().default("FSDX WEB"),
		smtpHost: z.string().optional(),
		smtpPort: z.number().int().optional(),
		smtpSecure: z.boolean().optional(),
		smtpUser: z.string().optional(),
		smtpPass: z.string().optional(),
		smtpFrom: z.string().optional(),
		aiBaseUrl: z.string().optional(),
		aiApiKey: z.string().optional(),
		aiDeepModel: z.string().optional(),
		aiFastModel: z.string().optional(),
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
	dictSlug: z.string().min(1),
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
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().optional(),
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
// ── 管理员用户列表 ──
const adminUserListSchema = z.object({
	page: z.number().optional(),
	pageSize: z.number().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

// ── 客户端用户列表 ──
const clientUserListSchema = z.object({
	page: z.number().optional(),
	pageSize: z.number().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

// ── UI 翻译管理 ──
const uiTranslationListSchema = z.object({
	locale: z.string().optional(),
	keyword: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

const uiTranslationSaveSchema = z.object({
	id: z.string().optional(),
	locale: z.enum(["zh", "en"]),
	key: z.string().min(1).max(300),
	value: z.string().min(1),
	valueType: z.string().optional(),
});

// ── 内容翻译管理 ──
const contentTranslationListSchema = z.object({
	entityType: z.string().optional(),
	locale: z.string().optional(),
	keyword: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

const contentTranslationSaveSchema = z.object({
	id: z.string().optional(),
	entityType: z.string().min(1),
	entityId: z.string().min(1),
	fieldName: z.string().min(1),
	locale: z.enum(["zh", "en"]),
	value: z.string().min(1),
	valueType: z.string().optional(),
});

// ── 埋点事件 ──
const trackEventSchema = z.object({
	time: z.number(),
	userId: z.string().optional(),
	sessionId: z.string().min(1),
	event: z.string().min(1).max(100),
	properties: z.record(z.string(), z.unknown()).default({}),
});

const eventQuerySchema = z.object({
	event: z.string().optional(),
	userId: z.string().optional(),
	sessionId: z.string().optional(),
	keyword: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

const analyticsQuerySchema = z.object({
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	granularity: z.enum(["hour", "day"]).optional(),
});

const presetEventCreateSchema = z.object({
	name: z.string().min(1).max(100),
	label: z.string().min(1).max(100),
	category: z.string().min(1).max(50),
	description: z.string().optional(),
});

const presetEventUpdateSchema = z.object({
	name: z.string().min(1).max(100),
	label: z.string().min(1).max(100).optional(),
	category: z.string().min(1).max(50).optional(),
	description: z.string().optional(),
});

const presetEventDeleteSchema = z.object({
	name: z.string().min(1).max(100),
});

const presetPropertyCreateSchema = z.object({
	key: z.string().min(1).max(100),
	label: z.string().min(1).max(100),
	dataType: z.string().optional(),
	description: z.string().optional(),
});

const presetPropertyUpdateSchema = z.object({
	key: z.string().min(1).max(100),
	label: z.string().min(1).max(100).optional(),
	dataType: z.string().optional(),
	description: z.string().optional(),
});

const presetPropertyDeleteSchema = z.object({
	key: z.string().min(1).max(100),
});

// ═══════════════════════════════════════════════════════════
// 验证测试
// ═══════════════════════════════════════════════════════════
describe("loginSchema（clientLoginSFn / adminLoginSFn 共用）", () => {
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

	it("可选字段 publishedAt 和 sortOrder 通过", () => {
		expect(
			newsUpdateSchema.safeParse({
				id: "n-1",
				title: "更新标题",
				isPinned: true,
				status: "published",
				publishedAt: "2026-01-01T00:00:00.000Z",
				sortOrder: 10,
			}).success,
		).toBe(true);
	});

	it("publishedAt 为 null 通过", () => {
		expect(
			newsUpdateSchema.safeParse({
				id: "n-1",
				title: "更新标题",
				isPinned: true,
				status: "published",
				publishedAt: null,
			}).success,
		).toBe(true);
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
	it("合法输入通过", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "u@t.com",
				imageToken: "token-123",
				imageCode: "ABCD",
			}).success,
		).toBe(true);
	});

	it("非法邮箱失败", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "not-email",
				imageToken: "token-123",
				imageCode: "ABCD",
			}).success,
		).toBe(false);
	});

	it("缺少 imageToken 失败", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "u@t.com",
				imageCode: "ABCD",
			}).success,
		).toBe(false);
	});

	it("缺少 imageCode 失败", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "u@t.com",
				imageToken: "token-123",
			}).success,
		).toBe(false);
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

	it("可选字段 publishedAt 和 sortOrder 通过", () => {
		const result = newsCreateSchema.safeParse({
			title: "新闻标题",
			publishedAt: "2026-01-01T00:00:00.000Z",
			sortOrder: 10,
		});
		expect(result.success).toBe(true);
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
			name: "测试字典",
			slug: "test_dict",
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

	it("可选字段 clientVisible / valueType / groupName 通过", () => {
		expect(
			configCreateSchema.safeParse({
				key: "site_name",
				value: "My CMS",
				clientVisible: true,
				valueType: "text",
				groupName: "basic",
			}).success,
		).toBe(true);
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
			expect(result.data.siteName).toBe("FSDX WEB");
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

	it("包含 AI 配置字段合法通过", () => {
		const result = initSchema.safeParse({
			username: "admin",
			password: "123456",
			confirmPassword: "123456",
			email: "admin@example.com",
			aiBaseUrl: "https://api.openai.com/v1",
			aiApiKey: "sk-xxx",
			aiDeepModel: "gpt-4o",
			aiFastModel: "gpt-4o-mini",
		});
		expect(result.success).toBe(true);
	});

	it("AI 配置字段均为可选", () => {
		const result = initSchema.safeParse({
			username: "admin",
			password: "123456",
			confirmPassword: "123456",
			email: "admin@example.com",
		});
		expect(result.success).toBe(true);
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
			dictSlug: "d-1",
			label: "标签",
			value: "val",
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.sortOrder).toBe(0);
	});

	it("label 为空失败", () => {
		expect(
			dictItemCreateSchema.safeParse({
				dictSlug: "d-1",
				label: "",
				value: "val",
			}).success,
		).toBe(false);
	});

	it("缺少 dictSlug 失败", () => {
		expect(
			dictItemCreateSchema.safeParse({
				label: "标签",
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

	it("可选字段 clientVisible / valueType / groupName 通过", () => {
		expect(
			updateConfigSchema.safeParse({
				id: "c-1",
				clientVisible: false,
				valueType: "richtext",
				groupName: "email",
			}).success,
		).toBe(true);
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

describe("adminUserListSchema（管理员用户列表）", () => {
	it("无参数通过", () => {
		expect(adminUserListSchema.safeParse({}).success).toBe(true);
	});

	it("全部参数通过", () => {
		expect(
			adminUserListSchema.safeParse({
				page: 1,
				pageSize: 10,
				keyword: "admin",
				sortField: "createdAt",
				sortOrder: "descend",
			}).success,
		).toBe(true);
	});
});

describe("clientUserListSchema（客户端用户列表）", () => {
	it("无参数通过", () => {
		expect(clientUserListSchema.safeParse({}).success).toBe(true);
	});

	it("全部参数通过", () => {
		expect(
			clientUserListSchema.safeParse({
				page: 1,
				pageSize: 10,
				keyword: "test",
				sortField: "createdAt",
				sortOrder: "ascend",
			}).success,
		).toBe(true);
	});
});

describe("uiTranslationListSchema（UI 翻译列表）", () => {
	it("无参数通过", () => {
		expect(uiTranslationListSchema.safeParse({}).success).toBe(true);
	});

	it("带 locale 筛选通过", () => {
		expect(uiTranslationListSchema.safeParse({ locale: "en" }).success).toBe(
			true,
		);
	});
});

describe("uiTranslationSaveSchema（UI 翻译保存）", () => {
	it("合法新建输入通过", () => {
		expect(
			uiTranslationSaveSchema.safeParse({
				locale: "en",
				key: "home.title",
				value: "Welcome",
			}).success,
		).toBe(true);
	});

	it("带 id 编辑输入通过", () => {
		expect(
			uiTranslationSaveSchema.safeParse({
				id: "t-1",
				locale: "en",
				key: "home.title",
				value: "Welcome",
				valueType: "text",
			}).success,
		).toBe(true);
	});

	it("非法 locale 失败", () => {
		expect(
			uiTranslationSaveSchema.safeParse({
				locale: "fr",
				key: "home.title",
				value: "Bienvenue",
			}).success,
		).toBe(false);
	});

	it("key 为空失败", () => {
		expect(
			uiTranslationSaveSchema.safeParse({
				locale: "en",
				key: "",
				value: "V",
			}).success,
		).toBe(false);
	});
});

describe("contentTranslationListSchema（内容翻译列表）", () => {
	it("无参数通过", () => {
		expect(contentTranslationListSchema.safeParse({}).success).toBe(true);
	});

	it("全部参数通过", () => {
		expect(
			contentTranslationListSchema.safeParse({
				entityType: "news",
				locale: "en",
				keyword: "title",
				page: 1,
				sortField: "createdAt",
				sortOrder: "descend",
			}).success,
		).toBe(true);
	});
});

describe("contentTranslationSaveSchema（内容翻译保存）", () => {
	it("合法输入通过", () => {
		expect(
			contentTranslationSaveSchema.safeParse({
				entityType: "news",
				entityId: "n-1",
				fieldName: "title",
				locale: "en",
				value: "Hello World",
			}).success,
		).toBe(true);
	});

	it("缺少 entityType 失败", () => {
		expect(
			contentTranslationSaveSchema.safeParse({
				entityId: "n-1",
				fieldName: "title",
				locale: "en",
				value: "Hello World",
			}).success,
		).toBe(false);
	});

	it("缺少 entityId 失败", () => {
		expect(
			contentTranslationSaveSchema.safeParse({
				entityType: "news",
				fieldName: "title",
				locale: "en",
				value: "Hello World",
			}).success,
		).toBe(false);
	});

	it("非法 locale 失败", () => {
		expect(
			contentTranslationSaveSchema.safeParse({
				entityType: "news",
				entityId: "n-1",
				fieldName: "title",
				locale: "fr",
				value: "Bonjour",
			}).success,
		).toBe(false);
	});
});

describe("trackEventSchema（埋点事件上报）", () => {
	it("最小合法输入通过", () => {
		expect(
			trackEventSchema.safeParse({
				time: Date.now(),
				sessionId: "s-abc",
				event: "PageView",
			}).success,
		).toBe(true);
	});

	it("包含可选 userId 和 properties 通过", () => {
		expect(
			trackEventSchema.safeParse({
				time: Date.now(),
				sessionId: "s-abc",
				event: "Click",
				userId: "u-1",
				properties: { element_id: "btn-1", element_text: "提交" },
			}).success,
		).toBe(true);
	});

	it("sessionId 为空失败", () => {
		expect(
			trackEventSchema.safeParse({
				time: Date.now(),
				sessionId: "",
				event: "PageView",
			}).success,
		).toBe(false);
	});

	it("event 为空失败", () => {
		expect(
			trackEventSchema.safeParse({
				time: Date.now(),
				sessionId: "s-abc",
				event: "",
			}).success,
		).toBe(false);
	});

	it("event 超过 100 字符失败", () => {
		expect(
			trackEventSchema.safeParse({
				time: Date.now(),
				sessionId: "s-abc",
				event: "a".repeat(101),
			}).success,
		).toBe(false);
	});

	it("properties 默认为空对象", () => {
		const result = trackEventSchema.safeParse({
			time: Date.now(),
			sessionId: "s-abc",
			event: "PageView",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.properties).toEqual({});
		}
	});
});

describe("eventQuerySchema（埋点事件查询）", () => {
	it("无参数通过", () => {
		expect(eventQuerySchema.safeParse({}).success).toBe(true);
	});

	it("全部参数通过", () => {
		expect(
			eventQuerySchema.safeParse({
				event: "PageView",
				userId: "u-1",
				sessionId: "s-abc",
				keyword: "test",
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				page: 1,
				pageSize: 20,
				sortField: "time",
				sortOrder: "descend",
			}).success,
		).toBe(true);
	});

	it("pageSize 超过 100 失败", () => {
		expect(eventQuerySchema.safeParse({ pageSize: 200 }).success).toBe(false);
	});

	it("非法 sortOrder 失败", () => {
		expect(eventQuerySchema.safeParse({ sortOrder: "invalid" }).success).toBe(
			false,
		);
	});
});

describe("analyticsQuerySchema（事件分析查询）", () => {
	it("合法输入通过", () => {
		expect(
			analyticsQuerySchema.safeParse({
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			}).success,
		).toBe(true);
	});

	it("带 granularity 通过", () => {
		expect(
			analyticsQuerySchema.safeParse({
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				granularity: "hour",
			}).success,
		).toBe(true);
	});

	it("缺少 startDate 失败", () => {
		expect(
			analyticsQuerySchema.safeParse({ endDate: "2026-01-31" }).success,
		).toBe(false);
	});

	it("非法 granularity 失败", () => {
		expect(
			analyticsQuerySchema.safeParse({
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				granularity: "week",
			}).success,
		).toBe(false);
	});
});

describe("presetEventCreateSchema（预设事件创建）", () => {
	it("合法输入通过", () => {
		expect(
			presetEventCreateSchema.safeParse({
				name: "Download",
				label: "文件下载",
				category: "内容互动",
			}).success,
		).toBe(true);
	});

	it("缺少 label 失败", () => {
		expect(
			presetEventCreateSchema.safeParse({
				name: "Download",
				category: "内容互动",
			}).success,
		).toBe(false);
	});

	it("缺少 category 失败", () => {
		expect(
			presetEventCreateSchema.safeParse({
				name: "Download",
				label: "文件下载",
			}).success,
		).toBe(false);
	});

	it("name 超过 100 字符失败", () => {
		expect(
			presetEventCreateSchema.safeParse({
				name: "a".repeat(101),
				label: "标签",
				category: "用户行为",
			}).success,
		).toBe(false);
	});
});

describe("presetEventUpdateSchema（预设事件更新）", () => {
	it("部分字段更新通过", () => {
		expect(
			presetEventUpdateSchema.safeParse({
				name: "Download",
				label: "文件下载",
			}).success,
		).toBe(true);
	});

	it("缺少 name 失败", () => {
		expect(presetEventUpdateSchema.safeParse({ label: "新标签" }).success).toBe(
			false,
		);
	});
});

describe("presetEventDeleteSchema（预设事件删除）", () => {
	it("合法输入通过", () => {
		expect(
			presetEventDeleteSchema.safeParse({ name: "CustomEvent" }).success,
		).toBe(true);
	});

	it("name 为空失败", () => {
		expect(presetEventDeleteSchema.safeParse({ name: "" }).success).toBe(false);
	});
});

describe("presetPropertyCreateSchema（预设属性创建）", () => {
	it("合法输入通过", () => {
		expect(
			presetPropertyCreateSchema.safeParse({
				key: "download_url",
				label: "下载地址",
			}).success,
		).toBe(true);
	});

	it("带 dataType 通过", () => {
		expect(
			presetPropertyCreateSchema.safeParse({
				key: "file_size",
				label: "文件大小",
				dataType: "number",
			}).success,
		).toBe(true);
	});

	it("缺少 key 失败", () => {
		expect(
			presetPropertyCreateSchema.safeParse({
				label: "仅标签",
			}).success,
		).toBe(false);
	});
});

describe("presetPropertyUpdateSchema（预设属性更新）", () => {
	it("部分字段更新通过", () => {
		expect(
			presetPropertyUpdateSchema.safeParse({
				key: "download_url",
				label: "新标签",
			}).success,
		).toBe(true);
	});

	it("缺少 key 失败", () => {
		expect(
			presetPropertyUpdateSchema.safeParse({ label: "新标签" }).success,
		).toBe(false);
	});
});

describe("presetPropertyDeleteSchema（预设属性删除）", () => {
	it("合法输入通过", () => {
		expect(
			presetPropertyDeleteSchema.safeParse({ key: "custom_prop" }).success,
		).toBe(true);
	});

	it("key 为空失败", () => {
		expect(presetPropertyDeleteSchema.safeParse({ key: "" }).success).toBe(
			false,
		);
	});
});

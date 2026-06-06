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

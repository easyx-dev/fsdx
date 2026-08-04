/**
 * 国际化种子数据：初始化预设语言（zh + en）的 UI 翻译
 * 基于 (locale, key) 唯一约束做 upsert，仅写入缺失的条目，
 * 后续新增种子数据可增量写入，已有条目不受影响
 */
import { db } from "#/db/index";
import { uiTranslation } from "#/db/schema";
import { logger } from "#/lib/logger/logger";

export async function ensurePresetTranslations(): Promise<void> {
	const now = new Date();
	const rows: (typeof uiTranslation.$inferInsert)[] = [];

	for (const row of SEED_DATA) {
		rows.push({ ...row, createdAt: now, updatedAt: now });
	}

	// 基于 (locale, key) 唯一约束，冲突时跳过，仅插入不存在的条目
	await db.insert(uiTranslation).values(rows).onConflictDoNothing();
	logger.info({ count: rows.length }, "UI 翻译种子数据写入完成");
}

interface SeedRow {
	locale: string;
	key: string;
	value: string;
	valueType?: string;
}

const SEED_EN: SeedRow[] = [
	// common
	{ locale: "en", key: "返回首页", value: "Back to Home" },
	{ locale: "en", key: "暂无数据", value: "No Data" },

	// header
	{ locale: "en", key: "首页", value: "Home" },
	{ locale: "en", key: "新闻", value: "News" },
	{ locale: "en", key: "关于", value: "About" },
	{ locale: "en", key: "切换语言", value: "Switch Language" },

	// home
	{
		locale: "en",
		key: "CMS 内容管理系统",
		value: "CMS Content Management System",
	},
	{
		locale: "en",
		key: "轻量、安全、可扩展的全栈内容管理解决方案，基于 TanStack Start 构建，支持 SSR 与强大的管理后台。",
		value:
			"Lightweight, secure, and scalable full-stack CMS built with TanStack Start, featuring SSR and a powerful admin panel.",
	},
	{ locale: "en", key: "浏览新闻", value: "Browse News" },
	{ locale: "en", key: "了解更多", value: "Learn More" },
	{ locale: "en", key: "最新新闻", value: "Latest News" },
	{ locale: "en", key: "查看全部", value: "View All" },
	{ locale: "en", key: "类型安全路由", value: "Type-Safe Routing" },
	{
		locale: "en",
		key: "TanStack Router 提供编译期路由校验，链接与参数始终同步。",
		value:
			"TanStack Router provides compile-time route validation, keeping links and params always in sync.",
	},
	{ locale: "en", key: "Server Functions", value: "Server Functions" },
	{
		locale: "en",
		key: "直接在组件中调用服务端逻辑，无需手动创建 API 层。",
		value:
			"Call server-side logic directly from components, no manual API layer needed.",
	},
	{ locale: "en", key: "SSR 流式渲染", value: "SSR Streaming" },
	{
		locale: "en",
		key: "渐进式页面加载，首屏速度更快，SEO 友好。",
		value: "Progressive page loading, faster first paint, SEO-friendly.",
	},
	{ locale: "en", key: "强大的管理后台", value: "Powerful Admin Panel" },
	{
		locale: "en",
		key: "基于 antd 的后台管理，支持新闻、字典、配置、文件管理。",
		value:
			"antd-based admin panel with news, dictionary, config, and file management.",
	},
	{ locale: "en", key: "RBAC 权限控制", value: "RBAC Access Control" },
	{
		locale: "en",
		key: "细粒度角色权限，管理员与客户端用户双通道。",
		value:
			"Fine-grained role permissions with dual admin/client user channels.",
	},
	{ locale: "en", key: "Tailwind CSS", value: "Tailwind CSS" },
	{
		locale: "en",
		key: "高效构建现代 UI，统一设计令牌，响应式开箱即用。",
		value:
			"Build modern UI efficiently with unified design tokens and responsive design out of the box.",
	},

	// news list
	{ locale: "en", key: "新闻资讯", value: "News" },
	{ locale: "en", key: "共 {total} 篇", value: "{total} articles" },
	{ locale: "en", key: "暂无新闻", value: "No news yet" },
	{ locale: "en", key: "置顶", value: "Pinned" },

	// news detail
	{
		locale: "en",
		key: "新闻不存在或未发布",
		value: "News not found or unpublished",
	},

	// auth
	{ locale: "en", key: "用户登录", value: "User Login" },
	{ locale: "en", key: "用户注册", value: "User Registration" },
	{ locale: "en", key: "用户名", value: "Username" },
	{ locale: "en", key: "密码", value: "Password" },
	{ locale: "en", key: "邮箱", value: "Email" },
	{ locale: "en", key: "邮箱验证码", value: "Email Verification Code" },
	{ locale: "en", key: "登录", value: "Login" },
	{ locale: "en", key: "登录中...", value: "Logging in..." },
	{ locale: "en", key: "注册", value: "Register" },
	{ locale: "en", key: "注册中...", value: "Registering..." },
	{ locale: "en", key: "还没有账号？", value: "Don't have an account?" },
	{ locale: "en", key: "立即注册", value: "Register Now" },
	{ locale: "en", key: "已有账号？", value: "Already have an account?" },
	{ locale: "en", key: "立即登录", value: "Login Now" },

	// validation
	{ locale: "en", key: "请输入用户名", value: "Please enter username" },
	{ locale: "en", key: "请输入密码", value: "Please enter password" },
	{ locale: "en", key: "请输入邮箱", value: "Please enter email" },
	{ locale: "en", key: "邮箱格式不正确", value: "Invalid email format" },
	{
		locale: "en",
		key: "密码至少 6 位",
		value: "Password must be at least 6 characters",
	},
	{
		locale: "en",
		key: "请输入验证码",
		value: "Please enter verification code",
	},
	{
		locale: "en",
		key: "验证码为 6 位",
		value: "Verification code is 6 digits",
	},

	// about
	{ locale: "en", key: "关于 CMS", value: "About CMS" },
	{
		locale: "en",
		key: "CMS 内容管理系统是一个基于 TanStack Start 构建的全栈内容管理平台。支持类型安全路由、Server Functions、SSR 流式渲染，并配备强大的管理后台。",
		value:
			"CMS is a full-stack content management platform built with TanStack Start. It features type-safe routing, Server Functions, SSR streaming, and a powerful admin panel.",
	},
	{ locale: "en", key: "技术栈", value: "Tech Stack" },
	{ locale: "en", key: "核心功能", value: "Core Features" },
	{
		locale: "en",
		key: "新闻发布与管理",
		value: "News Publishing and Management",
	},
	{
		locale: "en",
		key: "字典与系统配置",
		value: "Dictionary and System Config",
	},
	{ locale: "en", key: "文件上传管理", value: "File Upload Management" },
	{ locale: "en", key: "日志查询分析", value: "Log Query and Analysis" },
];

export const SEED_DATA: SeedRow[] = [...SEED_EN];

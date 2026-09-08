/**
 * 国际化种子数据：初始化预设语言（zh + en）的 UI 翻译
 * 基于 (locale, key) 唯一约束做 upsert，仅写入缺失的条目，
 * 后续新增种子数据可增量写入，已有条目不受影响
 */
import { db } from "#/db/index";
import { uiTranslation } from "#/db/schema";
import { logger } from "#/shared-services/logger";

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
		key: "全栈开发工程基座",
		value: "Full-Stack Development Base",
	},
	{
		locale: "en",
		key: "基于 TanStack Start 构建的全栈开发工程基座，内置双端认证/RBAC、缓存、埋点、审计、国际化等基础设施，支持 SSR 与强大的管理后台。",
		value:
			"A full-stack development base built with TanStack Start, featuring admin/client auth, RBAC, caching, tracking, audit, and i18n infrastructure, plus SSR and a powerful admin panel.",
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
	{ locale: "en", key: "共 {{total}} 篇", value: "{{total}} articles" },
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
	{ locale: "en", key: "登录中", value: "Logging in..." },
	{ locale: "en", key: "登录失败", value: "Login failed" },
	{ locale: "en", key: "登录成功", value: "Login successful" },
	{ locale: "en", key: "忘记密码？", value: "Forgot password?" },
	{ locale: "en", key: "注册", value: "Register" },
	{ locale: "en", key: "注册中", value: "Registering..." },
	{ locale: "en", key: "注册失败", value: "Registration failed" },
	{ locale: "en", key: "注册成功", value: "Registration successful" },
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
	{ locale: "en", key: "关于本项目", value: "About This Project" },
	{
		locale: "en",
		key: "本项目是基于 TanStack Start 构建的全栈开发工程基座。内置双端认证/RBAC、缓存、事件埋点、操作审计、国际化、文件存储等基础设施，并附新闻业务示例，可快速扩展为任意业务系统。",
		value:
			"This is a full-stack development base built with TanStack Start. It ships with dual-auth/RBAC, caching, event tracking, operation audit, i18n, and file storage infrastructure, plus a news business example that shows how to extend into any business system.",
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

	// header / 用户区
	{ locale: "en", key: "消息中心", value: "Messages" },
	{ locale: "en", key: "退出登录", value: "Log out" },

	// forgot password
	{ locale: "en", key: "忘记密码", value: "Forgot Password" },
	{ locale: "en", key: "返回登录", value: "Back to Login" },
	{ locale: "en", key: "新密码", value: "New Password" },
	{ locale: "en", key: "请输入新密码", value: "Please enter new password" },
	{ locale: "en", key: "确认新密码", value: "Confirm New Password" },
	{ locale: "en", key: "请确认新密码", value: "Please confirm new password" },
	{ locale: "en", key: "重置中", value: "Resetting..." },
	{ locale: "en", key: "重置密码", value: "Reset Password" },
	{ locale: "en", key: "重置失败", value: "Reset failed" },

	// messages
	{ locale: "en", key: "全部已读", value: "Mark All Read" },
	{ locale: "en", key: "全部", value: "All" },
	{ locale: "en", key: "未读", value: "Unread" },
	{ locale: "en", key: "已读", value: "Read" },
	{ locale: "en", key: "删除", value: "Delete" },
	{ locale: "en", key: "已删除", value: "Deleted" },
	{ locale: "en", key: "暂无消息", value: "No messages" },
	{ locale: "en", key: "上一页", value: "Previous" },
	{ locale: "en", key: "下一页", value: "Next" },
	{ locale: "en", key: "加载消息失败", value: "Failed to load messages" },
	{ locale: "en", key: "操作失败", value: "Operation failed" },
	{ locale: "en", key: "删除失败", value: "Delete failed" },
	{ locale: "en", key: "已全部标记为已读", value: "All marked as read" },
];

export const SEED_DATA: SeedRow[] = [...SEED_EN];

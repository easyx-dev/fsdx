/**
 * 新闻 slug 生成与唯一性保障（纯逻辑 + 唯一性查询）
 * 由 news.server.ts 消费，避免把 slug 规则与 CRUD 逻辑耦合在同一文件
 */
import { and, eq, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import { notDeleted } from "#/shared-services/query/query-utils.server";

/**
 * 根据标题生成 slug：中文字符用时间戳后缀，ASCII 直接 slugify
 */
export function generateSlug(title: string): string {
	const hasChinese = /[\u4e00-\u9fff]/.test(title);
	if (hasChinese) {
		return `news-${Date.now()}`;
	}
	return (
		title
			.toLowerCase()
			.replace(/[^\w\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 100) || `news-${Date.now()}`
	);
}

/** 确保 slug 唯一，重复时追加数字后缀 */
export async function ensureUniqueSlug(
	slug: string,
	excludeId?: string,
): Promise<string> {
	let uniqueSlug = slug;
	let counter = 1;
	const MAX_ATTEMPTS = 100;

	while (counter <= MAX_ATTEMPTS) {
		const conditions = [eq(news.slug, uniqueSlug), notDeleted(news.deletedAt)];
		if (excludeId) conditions.push(ne(news.id, excludeId));

		const [existing] = await db
			.select()
			.from(news)
			.where(and(...conditions))
			.limit(1);

		if (!existing) break;
		uniqueSlug = `${slug}-${counter}`;
		counter++;
	}

	// 超过最大尝试次数仍未找到唯一 slug
	if (counter > MAX_ATTEMPTS) {
		throw new Error(
			`无法为 slug "${slug}" 生成唯一标识（已尝试 ${MAX_ATTEMPTS} 次）`,
		);
	}

	return uniqueSlug;
}

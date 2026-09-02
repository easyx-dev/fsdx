/**
 * 国际化 Server Function 包装器：共享查询 + AI 翻译
 */

import type { Locale } from "@fsdx/core/i18n-types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@fsdx/core/i18n-types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EDITOR_TYPES } from "#/constants/editor-types";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { completeText } from "#/services/ai/ai.server";
import { getConfig } from "#/services/config/config.server";
import {
	getFieldTranslations,
	getUITranslations,
	upsertContentTranslation,
} from "#/services/i18n/i18n.server";
import { logCrud } from "#/services/operation-log/operation-log.server";

const localeSchema = z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE);

/** 获取当前请求的 locale 及对应翻译（从 requestMiddleware context 读取 Cookie locale） */
export const getLocaleBundleSFn = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const locale: Locale = (context.locale as Locale) || DEFAULT_LOCALE;
		const translations = await getUITranslations(locale);
		return { locale, translations };
	},
);

/** 获取某实体某字段的所有语言翻译（抽屉用） */
export const getFieldTranslationsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRANSLATION_VIEW)])
	.validator(
		z.object({
			entityType: z.string(),
			entityId: z.string(),
			fieldName: z.string(),
		}),
	)
	.handler(async ({ data: { entityType, entityId, fieldName } }) => {
		return getFieldTranslations(entityType, entityId, fieldName);
	});

/** 实体翻译创建/更新 */
export const saveContentTranslationSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRANSLATION_MANAGE)])
	.validator(
		z.object({
			id: z.string().optional(),
			entityType: z.string().min(1),
			entityId: z.string().min(1),
			fieldName: z.string().min(1),
			locale: localeSchema,
			value: z.string().min(1),
			valueType: z.enum(EDITOR_TYPES).optional(),
		}),
	)
	.handler(async ({ data, context }) => {
		const result = await upsertContentTranslation(data);
		logCrud(context.user, "translation", "update", undefined, {
			targetType: "content_translation",
		});
		return result;
	});

// ══════════════════ AI 翻译 ══════════════════

/** AI 翻译字段内容（使用 fast 模型） */
export const aiTranslateFieldSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRANSLATION_MANAGE)])
	.validator(
		z.object({
			sourceText: z.string().min(1, "源文本不能为空"),
			targetLang: z.string().min(1),
			sourceLang: z.string().min(1),
		}),
	)
	.handler(async ({ data: { sourceText, targetLang, sourceLang } }) => {
		const promptTemplate = await getConfig("ai_translation_prompt");
		if (!promptTemplate) {
			throw new Error(
				"AI 翻译提示词未配置，请在系统配置中设置 ai_translation_prompt",
			);
		}
		const prompt = promptTemplate
			.replace(/\{sourceLang\}/g, sourceLang)
			.replace(/\{targetLang\}/g, targetLang)
			.replace(/\{sourceText\}/g, sourceText);

		try {
			// 非流式一次性生成：由 app 编排层消费，统一转为友好提示
			return await completeText({
				messages: [{ role: "user", content: prompt }],
				modelOptions: { temperature: 0.3 },
			});
		} catch {
			throw new Error("AI 翻译服务不可用，请检查 AI 配置");
		}
	});

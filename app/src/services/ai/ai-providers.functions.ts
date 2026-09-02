/**
 * AI 厂商管理 Server Function：读取/保存 ai_providers 配置（供专属管理页与 demo 选择器共用）
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { logCrud } from "#/services/operation-log/operation-log.server";
import { aiProvidersSchema } from "./ai.schemas";
import { getAiProviderList, saveAiProviderList } from "./ai-providers.server";

const saveAiProvidersInputSchema = z.object({ providers: aiProvidersSchema });

/** 获取 AI 厂商配置列表 */
export const getAiProvidersSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.AI_PROVIDER_MANAGE)])
	.handler(async () => getAiProviderList());

/** 保存 AI 厂商配置列表（整列表覆盖） */
export const saveAiProvidersSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.AI_PROVIDER_MANAGE)])
	.validator(saveAiProvidersInputSchema)
	.handler(async ({ data, context }) => {
		await saveAiProviderList(data.providers);
		logCrud(context.user, "ai-provider", "update", undefined, {
			targetType: "ai_providers",
			detail: { count: data.providers.length },
		});
		return { ok: true as const };
	});

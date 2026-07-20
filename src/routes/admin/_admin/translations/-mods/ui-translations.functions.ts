/**
 * UI 翻译页面 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	deleteUITranslation,
	getAllUITranslationsForExport,
	importUiTranslations,
	listUITranslations,
	type TranslationImportResult,
	type UiTranslationExportData,
	upsertUITranslation,
} from "#/server/i18n/i18n.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import {
	deleteSchema,
	formSchema,
	getListSchema,
} from "./ui-translations.schemas";

export const getListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(getListSchema)
	.handler(async ({ data }) =>
		listUITranslations(data as Parameters<typeof listUITranslations>[0]),
	);

export const saveSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(formSchema)
	.handler(async ({ data, context }) => {
		const result = await upsertUITranslation(
			data as Parameters<typeof upsertUITranslation>[0],
		);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "translation",
			action: "update",
			targetType: "ui_translation",
		});
		return result;
	});

export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(deleteSchema)
	.handler(async ({ data, context }) => {
		await deleteUITranslation(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "translation",
			action: "delete",
			targetType: "ui_translation",
			targetId: data.id,
		});
		return { success: true };
	});

export const exportUITranslationsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_EXPORT)])
	.handler(async () => {
		const translations = await getAllUITranslationsForExport();
		return toJson({ translations });
	});

export const importUITranslationsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_IMPORT)])
	.inputValidator(
		z.object({
			data: z.object({
				translations: z.array(
					z.object({
						locale: z.string().min(1),
						key: z.string().min(1),
						value: z.string().min(1),
						valueType: z.string().optional(),
					}),
				),
			}),
		}),
	)
	.handler(
		async ({ data: { data }, context }): Promise<TranslationImportResult> => {
			const result = await importUiTranslations(
				data as UiTranslationExportData,
			);
			logOperation({
				operatorId: context.user.id,
				operatorName: context.user.username,
				module: "translation",
				action: "import",
				targetType: "ui_translation",
				detail: { created: result.created, updated: result.updated },
			});
			return result;
		},
	);

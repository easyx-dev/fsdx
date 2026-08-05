/**
 * UI 翻译页面 Server Function
 */

import { toJson } from "@fsdx/core/export";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/constants/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	deleteUITranslation,
	getAllUITranslationsForExport,
	importUiTranslations,
	listUITranslations,
	type TranslationImportResult,
	type UiTranslationExportData,
	upsertUITranslation,
} from "#/services/i18n/i18n.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
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
		logCrud(context.user, "translation", "update", undefined, {
			targetType: "ui_translation",
		});
		return result;
	});

export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(deleteSchema)
	.handler(async ({ data, context }) => {
		await deleteUITranslation(data.id);
		logCrud(
			context.user,
			"translation",
			"delete",
			{ id: data.id },
			{ targetType: "ui_translation" },
		);
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
			logCrud(context.user, "translation", "import", undefined, {
				targetType: "ui_translation",
				detail: { created: result.created, updated: result.updated },
			});
			return result;
		},
	);

/**
 * 实体翻译页面 Server Function
 */

import { toJson } from "@fsdx/core/export";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/constants/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	type ContentTranslationExportData,
	deleteContentTranslation,
	getAllContentTranslationsForExport,
	importContentTranslations,
	listContentTranslations,
	type TranslationImportResult,
	upsertContentTranslation,
} from "#/services/i18n/i18n.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	deleteSchema,
	formSchema,
	getListSchema,
} from "./content-translations.schemas";

export const getListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(getListSchema)
	.handler(async ({ data }) =>
		listContentTranslations(
			data as Parameters<typeof listContentTranslations>[0],
		),
	);

export const saveSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(formSchema)
	.handler(async ({ data, context }) => {
		const result = await upsertContentTranslation(
			data as Parameters<typeof upsertContentTranslation>[0],
		);
		logCrud(context.user, "translation", "update", undefined, {
			targetType: "content_translation",
		});
		return result;
	});

export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(deleteSchema)
	.handler(async ({ data, context }) => {
		await deleteContentTranslation(data.id);
		logCrud(
			context.user,
			"translation",
			"delete",
			{ id: data.id },
			{ targetType: "content_translation" },
		);
		return { success: true };
	});

export const exportContentTranslationsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_EXPORT)])
	.handler(async () => {
		const translations = await getAllContentTranslationsForExport();
		return toJson({ translations });
	});

export const importContentTranslationsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_IMPORT)])
	.inputValidator(
		z.object({
			data: z.object({
				translations: z.array(
					z.object({
						entityType: z.string().min(1),
						entityId: z.string().min(1),
						fieldName: z.string().min(1),
						locale: z.string().min(1),
						value: z.string().min(1),
						valueType: z.string().optional(),
					}),
				),
			}),
		}),
	)
	.handler(
		async ({ data: { data }, context }): Promise<TranslationImportResult> => {
			const result = await importContentTranslations(
				data as ContentTranslationExportData,
			);
			logCrud(context.user, "translation", "import", undefined, {
				targetType: "content_translation",
				detail: { created: result.created, updated: result.updated },
			});
			return result;
		},
	);

/**
 * 实体翻译（content_translation）zod schema：单一来源
 */

import { z } from "zod";
import { EDITOR_TYPES } from "#/constants/editor-types";
import { localeSchema } from "./i18n-types";

export const formSchema = z.object({
	id: z.string().optional(),
	entityType: z.string().min(1),
	entityId: z.string().min(1),
	fieldName: z.string().min(1),
	locale: localeSchema,
	value: z.string().min(1),
	valueType: z.enum(EDITOR_TYPES).optional(),
});

export const getListSchema = z.object({
	entityType: z.string().optional(),
	locale: localeSchema.optional(),
	keyword: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

export const deleteSchema = z.object({ id: z.string().min(1) });

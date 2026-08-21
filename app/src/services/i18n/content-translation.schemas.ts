/**
 * 实体翻译（content_translation）zod schema：单一来源
 */
import { SUPPORTED_LOCALES } from "@fsdx/core/i18n-types";
import { z } from "zod";
import { EDITOR_TYPES } from "#/constants/editor-types";

export const formSchema = z.object({
	id: z.string().optional(),
	entityType: z.string().min(1),
	entityId: z.string().min(1),
	fieldName: z.string().min(1),
	locale: z.enum(SUPPORTED_LOCALES),
	value: z.string().min(1),
	valueType: z.enum(EDITOR_TYPES).optional(),
});

export const getListSchema = z.object({
	entityType: z.string().optional(),
	locale: z.enum(SUPPORTED_LOCALES).optional(),
	keyword: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

export const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * UI 翻译（ui_translation）zod schema：单一来源
 */

import { z } from "zod";
import { EDITOR_TYPES } from "#/constants/editor-types";
import { SUPPORTED_LOCALES } from "./i18n-types";

export const formSchema = z.object({
	id: z.string().optional(),
	locale: z.enum(SUPPORTED_LOCALES),
	key: z.string().min(1).max(300),
	value: z.string().min(1),
	valueType: z.enum(EDITOR_TYPES).optional(),
});

export const getListSchema = z.object({
	locale: z.enum(SUPPORTED_LOCALES).optional(),
	keyword: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

export const deleteSchema = z.object({ id: z.string().min(1) });

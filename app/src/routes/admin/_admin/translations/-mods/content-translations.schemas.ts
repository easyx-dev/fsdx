/**
 * 实体翻译页面 zod schema
 */

import { SUPPORTED_LOCALES } from "@fsdx/core/i18n-types";
import { z } from "zod";

export const formSchema = z.object({
	id: z.string().optional(),
	entityType: z.string().min(1),
	entityId: z.string().min(1),
	fieldName: z.string().min(1),
	locale: z.enum(SUPPORTED_LOCALES),
	value: z.string().min(1),
	valueType: z.string().optional(),
});

export const getListSchema = z.object({
	entityType: z.string().optional(),
	locale: z.string().optional(),
	keyword: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

export const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * 元事件管理共享 Zod Schema
 */
import { z } from "zod";

export const eventMetaCreateSchema = z.object({
	name: z.string().min(1).max(100),
	label: z.string().min(1).max(100),
	category: z.string().min(1).max(50),
	description: z.string().optional(),
});

export const eventMetaUpdateSchema = z.object({
	name: z.string().min(1).max(100),
	label: z.string().min(1).max(100).optional(),
	category: z.string().min(1).max(50).optional(),
	description: z.string().optional(),
});

export const eventMetaDeleteSchema = z.object({
	name: z.string().min(1).max(100),
});

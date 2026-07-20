/**
 * 预设属性管理共享 Zod Schema
 */
import { z } from "zod";

export const presetPropertyCreateSchema = z.object({
	key: z.string().min(1).max(100),
	label: z.string().min(1).max(100),
	dataType: z.string().optional(),
	description: z.string().optional(),
});

export const presetPropertyUpdateSchema = z.object({
	key: z.string().min(1).max(100),
	label: z.string().min(1).max(100).optional(),
	dataType: z.string().optional(),
	description: z.string().optional(),
});

export const presetPropertyDeleteSchema = z.object({
	key: z.string().min(1).max(100),
});

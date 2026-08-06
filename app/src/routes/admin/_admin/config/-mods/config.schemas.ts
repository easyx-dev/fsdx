/**
 * 系统配置管理共享 Zod Schema
 */
import { z } from "zod";

export const createConfigSchema = z.object({
	key: z.string().min(1, "配置键不能为空").max(100),
	value: z.string().min(1, "配置值不能为空"),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().optional(),
	description: z.string().optional(),
});

export const updateConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().optional(),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().optional(),
	description: z.string().optional(),
});

export const deleteConfigSchema = z.object({ id: z.string().min(1) });

const configItemSchema = z.object({
	key: z.string().min(1),
	value: z.string().min(1),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
});

export const configImportSchema = z.object({
	configs: z.array(configItemSchema),
});

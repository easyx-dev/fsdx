/**
 * 系统配置缓存实例：configCache（全量配置列表）+ configTranslationCache（配置翻译）
 * 仅允许 src/services/config/config.server.ts 直接操作
 */
import { MemoryCache } from "#/lib/cache/core";

/** 缓存的系统配置条目（按需扩展字段） */
export interface CachedConfig {
	id: string;
	key: string;
	value: string;
	clientVisible: boolean;
}

/** 系统配置缓存实例：全量缓存配置列表，key 固定为 "all" */
export const configCache = new MemoryCache<CachedConfig[]>({
	name: "config",
});

/** 系统配置的 content_translation 翻译缓存：key = locale，value = { entityId: translatedValue } */
export const configTranslationCache = new MemoryCache<Record<string, string>>({
	name: "config_translation",
});

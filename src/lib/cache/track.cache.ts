/**
 * 埋点元数据缓存实例：trackEventMetaCache + trackPropertyMetaCache
 * 仅允许 src/services/track/track.server.ts 直接操作
 */
import { MemoryCache } from "#/lib/cache/core";

/** 元事件缓存：key = 事件名，value = true，无过期（随元数据变更主动失效） */
export const trackEventMetaCache = new MemoryCache<boolean>({
	name: "track_event_meta",
});

/** 元属性缓存：key = 属性键，value = dataType，无过期（随元数据变更主动失效） */
export const trackPropertyMetaCache = new MemoryCache<string>({
	name: "track_property_meta",
});

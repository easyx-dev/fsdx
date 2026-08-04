/**
 * 埋点元数据缓存实例：presetEventCache + presetPropertyCache
 * 仅允许 src/services/event/event.server.ts 直接操作
 */
import { MemoryCache } from "#/lib/cache/core";

/** 预设事件缓存：key = 事件名，value = true，无过期（随预设变更主动失效） */
export const presetEventCache = new MemoryCache<boolean>({
	name: "preset_event",
});

/** 预设属性缓存：key = 属性键，value = dataType，无过期（随预设变更主动失效） */
export const presetPropertyCache = new MemoryCache<string>({
	name: "preset_property",
});

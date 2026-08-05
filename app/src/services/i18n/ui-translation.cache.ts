/**
 * UI 翻译缓存实例：key = locale，value = { 中文文本: 翻译 }
 * 仅允许 src/services/i18n/i18n.server.ts 直接操作
 */
import { MemoryCache } from "@fsdx/core/cache-core";

/** UI 翻译缓存实例 */
export const uiTranslationCache = new MemoryCache<Record<string, string>>({
	name: "ui_translation",
});

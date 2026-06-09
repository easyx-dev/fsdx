/**
 * 内存缓存模块：基于 Map 的简单缓存，用于字典和系统配置避免频繁查库
 */

/** 缓存选项 */
export interface CacheOptions<_T> {
	/** 默认过期时间（毫秒），0 表示永不过期 */
	defaultTTL?: number;
	/** 缓存名称，用于日志 */
	name?: string;
}

/** 缓存条目 */
interface CacheEntry<T> {
	value: T;
	expiresAt: number; // 0 表示永不过期
}

/**
 * 创建带过期时间的内存缓存
 */
export class MemoryCache<T = unknown> {
	private store = new Map<string, CacheEntry<T>>();
	private defaultTTL: number;

	constructor(options: CacheOptions<T> = {}) {
		this.defaultTTL = options.defaultTTL ?? 0;
	}

	/** 获取缓存值 */
	get(key: string): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return undefined;
		}
		return entry.value;
	}

	/** 设置缓存值 */
	set(key: string, value: T, ttl?: number): void {
		const effectiveTTL = ttl ?? this.defaultTTL;
		this.store.set(key, {
			value,
			expiresAt: effectiveTTL > 0 ? Date.now() + effectiveTTL : 0,
		});
	}

	/** 删除缓存 */
	delete(key: string): boolean {
		return this.store.delete(key);
	}

	/** 判断键是否存在且未过期 */
	has(key: string): boolean {
		const entry = this.store.get(key);
		if (!entry) return false;
		if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return false;
		}
		return true;
	}

	/** 清空所有缓存 */
	clear(): void {
		this.store.clear();
	}

	/** 获取所有键 */
	keys(): string[] {
		return Array.from(this.store.keys());
	}

	/** 缓存条目数量 */
	get size(): number {
		return this.store.size;
	}

	/** 清理过期条目 */
	cleanup(): number {
		const now = Date.now();
		let count = 0;
		for (const [key, entry] of this.store) {
			if (entry.expiresAt > 0 && entry.expiresAt < now) {
				this.store.delete(key);
				count++;
			}
		}
		return count;
	}
}

/** 字典缓存实例 */
export const dictCache = new MemoryCache<Record<string, string>>({
	name: "dict",
});

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

/** UI 翻译缓存：key = locale，value = { 中文文本: 翻译 } */
export const uiTranslationCache = new MemoryCache<Record<string, string>>({
	name: "ui_translation",
});

/** 系统配置的 content_translation 翻译缓存：key = locale，value = { entityId: translatedValue } */
export const configTranslationCache = new MemoryCache<Record<string, string>>({
	name: "config_translation",
});

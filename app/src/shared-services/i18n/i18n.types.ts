/**
 * 国际化类型定义：支持的语言列表、Cookie 名、locale 类型
 * 客户端安全，可被任意模块引用
 */
import { z } from "zod";

/** 支持的语言 */
export const SUPPORTED_LOCALES = ["zh", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** 默认语言 */
export const DEFAULT_LOCALE: Locale = "zh";

/** 存储 locale 的 Cookie 名 */
export const LOCALE_COOKIE = "lang";

/** locale 校验 schema（单一来源，供各服务层/路由层复用） */
export const localeSchema = z.enum(SUPPORTED_LOCALES);

/** 翻译资源：中文文本作为 key，映射到目标语言翻译 */
export type Translations = Record<string, string>;

/** 翻译导入结果：UI 翻译与实体翻译共用 */
export interface TranslationImportResult {
	created: number;
	updated: number;
}

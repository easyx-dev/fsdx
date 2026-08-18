/**
 * 国际化服务层统一导出（barrel）
 * UI 翻译 → i18n-ui.server；实体字段翻译 → i18n-content.server
 */

export type {
	ContentTranslationExportData,
	ContentTranslationResult,
	ListContentTranslationsParams,
} from "./i18n-content.server";
export {
	applyTranslations,
	deleteContentTranslation,
	getAllContentTranslationsForExport,
	getContentTranslations,
	getFieldTranslations,
	importContentTranslations,
	listContentTranslations,
	upsertContentTranslation,
} from "./i18n-content.server";
export type {
	ListUITranslationsParams,
	TranslationImportResult,
	UiTranslationExportData,
} from "./i18n-ui.server";
export {
	deleteUITranslation,
	getAllUITranslationsForExport,
	getUITranslations,
	importUiTranslations,
	listUITranslations,
	loadUITranslations,
	refreshUITranslationCache,
	upsertUITranslation,
} from "./i18n-ui.server";

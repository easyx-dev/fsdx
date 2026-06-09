/**
 * 国际化 Context Provider：将 i18next 实例注入 React 组件树
 * 封装 useTranslation / useLocale，中文文本作为翻译 key
 */
import type { TFunction } from "i18next";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useRef,
} from "react";
import {
	I18nextProvider,
	useTranslation as useI18nTranslation,
} from "react-i18next";
import { createI18nInstance } from "#/lib/i18n/i18n.config";
import type { Locale, Translations } from "#/lib/i18n/i18n.types";
import { DEFAULT_LOCALE } from "#/lib/i18n/i18n.types";
import { useGlobalStore } from "../global-store/global-store";

interface I18nContextValue {
	locale: Locale;
}

const I18nContext = createContext<I18nContextValue>({
	locale: DEFAULT_LOCALE,
});

interface I18nProviderProps {
	locale: Locale;
	translations: Translations;
	children: ReactNode;
}

/**
 * 国际化 Provider：创建 i18next 实例并注入
 * 使用 ref 避免每次渲染重建——仅在 locale 变化时创建新实例
 */
export function I18nProvider({
	locale,
	translations,
	children,
}: I18nProviderProps) {
	const instanceRef = useRef(createI18nInstance(locale, translations));
	const prevLocale = useRef(locale);

	if (prevLocale.current !== locale) {
		instanceRef.current = createI18nInstance(locale, translations);
		prevLocale.current = locale;
	}

	const contextValue = useMemo(() => ({ locale }), [locale]);

	return (
		<I18nContext value={contextValue}>
			<I18nextProvider i18n={instanceRef.current}>{children}</I18nextProvider>
		</I18nContext>
	);
}

/**
 * 从 context 获取当前语言
 */
export function useLocale(): Locale {
	const { locale } = useGlobalStore();
	return locale;
}

/**
 * 从 context 获取翻译函数 t
 * 中文文本直接作为 key：t("首页") → "首页"(zh) 或 "Home"(en)
 */
export function useTranslation(): { t: TFunction; locale: Locale } {
	const { locale } = useContext(I18nContext);
	const { t } = useI18nTranslation();
	return { t, locale };
}

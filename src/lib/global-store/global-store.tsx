import { createContext, useContext } from "react";
import type { Locale, Translations } from "../i18n/i18n.types";
import { I18nProvider } from "../i18n/i18n-context";

interface GlobalStoreValue {
	locale: Locale;
	translations: Translations;
	/** 客户端可见的系统配置：key → 当前语言解析后的值 */
	systemConfig: Record<string, string>;
}

export const globalStoreContext = createContext<GlobalStoreValue>(
	{} as GlobalStoreValue,
);

export function GlobalStoreProvider({
	value,
	children,
}: {
	value: GlobalStoreValue;
	children: React.ReactNode;
}) {
	return (
		<globalStoreContext.Provider value={value}>
			<I18nProvider locale={value.locale} translations={value.translations}>
				{children}
			</I18nProvider>
		</globalStoreContext.Provider>
	);
}

export function useGlobalStore() {
	const { locale, translations, systemConfig } = useContext(globalStoreContext);
	return {
		locale,
		translations,
		systemConfig,
	};
}

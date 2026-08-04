/**
 * 前台首页 Server Functions
 */
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import type { Locale } from "#/lib/i18n/i18n.types";
import {
	DEFAULT_LOCALE,
	LOCALE_COOKIE,
	SUPPORTED_LOCALES,
} from "#/lib/i18n/i18n.types";
import { getNewsList, translateNewsRecords } from "#/services/news/news.server";

export const getLatestNewsSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const cookieLocale = getCookie(LOCALE_COOKIE);
		const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(
			cookieLocale ?? "",
		)
			? (cookieLocale as Locale)
			: DEFAULT_LOCALE;
		const { records, ...rest } = await getNewsList({
			status: "published",
			pageSize: 6,
		});
		return { records: await translateNewsRecords(records, locale), ...rest };
	},
);

/**
 * 前台首页 Server Functions
 */

import { createServerFn } from "@tanstack/react-start";
import { getNewsList } from "#/services/news/news.server";
import { translateRecords } from "#/shared-services/i18n/i18n.server";

export const getLatestNewsSFn = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const { records, ...rest } = await getNewsList({
			isPublished: true,
			pageSize: 6,
		});
		return {
			records: await translateRecords(records, "news", context.locale),
			...rest,
		};
	},
);

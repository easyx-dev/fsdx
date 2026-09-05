/**
 * 前台首页 Server Functions
 */

import { createServerFn } from "@tanstack/react-start";
import { getNewsList, translateNewsRecords } from "#/services/news/news.server";

export const getLatestNewsSFn = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const { records, ...rest } = await getNewsList({
			status: "published",
			pageSize: 6,
		});
		return {
			records: await translateNewsRecords(records, context.locale),
			...rest,
		};
	},
);

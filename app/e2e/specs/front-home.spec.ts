/**
 * 前台首页 e2e：SSR 输出、Hero 区、Header 布局与空态
 */

import { expect, goto, test } from "../fixtures";

test.describe("前台首页", () => {
	test("SSR 首屏输出包含站点主标题", async ({ request }) => {
		const res = await request.get("/");
		expect(res.ok()).toBeTruthy();
		const html = await res.text();
		expect(html).toContain("CMS 内容管理系统");
	});

	test("Hero 区标题与副标题可见", async ({ page }) => {
		await goto(page, "/");
		await expect(
			page.getByRole("heading", { name: "CMS 内容管理系统" }),
		).toBeVisible();
		await expect(
			page.getByText("轻量、安全、可扩展的全栈内容管理解决方案"),
		).toBeVisible();
	});

	test("Header 渲染站点名、导航与语言切换", async ({ page }) => {
		await goto(page, "/");
		const header = page.locator("header");
		await expect(header.getByText("FSDX")).toBeVisible();
		const nav = header.locator("nav");
		await expect(nav).toContainText("首页");
		await expect(nav).toContainText("新闻");
		await expect(nav).toContainText("关于");
		await expect(header.getByRole("button", { name: "EN" })).toBeVisible();
	});

	test("未登录状态 Header 显示登录入口", async ({ page }) => {
		await goto(page, "/");
		await expect(
			page.locator("header").getByRole("link", { name: "登录" }),
		).toBeVisible();
	});

	test("最新新闻区块在无数据时显示空态", async ({ page }) => {
		await goto(page, "/");
		await expect(page.getByRole("heading", { name: "最新新闻" })).toBeVisible();
		await expect(page.getByText("暂无数据")).toBeVisible();
	});
});

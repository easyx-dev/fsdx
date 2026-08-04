/**
 * 埋点事件服务层测试：事件追踪、查询、分析、预设管理
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockTrackEventMetaCache, mockTrackPropertyMetaCache } = vi.hoisted(
	() => {
		const eventStore = new Map<string, boolean>();
		const propertyStore = new Map<string, string>();
		return {
			mockTrackEventMetaCache: {
				clear: vi.fn(() => eventStore.clear()),
				set: vi.fn((k: string, v: boolean) => eventStore.set(k, v)),
				get: vi.fn((k: string) => eventStore.get(k)),
				has: vi.fn((k: string) => eventStore.has(k)),
			},
			mockTrackPropertyMetaCache: {
				clear: vi.fn(() => propertyStore.clear()),
				set: vi.fn((k: string, v: string) => propertyStore.set(k, v)),
				get: vi.fn((k: string) => propertyStore.get(k)),
				has: vi.fn((k: string) => propertyStore.has(k)),
			},
		};
	},
);

vi.mock("#/lib/cache/track.cache", () => ({
	trackEventMetaCache: mockTrackEventMetaCache,
	trackPropertyMetaCache: mockTrackPropertyMetaCache,
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				trackEvent: q(),
				trackEventMeta: q(),
				trackPropertyMeta: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
				file: q(),
				systemConfig: q(),
				captchaCode: q(),
				contentTranslation: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => ({
							limit: vi.fn(() => ({
								offset: vi.fn(() => Promise.resolve([])),
							})),
						})),
						groupBy: vi.fn(() => ({
							orderBy: vi.fn(() => ({
								limit: vi.fn(() => Promise.resolve([])),
							})),
						})),
					})),
				})),
			})),
			selectDistinct: vi.fn(() => ({
				from: vi.fn(() => ({
					orderBy: vi.fn(() => Promise.resolve([])),
				})),
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
				})),
			})),
			delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
			execute: vi.fn(() => Promise.resolve({ rows: [] })),
		},
	};
});

vi.mock("#/db", () => ({ db: mockDb }));

// 所有 mock 之后导入被测模块
import {
	createTrackEventMeta,
	createTrackPropertyMeta,
	deleteTrackEventMeta,
	deleteTrackPropertyMeta,
	flushTrackEvents,
	getTrackEventMeta,
	getTrackEventMetaList,
	getTrackEventNames,
	getTrackPropertyMeta,
	getTrackPropertyMetaList,
	loadTrackMetaCache,
	trackEvent,
	updateTrackEventMeta,
	updateTrackPropertyMeta,
} from "../track.server";

beforeEach(() => {
	vi.clearAllMocks();
	mockTrackEventMetaCache.clear();
	mockTrackPropertyMetaCache.clear();
});

describe("loadTrackMetaCache", () => {
	it("从数据库加载预设到缓存", async () => {
		mockDb.select.mockReturnValueOnce({
			from: vi.fn(() => Promise.resolve([{ name: "PageView" }])),
		} as any);

		mockDb.select.mockReturnValueOnce({
			from: vi.fn(() => Promise.resolve([{ key: "$ip", dataType: "string" }])),
		} as any);

		await loadTrackMetaCache();

		expect(mockDb.select).toHaveBeenCalled();
	});
});

describe("trackEvent", () => {
	it("缓存未就绪时仍接受事件（不校验）", () => {
		expect(() =>
			trackEvent({
				time: Date.now(),
				sessionId: "session-1",
				name: "UnknownEvent",
				properties: {},
			}),
		).not.toThrow();
	});
});

describe("getTrackEventNames", () => {
	it("返回事件名称列表", async () => {
		mockDb.selectDistinct.mockReturnValue({
			from: vi.fn(() => ({
				orderBy: vi.fn(() =>
					Promise.resolve([{ name: "PageView" }, { name: "Click" }]),
				),
			})),
		} as any);

		const names = await getTrackEventNames();
		expect(names).toEqual(["PageView", "Click"]);
	});

	it("无事件时返回空数组", async () => {
		mockDb.selectDistinct.mockReturnValue({
			from: vi.fn(() => ({
				orderBy: vi.fn(() => Promise.resolve([])),
			})),
		} as any);

		const names = await getTrackEventNames();
		expect(names).toEqual([]);
	});
});

describe("元事件管理", () => {
	describe("getTrackEventMetaList", () => {
		it("返回预设事件列表", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					orderBy: vi.fn(() =>
						Promise.resolve([
							{ name: "PageView", label: "页面浏览", category: "页面交互" },
						]),
					),
				})),
			} as any);

			const list = await getTrackEventMetaList();
			expect(list).toHaveLength(1);
			expect(list[0].name).toBe("PageView");
		});
	});

	describe("getTrackEventMeta", () => {
		it("按名称获取预设事件", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{ name: "PageView", label: "页面浏览", category: "页面交互" },
							]),
						),
					})),
				})),
			} as any);

			const event = await getTrackEventMeta("PageView");
			expect(event).not.toBeNull();
			expect(event!.name).toBe("PageView");
		});

		it("不存在的名称返回 null", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			} as any);

			const event = await getTrackEventMeta("NotFound");
			expect(event).toBeNull();
		});
	});

	describe("createTrackEventMeta", () => {
		it("创建预设事件并返回记录", async () => {
			const mockReturning = vi.fn(() =>
				Promise.resolve([
					{ name: "Custom", label: "自定义", category: "自定义类别" },
				]),
			);
			mockDb.insert.mockReturnValue({
				values: vi.fn(() => ({ returning: mockReturning })),
			} as any);

			const result = await createTrackEventMeta("Custom", {
				label: "自定义",
				category: "自定义类别",
			});

			expect(result.name).toBe("Custom");
		});
	});

	describe("updateTrackEventMeta", () => {
		it("更新不存在的预设事件返回 null", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			} as any);

			const result = await updateTrackEventMeta("NotFound", {
				label: "新名称",
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteTrackEventMeta", () => {
		it("预置事件不可删除返回 false", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									name: "PageView",
									label: "页面浏览",
									category: "页面交互",
									isPreset: true,
								},
							]),
						),
					})),
				})),
			} as any);

			const result = await deleteTrackEventMeta("PageView");
			expect(result).toBe(false);
		});

		it("不存在的预设事件删除返回 false", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			} as any);

			const result = await deleteTrackEventMeta("NotFound");
			expect(result).toBe(false);
		});
	});
});

describe("元属性管理", () => {
	describe("getTrackPropertyMetaList", () => {
		it("返回预设属性列表", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					orderBy: vi.fn(() =>
						Promise.resolve([
							{ key: "$ip", label: "IP 地址", dataType: "string" },
						]),
					),
				})),
			} as any);

			const list = await getTrackPropertyMetaList();
			expect(list).toHaveLength(1);
		});
	});

	describe("getTrackPropertyMeta", () => {
		it("按 key 获取预设属性", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{ key: "$ip", label: "IP 地址", dataType: "string" },
							]),
						),
					})),
				})),
			} as any);

			const prop = await getTrackPropertyMeta("$ip");
			expect(prop).not.toBeNull();
		});

		it("不存在的 key 返回 null", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			} as any);

			const prop = await getTrackPropertyMeta("$notfound");
			expect(prop).toBeNull();
		});
	});

	describe("createTrackPropertyMeta", () => {
		it("创建预设属性默认 dataType 为 string", async () => {
			const mockReturning = vi.fn(() =>
				Promise.resolve([
					{ key: "custom_key", label: "自定义属性", dataType: "string" },
				]),
			);
			mockDb.insert.mockReturnValue({
				values: vi.fn(() => ({ returning: mockReturning })),
			} as any);

			const result = await createTrackPropertyMeta("custom_key", {
				label: "自定义属性",
			});
			expect(result.key).toBe("custom_key");
		});
	});

	describe("updateTrackPropertyMeta", () => {
		it("更新不存在的属性返回 null", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			} as any);

			const result = await updateTrackPropertyMeta("notfound", {
				label: "新名称",
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteTrackPropertyMeta", () => {
		it("预置属性不可删除返回 false", async () => {
			mockDb.select.mockReturnValue({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									key: "$ip",
									label: "IP 地址",
									dataType: "string",
									isPreset: true,
								},
							]),
						),
					})),
				})),
			} as any);

			const result = await deleteTrackPropertyMeta("$ip");
			expect(result).toBe(false);
		});
	});
});

describe("flushTrackEvents", () => {
	it("强制刷新完成不抛出异常", async () => {
		await expect(flushTrackEvents()).resolves.toBeUndefined();
	});
});

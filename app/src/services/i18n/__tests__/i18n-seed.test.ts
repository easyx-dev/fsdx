/**
 * 国际化种子数据测试：验证预置翻译批量写入与冲突跳过
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				uiTranslation: q(),
				contentTranslation: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
				news: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({
				from: vi.fn(() => ({ where: vi.fn() })),
			})),
			insert: vi.fn(() => ({ values: vi.fn() })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});

vi.mock("#/db", () => ({ db: mockDb }));

import { ensurePresetTranslations, SEED_DATA } from "../i18n-seed";

describe("ensurePresetTranslations", () => {
	beforeEach(() => vi.clearAllMocks());

	it("批量写入全部种子数据并跳过冲突", async () => {
		const onConflictDoNothing = vi.fn(() => Promise.resolve());
		const valuesMock = vi.fn((_data: unknown) => ({ onConflictDoNothing }));
		mockDb.insert.mockReturnValue({ values: valuesMock });

		await ensurePresetTranslations();

		expect(valuesMock).toHaveBeenCalledTimes(1);
		expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
		const rows = valuesMock.mock.calls[0][0] as {
			locale: string;
			key: string;
			value: string;
		}[];
		expect(rows).toHaveLength(SEED_DATA.length);
		expect(rows[0]).toMatchObject({
			locale: "en",
			key: "返回首页",
			value: "Back to Home",
		});
	});
});

describe("SEED_DATA", () => {
	it("种子数据仅包含英文语言", () => {
		const locales = new Set(SEED_DATA.map((r) => r.locale));
		expect(locales).toEqual(new Set(["en"]));
	});

	it("种子数据键值不为空且无重复键", () => {
		const keys = new Set<string>();
		for (const row of SEED_DATA) {
			expect(row.key).toBeTruthy();
			expect(row.value).toBeTruthy();
			keys.add(row.key);
		}
		expect(keys.size).toBe(SEED_DATA.length);
	});
});

/**
 * 图片验证码生成器测试
 */

import { describe, expect, it } from "vitest";
import { create, createMathExpr, randomText } from "#/lib/captcha/captcha";

describe("create", () => {
	it("返回 data 和 text", () => {
		const result = create();
		expect(result).toHaveProperty("data");
		expect(result).toHaveProperty("text");
	});

	it("默认生成 4 位字符串文本", () => {
		const result = create();
		expect(result.text).toHaveLength(4);
		expect(typeof result.text).toBe("string");
	});

	it("data 为有效 SVG 字符串", () => {
		const result = create();
		expect(result.data).toContain("<svg");
		expect(result.data).toContain("</svg>");
		expect(result.data).toContain('xmlns="http://www.w3.org/2000/svg"');
	});

	it("SVG 包含 width 和 height 属性", () => {
		const result = create({ width: 200, height: 80 });
		expect(result.data).toContain('width="200"');
		expect(result.data).toContain('height="80"');
	});

	it("自定义 size 生效", () => {
		const result = create({ size: 6 });
		expect(result.text).toHaveLength(6);
	});

	it("ignoreChars 排除指定字符", () => {
		const result = create({
			size: 4,
			ignoreChars: "ABCDEFGHJKMNPQRSTUVWYZabcdefghjkmnpqrstuvwyz123456789",
		});
		expect(result.text).toMatch(/^[Xx]{4}$/);
	});

	it("noise 参数不报错", () => {
		expect(() => create({ noise: 5 })).not.toThrow();
	});

	it("background 参数包含背景矩形", () => {
		const result = create({ background: "#f0f0f0" });
		expect(result.data).toContain("<rect");
		expect(result.data).toContain("#f0f0f0");
	});

	it("多次调用结果不同（随机性）", () => {
		const results = new Set<string>();
		for (let i = 0; i < 10; i++) {
			results.add(create().text);
		}
		expect(results.size).toBeGreaterThan(1);
	});

	it("charPreset 使用自定义字符集", () => {
		const result = create({ size: 6, charPreset: "AB" });
		expect(result.text).toHaveLength(6);
		expect(result.text).toMatch(/^[AB]{6}$/);
	});

	it("background 开启后自动启用 color 模式", () => {
		const result = create({ background: "#333", color: false });
		expect(result.data).toContain("<rect");
	});

	it("干扰线使用贝塞尔曲线 path", () => {
		const result = create({ noise: 3 });
		expect(result.data).toContain('<path d="M');
		expect(result.data).toContain('fill="none"');
	});

	it("字符渲染为 SVG path（非 text 元素）", () => {
		const result = create({ noise: 0 });
		expect(result.data).not.toContain("<text");
		const pathMatches = result.data.match(/<path fill="/g);
		expect(pathMatches).not.toBeNull();
		expect((pathMatches ?? []).length).toBeGreaterThanOrEqual(4);
	});

	it("path data 包含路径命令", () => {
		const result = create({ noise: 0 });
		expect(result.data).toMatch(/d="M[\d.]+ [\d.]+/);
	});
});

describe("createMathExpr", () => {
	it("返回 data 和 text", () => {
		const result = createMathExpr();
		expect(result).toHaveProperty("data");
		expect(result).toHaveProperty("text");
	});

	it("text 为数字字符串", () => {
		const result = createMathExpr({ mathMin: 1, mathMax: 3 });
		expect(Number.isInteger(Number(result.text))).toBe(true);
	});

	it("data 包含运算符号", () => {
		const result = createMathExpr({
			mathOperator: "+",
			mathMin: 1,
			mathMax: 1,
		});
		// 表达式 1+1 的 path data 会包含数字和加号
		expect(result.data).toContain("<svg");
	});

	it("mathOperator 随机模式不报错", () => {
		expect(() => createMathExpr({ mathOperator: "+-" })).not.toThrow();
	});
});

describe("randomText", () => {
	it("返回指定长度的字符串", () => {
		expect(randomText(6)).toHaveLength(6);
	});

	it("支持 options 对象", () => {
		const text = randomText({ size: 3, charPreset: "A" });
		expect(text).toBe("AAA");
	});
});

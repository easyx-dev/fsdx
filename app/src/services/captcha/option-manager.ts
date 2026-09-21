/**
 * 验证码默认选项与字体加载
 */
import type { Font } from "opentype.js";
import * as opentypeNs from "opentype.js";
import { FONT_BASE64 } from "./font-data";

// opentype.js v2: CJS(dev) 需通过 default 访问，ESM(build) 直接用命名空间
// import.meta.env.DEV 是 Vite 编译时常量，prod build 下为 false，Rollup 会 tree-shake 掉 default 访问
const opentype = import.meta.env.DEV
	? (opentypeNs as typeof opentypeNs & { default: typeof opentypeNs }).default
	: opentypeNs;

// 字体解析是纯 CPU 开销，模块级单例复用解析结果，避免每次生成验证码重复解析
const fontBuffer = Buffer.from(FONT_BASE64, "base64").buffer as ArrayBuffer;
const font = opentype.parse(fontBuffer) as Font;

/** 默认字符集：排除易混淆字符（0/O、1/I/l） */
const charPreset = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

const defaultOptions = {
	width: 150,
	height: 50,
	noise: 1,
	color: false,
	background: "",
	size: 4,
	ignoreChars: "",
	fontSize: 56,
	charPreset,
	font,
	ascender: font.ascender,
	descender: font.descender,
	truncateLineProbability: 0.5,
	truncateCurveProbability: 0.5,
	truncateCurvePositionMin: 0.4,
	truncateCurvePositionMax: 0.6,
};

/**
 * 验证码默认选项，只读：禁止调用方改写全局默认值
 * （生成时由 createCaptcha 与本对象做浅拷贝合并，合法定制走 userOptions 入参）
 */
const options: Readonly<typeof defaultOptions> = defaultOptions;

export { font, options };

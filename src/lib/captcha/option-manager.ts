/**
 * 选项管理 + 字体加载
 */
import type { Font } from "opentype.js";
import * as opentypeNs from "opentype.js";
import { FONT_BASE64 } from "./font-data";

// opentype.js v2: CJS(dev) 需通过 default 访问，ESM(build) 直接用命名空间
// import.meta.env.DEV 是 Vite 编译时常量，prod build 下为 false，Rollup 会 tree-shake 掉 default 访问
const opentype = import.meta.env.DEV
	? (opentypeNs as typeof opentypeNs & { default: typeof opentypeNs }).default
	: opentypeNs;

const fontBuffer = Buffer.from(FONT_BASE64, "base64").buffer as ArrayBuffer;
const font = opentype.parse(fontBuffer) as Font;

const charPreset = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

const options = {
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

export { options, font };

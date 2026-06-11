/**
 * 选项管理 + 字体加载
 */
import { createRequire } from "node:module";
import type { Font } from "opentype.js";
import { FONT_BASE64 } from "./font-data";

const require = createRequire(import.meta.url);
const opentype = require("opentype.js");

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

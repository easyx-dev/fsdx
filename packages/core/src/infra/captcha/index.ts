/**
 * 图片验证码生成：聚合 create / createMathExpr 与 captchaText 导出
 * 供宿主应用 services/captcha 使用
 */
export {
	type CaptchaOptions,
	type CaptchaResult,
	create,
	createMathExpr,
	type MathExprOptions,
} from "./captcha";
export { type CaptchaTextOptions, captchaText, mathExpr } from "./random";

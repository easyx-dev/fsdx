/**
 * 图片验证码生成：聚合 create 与 captchaText 导出
 * 供宿主应用 services/captcha 使用
 */
export {
	type CaptchaOptions,
	type CaptchaResult,
	create,
} from "./captcha";
export { type CaptchaTextOptions, captchaText } from "./random";

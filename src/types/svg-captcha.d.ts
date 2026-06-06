/**
 * svg-captcha 库类型声明
 */
declare module "svg-captcha" {
	interface CaptchaOptions {
		size?: number;
		noise?: number;
		color?: boolean;
		background?: string;
		width?: number;
		height?: number;
		fontSize?: number;
		ignoreChars?: string;
	}

	interface CaptchaResult {
		/** SVG 字符串 */
		data: string;
		/** 验证码答案文本 */
		text: string;
	}

	interface MathCaptchaOptions {
		size?: number;
		noise?: number;
		color?: boolean;
		background?: string;
		width?: number;
		height?: number;
		fontSize?: number;
		mathMin?: number;
		mathMax?: number;
		mathOperator?: "+" | "-";
	}

	/** 生成字符验证码 */
	export function create(options?: CaptchaOptions): CaptchaResult;
	/** 生成数学表达式验证码 */
	export function createMathExpr(options?: MathCaptchaOptions): CaptchaResult;
}

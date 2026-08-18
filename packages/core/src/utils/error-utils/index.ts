/**
 * 错误处理工具：日志脱敏 + 客户端错误归一化
 */

/** 生产环境未知错误兜底文案 */
const CLIENT_FALLBACK_MESSAGE = "服务器内部错误，请稍后重试";

/**
 * 归一化抛给客户端的错误，保证 err.message 始终为「业务文案 / 校验文案 / 兜底文案」之一
 * - 校验错误（StandardSchema issues / ZodError）→ "参数校验失败：{首条 issue}"
 * - 业务错误（含中文文案，本项目约定 UI 文案均为简体中文）→ 原样透传
 * - 其他技术错误（SQL/堆栈/英文）→ 生产环境兜底，开发环境保留原样便于排查
 * - 非 Error 抛出值（如 TanStack 重定向对象）→ 原样透传
 * @param error 任意抛出值
 * @param isProd 是否生产环境
 */
export function toClientError(error: unknown, isProd: boolean): unknown {
	const validationMessage = extractValidationMessage(error);
	if (validationMessage !== null) {
		return new Error(`参数校验失败：${validationMessage}`);
	}

	if (error instanceof Error) {
		// 开发环境保留原始错误（含堆栈细节），生产环境仅透传业务文案
		if (!isProd) return error;
		if (isUserFacingMessage(error.message)) return error;
		return new Error(CLIENT_FALLBACK_MESSAGE);
	}

	return error;
}

/**
 * 从校验错误中提取首条 issue 文案，非校验错误返回 null
 * 兼容两种形态：StandardSchema 返回的 issues 数组、TanStack 将 issues JSON 序列化后抛出的 Error
 */
function extractValidationMessage(error: unknown): string | null {
	if (typeof error === "object" && error !== null && "issues" in error) {
		const issues = (error as { issues?: unknown }).issues;
		if (Array.isArray(issues) && issues.length > 0) {
			return issueToMessage(issues[0]);
		}
	}

	if (error instanceof Error) {
		try {
			const parsed: unknown = JSON.parse(error.message);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return issueToMessage(parsed[0]);
			}
		} catch {
			// 非 JSON 消息，忽略
		}
	}

	return null;
}

/** 提取单条 issue 的 message 字段 */
function issueToMessage(issue: unknown): string {
	if (typeof issue === "object" && issue !== null && "message" in issue) {
		const message = (issue as { message?: unknown }).message;
		if (typeof message === "string" && message.trim()) return message.trim();
	}
	return "输入参数不合法";
}

/** 判断是否为面向用户的业务文案：包含中文字符即视为业务文案 */
function isUserFacingMessage(message: string): boolean {
	return /[\u4e00-\u9fff]/.test(message);
}

/** 需要在日志中脱敏的敏感字段 */
const SENSITIVE_PATTERNS: [RegExp, string][] = [
	[/"token"\s*:\s*"[^"]+"/gi, '"token":"***REDACTED***"'],
	[/"password"\s*:\s*"[^"]+"/gi, '"password":"***REDACTED***"'],
	[/'token'\s*:\s*'[^']+'/gi, "'token':'***REDACTED***'"],
	[/'password'\s*:\s*'[^']+'/gi, "'password':'***REDACTED***'"],
	[/Bearer\s+[^\s"]+/gi, "Bearer ***REDACTED***"],
	[/secret[=:]\s*\S+/gi, "secret=***REDACTED***"],
];

/** 递归脱敏的最大深度：防止 error.cause 循环引用导致无限递归 */
const MAX_CAUSE_DEPTH = 10;

/** 对单个字符串应用全部敏感模式脱敏 */
function redactSensitive(text: string): string {
	for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
		text = text.replace(pattern, replacement);
	}
	return text;
}

/**
 * 对错误对象进行脱敏处理
 * 移除 password / token / secret 等敏感信息，仅 dev 环境输出 stack trace
 */
export function sanitizeError(error: unknown): Record<string, unknown> {
	return sanitizeErrorInternal(error, new WeakSet<object>(), 0);
}

/** 内部递归实现：seen 记录已访问的对象，避免 cause 成环 */
function sanitizeErrorInternal(
	error: unknown,
	seen: WeakSet<object>,
	depth: number,
): Record<string, unknown> {
	if (!(error instanceof Error)) {
		return { message: String(error) };
	}
	// 同一 Error 再次出现或超出深度上限时截断，防止日志路径无限递归掩盖原始错误
	if (depth >= MAX_CAUSE_DEPTH || seen.has(error)) {
		return { name: error.name, message: "[cause 循环或过深，已截断]" };
	}
	seen.add(error);

	let message = error.message;
	let stack = error.stack;

	message = redactSensitive(message);
	if (stack) stack = redactSensitive(stack);

	const result: Record<string, unknown> = {
		name: error.name,
		message,
	};

	if (process.env.NODE_ENV === "development") {
		result.stack = stack;
	}

	if (error.cause !== undefined) {
		result.cause = sanitizeCause(error.cause, seen, depth + 1);
	}

	return result;
}

/**
 * 递归脱敏 cause：Error 走错误脱敏，任意对象/数组/字符串逐层应用脱敏规则
 * 避免非 Error 的 cause（如 fetch/axios 错误对象）原样落库绕过脱敏
 */
function sanitizeCause(
	value: unknown,
	seen: WeakSet<object>,
	depth: number,
): unknown {
	if (value instanceof Error) {
		return sanitizeErrorInternal(value, seen, depth);
	}
	if (value === null || value === undefined) {
		return value;
	}
	if (typeof value === "string") {
		return redactSensitive(value);
	}
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return value;
	}
	if (typeof value === "object") {
		if (depth >= MAX_CAUSE_DEPTH || seen.has(value)) {
			return "[cause 循环或过深，已截断]";
		}
		seen.add(value);
		// 内置对象保留原样，避免破坏结构
		if (
			value instanceof Date ||
			value instanceof RegExp ||
			value instanceof URL
		) {
			return value;
		}
		if (Array.isArray(value)) {
			return value.map((item) => sanitizeCause(item, seen, depth + 1));
		}
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			out[key] = sanitizeCause(item, seen, depth + 1);
		}
		return out;
	}
	// function / symbol 等不可序列化类型
	return String(value);
}

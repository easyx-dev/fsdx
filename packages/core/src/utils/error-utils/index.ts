/**
 * 错误处理工具：日志脱敏
 */

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

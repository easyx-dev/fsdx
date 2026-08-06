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

/**
 * 对错误对象进行脱敏处理
 * 移除 password / token / secret 等敏感信息，仅 dev 环境输出 stack trace
 */
export function sanitizeError(error: unknown): Record<string, unknown> {
	if (!(error instanceof Error)) {
		return { message: String(error) };
	}

	let message = error.message;
	let stack = error.stack;

	for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
		message = message.replace(pattern, replacement);
		if (stack) stack = stack.replace(pattern, replacement);
	}

	const result: Record<string, unknown> = {
		name: error.name,
		message,
	};

	if (process.env.NODE_ENV === "development") {
		result.stack = stack;
	}

	return result;
}

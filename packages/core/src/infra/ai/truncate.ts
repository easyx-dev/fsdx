/**
 * JSON 截断工具：将大体积 JSON 压缩到 LLM 上下文窗口可处理的范围
 * 保留结构骨架（字段名、嵌套层级），截断数组元素与超长字符串值
 */

/** 递归截断 JSON 值：数组保留前 3 项 + 标注总数，字符串截断到 500 字符 */
function truncateValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		if (value.length === 0) return [];
		const sample = value.slice(0, 3).map(truncateValue);
		if (value.length > 3) {
			return [...sample, `... [共 ${value.length} 项，已截断]`];
		}
		return sample;
	}
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			result[key] = truncateValue(val);
		}
		return result;
	}
	if (typeof value === "string" && value.length > 500) {
		return `${value.slice(0, 500)}... [已截断，原始长度 ${value.length} 字符]`;
	}
	return value;
}

/**
 * 截断 JSON 字符串以适配 LLM 上下文窗口
 *
 * 保留 JSON 结构骨架（字段名、嵌套层级），截断数组元素（保留前 3 项 + 标注总数），
 * 截断超长字符串值。适用于将大体积 API 响应压缩到 LLM 可处理的范围。
 *
 * @param jsonStr JSON 字符串
 * @param maxChars 最大字符数，默认 50000（约 25K tokens）
 * @returns 截断后的 JSON 字符串
 */
export function truncateJsonForLlm(jsonStr: string, maxChars = 50000): string {
	if (jsonStr.length <= maxChars) return jsonStr;

	try {
		const parsed = JSON.parse(jsonStr);
		const truncated = truncateValue(parsed);
		const result = JSON.stringify(truncated, null, 2);
		if (result.length <= maxChars) return result;
		return `${result.slice(0, maxChars)}\n... [结构截断后仍超限，原始长度 ${jsonStr.length} 字符]`;
	} catch {
		return `${jsonStr.slice(0, maxChars)}\n... [已截断，原始长度 ${jsonStr.length} 字符]`;
	}
}

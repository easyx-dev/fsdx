/**
 * AI Rich Editor 提示词能力：基于内置模板组装默认 system 提示词
 * 提示词语义归包所有（组件契约），宿主服务端不再自建；使用方可通过 config.systemPrompt 覆盖
 */
import { DEFAULT_SYSTEM_PROMPT_TEMPLATE } from "./constants";

/**
 * 构建默认 system 提示词（fragment-only：只输出 HTML 内容片段，不输出整页文档）
 * @returns 完整提示词
 */
export function buildDefaultSystemPrompt(): string {
	return DEFAULT_SYSTEM_PROMPT_TEMPLATE;
}

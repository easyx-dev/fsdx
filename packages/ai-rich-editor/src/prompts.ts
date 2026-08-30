/**
 * AI Rich Editor 提示词能力：基于内置模板与输出形态组装默认 system 提示词
 * 提示词语义归包所有（组件契约），宿主服务端不再自建；使用方可通过 systemPrompt 覆盖
 */
import {
	DEFAULT_SYSTEM_PROMPT_TEMPLATE,
	MODE_PROMPT_DESCRIPTIONS,
} from "./constants";
import type { AiChatMode } from "./types";

/**
 * 构建默认 system 提示词
 * @param mode 输出形态：fragment=页面内容片段，document=完整 HTML 文档
 * @returns 组合形态描述的完整提示词
 */
export function buildDefaultSystemPrompt(mode: AiChatMode): string {
	return DEFAULT_SYSTEM_PROMPT_TEMPLATE.replace(
		"{mode}",
		MODE_PROMPT_DESCRIPTIONS[mode],
	);
}

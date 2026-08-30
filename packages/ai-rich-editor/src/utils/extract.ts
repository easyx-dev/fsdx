/**
 * 纯函数：从 AI 回复中提取 HTML 代码块 + 构建预览文档外壳
 * 与协议层同属开放工具，任意宿主可复用
 */
import type { AiChatMode } from "../types";

/** 去除相邻重复的片段（同一回复中多次出现同一代码块时去重） */
function dedupe(items: string[]): string[] {
	return [...new Set(items)];
}

/**
 * 从 AI 回复文本中提取 HTML 代码块
 * 优先匹配 ```html … ```（兼容无语言标识的 ``` ），
 * 无任何代码块标记但整体以 < 开头时，将整体作为片段兜底
 */
export function extractHtmlFragments(content: string): string[] {
	const codeBlockRegex = /```(?:html)?\s*\n([\s\S]*?)```/gi;
	const fragments: string[] = [];
	for (
		let match = codeBlockRegex.exec(content);
		match;
		match = codeBlockRegex.exec(content)
	) {
		const fragment = match[1].trim();
		if (fragment) fragments.push(fragment);
	}
	if (fragments.length > 0) return dedupe(fragments);

	// 兜底：无代码块标记但整体像是 HTML
	const trimmed = content.trim();
	if (trimmed.startsWith("<")) return [trimmed];
	return [];
}

/**
 * 构建 iframe 预览文档
 * fragment 模式包一层最小文档外壳（补充 charset/viewport），document 模式原样返回
 */
export function buildPreviewDocument(html: string, mode: AiChatMode): string {
	if (mode === "document") return html;
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
}

/**
 * 纯函数：从 AI 回复中提取 HTML 代码块 + 构建预览文档外壳
 * 与协议层同属开放工具，任意宿主可复用
 */

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
 * 取 AI 回复中「最后一个」HTML 代码块（最终产物通常位于末尾；
 * 修改类回复可能先贴旧/分块内容、再给出改动后的完整片段）。
 * 自动应用到编辑器时用它，避免取到旧内容或不完整片段。
 */
export function lastHtmlFragment(content: string): string | undefined {
	const fragments = extractHtmlFragments(content);
	return fragments[fragments.length - 1];
}

/**
 * 流式实时提取「当前」HTML 代码块内容（含尚未闭合的代码块）。
 * AI 生成过程中末尾 ``` 闭合标记尚未到达，extractHtmlFragments 会提取不到；
 * 此函数取最后一个 ```html 围栏之后到文本末尾的可视内容（已闭合时截到 ``` ），
 * 供生成中实时同步到编辑器/预览使用。
 */
export function currentHtmlFragment(content: string): string {
	const re = /```(?:html)?\s*\n([\s\S]*?)(?:\n?```|$)/gi;
	let last = "";
	let match: RegExpExecArray | null = re.exec(content);
	while (match !== null) {
		const frag = match[1].trim();
		if (frag) last = frag;
		match = re.exec(content);
	}
	return last;
}

/**
 * 构建 iframe 预览文档：包一层最小文档外壳（补充 charset/viewport）
 * previewHead 为可选注入的原始 HTML 片段（如内置 <style>/<script>），原样插入 <head>
 */
export function buildPreviewDocument(
	html: string,
	previewHead?: string,
): string {
	const headInjection = previewHead?.trim() ? previewHead : "";
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${headInjection}</head><body>${html}</body></html>`;
}

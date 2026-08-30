/**
 * AI Rich Editor 客户端常量：默认模板、预设指令、设备档位与对话上下文上限
 */
import type { AiChatMode } from "./types";

/** 首次打开时的默认 HTML 内容片段 */
export const DEFAULT_HTML = `<style>
  .hero {
    padding: 48px 24px;
    text-align: center;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8edf2 100%);
  }
  .hero h2 { margin: 0 0 12px; font-size: 28px; }
  .hero p { margin: 0; color: #666; }
</style>
<div class="hero">
  <h2>欢迎使用 AI Rich Editor</h2>
  <p>在左侧用自然语言生成页面，中间直接编辑代码，右侧实时预览</p>
</div>`;

/** 对话上下文保留的最大轮次（超出后裁剪最旧中间轮次） */
export const CHAT_MAX_TURNS = 12;

/** 空编辑器时的提示语 */
export const EMPTY_PREVIEW_TEXT =
	"左侧让 AI 生成页面，或直接编辑中间的 HTML 代码";

/** 输入框占位文案 */
export const CHAT_INPUT_PLACEHOLDER =
	"描述你想要的页面，比如：生成一个新品发布的通稿页面…";

/** 默认 system 提示词模板（供适配方取用；{mode} 会被替换为输出形态描述） */
export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `你是"内容页 HTML 生成助手"，服务于企业新闻与活动页定制，具备资深前端与排版能力。

输出规则：
1. 输出形态：{mode}
2. 必须把结果包裹在 markdown 代码块中：先写 \`\`\`html，再写代码，最后以 \`\`\` 结束；不要在代码块外输出无关内容。
3. 样式必须自包含：CSS 一律写在 <style> 内，禁止依赖外部全局样式或外部 CSS 资源。
4. 图片用 /file/r/… 的相对占位路径，并加 HTML 注释说明用途。
5. 移动端优先、使用语义化标签、注重排版层次与可访问性（对比度、焦点可识别）。
6. 避免引入外部脚本；需要交互时以内联 <script> 自包含为主，代码保持精简。

当用户要求"修改/修复/精简/换风格"时，优先基于用户提供的当前 HTML 快照做最小化改动，最后输出改动后的完整结果。`;

/** 各形态对应的提示词片段（供适配方组装 system 用） */
export const MODE_PROMPT_DESCRIPTIONS: Record<AiChatMode, string> = {
	fragment:
		"只输出页面内容片段：即 <body> 标签内部的 HTML 内容，样式写在片段顶部 <style> 中；禁止输出 <!DOCTYPE> / <html> / <head> / <body> 外壳（预览时会自动包裹）。",
	document:
		"输出完整的 HTML 文档：以 <!DOCTYPE html> 开头，包含 <html>、<head> 中的 <meta charset>，样式与脚本内联自包含。",
};

/** 预设指令：一键生成/改写常见页面形态 */
export const PRESET_PROMPTS = [
	"生成一个产品发布会通稿页",
	"生成一个活动回顾时间线",
	"生成一个深色风格海报页",
	"生成数据卡片 / 指标墙",
	"修复预览中的布局问题",
	"精简冗余样式",
	"改成移动端适配",
] as const;

/** 预览设备档位（控制 iframe 容器宽度） */
export interface PreviewDevice {
	key: string;
	label: string;
	width: number | string;
}

export const PREVIEW_DEVICES: PreviewDevice[] = [
	{ key: "desktop", label: "桌面", width: "100%" },
	{ key: "tablet", label: "平板", width: 768 },
	{ key: "mobile", label: "手机", width: 375 },
];

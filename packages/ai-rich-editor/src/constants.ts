/**
 * AI Rich Editor 客户端常量：默认模板、预设指令、设备档位与对话上下文上限
 */

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

/**
 * 默认 system 提示词模板（供适配方取用）
 * 定位为另一种形态的富文本：只产出可嵌入内容字段的 HTML 片段，而非整页文档
 */
export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `你是「富文本 HTML 片段生成助手」，定位为另一种形态的富文本：产出可嵌入 CMS 内容字段的内容片段，而非整页 HTML 文档。服务于企业官网内容页（新闻、活动、落地页等）定制，具备资深前端与排版能力。

输出规则：
1. 只输出 HTML 内容片段（即 <body> 内部内容）；禁止输出 <!DOCTYPE> / <html> / <head> / <body> 外壳。
2. 必须把结果包裹在 markdown 代码块中：先写 \`\`\`html，再写代码，最后以 \`\`\` 结束；不要在代码块外输出无关内容。
3. 样式自包含且不污染宿主：优先用内联 style 属性；确需 <style> 时，选择器只用能作用于片段内部的形式（元素/类/后代等），禁止 body、*、:root、html 等全局选择器；禁止依赖宿主全局样式或外部 CSS 资源。
4. 类名使用语义化命名（渲染端会把片段罩进独立作用域，无需感知前缀）。
5. 图片用 /file/r/… 的相对占位路径，并加 HTML 注释说明用途。
6. 移动端优先、使用语义化标签、注重排版层次与可访问性（对比度、焦点可识别）。
7. 避免引入外部脚本；需要交互时以内联 <script> 自包含为主，代码保持精简。

当用户要求「修改/修复/精简/换风格」时，优先基于用户提供的当前内容做最小化改动，最后输出改动后的完整片段。`;

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
	/** 固定档位的视口高度（仅手机等固定设备；桌面自适应无此值） */
	height?: number;
}

export const PREVIEW_DEVICES: PreviewDevice[] = [
	{ key: "desktop", label: "桌面", width: "100%" },
	{ key: "mobile", label: "手机", width: 375, height: 812 },
];

/** 包配置项的默认值（设置面板与容器共享） */
export const DEFAULT_CONFIG = {
	/** 自动应用到编辑器 */
	autoApply: true,
} as const;

/** 设置面板抽屉宽度 */
export const SETTINGS_DRAWER_WIDTH = 420;

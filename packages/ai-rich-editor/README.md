# @fsdx/ai-rich-editor

AI 驱动的「代码编辑 + 实时预览」三栏工作台（重客户端组件）。定位为**另一种形态的富文本**：只产出可嵌入内容字段的 HTML 片段（fragment），不输出整页文档。对标仓库现有 `RichEditor`（WangEditor 传统富文本）的 AI 进化形态：由对话生成自由 HTML 片段，所见即所得预览。

## 定位与边界

| 项 | 约定 |
|----|------|
| 产物 | workspace 内部独立包，未来可完全分离（去 antd 依赖） |
| 场景 | 定制化页面（新闻、活动、落地页等）的 HTML 内容生产 |
| 输出 | **fragment-only**：只产出 HTML 内容片段，无完整文档切换 |
| 传输 | **不持有**任何 HTTP 端点/鉴权知识——对话能力经 `AiChatAdapter` 方法契约由调用方注入实现 |
| UI | antd（peer 单实例）+ tailwind 语义令牌类（宿主 `global.css` 注入，需 `@source` 扫描包源码） |
| 依赖 | peer：`antd` / `@ant-design/icons` / `monaco-editor` / `react` / `react-dom`；dep：`@monaco-editor/react` |

## 使用

```tsx
import { AiRichEditor, DEFAULT_HTML, type AiChatAdapter } from "@fsdx/ai-rich-editor";

// 1. 实现适配器（内部可走 OpenAI / 宿主 SFn / SSE / mock）
const adapter: AiChatAdapter = async function* (request, signal) {
  // 调用你的对话服务，产出协议数据单元
  yield { type: "delta", text: "<div>..." };
  yield { type: "done", model: "deepseek-chat" };
};

export function MyPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  return (
    <AiRichEditor
      value={html}
      onChange={setHtml}
      adapter={adapter}
      config={{
        notify: (type, content) => { /* 宿主消息提示 */ },
        previewHead: "<style>body{margin:0}</style>", // 注入预览 head 的附加代码
      }}
    />
  );
}
```

宿主适配示例见 app 的 `routes/admin/_admin/demo/-mods/ai-rich-editor.adapter.ts`（走 `/api/ai/html-chat` SSE）。

## 适配器契约

```ts
export type AiChatAdapter = (
  request: AiChatRequest,   // { messages, snapshot?, systemPrompt, options? }
  signal: AbortSignal,
) => AsyncIterable<AiChatChunk>;

export type AiChatChunk =
  | { type: "delta"; text: string }
  | { type: "thinking"; text: string }
  | { type: "attempt"; model: string }
  | { type: "done"; model: string; usage?: AiChatUsage }
  | { type: "error"; message: string };
```

- system 提示词由**包内生成**（可用本包导出的 `DEFAULT_SYSTEM_PROMPT_TEMPLATE` / `buildDefaultSystemPrompt`），使用方可通过 `config.systemPrompt` 覆盖。
- `stop` 即 abort signal；非流式实现也可 yield 单个 delta + done。
- 包内附通用 SSE 工具（`@fsdx/ai-rich-editor/sse`：`sseStream` / `consumeSseStream` / `extractSseFrames`），供适配器实现复用。

## 配置与设置面板

包配置项统一收拢到 `config` 属性（`adapter` / `value` / `onChange` / `height` 保持顶层），经顶栏「设置」面板编辑，**保存后生效**：

| 配置项 | 说明 | 默认 |
|--------|------|------|
| `autoApply` | AI 回复后自动应用到编辑器 | `true` |
| `systemPrompt` | 自定义 system 提示词 | 内置模板 |
| `previewHead` | 预览 `<head>` 附加代码（原始 HTML） | 空 |
| `notify` | 消息提示回调 | antd 静态提示 |

> **注意**：`config` 为**仅初始值（非受控）**——挂载后改动 `config` 不会生效；运行期请经设置面板修改（保存后即时生效），如需持久化再用 `onConfigChange` 回写宿主。

## subpath 导出

| subpath | 内容 |
|---------|------|
| `@fsdx/ai-rich-editor` | `AiRichEditor` + 协议类型（`AiChatAdapter`/`AiChatChunk`/`AiChatRequest`…）+ `useAiChat` + 默认常量与 `extractHtmlFragments`/`buildPreviewDocument` |
| `@fsdx/ai-rich-editor/sse` | 通用 SSE 帧解析与流消费（异步迭代器 + 回调两种形态） |

## 测试

`pnpm --filter @fsdx/ai-rich-editor test`。覆盖代码块提取、预览文档构建（含附加代码注入）、SSE 帧解析与流消费、`useAiChat` 流式状态机。

## 相关文档

- 组件方案与设计记录：[docs/ai-rich-editor.md](../../docs/ai-rich-editor.md)
- antd 管理端组件库：[ui-spa](../ui-spa/README.md)；纯逻辑底座：[core](../core/README.md)

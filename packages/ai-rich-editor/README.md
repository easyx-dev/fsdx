# @fsdx/ai-rich-editor

AI 驱动的「代码编辑 + 实时预览」工作台（重客户端组件）。定位为**另一种形态的富文本**：只产出可嵌入内容字段的 HTML 片段（fragment），不输出整页文档。对标仓库现有 `RichEditor`（WangEditor 传统富文本）的 AI 进化形态：由对话生成自由 HTML 片段，所见即所得预览。布局为**两栏**：左=预览区，右=AI 对话面板；「编辑器」（Monaco）为顶栏开关项，打开后在左栏与预览并排。

## 定位与边界

| 项 | 约定 |
|----|------|
| 产物 | workspace 内部独立包，未来可完全分离（去 antd 依赖） |
| 场景 | 定制化页面（新闻、活动、落地页等）的 HTML 内容生产 |
| 输出 | **fragment-only**：只产出 HTML 内容片段，无完整文档切换 |
| 传输 | **不持有**任何 HTTP 端点/鉴权知识——对话能力经宿主导入的 SSE 端点（`endpointUrl`）由 `createChatHook`（`@tanstack/ai-react/ui`，底层 `fetchServerSentEvents`）消费 |
| UI | antd（peer 单实例）+ Ant Design X（`Bubble`/`Sender`/`Welcome`/`Prompts`/`Think`）+ `@ant-design/x-markdown`（XMarkdown）+ tailwind 语义令牌类（宿主 `global.css` 注入，需 `@source` 扫描包源码） |
| 依赖 | peer：`antd` / `@ant-design/icons` / `monaco-editor` / `react` / `react-dom`；dep：`@monaco-editor/react`、`@tanstack/ai-react`、`@ant-design/x`、`@ant-design/x-markdown` |

## 使用

```tsx
import { AiRichEditor, DEFAULT_HTML } from "@fsdx/ai-rich-editor";

export function MyPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  return (
    <AiRichEditor
      value={html}
      onChange={setHtml}
      endpointUrl="/api/ai-chat" // 宿主提供的流式 SSE 端点（TanStack AI createChatHook 消费）
      config={{
        notify: (type, content) => { /* 宿主消息提示 */ },
        previewHead: "<style>body{margin:0}</style>", // 注入预览 head 的附加代码
      }}
    />
  );
}
```

宿主需提供对接 TanStack AI 的 SSE 端点（服务端用 `chat()` + `toServerSentEventsResponse`）。app 内示例见 `routes/api/ai-chat.tsx`；demo 页 `routes/admin/_admin/demo/ai-rich-editor.tsx`。

## 对话契约

- 对话区数据流基于 TanStack AI **headless UI**：`createChatHook` 在模块作用域注册 `components`（`layout`/`message`/`input`）与 `partsComponents`（`text`/`thinking`/`fallback`），`fetchServerSentEvents` 消费宿主 SSE 端点。服务端用 `chat()` + `toServerSentEventsResponse` 对接到 TanStack AI 标准 SSE。
- **渲染侧**使用 Ant Design X：消息 → `Bubble`（user 填充 / assistant 无边框）、输入 → `Sender`（内置发送/停止/Enter）、空态 → `Welcome` + `Prompts`、思考 → `Think`、错误 → antd `Alert`；对话面板头部含「AI 助手」+「新会话」。数据流与 UI 组件解耦（TanStack AI 只喂数据，Ant Design X 负责外观）。
- `UIMessage.parts` 由 `partsComponents` 自动分发：`text` part → `MarkdownContent`（基于 `@ant-design/x-markdown` 的 `XMarkdown`，含 ```html 代码块「应用到编辑器」）；`thinking` part → `Think`（流式「思考中…/已思考」）。
- system 提示词由**包内生成**（`DEFAULT_SYSTEM_PROMPT_TEMPLATE` / `buildDefaultSystemPrompt`），经 `config.systemPrompt` 覆盖；随每次发送由 `sendMessage(text, { body: { ...requestMeta, systemPrompt } })` 透传给服务端（`forwardedProps.systemPrompt` / `providerId` 等）。
- `stop` 即中止当前生成；`clear` / `新会话` 清空对话；`autoApply` 在流结束（`onFinish`）后自动应用回复中的 HTML 代码块。

## 配置与设置面板

包配置项统一收拢到 `config` 属性（`endpointUrl` / `value` / `onChange` / `height` 保持顶层），经顶栏「设置」面板编辑，**保存后生效**：

| 配置项 | 说明 | 默认 |
|--------|------|------|
| `autoApply` | AI 回复后自动应用到编辑器 | `true` |
| `systemPrompt` | 自定义 system 提示词 | 内置模板 |
| `previewHead` | 预览 `<head>` 附加代码（原始 HTML） | 空 |
| `notify` | 消息提示回调 | antd 静态提示 |

> **注意**：`config` 为**仅初始值（非受控）**——挂载后改动 `config` 不会生效；运行期请经设置面板修改（保存后即时生效），如需持久化再用 `onConfigChange` 回写宿主。

## 导出

| 导出 | 内容 |
|------|------|
| `@fsdx/ai-rich-editor` | `AiRichEditor` + 默认常量与 `extractHtmlFragments`/`buildPreviewDocument` + `buildDefaultSystemPrompt` |

> 对话区基于 `createChatHook` 在包内 `src/chat/ChatProvider.tsx` 一次性绑定，宿主无需感知其内部组件结构。

## 测试

`pnpm --filter @fsdx/ai-rich-editor test`。覆盖代码块提取/预览文档构建（含附加代码注入）、`MarkdownContent`（XMarkdown 文本/```html 代码块「应用到编辑器」/空回复占位）。

## 相关文档

- 组件方案与设计记录：[docs/ai-rich-editor.md](../../docs/ai-rich-editor.md)
- antd 管理端组件库：[ui-spa](../ui-spa/README.md)；纯逻辑底座：[core](../core/README.md)

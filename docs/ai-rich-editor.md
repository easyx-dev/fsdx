# AI Rich Editor（`@fsdx/ai-rich-editor`）

> 定位：平台组件类 · 人类阅读
> 单一事实来源：`packages/ai-rich-editor/src/`（以代码为准）
> 引用关系：← AGENTS「组件约定」分类；→ 被 app 管理端 `/admin/demo/ai-rich-editor` 演示路由引用
> 更新触发：组件 API、对话契约（endpointUrl / createChatHook）、配置项（config/设置面板）变更时

## 定位与边界

AI 驱动「代码编辑 + 实时预览」三栏工作台，是**另一种形态的富文本**：

- 产物是**可嵌入 CMS 内容字段的 HTML 片段**（fragment），**不输出**整页 HTML 文档（无 `mode` 概念）。
- 场景：企业官网内容页（新闻、活动、落地页）的 HTML 内容生产。
- **不持有**任何 HTTP 端点/鉴权知识——对话能力经宿主导入的 SSE 端点（`endpointUrl`）由 `createChatHook`（`@tanstack/ai-react/ui`，底层 `fetchServerSentEvents`）消费。
- UI：antd（peer 单实例）+ tailwind 语义令牌类（宿主 `global.css` 注入，需 `@source` 扫描包源码）。

## 三栏结构

顶栏 + antd `Splitter`（水平拖拽分割）：左（AI 对话面板）｜中（Monaco 代码编辑）｜右（iframe 实时预览）。

- 顶栏：复制、**设置**（下拉：对话/预览面板显隐开关联动 Splitter + 「更多配置」打开设置面板）。
- 左栏 headless 对话区：由 `Splitter.Panel` 承载（默认 300，min 220 / max 480，随 `showChat` 显隐）；`src/chat/ChatProvider.tsx` 用 `createChatHook` 注册 `components`（`layout`/`message`/`input`）与 `partsComponents`（`text`/`thinking`/`fallback`）驱动的预设指令 + 消息列表 + 输入区。
- 中栏 `EditorPanel`：自适应面板；Monaco 懒加载（`editor.api` + 仅 html/css/js 词法高亮，无语言服务/worker，本地打包），主题亮暗跟随宿主 `data-theme`。
- 右栏 `PreviewPanel`：由 `Splitter.Panel` 承载（默认 440，min 300 / max 1200，随 `showPreview` 显隐）；自带头部（设备档位 Segmented、脚本开关、刷新、**新窗口预览**按钮）；桌面拉伸预览（无壳），手机为固定尺寸设备框（375×812，按舞台等比缩放）；iframe sandbox 渲染 `srcDoc`，片段包裹 + 附加代码注入。

## 对话契约（基于 TanStack AI headless UI）

- 对话区基于 `createChatHook`（`@tanstack/ai-react/ui`）：包内在模块作用域一次性绑定 `components`（`layout`/`message`/`input`）与 `partsComponents`（`text`/`thinking`/`fallback`），`fetchServerSentEvents` 消费宿主 SSE 端点（`endpointUrl`），服务端用 `chat()` + `toServerSentEventsResponse` 对接到 TanStack AI 标准 SSE。app 内示例为 `routes/api/ai-chat.tsx`。
- `UIMessage.parts` 由 `partsComponents` 自动分发，不再映射为包内 `ChatTurn`：`text` part → `MarkdownContent`（含代码块「应用到编辑器」）；`thinking` part → `ThinkingBubble`（流式「思考中…/已思考 (N 字)」）。
- system 提示词由包内生成（`buildDefaultSystemPrompt`），使用方可通过 `config.systemPrompt` 覆盖；随每次发送经 `sendMessage(text, { body: { ...requestMeta, systemPrompt } })` 透传为 `forwardedProps.systemPrompt` / `providerId` 等。
- `stop` 中止当前生成（AbortController）；`clear` 清空对话；`autoApply` 在流结束（`onFinish`）后自动应用回复中的 HTML 代码块。

## 统一配置与设置面板

包配置项收拢到单一 `config` 属性（`AiRichEditorConfig`），`endpointUrl`、`value/onChange`、`height` 保持顶层：

| 配置项 | 说明 | 默认 |
|--------|------|------|
| `autoApply` | AI 回复后是否自动应用到编辑器 | `true` |
| `systemPrompt` | 自定义 system 提示词（缺省用内置模板） | 内置 |
| `previewHead` | 预览 `<head>` 附加代码（原始 HTML 片段，如内置 `<style>`/`<script>`） | 空 |
| `notify` | 消息提示回调（设置面板只读展示） | antd 静态提示 |

- `config` 作为**初始值**；运行时变更经**设置面板**（顶栏齿轮 → antd 抽屉）编辑，**保存后生效**并触发 `onConfigChange`（可选，用于宿主持久化）。
- 预览文档由 `buildPreviewDocument(fragment, previewHead?)` 构建：片段模式包裹最小外壳，`previewHead` 原样注入 `<head>`。

## 对话状态（createChatHook）

- `sendMessage(text, { body })` 由 `components.input`/`layout` 的预设指令与输入区调用，body 合并 `requestMeta` 与 `systemPrompt`。
- 流式中的生成中消息直接存在于 `messages`（末条 assistant 的 text/thinking parts 逐字增长），`message`/`parts` 组件持续渲染，无需再单独拆流出「流式占位气泡」。
- `onFinish`（`options`）读取模块级 `onCompleteRef` 触发 `handleAiComplete`（autoApply 应用编辑器）；`error` 暴露错误信息。
- `stop`/`clear` 映射到 `useChat.stop`/`useChat.setMessages([])`。
- 模块级 ref 注入：`endpointUrlRef`（`fetchServerSentEvents(函数形式)`）与 `onCompleteRef`；`systemPrompt`/`requestMeta`/`onApplyHtml` 经 `EditorCfgContext` 注入（单实例假设：编辑器一页一个）。

## 预览沙箱

`iframe` 使用 `sandbox` 隔离；默认允许脚本（受信编辑器环境）时 `allow-scripts allow-same-origin`（后者用于加载 `/file/r/` 资源），脚本可在顶栏关闭。

## 演进记录

- 初始：三栏工作台 + `fragment/document` 输出形态切换。
- 本次优化：定位收敛为 fragment-only（去 `mode`）、提示词重写、新增 `previewHead` 附加代码注入、配置归拢 `config` + 设置面板、Monaco 本地打包、主题暗色联动、测试与文档补齐。
- 本次迁移：对话传输从自定义 `AiChatAdapter`/SSE 帧协议改为基于 TanStack AI 的 `useChat` + 标准 SSE（`endpointUrl`），删除 `/sse` 子路径与 `AiChatChunk` 协议。
- 本次重构：对话区 UI 改为 `@tanstack/ai-react/ui` 的 `createChatHook`（headless，组件注册 `components`/`partsComponents`），移除 `useAiChat`/`ChatPanel`/`ChatTurn`；配套升级 `@tanstack/ai-react@^0.23.0`、`@tanstack/ai@^0.52.2`。

# AI Rich Editor（`@fsdx/ai-rich-editor`）

> 定位：平台组件类 · 人类阅读
> 单一事实来源：`packages/ai-rich-editor/src/`（以代码为准）
> 引用关系：← AGENTS「组件约定」分类；→ 被 app 管理端 `/admin/demo/ai-rich-editor` 演示路由引用；产物为**自带 scope 前缀**的 HTML 片段，使用端直接当 HTML 引入（`dangerouslySetInnerHTML`）即可防全局污染，无需任何端侧组件
> 更新触发：组件 API、对话契约（endpointUrl / createChatHook）、配置项（config/设置面板）、样式作用域化（rich-content 子路径）变更时

## 定位与边界

AI 驱动「代码编辑 + 实时预览」三栏工作台，是**另一种形态的富文本**：

- 产物是**可嵌入 CMS 内容字段的 HTML 片段**（fragment），**不输出**整页 HTML 文档（无 `mode` 概念）。
- 场景：企业官网内容页（新闻、活动、落地页）的 HTML 内容生产。
- **不持有**任何 HTTP 端点/鉴权知识——对话能力经宿主导入的 SSE 端点（`endpointUrl`）由 `createChatHook`（`@tanstack/ai-react/ui`，底层 `fetchServerSentEvents`）消费。
- UI：antd（peer 单实例）+ tailwind 语义令牌类（宿主 `global.css` 注入，需 `@source` 扫描包源码）。

## 两栏结构

顶栏 + antd `Splitter`（水平拖拽分割）：左（预览区，可选编辑器）｜右（AI 对话面板，min 400 / max 600）。

- 顶栏：预览控件「设备档位 Segmented / 脚本开关 / 刷新 / 新窗口预览」+ **编辑器**开关（打开后在左栏与预览并排）+ 复制 + **设置**（下拉「更多配置」打开设置面板）。
- 左栏：默认整个区域为 `PreviewPanel`（带背景色与内边距的内容卡片，iframe 实时预览）；顶栏开启「编辑器」后，左栏变为 `[EditorPanel (Monaco) | PreviewPanel]` 内层横向 `Splitter`。
- 右栏：AI 对话面板（默认 420，min 400 / max 600），头部为「AI 助手」+「新会话」，`src/chat/ChatProvider.tsx` 用 `createChatHook` 注册 `components`（`layout`/`message`/`input`）与 `partsComponents`（`text`/`thinking`/`fallback`），渲染用 Ant Design X（`Bubble`/`Sender`/`Welcome`/`Prompts`/`Think`）驱动预设指令 + 消息列表 + 输入区。
- 中栏 `EditorPanel`：Monaco 懒加载（`editor.api` + 仅 html/css/js 词法高亮，无语言服务/worker，本地打包），主题亮暗跟随宿主 `data-theme`；随顶栏开关显隐。
- `PreviewPanel`：自身不含头部控制条（控件在主顶栏）；内容卡片桌面拉伸、手机为固定尺寸设备框（375×812，按舞台等比缩放）；外层带 `bg-background-secondary` 背景与 `p-6` 内边距；iframe sandbox 渲染 `srcDoc`，片段包裹 + 附加代码注入。

## 对话契约（基于 TanStack AI headless UI + Ant Design X）

- 对话区数据流基于 `createChatHook`（`@tanstack/ai-react/ui`）：包内在模块作用域一次性绑定 `components`（`layout`/`message`/`input`）与 `partsComponents`（`text`/`thinking`/`fallback`），`fetchServerSentEvents` 消费宿主 SSE 端点（`endpointUrl`），服务端用 `chat()` + `toServerSentEventsResponse` 对接到 TanStack AI 标准 SSE。app 内示例为 `routes/api/ai-chat.tsx`。
- **渲染侧**用 Ant Design X：`Bubble`（消息）、`Sender`（输入）、`Welcome`+`Prompts`（空态）、`Think`（思考）、`Alert`（错误）。TanStack AI 只提供数据（`messages`/`sendMessage`/`stop`/`isLoading`/`error`），外观由 Ant Design X 负责；两者通过模块作用域 `createChatHook` 绑定解耦。
- `UIMessage.parts` 由 `partsComponents` 自动分发，不再映射为包内 `ChatTurn`：`text` part → `MarkdownContent`（基于 `@ant-design/x-markdown` 的 `XMarkdown`，含 ```html 代码块「应用到编辑器」）；`thinking` part → `Think`（流式「思考中…/已思考」）。
- system 提示词由包内生成（`buildDefaultSystemPrompt`），使用方可通过 `config.systemPrompt` 覆盖；随每次发送经 `sendMessage(text, { body: { ...requestMeta, systemPrompt } })` 透传为 `forwardedProps.systemPrompt` / `providerId` 等。
- `stop` 中止当前生成（AbortController）；`clear` / 「新会话」清空对话；`autoApply` 在流结束（`onFinish`）后自动应用回复中的 HTML 代码块。

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

> 安全边界：`allow-scripts` + `allow-same-origin` 组合会使 iframe 内容与宿主同源、获得 `parent.document` 写权（OWASP 反模式）。当前保留 `allow-same-origin` 是为在预览内加载同源 `/file/r/` 资源，二者不可兼得，故以「受信编辑器产物」为前提，宿主仅在内置 admin 工作台使用，勿把该 mode 用于不可信内容。

## 样式作用域化（应用时刻，防全局污染）

AI 生成的 fragment 顶层常带 `<style>` 全局选择器（如 `.hero`），若直接注入宿主正文 DOM 会污染全局（覆盖同名类、泄漏 `body`/`*` 等）。治理收敛在**包内「应用到编辑器」时刻**，使用端零处理：

- **源头约束**（`DEFAULT_SYSTEM_PROMPT_TEMPLATE`）：要求内联样式优先；确需 `<style>` 时仅用可作用于片段内部的选择器，禁用 `body`/`*`/`:root`/`html`；类名语义化。
- **应用时刻作用域化**：`handleApplyHtml`（手动「应用到编辑器」）与 `handleAiComplete`（`autoApply`）在把提取到的 HTML 代码块写入 `value` 前，调用包内 `scopedRichContent`：给片段根注入**实例级唯一前缀**（编辑器实例创建时 `generateScopePrefix` 生成一次并一直沿用，多次应用/修改不变）并把 `<style>` 内选择器改写为 `.{prefix} …`，只在该片段根内生效；内联样式天然隔离。产物形如 `<div class="rich-content-<会话前缀>"><style>.rich-content-<会话前缀> .hero{…}</style><div class="hero">…</div></div>`。
- **使用端零负担**：产物本身即「内联 + scope 前缀」的 HTML，宿主直接 `dangerouslySetInnerHTML` 引入即可，无需任何组件/包裹/传参。
- **预览一致**：`PreviewPanel` 的 iframe 与顶栏「新窗口预览」直接使用该 `value`，所见即所得（初始占位片段为演示值，未 scoped；正式内容经「应用到编辑器」产出）。

> 兼容性与局限：`<style>` 选择器改写为零依赖轻量实现，覆盖常见选择器（元素/类/后代/`@media`/`@supports` 内层）与 `@keyframes`/`@font-face` 原样保留；CSS 原生嵌套规则（规则体嵌套规则）不做嵌套前缀，README 已注明。

## 演进记录

- 初始：三栏工作台 + `fragment/document` 输出形态切换。
- 本次优化：定位收敛为 fragment-only（去 `mode`）、提示词重写、新增 `previewHead` 附加代码注入、配置归拢 `config` + 设置面板、Monaco 本地打包、主题暗色联动、测试与文档补齐。
- 本次迁移：对话传输从自定义 `AiChatAdapter`/SSE 帧协议改为基于 TanStack AI 的 `useChat` + 标准 SSE（`endpointUrl`），删除 `/sse` 子路径与 `AiChatChunk` 协议。
- 本次重构：对话区 UI 改为 `@tanstack/ai-react/ui` 的 `createChatHook`（headless，组件注册 `components`/`partsComponents`），移除 `useAiChat`/`ChatPanel`/`ChatTurn`；配套升级 `@tanstack/ai-react@^0.23.0`、`@tanstack/ai@^0.52.2`。
- 本次 UI 迁移：对话区改用 Ant Design X（`Bubble`/`Sender`/`Welcome`/`Prompts`/`Think`），消息渲染改用 `@ant-design/x-markdown` 的 `XMarkdown`（替换 react-markdown + `splitContentBlocks`）；布局由三栏改为两栏（左=预览、右=AI 对话面板，min 400 / max 600），编辑器改为顶栏开关（打开后与预览并排）；移除 `ThinkingBubble` 导出。
- 本次防污染：包内新增 `utils/scope.ts`（`scopedRichContent`），在「应用到编辑器」/`autoApply` 时刻把片段 `<style>` 选择器作用域化（默认前缀 `rich-content-<随机>`），产物自带 scope 前缀，使用端直接当 HTML 引入即不污染全局；prompt 收紧为内联优先 + 禁用全局选择器；预览 iframe / 新窗口直接使用该 `value`。

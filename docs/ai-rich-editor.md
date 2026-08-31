# AI Rich Editor（`@fsdx/ai-rich-editor`）

> 定位：平台组件类 · 人类阅读
> 单一事实来源：`packages/ai-rich-editor/src/`（以代码为准）
> 引用关系：← AGENTS「组件约定」分类；→ 被 app 管理端 `/admin/demo/ai-rich-editor` 演示路由引用
> 更新触发：组件 API、协议（AiChatAdapter/Chunk）、配置项（config/设置面板）变更时

## 定位与边界

AI 驱动「代码编辑 + 实时预览」三栏工作台，是**另一种形态的富文本**：

- 产物是**可嵌入 CMS 内容字段的 HTML 片段**（fragment），**不输出**整页 HTML 文档（无 `mode` 概念）。
- 场景：企业官网内容页（新闻、活动、落地页）的 HTML 内容生产。
- **不持有**任何 HTTP 端点/鉴权知识——对话能力经 `AiChatAdapter` 方法契约由调用方注入实现。
- UI：antd（peer 单实例）+ tailwind 语义令牌类（宿主 `global.css` 注入，需 `@source` 扫描包源码）。

## 三栏结构

顶栏 + antd `Splitter`（水平拖拽分割）：左（AI 对话面板）｜中（Monaco 代码编辑）｜右（iframe 实时预览）。

- 顶栏：复制、**设置**（下拉：对话/预览面板显隐开关联动 Splitter + 「更多配置」打开设置面板）。
- 左栏 `ChatPanel`：由 `Splitter.Panel` 承载（默认 300，min 220 / max 480，随 `showChat` 显隐）；预设指令 + 消息列表 + 流式气泡 + 输入区；消费 `useAiChat` controller。
- 中栏 `EditorPanel`：自适应面板；Monaco 懒加载（`editor.api` + 仅 html/css/js 词法高亮，无语言服务/worker，本地打包），主题亮暗跟随宿主 `data-theme`。
- 右栏 `PreviewPanel`：由 `Splitter.Panel` 承载（默认 440，min 300 / max 1200，随 `showPreview` 显隐）；自带头部（设备档位 Segmented、脚本开关、刷新、**新窗口预览**按钮）；桌面拉伸预览（无壳），手机为固定尺寸设备框（375×812，按舞台等比缩放）；iframe sandbox 渲染 `srcDoc`，片段包裹 + 附加代码注入。

## 协议与适配器契约

- `AiChatAdapter(request, signal) => AsyncIterable<AiChatChunk>`：由适配方实现，天然支持流式与 abort。
- chunk：`delta`（正文）、`thinking`（推理）、`attempt`（deep→fast 降级）、`done`（model/usage）、`error`。
- system 提示词由包内生成（`buildDefaultSystemPrompt`），使用方可通过 `config.systemPrompt` 覆盖。
- subpath `@fsdx/ai-rich-editor/sse`：通用 SSE 帧解析与流消费，供适配器实现复用。

## 统一配置与设置面板

包配置项收拢到单一 `config` 属性（`AiRichEditorConfig`），`adapter`、`value/onChange`、`height` 保持顶层：

| 配置项 | 说明 | 默认 |
|--------|------|------|
| `autoApply` | AI 回复后是否自动应用到编辑器 | `true` |
| `systemPrompt` | 自定义 system 提示词（缺省用内置模板） | 内置 |
| `previewHead` | 预览 `<head>` 附加代码（原始 HTML 片段，如内置 `<style>`/`<script>`） | 空 |
| `notify` | 消息提示回调（设置面板只读展示） | antd 静态提示 |

- `config` 作为**初始值**；运行时变更经**设置面板**（顶栏齿轮 → antd 抽屉）编辑，**保存后生效**并触发 `onConfigChange`（可选，用于宿主持久化）。
- 预览文档由 `buildPreviewDocument(fragment, previewHead?)` 构建：片段模式包裹最小外壳，`previewHead` 原样注入 `<head>`。

## 对话状态机（`useAiChat`）

发送 → 裁剪历史（保留最近 `CHAT_MAX_TURNS` 轮）→ 消费 AsyncIterable：

- `thinking`/`delta` 累积（delta 走打字机节流逐字推进）。
- `attempt`（deep→fast 降级）清空已输出的正文与思考，避免残文混入。
- `done` 记录 model/usage；`error` 暴露错误。
- 流正常结束且无 error：保存 assistant 消息（含 thinking），触发 `onComplete`（自动应用编辑器）。
- `stop`/`clear` 通过 AbortSignal 中止；clear 触发的中止不残留错误提示。

## 预览沙箱

`iframe` 使用 `sandbox` 隔离；默认允许脚本（受信编辑器环境）时 `allow-scripts allow-same-origin`（后者用于加载 `/file/r/` 资源），脚本可在顶栏关闭。

## 演进记录

- 初始：三栏工作台 + `fragment/document` 输出形态切换。
- 本次优化：定位收敛为 fragment-only（去 `mode`）、提示词重写、新增 `previewHead` 附加代码注入、配置归拢 `config` + 设置面板、Monaco 本地打包、主题暗色联动、测试与文档补齐。

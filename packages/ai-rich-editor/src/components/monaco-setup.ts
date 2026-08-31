/**
 * Monaco 本地打包配置：仅启用 html/css/js 词法高亮（Monarch tokenizer，无需 web worker）
 * 用 editor.api（完整编辑器内核）+ 三个语言 register 替代默认整包 `monaco-editor`，
 * 规避 CDN 依赖、去掉语言服务/worker，显著缩包
 */

import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";

// 配置 loader 使用本地打包的 monaco-editor，而非默认 CDN
loader.config({ monaco });

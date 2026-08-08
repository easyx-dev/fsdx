# @fsdx/ui-spa

antd 管理端组件库，面向数据密集型后台场景（表单、表格、上传、编辑器）。antd 为 peerDependency，宿主应用提供唯一实例。

## 定位与边界

| 项 | 约定 |
|----|------|
| 使用场景 | 管理端 `/admin/*` 页面 |
| antd 单实例 | antd 声明为 peerDependency，宿主提供唯一实例；`antd-static` 桥接必须在宿主 `<App>` 上下文内工作，双实例会导致 message/modal 脱离 ConfigProvider |
| 样式 | 直角风格（`borderRadius: 0`）、统一语义令牌（`--s-*`），同 AGENTS.md 视觉约定 |
| 依赖 | `@fsdx/core`、`@monaco-editor/react`；peer：`antd` / `@ant-design/icons` / `@tanstack/react-router` / `dayjs` / `monaco-editor` / `@wangeditor/editor` / `@wangeditor/editor-for-react` |
| 测试 | 无独立测试脚本 |

## subpath 导出

| subpath | 内容 | 关键导出 |
|---------|------|----------|
| `@fsdx/ui-spa/antd-static` | antd 静态方法桥接 | `AntdStaticBridge`（挂载于宿主 `<App>` 内，从 `App.useApp()` 捕获实例）、`message` / `modal` / `notification`（未挂载即调用会抛错） |
| `@fsdx/ui-spa/table` | 表格 | `ProTable`（`ProColumnType` / `ProTableProps`，增强 antd Table）、`TableOperate`（操作列容器：`Edit` / `Delete` / `Link` / `Custom`，按钮统一「图标 + 文字」风格） |
| `@fsdx/ui-spa/upload` | 上传 | `FileUpload`（`UploadFileFn` / `UploadResult`，上传/文件库/下载回调注入）、`ImageUpload`、`PhotoWall`（`ImageItem`）、`SelectFileModal`（`FetchFiles` / `SelectableFile` / `acceptToMimePrefix` / `formatSize`）、`renderUploadItem` |
| `@fsdx/ui-spa/editor` | 编辑器 | `CodeEditor`（Monaco）、`RichEditor`（WangEditor 5，`valueType` 对接 `EditorType`） |
| `@fsdx/ui-spa/permission-tags` | 权限展示 | `PermissionTags`（通配符优先排序、绿色标识、超 `maxVisible` 折叠，元信息由宿主传入 `PermissionMetaMap`） |
| `@fsdx/ui-spa/json-import-button` | JSON 导入 | `JsonImportButton`（弹窗 + 拖拽 + JSON 编辑器预览，`onImport` 回调） |
| `@fsdx/ui-spa/ms-input` | 时长输入 | `MSInput`（以 `"30s"` / `"10min"` / `"1d"` 展示、以毫秒值提交，`min` / `max` / `allowZero` 约束，复用 `@fsdx/core/ms`） |
| `@fsdx/ui-spa/sfn-helpers` | SFn 调用辅助 | `safeSfnCall(promise, fallbackMsg?)`（自动 `message.error` 并继续抛出）、`unwrapSfn(...)`（返回 `[data, null] | [null, error]`） |

## 使用约束

1. **禁止静态 `import { message } from "antd"`**：antd 静态函数会创建独立 React root，脱离 `<StyleProvider layer>` 与 ConfigProvider 主题（暗色算法、品牌色不生效，且未分层样式会压制 `@layer`）。`message` / `modal` / `notification` 统一从 `@fsdx/ui-spa/antd-static` 导入。
2. **调用时机**：`AntdStaticBridge` 实例在 `<App>` 挂载后才捕获，调用必须发生在渲染完成后的交互/副作用（事件处理、useEffect）中；路由 loader / beforeLoad 等早于 App 挂载阶段调用会抛错（宁抛错不静默）。
3. **宿主集成**：上传与文件库组件不直接调 SFn，由宿主注入回调（如 `uploadFileSFn` / `getFileListSFn`）。

## 相关文档

- 纯逻辑底座：[@fsdx/core](../core/README.md)
- shadcn 前台组件库：[@fsdx/ui-ssr](../ui-ssr/README.md)
- 应用层架构、组件选型与视觉令牌约定：[docs/architecture-overview.md](../../docs/architecture-overview.md)、[AGENTS.md](../../AGENTS.md)

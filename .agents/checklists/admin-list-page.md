# 管理端列表页验收清单

> 用途：新增或改造管理端列表页时逐项自查。规范本体见 [docs/admin-list-page.md](../../docs/admin-list-page.md)，规则见 [AGENTS.md](../../AGENTS.md)「表格操作列」「表格列规范」。
> 用法：改完列表页后逐条勾选，不适用的条目注明原因。

## 骨架与布局

- [ ] 页面用 `AdminListPage`（而非手写 `AdminPageContent`）组织标题栏 / 看板 / 工具条 / 表格区域
- [ ] 主操作（新建等）放 `extra`（标题栏右侧，固定可见）
- [ ] 筛选项放 `AdminTableToolbar` 左侧，导出 / 批量等次要操作放 `extra`
- [ ] 有筛选条件时才传 `onReset`，重置后清空所有条件并回到第 1 页
- [ ] 页面没有残留的手写 `marginBottom` / `display:flex` 间距结构

## 查询状态

- [ ] 用 `useListQuery`，首屏数据来自路由 loader
- [ ] `fetcher` 用 `useCallback` 包裹且依赖为空
- [ ] ProTable 只接 `loading` / `onChange={list.onTableChange}` / `pagination={list.pagination}`
- [ ] **没有** `pagination.onChange`（与 `Table.onChange` 并存会双请求、翻页失效）
- [ ] 没有 `useEffect` 自动拉取列表
- [ ] 增删改 / 内联更新后调用 `list.reload()`
- [ ] 筛选变更走 `list.applyFilters(...)`（自动回第 1 页）
- [ ] 「点查询才请求」的页面（日志 / 埋点）保留显式查询按钮，未把输入框 `onChange` 直接接上查询

## 服务端契约

- [ ] 列表 schema 以 `listSchema` 为基座 `.extend({ ...业务筛选 })`，命名为 `<模块>ListSchema`
- [ ] `pageSize` 从入参透传到服务层（未硬编码 `pageSize: 20`）
- [ ] 排序字段在服务层 `buildSortClause` 白名单内，默认排序写在服务层
- [ ] 单字段变更各配独立 SFn（`updateXxxSortSFn` / `setXxxPublishedSFn` / 标签等）+ `logCrud` 审计
- [ ] 未复用整表更新充当单字段更新

## 列规范

- [ ] 图片 / 封面列在表格最前，用 `ImageCell`
- [ ] 时间列用 `valueType: "dateTimeMinute"`（或 `"dateTime"`），无手写 `dayjs().format`；可空时间列带 `emptyText: "—"`
- [ ] 可排序列用 `...list.sortProps("字段名")`，`dataIndex` 与服务端字段名一致
- [ ] 状态列按形态选组件（`PublishSwitchCell` / `StatusTag` / 字典驱动用 `DictTag` / `Select`）；无自选 Tag 颜色
- [ ] 字节 / 体积列用 `formatBytes`
- [ ] 内联编辑列（`SortOrderCell` / `PublishSwitchCell`）未加 `ellipsis` / `copyable`

## 操作列

- [ ] 用 `TableOperate` 包裹，按钮统一「图标 + 文字」
- [ ] 操作数 ≤ 5，超出用「更多」折叠
- [ ] 操作列显式声明 `width`（2 项 160 / 3 项 240 / 4 项 320 / 5 项 400）
- [ ] `scroll.x` ≥ 各列宽度之和（含操作列）
- [ ] `TableOperate.Delete` 的 `onConfirm` 传 `() => onDelete(record)`，内部用 `sfnUnwrap` 不抛错，无本地 `message.error` 捕获
- [ ] 无权限的操作用 `disabled` + `disabledReason`（未隐藏按钮）
- [ ] 上下架 / 排序等通用态未重复出现在操作列

## 弹层

- [ ] 新建 / 编辑用 `AdminFormDrawer`（或既有 Modal），无 `create.tsx` / `$id/edit.tsx` 路由页
- [ ] 表单组件以可选 `formId` / `hideActions` / `onSubmittingChange` 配合抽屉
- [ ] 单字段快速修改（标签等）用 Modal 或单元格内联编辑，未为此开抽屉

## 兜底

- [ ] `pnpm check` 通过（`tsc --noEmit` + Biome）
- [ ] 列表相关单测通过，新增 schema / 服务函数有覆盖
- [ ] 手工冒烟：翻页、每页条数、排序、内联编辑、抽屉新建 / 编辑、权限置灰

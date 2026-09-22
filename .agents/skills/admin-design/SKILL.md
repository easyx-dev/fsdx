---
name: admin-design
description: >
  管理端 UI 设计规范（布局骨架 / 页头三段式 / 表格列与列宽预算 / 操作列 /
  筛选落点 / 弹窗与抽屉 / 表单 / 状态与反馈 / 分析页）。当新增或改造 /admin
  页面、调整表格列、加筛选、写弹窗抽屉与表单时触发。
  ——模块生成流程见 admin-crud skill；视觉令牌见 AGENTS.md「视觉风格与主题约定」。
---

# 管理端设计规范

## 0. 适用范围

- **规则本体在本文件**（尺寸档位、决策表、禁令）；机制与实测依据见 [docs/admin-design.md](../../../docs/admin-design.md)；验收见 [checklists/admin-design.md](../../checklists/admin-design.md)
- 尺寸基准：1440×900 视口 → 侧边栏 200 + **标题栏 56 高 / 1240 宽** → 内容区 `p-5` → **表格可用宽 1199**
- 本文件出现的所有数值都是硬约束，页面不得各写一套

## 1. 布局骨架

### 1.1 页头三段式（一页一行 chrome）

```
┌ 标题栏 ─ 高 56px ────────────────────────────────────────────────────┐
│ 标题（说明走 Tooltip）  [筛选段 ← 左起紧贴标题，flex-1]   [操作段 → 右] │
└──────────────────────────────────────────────────────────────────────┘
表格（占满剩余高度，表体内部滚动）
```

- **标题段**：只有标题（`max-width: 300px` 内省略）；页面说明一律走 `description`，**以 Tooltip 在悬停标题时显示**（`AdminPageContent` 统一处理，`mouseEnterDelay: 0.3`），不占标题栏第二行——实时计数等动态说明同样放这里（如「当前 27 项」「当前 用户状态（2 条）」）
- **筛选段**（`AdminListPage` 的 `filters` → `AdminPageContent.titleTrailing`）：左对齐、`gap: 12px`，放搜索 / 状态快筛 / 分类 Select / 日期范围
- **操作段**（`extra`）：`ml-auto` 右对齐；**主操作（`type="primary"`）最多 1 个且放最后**，次要操作 ≤2 个，其余收进「更多 ▾」
- **禁止独立筛选行**：页面级工具条已删除（`AdminTableToolbar` 不再存在），筛选与操作一律进页头
- **放不下时**：用 `AdminFilters` 的 `more` 收进「筛选 ▾」浮层（`AdminFilterItem` 提供标签），**不得**新增第二行
- **显式查询页**：`查询`(primary) + `重置` 由 `AdminFilters` 渲染，紧跟筛选段末尾（**不靠右、不与筛选分置两端**）

```tsx
<AdminListPage
  title="埋点事件查询"
  description="查询和分析客户端上报的埋点事件数据"
  filters={
    <AdminFilters onQuery={handleSearch} onReset={handleReset} moreCount={1} more={
      <AdminFilterItem label="触发时间"><RangePicker className="w-full" /></AdminFilterItem>
    }>
      <Select placeholder="事件名称" style={{ width: 160 }} />
      <Input placeholder="关键词搜索" style={{ width: 240 }} />
    </AdminFilters>
  }
  extra={<><Button icon={<DownloadOutlined />}>导出 CSV</Button><Button>刷新</Button></>}
>
```

### 1.2 区块与间距

- 表格**直接挂在页头下**；仅当存在「必须常驻的页面级工具」时才用 `stats` 区块（当前仅文件管理的双路上传区）
- 区块间距 16px、控件间距 12px、卡片内边距 16px
- 内容区高度 `calc(100vh - 56px)` 内部滚动；**表体高度由骨架实测注入**，禁止各页手写 `scroll.y`
- 空态用 `locale={{ emptyText: "…" }}`（中文），禁止 antd 默认英文空态

## 2. 筛选与查询

### 2.1 即时筛选 vs 显式查询

- **即时筛选**：筛选控件 `onChange` 即 `applyFilters`（管理端 CRUD 列表默认）
- **显式查询**：重查询页面（运行日志 / 操作日志 / 埋点事件查询 / 分析页）保留「查询」按钮，输入仅维护草稿条件，未点查询不发请求

### 2.2 筛选落点决策表

| 筛选类型 | 落点 | 说明 |
|---|---|---|
| 关键词搜索 | 页头筛选段 | 全页唯一主筛选，用 `Input.Search`（内嵌查询图标），**不再外挂「搜索」按钮** |
| 状态类（上架/临时/未读/启用…） | **列头漏斗** | `filters` + `filterMultiple: false` + 受控 `filteredValue`；配 `useListQuery` 的 `mapColumnFilters` |
| 分类（取值 > 8） | 页头 Select | 如配置分组、实体类型、模块 |
| 时间范围 | 页头 | `RangePicker` + `presets`（今天/近 7 天/近 30 天） |
| 低频项（粒度 / 对比 / 维度拆解 / 动作 / 关键词） | 「筛选 ▾」 | 用 `AdminFilters` 的 `more`，`moreCount` 显示已启用数量 |

- 日期快选**禁止**铺成第二行（日志页原有的 14 个日期 Tag 已收进「筛选 ▾」）
- 「重置」紧邻查询按钮；列头漏斗自带重置，页面可不再提供

### 2.3 列头筛选接入

```ts
const list = useListQuery<NewsRecord, NewsFilters>({
  initial, initialFilters: { published: "" }, errorMessage,
  // 列头漏斗 → 业务条件；hook 只认「值真正变化」，翻页不会被重置回第 1 页
  mapColumnFilters: (columnFilters) => ({
    published: (columnFilters.isPublished?.[0] as NewsFilters["published"]) ?? "",
  }),
  fetcher: useCallback(...),
});
```

列侧（`-mods/*Columns.tsx`）：

```tsx
{
  title: "状态", dataIndex: "isPublished", key: "isPublished", width: 130,
  filters: [{ text: "已发布", value: "published" }, { text: "未发布", value: "unpublished" }],
  filterMultiple: false,
  filteredValue: options.publishedFilter ? [options.publishedFilter] : null,
  render: ...,
}
```

## 3. 表格

### 3.1 列宽预算（硬规则）

- **`Σ列宽 ≤ 1199`，任何页面都不允许出现横向滚动**（页面级默认；宽表见 3.5 例外）
- **列宽三种表达，按内容特性选**：
  - **`width`**（定宽）：内容长度可预期的列——时间（165 / 180）、状态（100）、排序（115）、操作（按项数）、图片（80）、枚举 / 标识类（100~300，如配置键 300）。设了 `scroll.x` 即为 `tableLayout="fixed"`，按声明值精确渲染
  - **`minWidth` + `tableLayout="auto"`**（最小宽度）：内容长度差异大且**都很短**的表——列按内容分摊、不低于最小宽度，如资源管理器（名称 / 大小 / 修改时间 / 操作）。**长文本表禁用**：auto 布局按 max-content 计算，实测演示页 8 列被长文本撑到 2364px（fixed + `ellipsis` 才能截断）
  - **不给任何宽度**（不定宽）：吸收剩余宽度，通常给主内容列（标题 / 文件名 / 翻译值 / 消息内容 / 配置值 / 字典值）
- **至少一列不定宽（硬规则）**：禁止全定宽表——宽屏会留一条空白，窄屏则所有列一起被压缩
- **豁免**：Card / 弹窗内的**迷你表**（分析排行、数据库表占用、权限选择器、演示页）不受「至少一列不定宽」与 `scroll.x` 必填约束；但弹窗内的表要显式给 `scroll.y`（否则会继承页面骨架注入的表体高度，出现弹窗体与表体双层滚动）
- **`tableLayout="auto"` 时不要用 `fixed` 列**：rc-table 明确标注 auto 布局下 fixed 会破坏布局（`ColGroup` 仅在 `tableLayout === "auto"` 时读取 `minWidth`），此时用 `minWidth` 保底不被挤压
- 超出预算时的裁剪优先级：① 详情性长文本（存储路径 / SHA256 / 额外类型值）→ 行展开面板；② 次要时间列（更新时间）→ 删除；③ 操作列项数 → 折叠「更多」
- **列宽必须 ≥ 单元格内容宽 + 32px 左右内边距**：装不下时内容会**溢出到相邻列**（比省略号更糟，直接破坏列边界）。实测两例：配置「值类型」的标签（`Boolean 布尔开关` = 113px）在 100px 列里横向溢出 45px；标准尺寸 `Switch`（78px）在 100px 状态列里溢出 10px。定宽前先量内容宽（`cell.firstElementChild.getBoundingClientRect().width`），或改用省略号 / 小号控件
- **长文本列必须 `ellipsis`**：无省略的长文本会把单元格内容顶出列宽、`scrollWidth` 溢出（实测 10px 级横向滚动条即由此产生）
- **`scroll.x` 必填（硬规则）**，口径 = **参考视口（1440）下该表的可用宽度**：全宽页 `1199`；双栏页 `1199 − 左栏宽 − 20`（系统配置 997、字典 977）；行展开列（50）计入其内。三档行为——容器 > `scroll.x` 时不定宽列吸收多余宽度；= 时恰好铺满；< 时**横向滚动且列宽不被压缩**（这就是「适应各个屏幕」的实现方式）
- 时间列宽 **165**（`dateTimeMinute`）/ 180（`dateTime`）；可空时间列带 `emptyText: "—"`
- 图片 / 封面列放最前，`ImageCell`，宽 80
- **双栏（左栏 + 右表格）**：只在左栏是「独立实体列表」或「常驻可见就有价值的分组概览」时使用（如字典类型、配置分组）；单纯的分类筛选用页头 `Select`。统一用 `AdminSplitPanel`（见 3.6），右表预算按**右栏实宽**算（1199 − 左栏宽 − 20 间距），左栏不套 `Card`（避免与表格叠成双层边框）
- 字节列用 `formatBytes`；服务端排序用 `...list.sortProps("字段名")`

### 3.2 常用列宽档位

| 列类型 | 宽度 |
|---|---|
| 主内容列 | 不定宽（吸收剩余），或标识类定宽 200~300 |
| 排序权重（`SortOrderCell`） | **115**（内含 78px 输入框 + 单元格内边距） |
| 状态（`PublishSwitchCell` / `StatusTag`） | **100**（开关统一 `size="small"`；标准尺寸开关约 78px 宽，100px 列装不下会溢出） |
| 行展开列 | **50**（`expandable.columnWidth`；`+` 图标 16 + 单元格内边距 32 = 48，antd 默认即 48，取 50） |
| 图片 / 封面 | 80 |
| 时间（到分 / 到秒） | 165 / 180 |
| 状态（Tag / Switch） | 100~130 |
| 短枚举（类型 / 语言） | 80~120 |
| ID / UUID（`copyable`） | 120~170 |
| 布尔徽标 / 颜色 | 80~100 |
| 操作列 | 见 3.4 |

### 3.3 通用态与状态列

- 布尔状态（上架 / 启用）：`PublishSwitchCell` 单元格内切换（乐观更新 + 失败回滚）
- 多值枚举：`StatusTag`（语义色）/ 字典驱动用 `DictTag`
- 排序权重：`SortOrderCell`（失焦 / 回车提交，值未变不发请求）
- 状态变更落库走**单字段 SFn** + `logCrud` 审计；禁止复用整表更新
- 内联编辑列禁止 `ellipsis` / `copyable`（ProTable 会用 `overflow: hidden` 的 span 包住控件）

### 3.4 操作列

- 一律用 `TableOperate` 容器；可用子组件 `Edit` / `Delete` / `Link` / **`More`** / `Custom`
- **项数 ≤ 4**；高频动作外置（下载 / 删除），元数据类编辑（标签 / 编辑图片 / 翻译）收进 `TableOperate.More`
- **宽度按文案实算**：「16(图标) + 4(间距) + 文案宽度 + 16(内边距)」+ 单元格内边距 24
  - 2 项短文案（编辑 / 删除）→ **170**；3 项短文案 → 240；**3 项含 4 字文案（重置密码 / 设为默认）→ 270**；4 项 → 320（均为实测内容宽，原 160 / 260 会差 8px 导致按钮溢出到相邻列）
- `fixed: "right"` 且显式声明 `width`（无宽度的固定列会被压扁并把按钮挤出列外）
- `TableOperate.Delete` 内置 `Popconfirm`（文案 `确定删除{recordName}？`），**不自行吞错**：`onConfirm` 交调用方 `sfnUnwrap` / `callSfn`
- 无权限：`disabled` + `disabledReason`（置灰 + Tooltip 说明，禁止隐藏）

### 3.5 宽表例外

埋点事件 / 日志这类「属性 JSON 列」允许 `scroll.x > 容器`，但**不得再固定操作列**（固定列会盖住被滚动的列），可改为 `fixed: "left"` 固定标识列。

### 3.6 双栏（master-detail）

**使用前提**（二者之一）：左栏是①**独立实体列表**（可增删改，如「字典类型」）或②**常驻可见就有价值的分组概览**（如「配置分组」的名称 + 条目数）。单纯做分类筛选、取值又不多时用页头 `Select`，不要为此开双栏。

**统一用 `AdminSplitPanel`**（`#/components/admin`）：

```tsx
<AdminSplitPanel
  sideTitle="配置分组"                       // 左栏标题
  sideWidth={SPLIT_PANEL_WIDTH.narrow}      // 分组概览 180 / 实体列表 200
  side={items.map((it) => (
    <AdminSplitPanel.Item
      key={it.key}
      primary={it.name}          // 主文案（名称）
      secondary={it.slug}        // 次要文案（标识 / 说明），可选
      extra={it.count}           // 右侧辅助信息（条目数），可选
      actions={<EditButton />}   // 行内操作，与选中互不干扰，可选
      active={it.key === selectedKey}
      onSelect={() => select(it.key)}
    />
  ))}
>
  <ProTable ... />               {/* 右栏：预算按右栏实宽算 */}
</AdminSplitPanel>
```

约束：

- **左栏宽度只取档位**（`SPLIT_PANEL_WIDTH.narrow 180` / `base 200`），间距固定 20px
- **左栏与右表同一套视觉逻辑**：`border border-border` 外框 + **灰底标题行**（与表格表头同色 `bg-background-secondary`、同为 14px / 600、约 53px 高，实测两栏等高、表头差 2px）+ 白底内容区；两栏读作一对
- **左栏固定高度 + 吸顶 + 内部滚动**：高度取内容区可视高度 `calc(100vh - var(--admin-header-height) - 2.5rem)`，容器 `sticky top-0`，列表区 `min-h-0 flex-1 overflow-auto`——右栏内容（不分页的长表）滚动或页面变矮时，左栏始终整屏可见、不跟着滚走
- **列表项**：整行 `px-4 py-2.5` + `border-b border-divider`（末项去掉）；
  选中指示用 **`border-l-[3px]`**（选中 `border-l-primary`、未选中 `border-l-transparent`），与侧边导航同构，不引起内容左右跳动
- **交互态**（缺一不可，与侧边导航 `AdminNav` 对齐）：悬停 `hover:bg-accent/60`（半透明，任何底色上都能看见；用不透明的 `bg-accent` 在白底上几乎不可辨）、按下 `active:bg-accent`、键盘聚焦 `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset`、`cursor-pointer`、`transition-colors`
- **行内操作弱化**：默认 `enabled:text-foreground-tertiary`，悬停才提亮（编辑 → `hover:text-primary`，删除 → `hover:text-danger`），避免每行两枚主色图标抢视觉；用 `enabled:` 变体而不是裸 `hover:`，否则会覆盖 antd 的禁用态配色
- **右侧计数**用 `tabular-nums` 右对齐，数字列对齐
- **左栏不套 `Card`**：与右栏表格叠成双层边框
- **列宽预算按右栏实宽**：`右栏宽 = 1199 − 左栏宽 − 20`；超出时先裁右表列或把详情列移入行展开（系统配置即裁掉「描述」列）
- **列表项结构固定**：选中指示条（始终占位，避免切换时内容左右跳动）+ 主文案 + 次要文案 + 右侧计数 / 行内操作；主文案是独立的 `button`，行内操作是它的兄弟节点，因此**不需要 `stopPropagation`**
- **左栏不承载页面级主操作**：「新建字典」「新建配置」放页头操作段；依赖选中项的次级操作（如「新建条目」）也放页头，未选中时置灰并说明原因
- 依赖选中项的信息（当前字典名、条目数）写进页头 `description`（悬停标题可见），不再在右栏另起一行标题
- 未选中时的空态放右栏中央（`请选择左侧字典查看条目`），不要留空白表格

## 4. 容器：Modal 还是 Drawer

### 4.1 决策表

| 场景 | 容器 |
|---|---|
| 单对象新建 / 编辑，字段 ≤ 6 且无富文本 / 图片墙 | `AdminFormModal`（base 520，较宽用 640） |
| 含富文本 / 图片墙 / 需要纵向空间的编辑器（如新闻正文），或字段多到弹窗内滚动不便 | `AdminFormDrawer`（base 640 / wide 760 / full 60%） |
| 单字段快速修改（标签 / 状态 / 排序） | 单元格内联编辑，或小 Modal（`sm` 420） |
| 危险操作确认 | 行内 `Popconfirm`（表格）/ `Modal.confirm`（页面级） |
| 设置类（通知渠道、SMTP） | `AdminFormModal`（520） |
| 内容预览 / 长内容查看 | Modal（`width="auto"` 居中）或 Drawer |

### 4.2 弹窗与抽屉规范

- **宽度只取档位**：Modal `FORM_MODAL_WIDTH` = `sm 420 / base 520 / wide 640`；Drawer `FORM_DRAWER_WIDTH` = `base 640 / wide 760 / full "60%"`
- **表单类新建 / 编辑一律走 `AdminFormModal` / `AdminFormDrawer`**；非表单的工具类弹窗（图片预览、图片编辑器、重命名 / 新建目录这类单字段提示、标签编辑）可以直接用 antd `Modal`，但需自带 `destroyOnHidden` 与明确的 `width`（单个字段的小弹窗取 `base 520`；图片 / 文本预览这类需要大面积的可按视口相对给值，如 `min(1280px, 92vw)` / `75%`）
- 标题统一 `新建X` / `编辑X`（容器按 `entityName` + `id` 自动生成；标题不能用该模式时用 `title` 显式覆盖，如「重置密码 — admin」）
- 底部主按钮：传 `formId` 时容器以 `htmlType="submit" form={formId}` 触发该表单提交（表单侧配合 `formId` / `hideActions` / `onSubmittingChange`）；或传 `onOk` 交调用方提交
- 固定 `destroyOnHidden`：隐藏即卸载，避免校验态残留与 `display:none` 容器内组件拿到 0 尺寸
- **表单不写 `className="mt-4"`**：弹窗 body 自带 24px 内边距
- 表单初值由调用方在打开时装配（`setFieldsValue` / `initialValues`），容器不负责重置

## 5. 表单

- 统一 `layout="vertical"`；必填用 `rules`，校验失败由 antd 就地提示
- 控件选型：文本 `Input` / 长文本 `Input.TextArea` / 枚举 `Select` / 字典 `DictSelect` / 布尔 `Switch` / 单选组 `Segmented` 或 `Radio.Group` / 时间 `DatePicker` / 上传 `FileUpload`·`ImageUpload` / 富文本 `RichEditor` / 权限 `PermissionSelector`
- 服务端校验为最终权威（zod 在 `.schemas.ts` 单一来源）；客户端错误统一交 `callSfn` / `sfnUnwrap` 提示，禁止在表单里 `try/catch + message.error`
- 提交期间主按钮 `loading`，期间禁止重复提交
- 富文本编辑器高度按其内容区自适应（见 `RichEditor`），禁止在弹层内再套固定高度导致双层滚动
- 可翻译字段用 `FieldTranslationDrawer`（操作列「翻译」入口）

## 6. 反馈与状态

- `message` / `modal` / `notification` **必须**从 `@fsdx/ui-spa/antd-static` 导入（静态导入会脱离 ConfigProvider 上下文）
- 列表加载：`ProTable loading`；按钮提交：`loading` / `confirmLoading`；页面级：`Spin`
- 错误出口唯一：客户端调 SFn 一律 `sfnUnwrap` / `callSfn`；有意静默传 `{ silent: true }`
- 空态中文占位；失败态给可重试入口，不裸抛

## 7. 分析页与看板

- 骨架：`AdminPageContent`，筛选进页头（时间范围 + 主维度内联，粒度 / 对比 / 维度拆解 / 关键词 → 「筛选 ▾」）
- **禁止用 `Card` 包筛选区**（历史写法，已统一移除）
- KPI 用 `AnalyticsKpiCards`；图表用 `Card`；KPI 与图表卡间距 16px
- 页面级不需要「新建」主操作时，操作段留空即可，不强行放按钮

## 8. 反例清单（禁止）

- ❌ 独立筛选行 / 两端对齐（左侧一两个控件、右侧一堆按钮，中间大片死区）
- ❌ 搜索按钮与重置分置页面两端
- ❌ 页面级状态快筛（Segmented / Tabs）——状态筛选一律进列头漏斗
- ❌ 新建 / 编辑表单同时存在两种容器写法（同一场景只用 Modal 或 Drawer）
- ❌ 弹窗 / 抽屉宽度写非档位数值
- ❌ `Σ列宽 > 1199`、无 `ellipsis` 的长文本列、无宽度的固定操作列
- ❌ 把整表数据拉到前端排序 / 分页（服务端分页列表）
- ❌ `Card` 套筛选区、`className="mt-4"` 手写弹层内间距
- ❌ 手工 `dayjs().format` 渲染时间列（用 `valueType`；非表格场景用 `formatDateTimeValue`）

## 9. 验收

改完管理端页面后逐项自查 → [checklists/admin-design.md](../../checklists/admin-design.md)。

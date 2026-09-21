# CHANGELOG

> 本项目所有重要变更记录于此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Features

- **系统敏感配置加密（[infra]）**：`system_config` 新增 `is_secret` 标记，敏感值以 AES-256-GCM（`node:crypto`，零新依赖，密文格式 `enc:v1:{iv}:{ct}:{tag}`）入库、读取时解密，管理端与备份全链路不泄漏原文。
  - 服务层（`shared-services/config`）：新增 `config-secret.server.ts` 加解密工具；`config.server` 写入前按 `isSecret` 加密、`getConfig` 读时解密、`getConfigList` 列表值脱敏为 `******`、`getVisibleConfigRows` 过滤敏感项、`importConfigs` 命中敏感行保留原密文；`config.presets` 支持 `isSecret`（预置 `smtp_pass` / `sms_aliyun_access_key_secret`）；导入 schema 的 value 放宽为任意字符串，允许脱敏备份回灌。
  - 管理端 `/admin/config`：敏感行展示「已配置 / 未配置」，编辑留空保留原值，`isSecret` 创建后不可改，敏感值不参与搜索；导出 JSON 不含原文（附 `secretConfigured`）。
  - **升级与恢复路径**：导入备份携带 `isSecret` 时按标记建行；预置项/导入目标行当前值为空时补上敏感标记（空值无需加密，避免启动期强制依赖主密钥）；已有明文值不自动转密文（保持非敏感，避免读取时走错解密切径）。
  - 新增环境变量 `CONFIG_ENCRYPTION_KEY`（32 字节 Base64 或 64 位十六进制，缺失时读取敏感配置报错）；迁移新增 `is_secret` 列，历史行默认明文。可被衍生项目吸收

- **管理端图片编辑：浏览器端裁切 / 缩放 / 压缩 / 无损优化（[infra]）**：文件管理页新增「编辑图片」入口，图片处理全部在浏览器完成，服务端零图片库、零原生依赖，规避原生二进制与 Docker 镜像 libc 一致性、Nitro 外部化等一串部署约束。
  - **图片处理能力来自独立 npm 包 `@easyx/image-toolkit`（单包内聚）**：根入口为同构纯逻辑（`sniff` 魔数嗅探与尺寸解析、`limits` 格式能力矩阵、`lossless` 无损策略表、`operation` 操作归一化），`./ui` 为浏览器侧（wasm 引擎 + 加载状态机 + 自研组件，除 React 外不依赖 UI 库）。引擎基于 `@imagemagick/magick-wasm@0.0.43`（版本固定：glue 与 wasm 必须严格同版），运行在自建 Worker 中，wasm 与 glue 均为惰性资源、不进主 bundle。
  - **格式能力矩阵经实测确定**（引擎 `ImageMagick 7.1.2-30 Q8 wasm32`）：可编辑 JPEG / PNG / WebP / GIF / TIFF；可输出 JPEG / PNG / WebP；AVIF 在本构建下编码产物非法且无解码 delegate，BMP / ICO / TGA 需显式指定格式才能解码，HEIC 缺解码器，SVG 为规避 XML 解析器历史外部引用风险，均不纳入。
  - **加载进度是一等公民**：自行 fetch 后以 `wasmBinary` 形式传入（把 URL 交给库会失去进度）；状态机 `idle → downloading → instantiating → ready`，`instantiating` 阶段必须暴露否则用户以为卡死；响应带 `Content-Encoding` 时 `total` 置空、UI 降级为「已下载 x MB」而非百分比（`Content-Length` 是压缩后长度，与解压后字节基准不同，直接算会让进度冲过 100%）；并发调用共享同一次加载，`useImageEngine` + `<ImageEngineGate>` 统一提供进度 / 错误 / 重试。
  - **wasm 地址可配**：新增客户端可见配置项 `image_engine_wasm_url`（分组「图片设置」），留空使用包内自带资源（开箱与内网可用，产物增加约 14 MB）；包构建期 `EASYX_IMAGE_TOOLKIT_REMOTE=1` 可剥离本地副本并强制注入地址（未注入时明确报错而非静默失败）。实测 wasm 14.14 MiB / gzip 5.34 MiB，初始化约 28 ms，瓶颈纯在下载。
  - **服务端只多一个接口**：新增 `replaceFileContent`（`services/file/file.server.ts`）与 `replaceFileContentSFn`（权限码 `file:process`，审计动作 `overwrite_image`）用于覆盖原图，另存为新文件复用既有上传链路。覆盖以**魔数嗅探**结果为准判定类型与尺寸（不信任客户端声明的 MIME），换新存储名后删除旧物理文件（`deleteFile` 只做软删除，不会清理磁盘）；**格式变化时同步原始文件名后缀**（如 `照片.png` → `照片.webp`），避免列表与下载文件名与实际内容不符。
  - **`file` 表新增 `width` / `height`**：上传时由嗅探结果顺带写入（零依赖解析 PNG / JPEG / WebP / GIF / BMP 容器头），非图片或无法解析时为 null。
  - **安全与健壮性补齐**：`createFileDownloadResponse` 统一补 `X-Content-Type-Options: nosniff`（文件内容可由管理端替换，避免伪造类型被内联渲染）；上传链路改为以嗅探结果覆盖客户端声明的 MIME；`sniff` 单测覆盖「HTML 伪装成 image/png 被拒绝」路径；物理文件缺失（存储目录被清理造成的孤儿记录）按 404 处理并记 warn 日志，不再把带绝对路径的 ENOENT 当 500 抛给客户端。
  - **编辑器界面为单视图左右分栏**：左侧大预览（**拖动对比**原图与处理结果）、右侧缩放 / 裁切 / 编码三组参数同屏可见、底部常驻体积增减与保存动作（默认**另存为新文件**，修正此前误用「覆盖原图」为默认值，风险提示收进 Tooltip）；参数变化后**自动防抖预览**（500ms、序号丢弃过期响应、保留上次结果不闪白），无需手动「生成」；裁切时预览区切换为占满画布的裁切台。提示语义分层：**Alert 只用于错误与需重试的失败态**，常规说明一律降级为面板内的一行小字，处理中 / 无变更等状态集中在底部状态栏，避免一屏堆叠多块提示色块。
  - **拖动对比的「同区域对齐」**：处理结果可能来自裁切与缩放，若把两张图都按 contain 铺开，左右显示的会是不同区域、对比失去意义。实现上让两张图处于同一像素密度（原图按 `处理后比例 × 处理后宽 / 裁切区宽` 渲染并按裁切偏移平移），分隔线两侧永远是同一块像素；裁剪必须套在「容器尺寸的 wrapper」上（`clip-path` 百分比按元素自身解析、分隔线按容器定位，直接在 img 上裁剪会让裁切边界与手柄分离）；支持拖动、点击定位与键盘（←/→/Home/End）调整。
  - **等比缩放**：新增 `resize` 子路径与 `resolveScaledSize` 纯函数（锁定原始宽高比、默认不放大、钳制上下限），UI 提供 100/75/50/25% 预设与自定义宽高联动并实时显示目标尺寸。编辑器对超过 `IMAGE_LIMITS.maxInputBytes`（50 MB）或 `maxInputPixels`（5000 万像素）的图直接提示不在浏览器内处理，避免 wasm 解码/编码吃爆内存。
  - **无损优化升级**：`optimizeLosslessly` 支持可选目标格式与可选裁切（裁切只取像素子集，保留区像素不变，仍属无损）；`isOptimizableLosslessly` 同时要求「保真等级可用 + 该格式可被编码输出」，避免 TIFF 这类「引擎具备能力但不作为输出格式」的格式在界面上被标为可优化却静默返回 null；无损路径返回 null 时给出明确提示而非无反应。同一张真实 PNG 实测：同格式无损重压缩仅 −1.9%，而**无损转 WebP 达 −40.7% 且逐像素一致**（原始 RGBA 字节比对验证）—— PNG 的 DEFLATE 对连续色调效率天生很低，换格式才是这类图的无损最优解。
  - **有损降色（TinyPNG 等价能力）**：新增 `ImageOperation.colors`，输出 PNG 时先做调色板量化（Riemersma 抖动）再编码 —— 即 TinyPNG 的主力手段（其官网明确说明用量化把 24-bit PNG 转成更小的 8-bit 索引图）。同一张图实测 256 色 −68.9%、128 色 −80.0%（TinyPNG 官网自称平均 75%）；界面明确提示「连续色调会出现色带，扁平插画几乎无感」。
  - **无变更即不处理**：设置未产生实际变更时不调用引擎、不产出「结果」，界面提示「尚未做任何修改」且保存不可用 —— 避免产出比原图更大的文件；PNG 输出一律使用最高压缩级别（只影响耗时不影响画质）。
  - **无损优化收益实测**（以 `compression-level=1` 写出的劣质源为基准，收益高度依赖源文件编码质量）：PNG −41.5%、WebP lossless −43.2%、TIFF LZW −25.7%，均经原始 RGBA 字节比对确认为逐像素无损；JPEG 无系数透传能力，质量 100 重编码仍有约 24% 像素字节差异，如实标注为「近无损」。
  - **已知取舍**：不提供手动旋转（EXIF 方向已由引擎 `autoOrient()` 处理，手动旋转会破坏「裁切矩形基于定向后原图像素坐标」的约定）；无损优化与缩放互斥（重采样会改变像素），但允许叠加裁切。
  - 单测覆盖魔数嗅探与尺寸解析、格式能力矩阵、操作归一化、裁切求交、等比缩放换算、无损策略、设置模型转换，以及引擎加载状态机 / 并发去重 / 进度映射 / `Content-Encoding` 降级 / Worker 异常与拖动对比交互；引擎侧另有**跑真实 wasm 的操作实测**（裁切 / 缩放 / 转格式 / 降色 / 无损转 WebP，断言产出能被 `sniffImage` 识别且无损路径逐像素一致）。**根入口零重量依赖**：服务端 import 根入口做嗅探，`.output/server` 中不得出现 `.wasm`（已作为回归检查点写入 AGENTS）。可被衍生项目吸收

- **管理端仪表盘重构：四域信号整合为系统态势总览（[infra]）**：`/admin` 由 4 个静态标量卡升级为「系统健康 + 访问流量 + 用户规模 + 存储占用 + 风险与资源趋势」一屏概览，数据源自既有埋点 / 系统监控 / 统计 / 操作审计服务，不新增表与依赖。
  - **聚合入口**：新增 `services/dashboard/dashboard.overview.server.ts` 按域编排 `getClientUserTotal`（未删除客户端用户数） / `getTrackAnalytics`（PageView 口径，含环比与 Top 页面） / `getSystemOverview` / `getStorageUsage` / `getSystemMetricHistory`（资源趋势，按可选指标集合裁剪采样点） / `getOperationLogAnalytics` + 新增 `operation-log.analytics` 的 `getOperationActionCounts`（高风险动作独立聚合，不受分布 TopN 截断），并新增 `getDashboardOverviewSFn`（复用 `dashboard:view` 权限）；指标口径复用既有服务，仪表盘与各分析页数字一致。存储占用取 STORAGE_DIR 实际占用（`StorageUsage.totalBytes`，含临时文件与日志），修正此前误用 `SUM(file.size)` 且 `SUM(bigint)` 经 node-postgres 返回字符串导致显示为 0 的问题。
  - **日志摘要独立懒加载**：新增 `services/dashboard/dashboard.logs.server.ts` 与 `getDashboardErrorSummarySFn`，仅在概览返回 `sections.logs` 时按需加载；窗口收敛为今日 / 近 7 日（近 30 日自动收敛），缓存 5 分钟，避免日志文件扫描阻塞首屏；`total=0`（窗口内无匹配日志文件）与「零错误」区分展示为空态，避免误报健康；SFn 支持 `force` 供手动刷新绕过缓存重扫。
  - **权限分块**：流量域 / 系统域 / 日志与审计域分别按 `track:query` / `system:monitor:view` / `log:view` 门控——未授权区块不发起查询、返回 `null` 并由前端隐藏，避免仅持 `dashboard:view` 的角色越权取数（Root 自动全通）；快捷入口按区块可用性过滤。
  - **成本控制**：各域摘要按时间范围缓存 60 秒（新增 `services/dashboard/dashboard.cache.ts`）；30 秒轮询改为只调用轻量系统快照 SFn（`getDashboardSystemSnapshotSFn`），不再重复触发埋点 / 审计 / 文件扫描等重量级聚合；时间范围收敛为 今日 / 近 7 日 / 近 30 日（单日按小时、多日按天），系统指标映射 24h / 7d（采样仅保留 7 天，卡片标注实际口径）。
  - **前端**：复用 `components/admin/analytics` 三件套（KPI 卡 / 懒加载图表 / 排行），新增健康条、系统实时面板、趋势面板、Top 页面、高频错误、高风险操作与快捷入口面板；趋势卡为单张「指标可切换」折线（PV + 请求数 / CPU / 内存 / 延迟，按权限过滤选项）；KPI 卡由 24 栅格改为 CSS Grid（支持 5 列精确均分，窄屏 1 列 → 小屏 2 列 → 大屏目标列数；3 / 4 / 6 列断点与改造前保持一致），同排等高、补充信息贴底对齐；`AnalyticsChart` 接入 `useAdminTheme`，暗色模式自动切换 G2 `dark` 主题（坐标轴 / 图例 / 网格 / 提示文字跟随主题），全部分析页生效；系统实时面板指标区垂直居中、磁盘容量行文本截断（修复长文本溢出）；趋势图例预留顶部空间避免与数据点重叠；`AnalyticsKpiItem.value` 扩展支持已格式化文本并新增 `hint` 补充说明、`formatBytes` 统一使用 `@fsdx/lib/format-bytes`；操作日志展示元数据上移 `constants/operation-log-meta.ts` 供明细页 / 分析页 / 仪表盘共用。
  - 单测覆盖时间窗口解析、权限分块、高风险动作独立聚合与占比、资源趋势指标裁剪、系统范围映射、日志窗口收敛与强制重扫、各域缓存命中。可被衍生项目吸收

- **应用内系统监控：进程资源 + 存储 / 数据库占用可视化（[infra]）**：管理端「系统管理」新增 `/admin/system/monitor`（权限码 `system:monitor:view`），无需外部监控系统即可查看程序自身运行状态与历史趋势。
  - **采样落盘（无建表）**：`services/system-metric` 每分钟采集进程 CPU / 内存 / 事件循环延迟 / 活跃资源 / 请求增量 / 依赖健康 / 数据库总量，按天写入 `{STORAGE_DIR}/metrics/YYYY-MM-DD.ndjson`（保留 7 天，每日定时任务清理），零迁移、零新依赖，采样行约 350 B/分钟。
  - **实时快照**：现读进程指标（微秒级、零 IO、零 DB 探测），前端每 5 秒轮询；依赖健康与库总量取最近一次采样，避免轮询打库；历史趋势按范围（1h / 24h / 7d）流式分桶聚合。跨 Nitro 入口 / SSR bundle 的共享状态（最新采样、事件循环延迟直方图、按需缓存）统一挂载 `globalThis`，避免模块级单例在打包后被拆分为多份。
  - **按需巡检**：STORAGE_DIR 体积（含顶层目录分解与 `fs.statfs` 文件系统容量）与数据库各表占用（`pg_relation_size` / `pg_indexes_size` / `pg_database_size`，方言隔离于 `system-metric.db-size.server.ts`）按需查询 + 内存缓存，页面手动刷新强制重算。
  - **指标模块扩展**：`shared-services/metrics` 的 `Counter` 新增只读访问器 `value()` / `total()`（`render()` 不变，向后兼容），供采样任务计算区间请求增量。
  - 复用既有 `components/admin/analytics`（懒加载图表 / KPI 卡）与管理端约定。可被衍生项目吸收

- **日志分析能力：操作日志与运行日志新增分析页（[infra]）**：管理端「日志审计」分组新增 `/admin/operation-logs/analytics` 与 `/admin/logs/analytics` 两个分析页，权限复用 `log:view`，不新增表与依赖。
  - **操作日志分析**：新增 `shared-services/operation-log/operation-log.analytics.ts` 聚合 KPI（操作总数 / 活跃操作人 / 高风险操作数 / 覆盖模块数，支持环比）、操作趋势（时间桶 × 动作或模块）、动作/模块/操作人分布 TopN；时间桶按业务时区口径，高风险动作白名单收敛于服务层，时间跨度上限 92 天，不新增 DB 字段。
  - **运行日志分析**：新增 `services/logs/log-analytics.server.ts` 流式扫描日志文件聚合级别分布、错误率趋势与错误消息聚类 TopN；受扫描行数上限（20 万行）与时间跨度（31 天）双重约束，超限截断并提示；pino 级别与消息归一化抽至 `services/logs/log-parse.ts` 纯函数（`normalizeLogLevel` / `normalizeMessage` / `iterateLogLines`），供日志查询与分析共用。
  - **管理端共享分析组件**：抽 `components/admin/analytics`（懒加载图表 `AnalyticsChart`、KPI 卡 `AnalyticsKpiCards`、排行表 `AnalyticsRanking`、系列调色板），埋点分析页同步复用并删除其局部重复实现。可被衍生项目吸收

- **通知多渠道下发 + 每用户渠道配置（[infra]）**：站内信（`message` 表）为恒定义必达的主渠道，外发渠道 email / 飞书 / 企微 / 钉钉 / 通用 webhook 作为可插拔切面，由**单个全局总闸** `notify_enabled`（系统配置，默认关闭）与**每用户配置** `user_config.notify_channels`（启用 + 目标地址）双重驱动；短信渠道仅预留适配器接口（`sendChannelSms` 占位）。新增 `shared-services/notify`（webhook 按 variant 生成 payload/签名、邮件复用 mail）、`services/user-config`（通用 jsonb 配置存取）与 `user_config` 表；通知域多态引用统一命名 `user_type/user_id`，消息类型收敛至 `constants/message-types.ts`（清理死类型 `ppt`）。管理端与客户端各提供「通知渠道设置」UI。

- **事件分析升级为交互式分析工作台（[infra]）**：管理端 `/admin/track/analytics` 由静态趋势/饼图升级为交互式分析工作台——筛选区支持事件多选对比、指标切换（次数/用户数）、维度拆解（元属性白名单）、周期对比（环比/同比）、周粒度；新增事件明细排行表（次数/用户数/占比，点击下钻趋势）、用户属性与来源分布（设备类型/来源/操作系统/浏览器）、KPI 卡带周期涨跌。服务端 `getTrackAnalytics` 收敛趋势/排行/维度/KPI 聚合（空桶补零对齐、维度白名单防注入、按业务时区口径对齐），事件查询拆至 `track.events.ts`；图表经 `analytics-chart` 懒加载拆分 chunk；新增 `buildTrendConfig` 纯函数与单测。可被衍生项目吸收

- **图片编辑支持「覆盖前备份原图」（[infra]）**：`replaceFileContentSFn` 新增 `backup` 入参，覆盖原图前经 `duplicateFile` 把当前原图复制为新的永久文件（文件名在主干后追加 `-backup`，保留 MIME / 尺寸，置 permanent 避免被临时清理并复用原物理文件字节，不二次上传）；备份失败即中断覆盖，避免「原图被覆盖却无备份」。覆盖失败（含并发删除 / 写盘异常）时经新增的 `removeFile`（物理删除，区别于用户侧软删除）回滚刚创建的备份，审计也仅在整体成功后写入，不留「已回滚备份」的脏记录；备份名超长时按 `original_name` 的 `varchar(500)` 上限兜底截断。备份与覆盖分别写 `backup_image` / `overwrite_image` 审计。管理端图片编辑器底部 footer 新增「覆盖前备份原图」勾选项，并优化布局（左侧选项 + 处理体积提示、右侧带图标按钮，间距对齐）。可被衍生项目吸收

### Infrastructure

- **管理端列表页统一规范：查询状态 / 骨架 / 通用态收敛为固定流水线（[infra]）**：二十余个各写一套的列表页收敛为「骨架负责布局与高度、查询 hook 负责状态与请求、表格负责渲染、单元格负责通用态」，页面只声明差异（列、筛选控件、行操作）。
  - **查询状态**：新增 `#/utils/use-list-query` 的 `useListQuery`——条件 / 页码 / 每页条数 / 排序的单一事实来源，**全部显式触发**（筛选变更与增删改后刷新，不用 effect 自动拉取），服务端实际生效的 `page` / `pageSize` 回填状态，过期响应按请求序号丢弃；分页与排序统一由 `Table.onChange` 驱动，并提供 `sortProps(field)` 生成受控排序属性。
  - **页面骨架与工具条**：新增 `AdminListPage`（标题 + 看板 + 工具条 + 表格区域，经 context 注入表体高度）与 `AdminTableToolbar`（左筛选 / 右次要操作 / 条件生效时才显示重置）；`AdminPageContent` 的内容区标记 `data-admin-scroll-container` 作为高度测量参考系。
  - **表体高度实测**：新增 `@fsdx/ui-spa/table` 的 `useTableBodyHeight` / `TableHeightProvider` / `useTableHeight`——以内容区为参考系测量表格顶部偏移（滚动不影响测量值），表头与分页器实测，`ResizeObserver` 观测内容区全部块级子元素（上传列表展开、侧边栏折叠均重算）；ProTable 经 context 继承，无需逐页传 `scroll.y`。
  - **通用态落到单元格**：新增 `SortOrderCell`（失焦 / 回车提交，值未变更不发请求）与 `PublishSwitchCell`（切换即提交、乐观更新、失败回滚，状态文案嵌在开关轨道内），配套协议为**单字段 SFn**（`updateXxxSortSFn` / `setXxxPublishedSFn` 复用 `updateSortOrderSchema` / `togglePublishedSchema`）+ `logCrud` 审计，避免复用整表更新回写其它字段。
  - **列规范组件**：新增 `ImageCell`（图片 / 封面列固定正方形 + `objectFit: contain`，放表格最前，空值渲染 `—`）与 `StatusTag`（多值枚举 → 文案 + 语义色 `success` / `warning` / `danger` / `info` / `neutral`）；ProTable 新增 `dateTimeMinute` 值类型（收敛各页手写的 `dayjs().format("YYYY-MM-DD HH:mm")`）。
  - **操作列**：`TableOperate` 支持 `disabledReason`（置灰 + Tooltip 说明，`span` 包裹规避 antd 禁用按钮不派发鼠标事件）；`Delete` 不再自行 `message.error`（错误出口唯一交 `callSfn` / `sfnUnwrap`）；上下架与排序不再重复出现在操作列。
  - **编辑承载统一为抽屉**：新增 `AdminFormDrawer`（宽度三档 `640` / `760` / `40%`、固定 `destroyOnHidden`、底部按钮经 HTML `form` 属性提交，表单侧以可选的 `formId` / `hideActions` / `onSubmittingChange` 配合）；删除 `news` 的 `create.tsx` 与 `$id/edit.tsx` 路由页，新建编辑回归列表页抽屉。
  - **服务端契约**：`validators/common.schemas.ts` 由死代码转为唯一来源（`listSchema` 基座 + `updateSortOrderSchema` / `togglePublishedSchema` / `sortDirectionSchema`，分页参数统一设界「页码 ≥ 1、每页 1–100」），列表 SFn 一律 `listSchema.extend({...})` 且 `pageSize` 全链路透传（此前多处硬编码 `pageSize: 20`，每页条数控件实为死控件）；角色列表服务补齐服务端分页与排序（另提供不分页的 `getAllAdminRoles` / `getAllClientRoles` 供下拉复用），默认排序由创建时间升序改为降序（与其它列表统一）。
  - 已迁移页面：`news`、`files`、`file-explorer`、`admin-roles`、`client-roles`、`users/{admins,clients}`、`dicts`、`config`、`messages`、`logs`、`operation-logs`、`track/{query,event-meta,property-meta,analytics}`、`translations/{ui,content}`、`ai-providers`；只读列表只做骨架与列规范，保留「点查询才请求」的交互。可被衍生项目吸收

- **文件库支持多标签与按标签 / 文件 ID 检索（[infra]）**：`file` 表新增 `tags`（PG 原生 `text[]`），文件库由单标签升级为多标签并可独立按标签筛选。
  - 标签规则集中在一处：`services/file/file.schemas.ts` 的 `normalizeFileTags` 负责去首尾空白 → 丢弃空项 → 去重（保留首次出现顺序）→ 单标签截断（100 字符），schema 归一化后再校验数量上限（20 个）；新增 `updateFileTags` 服务与 `updateFileTagsSFn`（权限 `file:edit`，审计动作 `update_tag`，空数组即清空）。
  - 列表新增「文件 ID」（可复制）与「标签」列（标签用 `Tag` 渲染，超出折叠为 `+N`，Tooltip 列出全部），标签编辑用 antd tags 模式 Select（`tokenSeparators` 支持粘贴逗号 / 分号分隔文本）；图片宽高由「大小」列移入「标签」列，以该列首个青色 `Tag` 展示（大小列只留体积，尺寸与用户标签同格但不混排）；补充 `MIME 类型` / `存储路径`（已含落盘文件名）/ `SHA256`（可复制）/ `过期时间` 列便于排查存储与内容问题；标签编辑弹窗内展示目标文件名（长名省略 + Tooltip 全名），避免在列表中误开错行；工具栏拆出**独立的标签搜索框**（`tag` 参数，与 `keyword` 互不影响），服务层借 `unnest` 展开数组做包含匹配；`keyword` 同时匹配原始文件名与文件 ID（uuid 显式转文本比较）。可被衍生项目吸收

- **`@fsdx/ui-ssr` 补齐 shadcn Carousel（[infra]）**：新增 `Carousel` / `CarouselContent` / `CarouselItem` / `CarouselPrevious` / `CarouselNext` / `useCarousel`（embla 内核，依赖 `embla-carousel-react` + `embla-carousel-autoplay`）；内置 `autoplay` 间隔属性（毫秒，hover 暂停、交互后不停止），左右箭头用内联 SVG（遵循包内不引入图标库的约定），无障碍按语义元素实现（`section[aria-roledescription=carousel]` / `fieldset[aria-roledescription=slide]`）。可被衍生项目吸收

- **字典支持业务字典播种（[infra]）**：新增 `SEED_DICTS` 常量（模板默认为空数组，由业务项目填充）与 `ensureSeedDicts`，仅首次部署时创建字典与初始条目，**结果字典不受保护**，运营可在「字典管理」中自由增删改（与 `PRESET_DICTS` 的只读保护语义相反；需可编辑的初始选项时用播种而非改预置常量）。可被衍生项目吸收

- **认证与鉴权小幅增强（[infra]）**：
  - `adminPermGuard` / `adminPermRouteGuard` 支持权限数组（一次鉴权解析多权限，避免串联多个 guard 重复解析），内部改用既有的 `hasAllAdminPermissions`。
  - `useAdminAuth()` 新增 `hasPermission(permissionDef)`，`AdminUser` 新增 `rolePermissions`（root 用户为 `["**"]`），供列表页按权限置灰操作（服务端 guard 仍是唯一权威）；`getCurrentAdmin` 的角色名与权限码合并为一次查询并过滤已软删除角色（与鉴权路径 `getAdminRolePermissions` 语义对齐，此前会把已删除角色的名称一并下发）。
  - 新增 `#/utils/use-sfn-section` 的 `useSfnSection`（区块级异步加载：挂载后拉取，提供 `loading` / `failed`，任一块失败不影响其余区块，适用于仪表盘这类多区块页面）。可被衍生项目吸收

- **操作日志展示元数据补齐（[infra]）**：`constants/operation-log-meta.ts` 的模块 / 动作颜色与中文名补齐代码实际发出的取值（`set_published`、`update_tag`、`overwrite_image`、`backup_image`、`rename`、`mkdir`、`client-role`、`message`、`ai-provider`），修复操作日志页存在无名称 / 无色标的记录。

- **部署与构建优化（[infra]）**：
  - `deploy/deploy.sh` 改为零停机：先拉新镜像（旧版继续服务）→ `up -d` 仅重建变更容器（失败回退 `down + up`）→ 按部署前镜像 ID 精确清理旧镜像（不用 `docker image prune -f`，避免误清同宿主机其他项目）→ 输出 `/health` 状态面板。
  - `Dockerfile`：pnpm 改为全局安装 v12（与根 `package.json` 的 `packageManager` 大版本一致，`NPM_REGISTRY` 默认对齐 `.npmrc` 镜像源）；依赖安装走 BuildKit `--mount=type=cache` 复用 pnpm store（不进镜像层）；运行阶段安装 `tini` 作 PID 1（信号转发 + 回收僵尸进程）并设 `TZ=Asia/Shanghai` 对齐业务时区。
  - `.gitlab-ci.yml`：`docker:latest` → `docker:27`，构建复用 registry 内嵌缓存（`--cache-from ...:latest --cache-to type=inline`）并单次构建多 tag。可被衍生项目吸收

- **测试共享 select mock 工厂（[infra]）**：新增 `app/src/test-utils/db-mock.ts` 的 `mockSelect(rows)`，返回支持 from/where/innerJoin/leftJoin/groupBy/having/orderBy/limit/offset/$dynamic 且可 await 的查询链，供各 `__tests__` 复用，消除逐处手写链式 mock；`test-writing` skill 补充用法说明。可被衍生项目吸收

- **权限匹配支持逐级分组通配（[infra]）**：`@fsdx/lib/match-permission` 的 `matchPermission` 由仅支持单级 `module:*` 扩展为按冒号逐级前缀通配（`open_api:material:query` 可被 `open_api:*` 或 `open_api:material:*` 命中），单级权限码行为不变；补多级用例。可被衍生项目吸收

- **客户端 SFn 错误处理统一：helper + 分级 + 全局兜底（[infra]）**：客户端对 Server Function 的调用统一经 `#/utils/sfn-error`，消除碎片化错误提示，并保证未捕获的 SFn 错误不漏提示。
  - 新增前端工具 `utils/sfn-error`（归 `src/utils/`，非 shared-service）：UI 无关的提示器注册中心（DI，两端入口分别注入 antd `message.error` / sonner `toast.error`）+ 错误标记 + `callSfn` / `sfnUnwrap`（失败统一提示后抛出 / 返回 `[data, err]` 元组）+ `installSfnErrorFallback`（全局 `unhandledrejection` 兜底，仅提示被打标且未处理的 SFn 错误，含同文案 2 秒去重）。
  - **错误分级 + 可展开详情**：新增 `@fsdx/lib/error-utils` 纯函数 `classifyError`（auth / validation / business / internal）与 `getErrorMessage`，以及元信息读写 `appendSfnErrorMeta` / `parseSfnErrorMeta` / `stripSfnErrorMeta`。服务端 `sf-error-logger` 按分类归一化文案，并在消息末尾追加人类可读后缀 `（类型：…；请求号：…；SFn：方法名）`（三者均人类可读、**所有服务端错误都带请求号**；框架 `ShallowErrorPlugin` 仅序列化 Error 的 `message`，自定义属性无法过界）。客户端 `#/utils/sfn-error` 将错误组装为 `SfnErrorInfo { title, details }`：按类型识别系统错误并统一显示「系统错误，请稍后重试」，业务/校验/鉴权展示归一化原文，传输失败（`TypeError`）提示「网络异常」；`SfnErrorNotice` 单行展示「标题 + 详情按钮」，点击经根级 `SfnErrorDialogHost` 弹窗展示 `requestId` / `sfnName`（请求号可复制，弹窗独立于 toast 生命周期，生产环境不携带原始技术信息）；**SFn 方法名与原始信息仅非生产环境携带与展示，生产环境仅保留请求号，排查按请求号查服务端日志**；路由错误边界展示前剥离后缀。
  - 新增客户端 function 中间件 `middleware/sfn-client-error.ts`（`.client()`，注册于 `start.ts` 的 `functionMiddleware`）；服务端 `sfErrorLogger` 归一化 + 客户端中间件打标 + 全局兜底三层链路，服务端错误日志补齐 `serverFnMeta.name` / `filename`。
  - 全量迁移客户端调用点（routes / components）：事件回调、提交、删除、上传、副作用统一经 helper，删除本地 `message.error` / `toast.error`；有意静默（轮询 / 未读数 / 预取 / 引导加载）统一 `{ silent: true }`（保留 `console.warn` 诊断）；路由 `loader` / `beforeLoad` 保持裸调（错误交 `errorComponent`）。
  - `@fsdx/ui-spa` 移除 `sfn-helpers`；上传基础组件与 `JsonImportButton` 不再重复弹错误提示（错误交由宿主统一 helper）。
  - **两端可运行示例页**：管理端 `/admin/demo/error-handling`（新增 `demo:view` 权限码）、前台 `/demo/error-handling`，演示业务 / 校验 / 系统 / 鉴权 / 静默 / 成功 / 未捕获兜底七类场景。
  - 文档：`AGENTS.md`、`architecture` skill、`server-function` skill、`sfn-checklist` 明确「归属决策阶梯」（前端工具归 `src/utils/`，shared-services 只放 app 级服务单例 / 系统级共享域）+「客户端调用 SFn 必须经统一 helper」硬规则 + 错误分级与诊断说明。可被衍生项目吸收

- **i18n AI 翻译重构 + 批量流式翻译（[infra]）**：AI 翻译三层分离落地，并新增单实体/全量批量翻译 + SSE 流式。
  - **三层分离**：AI 翻译服务逻辑下沉 `shared-services/i18n/i18n.ai.server.ts`（prompt 构建、错误分类、组批、流式执行），入参 schema 收敛 `i18n.ai.schemas.ts`（`aiTranslateFieldSchema` / `aiBatchTranslateReqSchema`），共享类型收敛客户端安全的 `i18n.ai.types.ts`（服务端与客户端 SSE 消费共用，避免服务端类型进客户端 bundle）；`i18n.functions.ts` 的 `aiTranslateFieldSFn` 精简为校验 + 调 `translateWithAi`，入参由中文语言标签改为 locale 码。可被衍生项目吸收
  - **修复 `$` 替换注入 Bug**：`buildTranslationPrompt` / `buildBatchPrompt` 改用函数 replacer，规避源文本含 `$&` / `$'` / `` $` `` 时污染 prompt（`String.replace` 字符串替换会把 `$` 当特殊模式）。
  - **语言名集中**：`LOCALE_LABELS` / `getLocaleLabel()` 上移 `i18n.types`（单字段/批量翻译、抽屉展示共用，扩展语言只改一处）。
  - **提示词 fail-fast**：`ai_translation_prompt` / 新增 `ai_translation_batch_prompt` 系统配置为空时直接报错，不设内置兜底。
  - **批量翻译能力（抽屉单实体 + SFn 流式）**：`FieldTranslationDrawer` 的「AI 批量翻译」以 **Server Function** 实现，handler 返回 `Response`（TanStack Start 置 `x-tss-raw` 透传，客户端直接拿到流式响应）——统一 `aiBatchTranslateSFn`（`shared-services/i18n`，客户端把要翻译的 `records`（id+源字段值）与字段声明传入，`writeBack=false` 仅回填编辑器）；按 `batchSize`（默认 10）把多实体打包为一个 JSON 一次 AI 调用，逐批 `streamAiChat`（`@tanstack/ai` 流式）生成，转发 `text-delta`（实时原文）+ 批进度，批末 `extractJsonFromText` 解析（**纯文本 JSON 提取，不依赖厂商 `response_format`，OpenAI 兼容通用**），`writeBack=true` 时可经 `upsertContentTranslations` 落库，整批失败收集后继续。**未做全表批量翻译**——取数由前端提供（客户端拥有数据），不耦合 `services`。
  - **服务层新能力**：`i18n.content.server` 新增 `getExistingTranslations`（按 entity+locale 分组查已存在字段，供 fill/correct 判定）与 `upsertContentTranslations`（批量原子 `onConflictDoUpdate` 写回）。
  - **前端**：`FieldTranslationDrawer` 新增「AI 批量翻译」（补齐/校正模式 + 流式预览 + 保存全部）；新增客户端 SSE 消费工具 `utils/sse-client.ts`（读取 SFn 流式返回的 `Response`）。
  - 测试：新增 `i18n.ai.test.ts`（prompt 构建含 `$` 注入防御、`extractJsonFromText`、`buildBatchTasks` 双模式、`runBatchTasks` 流式与失败收集、`translateWithAi`）；`i18n.test.ts` 补 `getExistingTranslations` / `upsertContentTranslations`。可被衍生项目吸收

- **富文本编辑器迁移至 @easyx/editor（[infra]）**：`@fsdx/ui-spa/editor` 的 `RichEditor` 由 WangEditor v5（`@wangeditor/editor` + `@wangeditor/editor-for-react`）替换为 Tiptap 内核、零框架依赖的 `@easyx/editor`（命令式 `createEditor(container, options)`，样式内联无需引入 CSS）——重写 base 组件为 React 命令式包装（生命周期管理、受控 `value/onChange` 同步、`data-theme` 变化主题跟随、卸载销毁），并装配媒体能力：图片/视频/音频/附件上传（`uploadImage` 保留回调兼容，其余经 `media` 注入，宿主返回 URL 内部映射为媒体项）+ 媒体库列表（`getList` 按类型前缀筛选，供编辑器「媒体库」选择 Tab）；配套调整 `app` 与 `ui-spa` 依赖（移除 wangeditor、新增 `@easyx/editor`），在 `admin.global.css` 以 `--easyx-editor-*` 变量接入项目主色（`--s-primary`）并统一直角风格（圆角归零），app 业务壳将上传/媒体库对接项目文件管理（`uploadFileSFn` / `getFileListSFn`）。`AiRichEditor`（AI 代码工作台）不属传统富文本，保持 Monaco 不变。

- **聚合代码审查命令至 `/code-review`（[infra]）**：原 `/check-architecture` 与代码一致性审查合并为单一入口 `.agents/commands/code-review.md`——默认全量扫描整个项目（`app/` + `packages/`），不做 diff 限定；按 10 维度（分层/路由/SFn/组件/类型与 DB/安全/错误处理/测试/命名与一致性/注释规范）输出严重度分级报告，并沉淀「一致性/Style Guide」（命名/分层/状态/错误处理/样式/注释与文档），目标让全仓库像一个人写的；`--diff` 需显式传参。删除 `.agents/commands/check-architecture.md`，并把 `AGENTS.md` 命令表、`.agents/guide.md`、`docs/documentation-architecture.md` 中的 `/check-architecture` 引用统一改为 `/code-review`（CHANGELOG 历史记录保留原词）。

- **代码审查整改：测试基线修复（[infra]）**：`@fsdx/ui-ssr` Vitest 配置补 `environment: "jsdom"` 并新增 `src/test-setup.ts`（内存版 `localStorage`/`sessionStorage`/`matchMedia` 豁免），修复 Node 22+ WebStorage 全局变量遮蔽 jsdom `window.localStorage` 导致 16 条主题测试全挂的问题；`services/dashboard` 的 `getStats` 测试从路由旁 `_admin/__tests__/stats.test.ts` 迁至模块同目录 `services/dashboard/__tests__/dashboard.test.ts`，满足「测试与被测模块同目录」约定。

- **模板去业务化：清理客户端权限示例泄漏（[infra]）**：`src/permissions/client-permissions.ts` 的「业务模块权限码预留位（例）」示例仍含下游业务域专属名词（`bam:view` / 「经分会」），属 `packages/lib` 与 `bom-easy` 回灌净化的遗留；改为与模板 `demo` 基建模块一致的中性抽象示例（`demo:view` / 「示例」）。可被衍生项目吸收

- **i18n 模块结构与写路径优化（[infra]）**：
  - 依赖收敛：内容翻译模块按 `entityType === "system_config"` 直接依赖 config 服务刷新配置翻译缓存（架构上可接受，不引入额外抽象）；并修复「导入 system_config 翻译后配置翻译缓存未同步」的隐患（导入后对受影响语言刷新配置翻译缓存）。
  - 结构收敛：`TranslationImportResult` 上移至 `i18n.types` 作为 UI/Content 共用契约（消除 `i18n.content-io` 反向依赖 `i18n.ui.server`）；`i18n.server` barrel 由三层 re-export 收敛为直接引 ui/content/io；`localeSchema` 收敛为单一来源供各层复用。
  - 写路径优化：`upsertUITranslation` / `upsertContentTranslation` 新建路径改为原子 `onConflictDoUpdate`，消除并发 select-then-write 唯一约束竞态；UI/Content 导入改为「单次预查询统计新增/更新 + 批量 `onConflictDoUpdate`」消除逐条 select，并按唯一键去重、拷贝数据避免污染入参。
  - 读取路径优化：`getUITranslations` 对默认语言（zh）短路返回空资源免查库；`refreshUITranslationCache` 改为仅失效缓存 key、由下一次读取懒加载重建。
  - 插值前缀由自定义单大括号 `{` 恢复为 i18next 默认 `{{}}`（种子与调用点同步更新），避免含 `{ }` 的文案被误判为插值。可被衍生项目吸收

- **外部调用可观测与审计解耦（[infra]）**：外部系统调用移出 `operation_log`（审计表只留用户操作，只追加），改走「pino 结构化日志 + Prometheus 指标」，并补齐埋点/审计缺口。
  - 新增 `shared-services/external-observability` 的 `logExternalRequest()`（成功 `debug` / 失败 `warn`，携带 requestId 与操作者），`operation-log` 删除外部调用专用 `BatchWriter`；metrics 新增 `external_calls_total`（system/outcome）与 `external_call_duration_seconds`（system）。可被衍生项目吸收
  - `logger.mixin` 由仅注入 `requestId` 扩展为 `requestId` + 操作者身份（`operatorId` / `operatorName` / `operatorType`），每条日志可归属到具体用户。可被衍生项目吸收
  - `track.server` 新增 `trackServerEvent` 服务端可信埋点入口（跳过匿名 per-session 频控，其余校验一致）。可被衍生项目吸收
  - 补齐缺口：`clientRegister` 注册成功补 Register 服务端埋点 + 注册审计；管理员忘记密码重置补审计（`reset_password`）。

- **lib 边界守门与归属判据收敛（[infra]）**：`@fsdx/lib` 的准入判据由「纯函数/类」收敛为「**可原样移植到另一个 TanStack Start 项目而无需改动**」，并新增机械守门测试 `packages/lib/src/__tests__/lib-boundary.test.ts`——扫描 lib 源码，命中读 env（`process.env` / `import.meta.env`）、logger 耦合、框架（React / TanStack Start）或 UI 包依赖、`#/*` 反向引用、app 私有协议或权限码耦合（`SfnError*` / `AdminAuthError` / `ADMIN_PERMISSIONS`）即失败（随 `pnpm test` 执行，注释中的同名词不误报）。
  - `src/utils/` 由「app 前端工具」重定位为「**app 同构工具层**（client / server 皆可引用，判据=是否耦合 app 内部约定）」；`AGENTS.md`「包边界约定 / 归属决策」、`architecture` skill 的归属表与违规自查、`code-review` 命令的 ① 分层合规（新增「lib 准入复核」）同步该判据与「服务端专属能力不下放 lib」规则；文档中的「客户端拒收清单」改为指向 `vite.config.ts` 的 `importProtection.client.specifiers`，不再复制包名清单。
  - 守门覆盖 `.tsx` 与动态 `import()` 两种引入形式；注释剥离按引号感知扫描，不误删字符串/模板字面量中的 `//`、`/*`。客户端 import-protection 拒收清单加入 `opentype.js`——captcha 引擎依赖 `opentype.js` + 顶层 `Buffer`，仅服务端可用，误引入客户端即构建失败而非运行时崩页。
  - 代码体积强制阈值 文件/类 400 → **600** 行，取消原 300 行预警档（函数级 40/60 不变）。可被衍生项目吸收

### Refactor

- **依赖包破坏性升级适配：AI 富文本工作台与图片处理套件（[infra]）**：`@easyx/ai-rich-editor` 0.1 → 2.0、`@easyx/image-toolkit` 0.1 → 1.0，两处接入面按新版 API 同步改造。
  - **`/api/ai-chat` 由 AG-UI 协议改为 OpenAI 兼容端点**：新版编辑器把宿主接入面收敛为「已鉴权的 OpenAI Chat Completions 端点 URL 或自定义适配器函数」，旧版 `endpointUrl` + `requestMeta`（TanStack AI `useChat` / AG-UI SSE）不再适用。端点改为 `{ messages, stream }` 入参、原样透传厂商 SSE（逐块 `data:` + `data: [DONE]` 终止哨兵），推理内容 / `finish_reason` / `usage` 保持厂商原始形态；厂商选择经 `?providerId=` 查询串透传（OpenAI 协议体不携带该信息）。新增 `shared-services/ai/ai.proxy.server.ts`（请求体 zod 校验 + SSE 编码 + 错误体归一化），`ai.provider.ts` 抽出 `buildOpenAiClient` 并将原始 client 纳入 provider 缓存，新增 `getAiRawClient` 复用同一份缓存；鉴权（`AI_CHAT` 权限）与操作审计链路不变。
  - **演示页接入面替换**：`endpointUrl`/`requestMeta` → `chat`（厂商经查询串拼入 URL），`config.notify` → 顶层 `onNotify` 并补 `onError` 诊断回调；`ClientOnly` + 动态 `import()` 隔离约定不变。
  - **图片编辑器改为「宿主弹窗 + 包内内容区」**：1.0 收窄公开导出（`ImageEditorModal`、对比滑块、裁切台等内部组件不再导出），`FileImageEditor` 改用 antd `Modal` 承载 `<ImageEditor onResultChange>`，宿主持有处理状态并实现「另存为新文件（默认主按钮）/ 覆盖原图（带不可恢复风险提示）」，底部展示处理前后体积；`ImageProcessResult` 类型与根入口纯逻辑 API 未变，服务端嗅探 / 列定义 / 上传覆盖链路零改动。可被衍生项目吸收

- **AI 富文本工作台与图片处理套件抽离为独立 npm 包（[infra]）**：原仓库内 `packages/ai-rich-editor`、`packages/image` 改由独立仓库维护并发布为 `@easyx/ai-rich-editor` / `@easyx/image-toolkit`，本仓库删除这两个包、改为 npm 依赖（`^0.1.0`），后续包内演进经版本升级即可获得，基座不再背负两个重客户端包的构建与测试成本。
  - **接入面变化**：`@fsdx/image` → `@easyx/image-toolkit`（子路径 `./admin` → `./ui`）、`@fsdx/ai-rich-editor` → `@easyx/ai-rich-editor`；根入口纯逻辑导出、`ImageEditorModal` / `AiRichEditor` props 与既有调用方代码保持一致，仅需替换包名与子路径。
  - **样式与依赖自包含**：两个包均以包内 SCSS + CSS 变量内联样式、UI 自研（除 React 外不依赖 UI 库），宿主 `admin.global.css` / `ssr.global.css` 移除对应 `@source`，`antd` / `@ant-design/icons` / `@ant-design/x` / `@ant-design/x-markdown` / `react-easy-crop` 等包内依赖随之从 lockfile 消失（-91 个包）。
  - **打包约束写入 AGENTS**：`@easyx/image-toolkit` 的 Worker / wasm 以 `new Worker(new URL(...))` 静态引用，宿主需 `optimizeDeps.exclude` 否则预打包丢失资源；`@easyx/ai-rich-editor` 内含 monaco（模块顶层访问 `window`），宿主页面必须 `ClientOnly` + 动态 `import()` 引入，否则服务端加载即崩（demo 页已按此改造）。
  - **回归检查点**：`pnpm build` 后 `.output/server` 内不得出现 `.wasm`、客户端 `assets/` 需产出 worker 与 `magick.wasm`（本次已实测生产构建 + 真实浏览器：图片编辑走通引擎、Monaco 懒加载可用）。
  - 删除本地包后 `packages/*` 仅保留 `lib` / `ui-ssr` / `ui-spa`，`Dockerfile` 对应 `COPY packages/*/package.json` 行同步移除；pnpm 供应链策略自动把两个新包写入 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`。可被衍生项目吸收

- **字节格式化统一到 `@fsdx/lib/format-bytes`（[infra]）**：原先散落 3 处各自实现的 `formatSize`（管理端文件管理、资源管理器、`ui-spa` 文件库选择弹窗）能力与精度不一致（仅到 MB、GB 精度各自为政），统一收敛为 `@fsdx/lib/format-bytes` 的 `formatBytes`（B → TB 全阶梯，B 级不带小数，非法入参返回 `0 B`）并补齐单测；`ui-spa/upload` 的 `formatSize` 保留为 `formatBytes` 别名并标注 `@deprecated`，兼容既有引用与文档化 API。可被衍生项目吸收

- **全量代码审查整改：命名一致性收敛（[infra]）**：
  - `-mods/` 逻辑文件 camelCase → kebab：`dictUtils.ts → dict.utils.ts`、`fileExplorerUtils.ts → file-explorer.utils.ts`（含对应测试与引用更新）
  - 裸 `interface Props` → `XxxProps`：`FieldTranslationDrawerProps` / `RichEditorProps` / `AiProviderFormProps`（后两者共用）
  - 布尔 prop 统一 `is/has/should` 前缀：`recipientSearching → isSearching`、`valueDisabled → isValueDisabled`、`advancedExpanded → isAdvancedExpanded`、`slugDisabled → isSlugDisabled`
- **超限文件按职责拆分（[infra]）**：`config.server.ts` 预置配置抽至 `config.presets.ts`；`news.server.ts` slug 逻辑抽至 `news.slug.ts`；`i18n.content.server.ts` 导入导出抽至 `i18n.content-io.ts`；`ai-providers/-mods/AiProviderFormModal.tsx` 表单数据模型抽至 `ai-provider-form.model.ts`；`ui-spa/upload/FileUpload.tsx` 纯工具抽至 `file-upload.utils.ts`，各文件压回 400 行阈值内。
- **圆角归零与语义令牌化（[infra]）**：圆角沿用已有的主题层归零约定（`--radius-*` 均为 0，`rounded-*` 类名保留、运行时归零，仅 `rounded-full` 保留圆形），未改动类名；`ErrorFallback`、管理端仪表盘统计色、`files` 成功色、`newsColumns` 占位色改走语义令牌（`var(--s-*)`）；邮件模板内联色值注明「客户端不解析令牌」豁免。
- **i18n 实体翻译去业务耦合：统一通用入口（[infra]）**：`shared-services/i18n` 新增通用 `translateRecord` / `translateRecords`（按 entityType + locale 查询 `content_translation` 并合并，默认语言/空数组短路，批量一次查询避免 N+1），业务侧无需声明可翻译字段且不再自写包装器——`news.server.ts` 删除 `translateNewsRecord` / `translateNewsRecords`，前台 `news` / 首页路由改调用 `translateRecords(records, "news", locale)`。`valueType` 确认仅为 UI 层选编辑器的字符串（透传给 `FieldTranslationDrawer`），不进入服务端契约。实体翻译扩展收敛为「组件定义字段 + 调 `translateRecords`」两个动作。可被衍生项目吸收

- **i18n 模块语义化命名规整（[infra]）**：`shared-services/i18n` 文件名由 `i18n-<role>` 破折号与按表命名的 `ui-translation.*`/`content-translation.*` 混用，统一为点号约定 `<module>.<子域>.<role>.ts`——`i18n-types`→`i18n.types`、`i18n-config`→`i18n.config`、`i18n-seed`→`i18n.seed`、`i18n-ui.server`→`i18n.ui.server`、`i18n-content.server`→`i18n.content.server`、`i18n-content-io`→`i18n.content-io`、`ui-translation.cache/schemas`→`i18n.ui.cache/schemas`、`content-translation.schemas`→`i18n.content.schemas`，与 `config.*`/`dict.*` 命名一致；服务层 barrel `i18n.server.ts` 保留 `.server` 分界标记（`importProtection` 依赖该后缀区分服务端）。同步更新全部引用、`docs/i18n.md`（按「基础件 / UI 翻译 / 内容翻译」重组并补充 `.server` 约束与 barrel 说明）、i18n / cache / db-sqlite skill 与 `cache-system` 文档。纯命名规整、无行为变更。可被衍生项目吸收

- **统一剪贴板工具（[infra]）**：新增 `@fsdx/lib/clipboard` 的 `copyToClipboard`（Clipboard API 优先，非安全上下文/被拒时退回 `execCommand` 兜底，修复 HTTP 下复制按钮失效）与 `@fsdx/ui-spa/clipboard` 的 `copyText`（集成 antd message 提示，success/warning 通道可定制）；`ui-spa` ProTable 与 `ai-rich-editor` 两处复制改走统一实现，`ai-rich-editor` 新增 `@fsdx/lib` 依赖，`lib` / `ui-spa` README 补 subpath 导出清单。可被衍生项目吸收

- **Schema 通用列片段提取（[infra]）**：新增 `src/db/schema/columns.ts`，以工厂函数提供 `pk` / `createdAt` / `updatedAt` / `timestamps`（两者组合）/ `softDelete` / `sortable` / `publishable` 通用列片段，全部 schema 表改为展开复用（工厂每次返回全新列构造器，规避 Drizzle 列构造器跨表共享 config 的隐患）；纯 TS 重构，`db:generate` 零 diff。`db-schema` skill 的通用列模板与完整表模板同步改为工厂写法。可被衍生项目吸收

- **news 演示模块统一发布建模（[infra]）**：`news.status`（draft/published/archived）替换为 `publishable()` 片段的 `is_published`（上架/下架）——`publishable` 只承载通用发布状态，发布时间 `published_at` 作为业务字段留在 `news`；`changeNewsStatus` → `setNewsPublished`（首次发布补写 `publishedAt`，下线保留），管理端列表筛选/状态列/表单、前台与首页查询、仪表盘统计、导出列与相关测试全部对齐；`PRESET_DICTS` 删除 `news_status`，列表/创建/更新/导入 schema 改用 `isPublished`。附迁移（新增 `is_published`、删除 `status`）。可被衍生项目吸收

- **模块归属迁移：`error-utils` 与 `captcha` 移出 `@fsdx/lib`（[infra]）**：两者均不满足 lib 的「可原样移植」准入判据，按新判据重新归属；下游若已吸收这两个模块需同步调整 import 路径。
  - `error-utils`（错误分类 / 归一化 / 脱敏 / SFn 元信息读写）整体迁至 `#/utils/error-utils`：它耦合本项目私有的中文括号元信息后缀协议与「含中文即业务文案」约定，不具备库的通用性；顺带修正 `sanitizeError` 读取 `process.env`（违反 lib 零 env），改为 `sanitizeError(error, isDev)` 由调用方注入环境判断（`isDev` 为必填，避免漏传导致开发环境的 stack trace 静默丢失），并补两条覆盖 `isDev` 分支的用例。
  - SVG 验证码生成（`captcha.ts` / `ch-to-path.ts` / `random.ts` / `option-manager.ts` / `font-data.ts` + 字体文件）并入 `app/src/services/captcha`（唯一消费方），属「服务端专属运行时能力」；`option-manager` 的默认选项由可变全局对象改为只读视图，`packages/lib/src/env.d.ts`（仅为 captcha 的 `import.meta.env.DEV` 而存在）删除。`opentype.js` / `@types/opentype.js` 依赖从 `@fsdx/lib` 转入 `@fsdx/web`。
  - `packages/lib` exports 移除 `./error-utils` 与 `./captcha`；`README.md`、`packages/lib/README.md` 与 `server-function` skill 的引用和包清单同步。

### Fix

- **news 编辑抽屉保存失败会静默还原用户输入（[infra]）**：`NewsForm` 的回填 effect 把 `onError` 放进了依赖数组，而调用方传入的是每次渲染都新建的行内函数——页面重渲染（提交时 `onSubmittingChange` 触发）即让 effect 重跑，重新请求 `getNewsByIdSFn` 并 `form.setFieldsValue(服务端值)` 覆盖用户已改内容（同时 `loading` 置真使表单被短暂替换为 Spin）。实测 501 字符标题被服务端 schema 拒绝后，标题输入框已回退为原值。改为以 ref 承载最新回调、effect 只依赖 `[id, form]`（与 `RichEditor` 的同类写法一致）。可被衍生项目吸收

- **可空列以 `emptyText` 统一兜底（[infra]）**：`ProTable` 的 `valueType` 对 `null` 返回 `null`，可为空的时间列（文件「过期时间」、用户「最后登录」、新闻「发布时间」）在列表里留白，与同表其它列的 `—` 占位不一致。为列新增 `emptyText` 选项（渲染结果为空时统一替换），上述四列改用 `emptyText: "—"`，避免各页为零值另写 `render` + 手写 `dayjs` 格式化。可被衍生项目吸收

- **e2e 环境被 devtools 悬浮徽标遮挡（[infra]）**：dev 期 `TanStackDevtools` 的启动徽标固定右下角（`z-index: 99999`），会盖住 `AdminFormDrawer` 底部的主按钮——Playwright 判为 pointer events 被拦截而无法点击（`force: true` 也无效，真实鼠标事件仍落在徽标上）。新增 auto fixture 在每个用例注入 CSS 隐藏该徽标（按内部图标结构定位，不依赖其 CSS Module 生成的类名），避免各 spec 各自绕过。可被衍生项目吸收

- **管理端列表页翻页 / 每页条数调整失效（[infra]）**：各列表页同时存在 `pagination.onChange` 与 `Table.onChange`，antd 翻页时会同时触发两者——分页回调按目标页查询，`Table.onChange` 却把页码重置为 1，两个请求互相覆盖，表现为「闪动一下仍停在第一页」，调整每页条数同样无效。移除各页 `pagination.onChange`，分页与排序统一由 `Table.onChange` 处理（分页参数直接取 `Table.onChange` 回传的目标页码与每页条数），并把列表条件收敛为单一查询状态（`useListQuery`，服务端返回后回填实际生效值）。可被衍生项目吸收

- **固定操作列在窄屏溢出（[infra]）**：操作列固定右侧但未声明 `width`，antd 会把无宽度的固定列压缩到剩余空间，窄屏下各列宽度之和超过容器宽度时按钮溢出到相邻列（如「下载」压在边框线上）。为各列表操作列补齐显式 `width`（2 项 160 / 3 项 240 / 4 项 320 / 5 项 400）并把 `scroll.x` 提到各列宽度之和以上；规则同步进 `AGENTS.md`、清单与设计文档。可被衍生项目吸收

- **图片验证码弹窗校验失败无错误提示（[infra]）**：`ImageCaptchaModal` 的 `refresh()` 内无条件 `setModalError("")`，而校验失败分支是「先写错误文案再调用 `refresh()`」，文案被立即清空，表现为验证码错误时只刷新图片、不给任何提示（登录 / 注册 / 找回密码等既有验证码流程同受影响）；改为 `refresh()` 不再清空错误文案，错误由打开弹窗与下次提交覆盖。可被衍生项目吸收

- **后台登录 e2e 断言失效（[infra]）**：`admin-login.spec.ts` 断言仪表盘出现「新闻总数」，而该文案随仪表盘重构为「系统态势总览」后已不存在，`pnpm e2e` 恒失败；改为断言稳定的页面标题（`getByRole("heading", { name: "仪表盘" })`），避免再与 KPI 文案耦合。

- **定时任务 per-tick 日志降级为 debug（[infra]）**：`shared-services/scheduler` 原在每次 `onTick` 以 `info` 记录「开始执行」与「执行完成」，每分钟任务每天写入约 2880 行心跳日志、淹没业务日志；改为 `debug` 并补充 `durationMs`（失败仍为 `error`），注册期日志保持 `info`。生产默认 `info` 下正常执行静默，`LOG_LEVEL=debug` 仍可拿到完整起止与耗时。可被衍生项目吸收

- **日志文件流级别跟随 `LOG_LEVEL`（[infra]）**：`shared-services/logger` 的文件流原硬编码 `level: "info"`，导致 `LOG_LEVEL=debug` 时 debug 日志只进开发控制台、永不落盘，与 `external-observability`「成功外部调用记 debug」及 `/admin/logs` 排障链路自相矛盾；改为文件流跟随配置级别（控制台生产仍仅 `warn` 以上），补 debug 落盘用例。可被衍生项目吸收

- **e2e 隔离库名解析修复（[infra]）**：`e2e/helpers/env.ts` 的 `E2E_DB_NAME` 在 `APP_DIR` 初始化之前求值，`loadAppEnv()` 读取 `APP_DIR/.env` 触发 TDZ 抛错并被 `try/catch` 静默吞掉，导致 `DATABASE_URL` 为空、Playwright 配置加载即 `Invalid URL`，`pnpm e2e` 完全不可用；调整声明顺序后恢复（现状全量 e2e 可跑）。可被衍生项目吸收

- **富文本编辑器占位符修复（[infra]）**：`@easyx/editor@1.1.1` 的 Placeholder 扩展生成的空段落属性名为 `data-data-placeholder`（双 `data-` 前缀），但其自带 CSS 用 `attr(data-placeholder)` 读取导致取空、占位文本不显示。该缺陷由升级 `@easyx/editor` 至 `1.1.2` 在包内修复（空段落改为单前缀 `data-placeholder`），占位符正常显示（浏览器实测）；此前在 `admin.global.css` 添加的本地覆盖 workaround 已随包升级移除。

- **错误兜底组件语义令牌化（[infra]）**：`ErrorFallback` 的 `DefaultErrorFallback`/`NotFoundFallback` 硬编码 zinc 色值换为语义令牌（`bg-background`/`text-foreground-secondary`/`bg-danger` 等）并删除注释掉的死代码，修复暗色主题下 404/错误页失控与直角风格不一致。

- **前台 locale 读取来源统一至 `context.locale` 并去冗余类型断言（[infra]）**：`getLatestNewsSFn` 原直接 `getCookie(LOCALE_COOKIE)` 重读并自行校验 `SUPPORTED_LOCALES`，与其它 SFn（`news.functions.ts`）读取 `context.locale` 的路径不一致；改为统一从请求中间件注入的 `context.locale` 读取。由于 `routeTree.gen.ts` 的 `Register.config` 增强使全局 requestMiddleware 类型流入 SFn 上下文，`context.locale` 已能推断为 `Locale`，一并移除 `getLatestNewsSFn` / `getLocaleBundleSFn` / `getVisibleConfigsSFn` 中冗余的 `(context.locale as Locale)` 断言、`context.locale || DEFAULT_LOCALE` 兜底（默认值已由 `localeMiddleware` 权威注入）与相关未用类型导入（`Locale` / `LOCALE_COOKIE` / `SUPPORTED_LOCALES`），语义行为不变。

- **locale 默认值收敛至 `localeMiddleware` 单一权威来源（[infra]）**：`router.tsx` 的 `createRouter({ context: { locale: DEFAULT_LOCALE } })` 是静态占位值（SSR 时不被改写，路由 loader 的 `context.locale` 恒为 `"zh"`），且 `__root.tsx` 的 `createRootRouteWithContext<{ locale: Locale }>` 与 `void context.locale` 均属休眠死配置；予以移除（`createRouter` 不再传 `context`，根路由改 `createRootRoute()`，loader 不再引用路由 `context.locale`）。同时 `localeMiddleware` 由盲目 `getCookie(...) as Locale` 改为 `SUPPORTED_LOCALES` 运行时校验，非法 Cookie 值回退 `DEFAULT_LOCALE`（成为 locale 默认值的唯一权威来源），并更新过时注释。`Header` 语言切换按钮改用 `LOCALE_COOKIE` / `SUPPORTED_LOCALES` / `DEFAULT_LOCALE` 常量（替换硬编码 `"lang"` / `"zh"` / `"en"`），消除魔法字符串并提升语言扩展健壮性。

- **补全前台英文种子翻译并新增完整性守卫（[infra]）**：前台大量 `t("中文")` 文案缺失英文种子（消息中心/退出登录/忘记密码/各类失败提示/分页/已读未读/重置相关等），致使英文站静默回退中文；已补齐 `i18n.seed.ts` 缺失条目，并新增 `i18n.seed.test.ts` 静态扫描守卫，自动校验前台所有 `t()` 字面量均存在于 `SEED_DATA`（en），防止后续新增文案遗漏种子。另修正 `translation.ts` / 缓存注释 / 翻译管理页占位符与「中文作为 key」约定不符的过时表述。

### Docs

- **管理端列表页规范文档与验收清单（[infra]）**：新增 `docs/admin-list-page.md`（分层职责 / 查询状态机 / 服务端契约 / 表体高度算法 / 图片列 / 操作列宽度 / 通用态 / 抽屉编辑 / 富文本高度）与 `.agents/checklists/admin-list-page.md`（逐项验收）；`AGENTS.md` 的「表格操作列」补齐 4 条硬规则并新增「表格列规范」一节；`.agents/skills/admin-crud` 的列表页示例去毒并补「列表页统一规范」章节；`.agents/guide.md` 补任务导航与清单索引。可被衍生项目吸收

- **日志级别语义与敏感配置加密文档（[infra]）**：`AGENTS.md`「日志约定」补充级别语义 + 一票否决判据 + 外部调用统一出口（`logExternalRequest`），并说明文件流跟随 `LOG_LEVEL`；`docs/deployment-ops.md` 补充 `CONFIG_ENCRYPTION_KEY` 与敏感配置加密说明。可被衍生项目吸收

- **SQLite 迁移指南时间戳方案改 `timestamp_ms`（[infra]）**：`db-sqlite` skill 原用 `integer({ mode: "number" })` + `$defaultFn` 承载时间戳，迫使业务层做 `Date` → `number` 全量改写；改为 `integer({ mode: "timestamp_ms" }).defaultNow()`——JS 侧保持 `Date`、DB 侧存毫秒且带 DB 级默认，写入/比较/读取/类型声明/测试断言均无需改；§7 由「Date → number 全量替换」收敛为「裸 sql 日期入参 / `db.all` 原始结果 / 字符串入参」三类人工处理，§3.2 / 3.4 / 9 / 11 / 12 同步更新。新增 §3.1.1：提供现成的 SQLite 版通用列工厂 `columns.ts`（含 `pk`/`createdAt`/`updatedAt`/`timestamps`/`softDelete`/`sortable`/`publishable`），通用列为单一改写点、无需逐表改，表文件仅需改 `pgTable`→`sqliteTable` 与业务列。迁移辅助脚本 `db-migration.ts` 的「甄别」规则新增「裸 sql 模板日期表达式插值」检查、`new Date(` 降级为「多无需改」。可被衍生项目吸收

- **项目定位重定向为「全栈开发工程基座」**：移除「内置 CMS 示例」的产品绑定叙事，改为强调全栈开发工程基座定位，CMS 降为支撑能力；业务示例收敛为单一 news（新闻），其余模块（dict / file / file-explorer / messages / config / translations / track / operation-logs / ai-providers / ai-rich-editor / demo）统一归入基建能力。同步更新 `AGENTS.md`、`README.md`、`docs/architecture-overview.md`、`docs/project-ecosystem.md`、`docs/ai-rich-editor.md`、上游同步/国际化 skill 与客户端可见产品文案（首页/关于页、i18n.seed、e2e 断言、i18n 单测、管理端导航分组标签），文案统一改为「全栈开发工程基座」口径。

- **AGENTS.md 包边界与说明补充**：结构树、README 链接清单与「新增共享逻辑」纳入 `@fsdx/ai-rich-editor`（AI 富文本工作台）；Server Function 章节明确「无入参 SFn（零参调用）可省略 `validator`」豁免，与现有零参 SFn 实践对齐。

- **文档统计计数硬编码与 doc-facts 机制移除（[infra]）**：正文不再硬编码易漂移的统计计数（表数 / 权限码数 / 缓存实例数 / skill 数 / schema 文件数），一律指向代码（`src/db/schema/`、`src/permissions/`），设计文档（`database-design` / `auth-permission-model`）仅保留解释性分组说明；删除 doc-facts 全套（`app/scripts/{doc-facts,gen-doc-facts,check-doc-facts}.ts` + `docs/generated/` + `doc:gen` / `doc:check` 脚本，根 `package.json` 的 `check` 移除 `doc:check`），文档体系收敛为「事实在代码、文档只解释」，同步更新 `documentation-architecture`、`db-sqlite` / `db-mysql` skill 与命令并清理迁移流程中的 doc-facts 引用。可被衍生项目吸收

- **文档偏移治理：历史性描述与路径漂移清理**：以当前代码为事实源全量比对文档，剔除描述旧状态的措辞与失效路径——
  - `README.md` 的 `@fsdx/lib` 描述去掉已下沉至 `src/shared-services/` 的 logger/jwt/ai/mail/sms；子包表补 `@fsdx/ai-rich-editor`；缓存行改为「以代码为准，部分位 `src/services/`、部分位 `src/shared-services/`」
  - `docs/database-design.md` 的 `message` 表列 `recipient_type/recipient_id` 改为 `user_type/user_id`（对齐已发布 Breaking），补全新表 `user_config`（表总览 + ER），`operation_log` 列名描述修正为 camelCase `operatorType`
  - `docs/auth-permission-model.md` 删除不存在的 `packages/lib/src/infra/jwt` 引用（JWT 在 `src/shared-services/jwt`）、修正 `match-permission` 实际路径、`ai` 权限补 `provider`
  - `docs/cache-system.md` 修正 `@fsdx/lib/cache` 实际路径（扁平结构，无嵌套 `cache/cache/`）
  - 三份包 README（`ui-spa`/`ui-ssr`/`ai-rich-editor`）的 `../core/README.md` 死链改为 `../lib/README.md`；`lib/README.md` 内 i18n/ai 路径修正为 `src/shared-services/`
  - `.agents/guide.md`、`docs/documentation-architecture.md` 文档清单去除硬编码数量；路由树补 `ai-providers`；缓存位置引用统一补 `src/shared-services/`；`project-ecosystem.md` 去旧包名「core 基础设施」表述

- **`ai-rich-editor` 文档归口包 README（[infra]）**：`docs/ai-rich-editor.md` 属组件级方案，改为合并进 `@fsdx/ai-rich-editor/README.md`（单一事实来源，贴近代码），删除独立 docs 文件；`docs/` 与 `README` 文档表仅经子包 README 索引，不再单独维护。合并时剔除原 docs 中的「演进记录」历史流水（由 CHANGELOG v2.0.0 承载），并把布局结构 / 对话状态 / 预览沙箱安全边界补进包 README；`documentation-architecture` 明确「组件/包级 API 与方案详解归各包 README，docs/ 仅作索引，不重复维护」。

- **新增国际化架构文档（[infra]）**：新增 `docs/i18n.md`（平台机制类），面向人类阅读——含两层翻译模型（`ui_translation` / `content_translation`）、语言检测与 SSR 加载时序、服务层关键文件、缓存与写路径（懒加载缓存/原子 upsert/批量导入）、实体翻译接入、管理端维护与扩展新语言要点；并挂入 README「文档」索引、architecture-overview「相关文档」与文档体系清单、`.agents/guide.md` 任务导航，i18n skill 增加指向该文档的链接。

### 依赖升级

- `@easyx/ai-rich-editor@0.1.0`、`@easyx/image-toolkit@0.1.0`：新增依赖，替代仓库内 `@fsdx/ai-rich-editor` / `@fsdx/image` workspace 包（发布自独立仓库）。

- `@easyx/ai-rich-editor` `^0.1.0` → `^2.0.0`、`@easyx/image-toolkit` `^0.1.0` → `^1.0.0`：均为破坏性变更，接入改造见 Refactor。

- `@easyx/editor` `^1.1.2` → `^2.0.0`：破坏性变更仅为公开类型命名收敛（`EasyxEditorOptions` → `EditorOptions`，其余 `ThemeType` / `ContentType` / `EventHandler` 等同理），`createEditor` API、选项字段、CSS 变量与 DOM 类名均不变；`@fsdx/ui-spa` 的 `RichEditor` 包装层同步改名，peer / dev 依赖一并升级。

### Breaking Changes

- ⚠️ **`/api/ai-chat` 协议变更与两个外部包大版本升级（[infra]）**：`/api/ai-chat` 由 TanStack AI AG-UI SSE 改为 OpenAI Chat Completions 兼容（入参 `{ messages, stream }`，出参厂商原始 SSE + `[DONE]`；厂商经 `?providerId=` 透传），下游若有自定义消费方需同步改造；`@easyx/ai-rich-editor` 升至 2.x（`endpointUrl` / `requestMeta` / `config.notify` → `chat` / 顶层 `onNotify`）、`@easyx/image-toolkit` 升至 1.x（`ImageEditorModal` 移除，改为宿主弹窗 + `ImageEditor`）。

- ⚠️ **仓库内 `@fsdx/ai-rich-editor` / `@fsdx/image` 包移除（[infra]）**：改由独立发布的 `@easyx/ai-rich-editor` / `@easyx/image-toolkit` 提供，下游同步需替换依赖与 import（`@fsdx/image` → `@easyx/image-toolkit`、`@fsdx/image/admin` → `@easyx/image-toolkit/ui`、`@fsdx/ai-rich-editor` → `@easyx/ai-rich-editor`），删除本地包目录与 `Dockerfile` 中的对应 `COPY packages/*/package.json` 行；AI 富编辑器宿主页面需改为 `ClientOnly` + 动态 `import()` 引入。

- ⚠️ **移除 `@fsdx/ui-spa/sfn-helpers`（[infra]）**：`safeSfnCall` / `unwrapSfn` 由 `#/utils/sfn-error` 的 `callSfn` / `sfnUnwrap` 取代（客户端调用统一经该模块）。

- ⚠️ **消息模块字段统一命名（[infra]）**：`message` 表列 `recipient_type/recipient_id` 重命名为 `user_type/user_id`；对应 SFn 入参 `recipientType/recipientIds` 改为 `userType/userIds`，管理列表返回字段 `recipientName` 改为 `userName`。

- ⚠️ **移除 `news` 的创建 / 编辑路由页（[infra]）**：`/admin/news/create` 与 `/admin/news/$id/edit` 不再存在（新建与编辑统一在列表页抽屉内完成），旧书签 / 浏览器历史访问将 404；`news` 列表页的「快速编辑」入口由「编辑」（同一抽屉）取代。

- ⚠️ **`@fsdx/ui-spa/table` 导出与语义变更（[infra]）**：`ProTable` 在页面骨架内会继承注入的表体高度（显式 `scroll.y` 仍优先）；`TableOperate.Delete` 不再捕获并提示错误（改由调用方 `callSfn` / `sfnUnwrap` 统一出口，调用方需保证 `onConfirm` 不抛出未处理的 rejected promise）；新增 `SortOrderCell` / `PublishSwitchCell` / `StatusTag` / `ImageCell` / `TableHeightProvider` / `useTableBodyHeight` / `useTableHeight` / `withDisabledReason`。

- ⚠️ **列表查询参数统一设界（[infra]）**：`listSchema` 基座的 `page` 要求 ≥ 1、`pageSize` 限制在 1–100；原先自行传入越界分页参数的调用方需按上限收敛。

- ⚠️ **`@fsdx/lib` 移除 `./error-utils` 与 `./captcha` 两个 subpath（[infra]）**：两者均不满足 lib 的「可原样移植」准入判据。`error-utils` 迁至 `#/utils/error-utils`（下游改 import 路径即可，注意 `sanitizeError(error, isDev)` 的 `isDev` 为必填）；`captcha` 并入 `app/src/services/captcha`（属服务端专属能力，下游需把验证码生成并入自身 `services/captcha`，并把 `opentype.js` / `@types/opentype.js` 依赖从 lib 转入应用包，同时把 `opentype.js` 加入客户端 import-protection 拒收清单）。

## [v2.0.0] - 2026-09-04

### Features

- **`@fsdx/ai-rich-editor` 样式作用域化（[infra]）**：AI 生成片段顶层的内嵌 `<style>` 全局选择器直接注入正文会污染宿主全局样式；在「应用到编辑器」/`autoApply` 时刻由包内 `scopedRichContent` 给片段根注入作用域前缀（编辑器实例创建时 `generateScopePrefix` 生成一次并一直沿用）并改写 `<style>` 内选择器为 `.{prefix} …`，产物自带 scope 前缀，宿主直接当作 HTML 引入（`dangerouslySetInnerHTML`）即不污染全局，端侧零处理；system prompt 收紧为内联优先 + 禁用 `body`/`*`/`:root`/`html` 全局选择器；预览 iframe 与新窗口直接使用该 `value`，所见即所得。

- **AI 多厂商适配（OpenAI 协议）**：
  - **配置重构**：`ai_base_url`/`ai_api_key`/`ai_model` 三键删除，收敛为单 JSON 配置 `ai_providers`（对象形式：`{ [厂商id]: { name, baseUrl, apiKey, default?, models } }`，键为厂商 id，每个厂商可挂多个模型并携带能力位；`json` valueType，管理端「AI设置」分组）；支持同时挂 DeepSeek/Moonshot/Qwen/本地 vLLM 等多个 OpenAI 兼容厂商并指定默认
  - **模型能力位**：每个模型支持 `name`/`default` 及能力位 `contextLimit`/`outputLimit`/`jsonOutput`/`toolCalls`/`reasoning`/`input`/`output`；声明了 `reasoning`/`jsonOutput`/`toolCalls`/`input` 的模型映射为 TanStack AI `createModel(name, { input, features })`，零能力位走裸字符串（乐观默认，零回归）；`contextLimit`/`outputLimit`/`output` 为项目自身元数据，预留给 UI 展示与裁剪/成本统计
  - **`shared-services/ai` 升级**：`ai.provider.ts` 提供 `readProviders`/`resolveProvider`/`resolveModel`/`getAiProvider(providerId?)`/`getAiAdapter(providerId?, modelId?)`（按「厂商 id + 配置指纹」缓存的跨 bundle `Map`，多厂商互相隔离）；`ai.server.ts` 的 `streamAiChat`/`completeText` 增加 `providerId?`，缺省走默认厂商
  - **兼容迁移**：`readProviders()` 对首版数组存量数据做一次性迁移（`id` 取自元素 `id`，`model` 归一化为 `models`），旧部署无需手工改库
  - **专用「AI 厂商」管理页**：新增 `/admin/ai-providers`（antd 表格 + 弹窗表单，读写 `ai_providers` 键，无新增 DB 表）+ 权限 `ai:provider`（`AI_PROVIDER_MANAGE`）+ 系统管理菜单项；同步 `doc:gen` 权限清单
  - **调用侧厂商选择**：`@fsdx/ai-rich-editor` 新增 `requestMeta` prop（合并进 `sendMessage` 的 `forwardedProps`），`/api/ai-chat` 读取 `forwardedProps.providerId`；demo（`/admin/demo/ai`、`/admin/demo/ai-rich-editor`）加厂商下拉
  - AI 翻译走默认厂商（`completeText` 不传 `providerId`）

- **`@fsdx/ai-rich-editor` 优化（fragment-only 定位 + 配置归拢 + 本地打包）**：
  - **定位收敛为 fragment-only**：删除 `AiChatMode` / `AiRichEditorProps.mode` / `AiChatRequest.mode` / 顶栏「片段-完整文档」切换，只输出 HTML 内容片段（另一种形态的富文本）；app 宿主 adapter / ai-chat 服务不依赖 `mode`，不受影响
  - **提示词重写**：默认 system 提示词按富文本片段定位重写（强调「只输出 body 内部片段、不输出整页文档」），删 `MODE_PROMPT_DESCRIPTIONS`，`buildDefaultSystemPrompt()` 去掉入参
  - **新增 `previewHead` 附加代码注入**：`config.previewHead` 一段原始 HTML 原样注入预览文档 `<head>`（如预置全局样式/脚本），`buildPreviewDocument(html, previewHead?)` 支持
  - **配置归拢到 `config` + 设置面板**：包配置项统一收拢到 `config` 属性（`autoApply`/`systemPrompt`/`previewHead`/`notify`），`adapter`/`value`/`onChange`/`height` 保持顶层；顶栏新增「设置」按钮 → antd 抽屉面板，编辑保存后生效并经 `onConfigChange` 回写宿主以持久化；提示词展示区分「自定义」与「内置默认」（生效 Tag + 只读折叠模板）
  - **可分离性与体验**：补 `react`/`react-dom` peer 与测试 devDeps；Monaco 改本地打包并**仅启用 html/css/js**（`editor.api` + 三个 `languages/definitions/*/register.js`，Monarch 词法高亮、无需语言服务/worker），去除默认 CDN 加载并显著缩包；新增 `useIsDark()` 订阅 `data-theme`，Monaco 主题随三态切换实时联动；补 `sseStream`/`stop` 中止/历史裁剪/`previewHead` 等测试
  - **布局重构**：三栏改用 antd `Splitter` 水平拖拽分割（对话默认 300 / 预览默认 440 / 预览 max 1200，含 min/max 阈值）；删除顶栏「折叠」按钮，改为「设置」下拉内的「对话面板 / 预览面板」开关，与 Splitter 联动显隐；预览区设计升级——自带头部（设备档位 Segmented、脚本开关、刷新按钮），顶栏精简为「复制 + 设置」
  - **预览设备档位**：移除平板档与横竖屏切换——桌面拉伸预览（无壳）、手机为固定尺寸设备框（375×812，按舞台等比缩放）；面板最大宽度调大至 1200；新增**新窗口预览**（同源 `window.open` + `document.write` 写入完整文档，保留 `/file` 相对资源）

- **新增 `@fsdx/ai-rich-editor` 独立包（AI 富编辑器三栏工作台）+ 演示页**：
  - **包定位**：重客户端组件，对标 `RichEditor`（WangEditor 富文本）的 AI 进化形态——左栏 AI 对话（预设指令 / 流式回复 / 代码块一键应用）+ 中栏 Monaco 代码编辑 + 右栏 iframe 沙箱预览，顶栏支持面板折叠、设备宽度（桌面/平板/手机）、脚本开关、复制；受控 `value/onChange`
  - **对话契约**：`AiChatAdapter = (req, signal) => AsyncIterable<AiChatChunk>` 方法契约，调用方注入实现（可走 OpenAI / SSE / 宿主 SFn），组件不持有端点/传输/鉴权知识；`stop` 即 abort；system 提示词由适配方注入（包提供 `DEFAULT_SYSTEM_PROMPT_TEMPLATE` / `MODE_PROMPT_DESCRIPTIONS` 模板）
  - **依赖收口**：peer 仅 `antd` / `@ant-design/icons` / `monaco-editor`，dep 仅 `@monaco-editor/react`；样式用 tailwind 语义令牌类（宿主 `global.css` 注入 + `@source` 扫描）；附通用 SSE 工具 subpath（`@fsdx/ai-rich-editor/sse`）
  - **app 侧集成**：demo 页 `/admin/demo/ai-rich-editor`（侧栏「测试页」菜单）+ 宿主 adapter 示例（`-mods/ai-rich-editor.adapter.ts`，映射 `/api/ai/html-chat` SSE 端点）；权限 `html-editor:use` + 审计保留在服务端；原「HTML 编辑器演示」页与 app 内组件目录随包迁移删除

- **`@fsdx/ai-rich-editor` 体验修复（对话与编辑器联动 + 打字机流式渲染）**：
  - **AI 生成自动应用到编辑器**：`useAiChat` 新增 `onComplete` 完成回调，`AiRichEditor` 默认在流结束后把回复中的 HTML 代码块自动写入编辑器（`autoApply` prop 可关，手动「应用到编辑器」按钮保留）——对话区与编辑器/预览形成联动
  - **打字机流式渲染**：`streamText` 改为 rAF 逐帧渐进推进（每帧 12 字符），不再一次性 setState——即使后端一次性返回大 chunk 也呈现逐字效果；流成功结束清空占位避免与列表消息重复，失败/中止保留已输出部分
  - **降级清空与清空提示修复**：deep→fast 降级（`attempt` 事件）时同时清空已输出的正文与思考残文（此前仅清思考，会导致降级后正文混入 fast 重新生成的完整结果）；「清空对话」触发的 abort 不再残留「已停止生成」错误提示，并补充 `useAiChat` 流式/降级/错误/清空四条单元测试

- **`@fsdx/ai-rich-editor` 思考过程展示（reasoning）**：
  - **全链路接通**：app SSE 路由补 `onThinking` 下发 `thinking` 帧 → 包 `sse.ts` 新增 `SSE_EVENT_THINKING` → adapter yield `{ type: "thinking" }` → `useAiChat` 累积 `thinkingText` 并随 assistant 消息持久化（`ChatTurn.thinking`）
  - **UI**：新增 `ThinkingBubble` 思考气泡（默认收起显示「思考中…/已思考 (N 字)」，展开可看全文），渲染于每条 assistant 消息正文上方与流式占位；deep→fast 降级（`attempt` 事件）自动清空残缺思考片段；无思考模型（fast / 关闭 thinking）不渲染气泡

- **`@fsdx/ai-rich-editor` 接入重构（SFn 流式 + 提示词归包）**：
  - **弃用自建 API 端点**：删除 `/api/ai/html-chat` Server Route，改为 `htmlChatSFn`（Server Function 返回 `ReadableStream<Uint8Array>`，经 TanStack Start 原始流协议逐块透传；SSE 帧编码逻辑随迁至 `services/html-editor/html-editor.functions.ts`），鉴权/审计沿用 `adminPermGuard` + `logOperation`，客户端 adapter 由 `fetch` 改为直接消费 SFn 流——减少自定义 HTTP 端点、走框架原生流式能力
  - **提示词归包**：`buildHtmlSystemPrompt` 自 `html-editor.server.ts` 移除，改由 `@fsdx/ai-rich-editor` 包的 `buildDefaultSystemPrompt(mode)` 按输出形态生成（组合 `DEFAULT_SYSTEM_PROMPT_TEMPLATE` + `MODE_PROMPT_DESCRIPTIONS`）；`AiChatRequest.systemPrompt` / `AiRichEditorProps.systemPrompt` 暴露自定义配置项（覆盖默认），app server 仅透传注入 system 消息、不再持有提示词业务语义

- **新增自定义 head 配置**：预置 `custom_head_config` 系统配置（`clientVisible`、`json` 类型），管理端可直接编辑 JSON（结构同 TanStack head()：`{ meta, links, scripts, styles }`，如百度统计、JSON-LD）；`parseCustomHeadConfig` 解析并校验 `scripts/styles.children` 为字符串，前台 `SSRRootDocument` head 全局注入，管理端不生效

- **资源管理器页面 UI 优化 + 夜间模式适配**：
  - 顶部面包屑改为可编辑路径输入框（`AdminPageContent` 新增可选 `titleTrailing` 插槽，路径输入 + 前往按钮，回车/按钮跳转，`normalizePath` 规范化输入）
  - 表格名称列定宽 320px，操作列不再强制 240px 宽度（按内容自适应，保留 `fixed: right`）；空态增加图标
  - 硬编码颜色全部替换为 antd 语义色 token（`--ant-color-text*`/`warning`）与 `--s-surface-tertiary`/`--s-text`，文本预览区明暗双主题自适应
  - 侧边栏菜单「目录浏览」更名为「资源管理器」（与页面标题一致）

- **接入 PWA manifest + 浏览器主题色跟随**：
  - 前台 `SSRRootDocument` head 引入 `/manifest.json`（theme_color/background_color 对齐前台亮色表面 `#ffffff`，start_url/scope 归一至 `/`），提供「添加到主屏幕 / 图标 / 地址栏主题色」能力
  - `ThemeScheme` 新增 `themeColor` 字段（与各端 `--s-surface` 同色，见 themes.ts 双写注释），`applyThemeToDom` 同步更新 `<meta name="theme-color">`，明暗切换 / 跨标签页 / 系统偏好联动时浏览器地址栏颜色跟随；前台与管理端 head 均挂载 meta，管理端不接 manifest

- **前台图标品牌色修正 + 暗色可见性适配**：
  - `favicon.svg` 描边与 F 文字由 antd 蓝 `#1677ff` 改为中性灰 `#212121`；`logo192.png` / `logo512.png` 由 React 默认青色原子 logo 重绘为中性灰六边形 F（Python 标准库几何渲染，一次性脚本见 `.tmp/`）
  - `Logo` 组件拆分 `ClientLogo`（前台）/ `AdminLogo`（管理端）并统一改为内联 SVG：前台 `currentColor` + `text-foreground` 随明暗主题自动取前景色，解决深灰 `logo.svg` 在暗色下不可见；管理端 fill 取 `--s-primary`、F 取 `--s-primary-fg`，随亮暗品牌色自动切换，替代固定棕色的 `logo-admin.svg`
  - `favicon.svg` 保留供亮色模式、新增 `favicon-dark.svg`（前台暗色主色 `#f5f5f5`），前台 head 双 favicon 按 `prefers-color-scheme` 切换
  - 删除不再引用的 `logo.svg`、`logo-admin.svg` 与无消费方的 `drizzle.svg` 死资源

- **管理端侧边栏菜单优化**：
  - `nav-config.ts` 重新组合分组：合并「用户管理 + 权限管理」为「用户与权限」，文件类、翻译类、日志类各自独立成组，解决原「系统管理」9 项杂物袋问题
  - 菜单命名对齐：角色管理 → 管理端角色（与客户端角色对称）、文件资源管理器 → 目录浏览、日志查询 → 运行日志；同组内重复图标差异化（IdcardOutlined/AuditOutlined/FileSearchOutlined/GlobalOutlined）
  - 菜单渲染自 AdminLayout 抽至 `AdminNav.tsx`（`AdminNav` + `useNavCollapse`）：分组支持折叠（CSS grid 0fr↔1fr 动画），折叠状态持久化到 localStorage（key `admin-nav-collapsed-groups`），路由切换自动展开包含激活项的分组，侧边栏图标模式下强制展开全部分组
  - 滚动条样式统一：`admin.global.css` 新增 `--s-scrollbar-thumb` 语义令牌（亮暗自适应）与 `.scrollbar-thin` 类，应用于侧边栏导航与 `AdminPageContent` 内容区

- **消息中心（message）**：`message` 表（`recipient_type` + `recipient_id` 无外键）+ 服务层 10 函数 + 三组 SFn（客户端自助/管理端收件箱/管理端管理）+ 前台 `/messages`（shadcn/ui SSR）+ 管理端 `/admin/messages`（收件箱）与 `/admin/messages/manage`（管理）+ Header/AdminLayout 消息铃铛（30 秒轮询）+ `message:view/send/delete` 权限

- **文件资源管理器（file-explorer）**：`STORAGE_DIR` 目录浏览 + 路径穿越防护 + 写保护 + `/admin/file-explorer` 页面 + `/api/download/file-explorer/*` 下载路由 + `file_explorer:*` 权限

- **lib/ms + MSInput**：vercel/ms 移植（parse/parseStrict/format/ms）+ 4 个测试文件 + antd 时长输入组件

- 修复既有测试失败：jwt 测试 logger mock 缺 `debug`；news 测试 i18n.server mock 缺 `applyTranslations`（改用 `importOriginal`）

### Infrastructure

- **[infra] AI 能力迁移到 TanStack AI（全栈框架式接入，单模型，下沉为 app 服务层）**：
  - **删除 `@fsdx/lib/ai`（AI 不再是 core 基建）**：AI 完全下沉到 app 服务层 `shared-services/ai`——`ai.provider.ts` 负责配置读取（`ai_base_url`/`ai_api_key`/`ai_model`）+ 基于 `@tanstack/ai-openai/compatible` 的 `openaiCompatible` provider 构建 + 按指纹缓存的跨 bundle 单例（globalThis 键 `__FSDX_AI_PROVIDER__`）；`ai.server.ts` 负责 `chat()` 编排。原 `deepChat`/`fastChat`/`deepChatStream`/`fastChatStream`/`AiModelType`/`truncateJsonForLlm`（无消费）一并移除；core 移除 `@tanstack/ai`/`@tanstack/ai-openai` 依赖与 `./ai` 导出
  - **`bootstrap.ts` 不再 `initAi`**：`@fsdx/lib/ai` 的 `initAi` 依赖注入随模块删除消失，AI 配置改由 `shared-services/ai` 直接 `getConfig` 读取
  - **服务编排 `shared-services/ai/ai.server.ts`**：`streamAiChat`（返回 TanStack AI 流）/ `completeText`（`chat({ stream:false })` 非流式取文本）；`chat()` 编排与流消费收敛在 app 编排层，AI 翻译等业务只依赖 `shared-services/ai`
  - **新增 Server Route `/api/ai-chat`**：`adminPermRouteGuard(AI_CHAT)` + `chatParamsFromRequest` + `toServerSentEventsResponse`，替代原 Server Function 自定义 SSE 帧协议；前端 `@fsdx/ai-rich-editor` 改用 `useChat`（`@tanstack/ai-react`）消费标准 SSE
  - **单模型配置**：`ai_deep_model`/`ai_fast_model` 收敛为 `ai_model`（`PRESET_CONFIGS`/初始化表单同步），去掉 deep→fast 自动降级与空内容参数变化重试，交由 TanStack AI 重试/错误处理；不保留旧键迁移（无历史兼容）
  - **AI 翻译**：`aiTranslateFieldSFn` 由 `fastChat` 改为 `shared-services/ai` 的 `completeText`，保留 `ai_translation_prompt` 模板与友好错误包裹；`FieldTranslationDrawer` 无感知
  - 依赖新增 `@tanstack/ai` / `@tanstack/ai-react` / `@tanstack/ai-openai`（app、ai-rich-editor）

- **[infra] 系统配置缓存挂载 globalThis 跨 bundle 共享**：`configCache`/`configTranslationCache` 原为模块级单例，Nitro 入口（bootstrap 注入 `getConfig`）与 SSR 渲染器分别打包一份实例，启动后经管理端修改的配置只刷新 SSR 侧缓存，注入 `getConfig` 的模块（AI / SMTP / 短信）仍读到启动时空值——表现为运行时填写 AI 配置后 AI 对话仍报「AI 客户端未配置」；现两个缓存实例挂载 `globalThis`（`__FSDX_CONFIG_CACHE__` / `__FSDX_CONFIG_TRANSLATION_CACHE__`），任意 bundle 读写同一实例，运行时配置变更即时生效。可被衍生项目吸收

- **[infra] 系统配置新增布尔值类型**：`EditorType` 新增 `boolean`（管理端编辑渲染 Switch，列表用「是/否」彩色标签展示，存储仍为 `"true"`/`"false"` 字符串），`smtp_secure` 预置项改用该类型，消除管理端手拼 true/false；`ensurePresetConfigs` 对已存在预置项仅同步 valueType（value 等其余字段不受影响），已部署系统重启即生效

- **[infra] 认证 Cookie Secure 标志可配置化**：新增 `COOKIE_SECURE` 环境变量（未设置时生产默认开启），admin/client 登录 Cookie 的 `secure` 标志由 `isCookieSecure()` 统一决策；线上未启用 HTTPS 时设 `COOKIE_SECURE=false` 即可正常登录（此前仅 `NODE_ENV === "production"` 判定，无法显式关闭，http:// 访问下浏览器不保存 Cookie、登录后被立即打回登录页）；`.env.example`、dev docker-compose、部署文档同步，生产 compose 透传在部署子仓库（fsdx-deploy）同步

- **[infra] 生产部署子仓库（fsdx-deploy）+ 迁移 fail-fast**：
  - 新增 `deploy/` 子模块（[fsdx-deploy](https://github.com/easyx-dev/fsdx-deploy.git)，回灌自 bom-easy 部署实践）：生产 compose（内置 postgres + app，镜像 `ghcr.io/easyx-dev/fsdx`）、`deploy.sh` 一键部署（等待健康检查 = 迁移结果）、`backup.sh`/`restore.sh` 备份恢复、`preflight-migrations.sh` 迁移预检与运维手册
  - bootstrap `runMigrations()` 改 **fail-fast**（失败即应用启动失败，原 warn 容错移除），生产部署由子仓库健康检查捕获迁移结果
  - 新增 GitHub Actions（`.github/workflows/build.yml`）构建推送 `ghcr.io/easyx-dev/fsdx:{latest|sha|tag}`，与内网 GitLab CI 并存
  - `deployment-ops.md` 生产部署章节收敛为指向子仓库 README；AGENTS/guide 同步
  - 影响：数据库迁移失败不再静默容错（本地 dev 与生产均 fail-fast）；生产部署运维迁移至 `deploy/` 子仓库

- **[infra] 文档事实生成与校验（doc-facts，回灌自 bom-easy `/backport` 试点）**：新增 `app/scripts/doc-facts.ts` + `gen-doc-facts.ts` + `check-doc-facts.ts`，从代码单一事实来源生成 `docs/generated/{permissions,tables}.md`（`pnpm doc:gen`），`pnpm doc:check` 挂入 `pnpm check` 自动拦截文档数字漂移（如「17 张表」「9 个缓存实例」「61 个权限常量」）；documentation-architecture 将 docs/generated 由「预留」落实为已实现机制并补充事实变更流程

- **[infra] 模板命名面收敛化改造 + 衍生项目协同进化协议**：
  - **运行期标识收敛**（可被衍生项目吸收）：Cookie 名收敛为集中常量 `COOKIE_NAMES`（`src/constants/cookie-names.ts`，中性默认 `admin_token`/`client_token`，移除 `fsdx_*` 硬编码）；e2e 库名由 `DATABASE_URL` 派生 + `_e2e` 后缀（`E2E_DB_NAME` 可覆盖）；e2e 账号邮箱默认 example.com 域（`E2E_ADMIN_EMAIL`/`E2E_CLIENT_EMAIL` 可覆盖）
  - **部署文档路径示例中性化**：`/opt/{项目名}/` 占位、镜像 tag 示例改 `{项目名}`
  - **新增衍生项目协同进化协议**：`docs/project-ecosystem.md`（定位模型 + 演进方向判定准则 + 命名面映射 + 基线管理）；`.agents/skills/` 新增 derive-project / upstream-sync；`.agents/commands/` 新增 /derive、/import-upstream、/backport；`.agents/checklists/` 新增 derive / upstream-sync 两份清单；AGENTS.md 新增「衍生项目与协同进化」章节（命名收敛硬规则、`[infra]` 标记、回灌净化）
  - 影响：衍生项目可据 CHANGELOG `[infra]` 条目吸收基建变更；模板 Cookie 名变化，既有部署需重新登录

- **版本发布流程 + CHANGELOG 归档机制**：
  - `app/package.json`（`@fsdx/web`）新增 `version` 字段（起始 `1.1.0`，即下一个待发布版本），版本号统一 `v1.x.y` 与 git tag 一致，根 `package.json` 为 workspace 编排壳不设版本
  - 新增 `.agents/commands/deploy.md` 发布命令：联动提交 → 确定版本（未发布直接用当前版本，已发布则 bump patch）→ 更新 CHANGELOG（Unreleased 升版 + 归档）→ 打 tag（含 commit 摘要）→ 推送
  - AGENTS.md 新增「变更日志（CHANGELOG）」章节：主文件只保留 `[Unreleased]` + 最近 3 个版本 + 「历史版本」索引，更早版本归档至 `docs/archive/changelog/`
  - `[1.0.0]` 历史版本归档至 `docs/archive/changelog/v1.0.0.md`，主 CHANGELOG 历史索引链接指向归档

- **favicon ?url import 缓存治理**：favicon.svg / favicon-dark.svg / favicon-admin.svg 自 `public/` 移入 `src/assets/` 并以 `?url` import（`Document.tsx` 内联为带 hash 的资源，图标变更不再受浏览器 URL 缓存影响）；`manifest.json` 移除对已删除 `favicon.svg` 的图标引用（PWA 图标保留 png）

- **新增 check-architecture 架构审计命令**：`.agents/commands/check-architecture.md` 按 8 维度（分层/路由/SFn/组件/类型与 DB/安全/错误处理/测试）全量扫描并输出分级报告；配套 `.agents/checklists/` 新增 sfn / route / component 三份精简检查清单

- **AGENTS.md 新增「对话效率」章节**：约定控制单会话上下文体积（阶段化会话 / explore 子代理 / read 限定行范围 / bash 输出瘦身 / 长文档按需读取），对齐 bom-easy 项目治理实践

- **`@fsdx/lib` 基础设施补齐（对照 bom-easy lib 查漏）**：
  - **`ai` 模块能力对齐**：重构拆分（types / client / chat / chat-stream / truncate，subpath 与既有 API 签名不变）；`ChatOptions` 新增 `extraBody`（如 DeepSeek thinking 控制，思考关闭时不传 temperature）；`deepChat` / `fastChat` 补齐 deep 失败自动降级 fast 重试、空内容参数变化重试（去 `max_tokens` → 改 `temperature=0`，带递增退避），客户端初始化同步超时与 SDK 重试；新增流式 `deepChatStream` / `fastChatStream`（逐 token 回调 + `reasoning_content` 思考流 + 降级通知）；新增 `truncateJsonForLlm` 大体积 JSON 结构截断。**行为变化**：空内容重试后仍为空时 `deepChat`/`fastChat` 直接抛错（原返回空串），`aiTranslateFieldSFn` 捕获后转友好提示，避免用户看到原始错误
  - **新增 `@fsdx/lib/semaphore`**：`Semaphore` 并发限流（许可打满有界排队，队列满 / 等待超时抛 `SemaphoreTimeoutError`）
  - **新增 `@fsdx/lib/task-manager`**：`createTaskManager` 内存任务管理器（pending/running/done/failed 状态机 + TTL 惰性清理 + 事件缓冲 / SSE 订阅与断线回放），供后台任务进度复用
  - **captcha 补齐 `createMathExpr`**：算式验证码生成（`+`/`-`/`+-` 随机），配套 `random.ts` 新增 `mathExpr` 原语
  - 全部新增/增强模块补齐 vitest 测试（ai 降级/重试/流式/截断、semaphore 并发与超时、task-manager 状态机与事件、captcha 算式）

- **Playwright e2e 测试体系接入（关键页面回归）**：
  - 新增 `@playwright/test`（app devDependency）+ `app/playwright.config.ts` + `app/e2e/`（helpers/scripts/specs），根命令 `pnpm e2e`（app 内 `pnpm e2e`）
  - 专用隔离数据库 `fsdx_web_e2e`（与开发库彻底隔离）：`e2e/scripts/prepare.ts` 负责建库、重置 public/drizzle schema、直接执行 drizzle 迁移 SQL（迁移记录写入 `drizzle.__drizzle_migrations`，与 bootstrap 的 `runMigrations` 读取路径一致，避免服务启动时重跑迁移）并种子 root 管理员 / 客户端用户 / 预置角色，服务启动时 bootstrap 自动补齐预置配置/字典/翻译；webServer 运行在独立端口 3100，避免与本地 dev server 冲突
  - 前台 SSR 5 个 spec（首页/Hero/Header、登录、注册、忘记密码、Header 登录态）：注册/忘记密码通过 `seedCaptcha()` 直插 `captcha_code` 绕开图片验证码弹窗与 SMTP 邮件链路，确定性通过
  - 后台 SPA 5 个 spec（登录、管理员用户、客户端用户、管理端角色、客户端角色）：覆盖列表/搜索/新建（含权限选择器）/编辑/重置密码/删除
  - `biome.json` 纳入 `**/e2e/**`，`app/tsconfig.json` 纳入 e2e 类型检查；`.gitignore` 增加 `test-results/`、`playwright-report/`

- **`/health` 健康检查端点迁移至 Server Route 并升级为就绪探活**：
  - 由 Hono 自定义路由（`hono-app.ts`）迁移为 TanStack Start Server Route（`routes/health.tsx`），Hono 层保留为空壳预留自定义 API 路由
  - 响应升级为通用健康检查风格：`status / uptime / timestamp / version / checks`，`checks` 并发探测数据库连通（`SELECT 1`，含 `latencyMs`）与存储目录可写；全部可用返回 `200`，任一异常返回 `503`（readiness 语义），供 Docker healthcheck / Playwright 正确等待依赖就绪
  - 检查逻辑位于 `src/services/health/health.server.ts`（含 vitest 覆盖）；版本号由 Vite `define` 从 `app/package.json` 构建时注入 `__APP_VERSION__`（`env.d.ts` 声明、`vitest.config.ts` 同步注入测试值）

- **[infra] 移除 Hono 自定义 API 层，回归纯 TanStack Start**：
  - 删除 Hono（`hono` / `@hono/node-server` 依赖）与 `src/hono-app.ts`，`app/server.ts`（Nitro entry）回归薄壳：bootstrap + HTTP 指标埋点 + 直接透传 TanStack Start SSR
  - 自定义 API 一律走 Server Function / Server Route（`/health`、`/api/metrics`、下载端点已有先例）；将来出现开放 REST / webhook 等非自身前端消费场景时再按需引入
  - `http_requests_total` 入口埋点修复：指标注册表挂载于 globalThis，解决 Nitro 入口与 SSR 渲染器分别打包 metrics.ts 导致入口计数不可见的问题（配套 vitest 覆盖跨模块图共享）
  - 影响：依赖减少、入口分流逻辑简化；请求行为等价（未匹配路由仍由 Nitro 兜底）

- **[infra] 分层重构：单仓库多包 + `@fsdx/lib` + `src/shared-services/`（可被衍生项目吸收）**：把原混装「纯可复用逻辑 + app 绑定单例/DI + 业务 service」的 monorepo 拆为单向分层 DAG——`routes → services → shared-services → (lib → db)`：
  - **单仓库多包**：`src/` 整体移入 `app/src/`（`@fsdx/web`），根 `package.json` 为 `--filter` 编排壳；`server.ts`/`public/`/`drizzle/`/配置文件移入 `app/`
  - **`@fsdx/lib`（subpath exports、无根桶，原 `@fsdx/core`，`packages/core` → `packages/lib`）**：仅保留纯可复用逻辑——utils（ms/export/cn/match-permission/error-utils/date-format）、`@fsdx/lib/cache`（原 `cache-core`）、infra 通用非单例（captcha/semaphore/task-manager/batch-writer）+ `StorageAdapter` 纯契约（`@fsdx/lib/storage`）；**零全局态、不读 env/db、不做日志耦合**（错误向上抛出，警告经 `onEvent` 钩子或 `console`，如 `batch-writer`）；第三方依赖收敛为 clsx / tailwind-merge / opentype.js；新增 `@fsdx/ui-ssr`（shadcn button/card/badge/input/textarea + AutofillBlocker）与 `@fsdx/ui-spa`（antd 基础组件，antd 为 peerDependency）
  - **`src/shared-services/`（app 层，高共享 service 归属）**：承载 app 绑定单例——`logger` / `jwt` / `metrics` / `storage`（`LocalStorageAdapter` + 单例）/ `scheduler` / `mail` / `sms` / `request-context` + 系统级共享域 `config` / `dict` / `i18n`（含 `i18n.functions`）/ `ai`（含 `ai-providers.functions`）/ `query-utils` / `operation-log`；**只依赖 `lib`/`db`/本层，绝不引用 `services`**（依赖图无环；判断标准：一个 `services` 模块被大范围引用共享 → 具备成为 shared-services 的条件）；`app/src/lib/` 目录删除（track 并入 `services/track/track.ts`，其余并入 shared-services）
  - **去依赖注入透传**：`mail` / `sms` / `scheduler` 直接 `import { logger }`，`mail` / `sms` 直接 `import { getConfig }`（`shared-services/config/config.server`）；删除 `initMail` / `initSms` / `setSchedulerLogger` 与 `createGlobalDepsStore`（`shared-services/deps-store` 删除）；`bootstrap.ts` 清空依赖注入；跨 bundle 一致性靠 globalThis（metrics 注册表、config / AI provider 缓存）
  - **其它**：logger 改 `createLogger` 工厂；jwt 改 `createJwt` 工厂；`COOKIE_NAMES` 迁至 `src/constants/cookie-names.ts`；`matchPermission` 迁入 lib；`OperatorType` 下沉 `db/schema/operation-log`（`request-context` type-only 引用，拆除 `db → core` 反向依赖）；`antd-static` 迁入 ui-spa、app 删除 `#/components/antd-static` 壳；Tailwind 经 `@source` 扫描 ui 包源码类名；i18n 单模块化；npm 依赖迁移（`pino`/`pino-pretty`/`jose`/`nodemailer`/`cron`/`@alicloud/*` 自 lib 移入 app）
  - 影响：`app/src/lib` 与 `#/lib/*` 路径废弃；整体目录/包布局与 import 路径变更；方案文档 `.opencode/plan/lib-shared-services-layer-rework.md` / `shared-services-consolidation.md`

- PostgreSQL + Drizzle ORM（17 张表，uuid 主键，软删除，timestamptz）

- Vitest 测试（79 个测试文件，822 条测试）

- 迁移流程：`pnpm db:generate` + `pnpm db:migrate`（bootstrap 启动自动执行）

### Refactor

- **`@fsdx/ai-rich-editor` 对话区 UI 迁移至 Ant Design X + 两栏布局（[infra]）**：
  - 对话区渲染改用 **Ant Design X**：消息 `Bubble` / 输入 `Sender` / 空态 `Welcome`+`Prompts` / 思考 `Think` / 错误 `Alert`；数据流仍为 TanStack AI headless（`createChatHook` + `fetchServerSentEvents`，SSE 契约与 `/api/ai-chat` 不变）
  - 消息 markdown 渲染改用 **`@ant-design/x-markdown`** 的 `XMarkdown`（替换 `react-markdown`+`remark-gfm`+手写 `splitContentBlocks`；```html 代码块「应用到编辑器」保留，经 `components.code` 拦截）
  - 布局由三栏改为**两栏**：左=预览区、右=AI 对话面板（默认 420，min 400 / max 600）；「编辑器」（Monaco）改为顶栏开关项，打开后在左栏与预览并排（移除 `showChat`/`showPreview`，新增 `showEditor`）
  - 依赖：新增 `@ant-design/x`、`@ant-design/x-markdown`，移除 `react-markdown`、`remark-gfm`；移除 `ThinkingBubble` 导出（包内私用、host 未引用）
  - **`@source` Tailwind 扫描路径修正**：`app/src/styles/{admin,ssr}.global.css` 三条 `@source "../../packages/*/src"` 原从 CSS 文件解析到不存在的 `app/packages/...`，改为 `../../../packages/*/src` 正确指向仓库根；使三个 ui 包独有工具类正常生成（修复 `shadow-md` 等悬浮投影无效果）
  - 样式微调：空态去掉 `Welcome` 灰底块改居中纯文字，推荐指令由 `wrap` 两列改 `vertical` 纵向单列；XMarkdown 代码块 `lang` 判定放宽为 `startsWith("html")`；代码卡片跳过挂载首轮滚动（流式增量触底、完整代码块停在顶部）

- **`@fsdx/ai-rich-editor` 对话区改为 TanStack AI headless UI（`createChatHook`）**：
  - 对话区用 `@tanstack/ai-react/ui` 的 `createChatHook` 重构：模块作用域注册 `components`（`layout`/`message`/`input`）+ `partsComponents`（`text`→`MarkdownContent`、`thinking`→`ThinkingBubble`、`fallback`），替代原 `useAiChat` + `ChatPanel` 的手写 `UIMessage`→`ChatTurn` 映射与流式占位气泡
  - `UIMessage.parts` 由 `partsComponents` 自动分发；流式中的生成中消息直接存在于 `messages`，随 token 逐步渲染（无需单独流式占位）
  - 新增 `EditorCfgContext` 注入 `systemPrompt`/`requestMeta`/`onApplyHtml`；`endpointUrl`/`onComplete`（autoApply）走模块级 ref（单实例假设：一页一个编辑器）
  - 移除 `useAiChat`/`AiChatController`/`ChatTurn` 等导出；配套升级 `@tanstack/ai-react@^0.23.0`（新增 `/ui` 子路径）、`@tanstack/ai@^0.52.2`；服务端 `/api/ai-chat` 不变

- **`@fsdx/ai-rich-editor` 对话区按参考图重构（消息气泡 / 富文本渲染 / 输入框）**：
  - 用户消息：右对齐灰底圆角气泡（`bg-background-secondary` + `text-foreground`，不再依赖 `primary`/`primary-fg` 的暗色主题对比度问题）；助手消息：纯文本直接铺在背景上，去头像、去外卡片
  - 助手消息富文本：`MarkdownContent` 改用 `react-markdown` + `remark-gfm` 渲染（标题/加粗/行内代码灰底圆角块/有序无序列表/引用），```` ```html ```` 仍走专属「可复制/应用到编辑器」代码块
  - 空态：改为「为你推荐」竖排圆角建议卡片（预设指令，点击即发送），移除输入框上方快速指令 chips
  - 输入区：大圆角输入框（`rounded-2xl` 描边 + 阴影、无边框 textarea 随内容增高）+ 底部工具栏（快捷键提示 + 停止/清空 + 主色发送）
  - 依赖：`@fsdx/ai-rich-editor` 新增 `react-markdown` / `remark-gfm`；按参考图采用圆角（此为对话区单独偏离项目「圆角归零」约定）
  - 布局微调：对话区 `Splitter.Panel` 默认/最小宽度调至 400（原默认 300/最小 220），面板更舒展；空态/输入框间距与内边距优化

- **移除富文本 HTML 消毒（dompurify / isomorphic-dompurify）**：前台新闻详情正文改直接透传渲染，admin 富文本视为受信任内容，删除 `DOMPurify.sanitize` 调用与 `app/package.json` 两个直连依赖（monaco-editor 传递依赖的 dompurify 不受影响）

- **路由目录组织边界补强 + forgot-password 服务层收编**：
  - AGENTS.md「路由目录组织」补边界与决策矩阵：路由文件 = 可独立访问的视图（有 URL / 进菜单 / 可深链分享 / 前进后退可达），页面本体必须建成路由文件，禁止塞进 `-mods/`；`-mods/` 收纳范围 = 就近 SFn + 路由局部 schema + 组件（表单/弹窗/列定义）+ 纯函数/常量，`*.server.ts` 一律归 `services/`；单页 vs 子路由决策矩阵（单视图页内 Tab/state、≥2 静态视图每视图一路由共用 `-mods/`、动态数量视图参数路由 `$xxx.tsx`）替代原两行决策表
  - architecture / server-function skill 违规自查与 docs/architecture-overview.md 同步（`-mods/` 目录树去掉 `.server.ts`，补页面本体禁入 `-mods/` 与多视图拆分自查）
  - **forgot-password 残留 `-mods/*.server.ts` 收编**：`resetClientPassword` / `resetAdminPassword`（自助验证码重置）重命名为 `resetClientPasswordByEmail` / `resetAdminPasswordByEmail` 收编至 `services/client-user/` / `services/admin-user/`（与既有管理端重置他人密码同名函数区分），SFn 导入路径更新，测试随迁至 `services/<module>/__tests__/`，删除路由 `-mods/` 内 `forgot-password.server.ts`
  - 自助重置函数健壮性对齐：bcrypt rounds 10 → 12（与同文件 CRUD 重置一致），update 改 `.returning()` 校验影响行数——用户被删除时不再静默返回成功

- **routes/services 分层重构（服务层收 services，SFn 就近路由）**：
  - 分层契约：`services/<module>/` 收**服务层**（`server` 业务逻辑 + `schemas` zod 单一来源 + `cache` + `types`），被服务层 `z.infer` 派生或跨端复用的 schema 必须收 services，纯路由局部 schema 可随 SFn 留在路由；`routes/**/-mods/` 放 UI 组件 + **就近的 SFn**（RPC 边界随消费页面，跨端实体 SFn 各拆到所属端路由），仅无页面消费的跨端共享 SFn（auth/captcha/track SDK/message/dict 选项/客户端可见配置/初始化状态/文件上传列表查询）留在 services
  - **news / dict / config**：路由 `-mods/` 的 `server` 收编至 `services/<module>/`，消除 `ensureUniqueSlug` / `MAX_RECOMMENDED` 重复实现（`checkRecommendedLimit` 统一按「新增数量」校验，修正 update 允许第 6 条推荐的越界）；`dict.server.ts` 补齐原缺失的 update 分支；SFn 就近回到各自路由 `-mods/`（news 拆管理端 + 前台两端），实体 schema 收 `*.schemas.ts`
  - **admin-role / client-role / admin-user / client-user / dashboard / logs / operation-log / translations / track（event-meta / property-meta / analytics / query）**：`server` + `schemas` 收编至 `services/<module>/`；SFn 就近回到对应路由 `-mods/`
  - **file / init / 登录**：删除/转永久、初始化、登录 SFn 回到各自路由 `-mods/`；文件上传/列表查询、`checkInitStatusSFn`、`getCurrentAdminSFn` / `logoutSFn`、`getCurrentClientSFn` / `clientLogoutSFn` 等跨端共享 SFn 保留在 services
  - **认证登录**：`adminLoginSFn` / `clientLoginSFn` 回归路由 login `-mods/`（登录 schema 为纯路由局部，内联）
  - 相关测试同步随迁（importConfigs / importDicts / ensureUniqueSlug 随被测模块至 `services/<module>/__tests__/`；路由局部 schema 测试改从路由 functions 导入）；路由组件仅从就近路由 `-mods/*.functions` 导入 SFn
  - `dict` / `dashboard` 的导入导出类型与统计类型抽至 `*.types.ts`（消除 `.server.ts` 反向 import `.functions.ts` 的分层倒置）
  - **dict 缓存失效内聚**：`updateDictRecord` / `createDictItemData` / `updateDictItemRecord` / `deleteDictItemRecord` / `importDicts` 在 server 层内部统一调用 `loadDictCache()`，删除 SFn handler 中的外置缓存刷新，与 `createDict` / `deleteDict` 的缓存所有权一致
  - 同步改写 architecture / server-function / admin-crud 三个 skill（双份 hardlink 副本）的分层契约、SFn 放置规则、Schema 归属与违规自查；修正 server-function skill 中 `.functions.ts → .server.ts` 误标为禁止的 Import 边界（实际为允许，handler 客户端构建剥离）
  - 文档路径时效更新：`auth-permission-model.md` 中 admin-user / client-user 服务层路径改指 `services/`；db-sqlite / test-writing skill 中 `dicts.server` 路径与 schema 导入示例同步修正

- **components 目录规范化重组**：
  - `admin/` 按职责分层：表单/输入控件（DictSelect、DictTag、PermissionSelector、RichEditor、FieldTranslationDrawer、editor-type/、upload/）统一收进 `admin/forms/`，管理端 zustand store 就近收进 `admin/stores/`，并新增 `index.ts` 统一出口
  - `NavConfig.tsx` → `admin/nav-config.ts` 改纯数据（icon 存组件引用，渲染处实例化）；`AdminThemeContext`/`useAdminTheme` 自 AdminLayout 拆出至 `admin-theme.ts`
  - `global-store/` 与 `i18n-context.tsx` 合并为 `providers/`，`useLocale` 改从 `I18nContext` 读取解除模块级循环依赖
  - 埋点 SDK 自 `components/track/` 迁至 `lib/track/track.ts`
  - `client/`、`providers/`、`admin/` 新增目录级 barrel；Header/Footer 默认导出改具名导出；全库约 48 处导入收敛为短路径
  - 删除无消费方的 `hooks/use-sfn-call.ts`

- **ui 包按域分桶导出 + app 上传/验证码组件抽离**：
  - ui-spa exports 收敛：`./table`（ProTable + TableOperate）、`./editor`（CodeEditor + RichEditor）、`./upload`（文件/图片上传 + 文件库弹窗），删除逐文件导出；`json-import-button` 内部改引 `./editor`
  - ui-ssr exports 收敛：`./ui`（shadcn 五件套）、`./theme`（ThemeToggle + useThemeMode）、`./form`（AutofillBlocker + ImageCaptchaModal），`use-theme-mode` 测试随迁 `theme/__tests__/`
  - FileUpload / ImageUpload / SelectFileModal 迁入 ui-spa，上传与文件库查询改 SFn 回调注入；app 保留同名薄壳接 `uploadFileSFn`/`getFileListSFn`，删除 app `SelectFileModal.tsx`
  - 前台图片验证码弹窗迁入 ui-ssr `ImageCaptchaModal`（SFn/错误/消息回调注入 + 内置 SVG 刷新图标），CaptchaInput 改薄壳，ui-ssr 不新增 sonner/lucide-react 依赖

- **单元测试查漏补缺**：
  - 修复 3 处假测试：track / files / register 的 schema 测试本地复制副本 → 改为导出真实 schema 并 import（`trackEventSchema`、`sendCaptchaWithImageSchema` 新增导出，translations import schema 提取命名导出）
  - 修复 `tasks.test.ts` 死 mock 与用例顺序依赖，改为真实执行 handler 覆盖清理分支；精简 ms 模块重复测试（index/parse-strict 收敛为分发与代表性用例）；清理 storage 测试无关环境变量
  - 补齐核心缺口：`getAdminUserForAuth` / `getClientUserForAuth`（鉴权 RBAC 解析）、track 上报校验链路（频控/事件名校验/属性类型/时间钳制）、`uploadFile`、file-explorer 写保护全路径、i18n 缓存与导入导出、log-reader 真实文件读取、图片验证码与短信发送、config/dict/news 分支
  - 补齐 4 组 schema 测试（message / client-role / file-explorer / translations import），track 新增测试专用 `resetTrackMetaCacheForTest` 重置缓存状态
  - core 包新增 logger / jwt / ch-to-path 测试，scheduler onTick 真实执行修复假覆盖；ui-ssr 补 use-theme-mode 系统偏好联动与跨标签页同步、新增 theme-toggle 三态测试
  - 弱断言修复：`buildSortClause` / `notDeleted` 补语义断言（防排序注入）、file 状态筛选、i18n upsert 分支、config getConfigList
  - 测试约定对齐：schema 测试就近放置（路由/模块 `__tests__/`），移除集中 `sf-schemas.test.ts` 约定（AGENTS.md 与 skills 同步）

- **路由目录组织优化**：
  - 测试目录统一：admin news / translations 的路由层测试自 `-mods/__tests__/` 迁至路由目录 `__tests__/`（对齐 AGENTS.md「schema 就近放置」约定，admin-crud skill 同步改为路由目录表述）
  - 仪表盘 companion 重命名：`_admin/-mods/index.functions.ts` / `index.server.ts` → `dashboard.functions.ts` / `dashboard.server.ts`，消除 `index` 通用命名
  - 超限页面拆分（均入对应 `-mods/`）：
    - `dicts`：抽 `DictFormModal` / `DictItemFormModal` / `DictListPanel` / `dictColumns` / `dictUtils`（684 → 335 行）
    - `file-explorer`：抽 `FileModals`（新建/重命名/预览）/ `fileExplorerColumns` / `fileExplorerUtils`（613 → 353 行）
    - `config`：抽 `ConfigFormModal` / `configColumns`（472 → 307 行）
    - `news`：抽 `newsColumns`（405 → 217 行）
    - `messages/manage`：抽 `SendMessageModal` / `messageManageColumns`（400 → 253 行）

- **下载路由回归模块 + 下载响应统一服务**：
  - 读取/下载/流式响应路由自 `routes/api/download/` 迁至所属模块：`routes/file/r.$id.tsx`（`/file/r/$id`）、`routes/admin/_admin/logs/download.$id.tsx`（`/admin/logs/download/$id`）、`routes/admin/_admin/file-explorer/download.$.tsx`（`/admin/file-explorer/download/*`），删除 `routes/api/` 目录；⚠️ **URL 变化**：原 `/api/download/*` 全部变更，旧书签/外链需更新
  - 新增 `services/download/download.server.ts`：`toWebStream` + `createFileDownloadResponse`，Content-Disposition 统一走 RFC 6266 `filename` + RFC 5987 `filename*=UTF-8''` 双头，修正中文文件名编码不一致
  - `file/r/$id` 保持前台公共访问（无登录守卫），新增 `createCsrfMiddleware` 同源校验防跨站盗链（放行 `same-origin`/`none`，拒绝 `cross-site`/`same-site`）；`logs` / `file-explorer` 下载路由保留 `adminPermRouteGuard` 管理端权限
  - ui-spa 上传组件回调 `downloadUrl` 更名 `readUrl`（该 URL 全程用于内联预览/打开，`/file/r/` 语义），`ImageUpload` / `FileUpload` / `SelectFileModal` 同步

- **Drizzle 升级 v0 → v1（rc.4）+ 移除 Relational Queries v1**：
  - `drizzle-orm` / `drizzle-kit` 升至 `1.0.0-rc.4`（v1 最新 rc，drizzle-kit 移入 devDependencies）；迁移目录重建为 v3 结构（每迁移一文件夹，去除 journal.json），开发库重建基线（17 张表）
  - ⚠️ **既有环境升级注意**：迁移历史已整体重建，任何已应用旧 `0000/0001` 迁移的库（其他开发机、预发/生产）需先重置库（`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 并清空 `drizzle` schema 迁移表）再启动，否则 bootstrap 的 `runMigrations()` 会对已存在的表执行建表而 fail-fast 崩溃；如需保留数据，须手工将新基线迁移 hash 回填进 `__drizzle_migrations`
  - 移除 RQBv1：全库 54 处 `db.query/tx.query.*.findFirst/findMany` 改为标准 query builder（`db.select().from(...).where(...).limit(1)`），回调式 where 内联为 eq/isNull/inArray/or，`getFileInfo` 的 columns 投影改 select 投影；`db` 实例不再传入 schema
  - 测试 mock 重构：mockDb 统一为可 await 的 select 查询链（`mockRows` 控制行数组），20 个测试文件同步；test-writing / admin-crud skill 示例更新；`noThenProperty` 规则仅在测试文件范围关闭（有意实现的 thenable）；删除死代码 `test-utils/db-mock.ts`
  - `db:migrate` 改走程序化迁移（新增 `src/db/migrate-cli.ts`）：drizzle-kit v1.0.0-rc.4 的 migrate 命令存在 CREATE SCHEMA 断连 bug（ECONNRESET），程序化路径与生产 bootstrap 的 `runMigrations()` 完全一致
  - `drizzle.config.ts` 的 schema 指向 `src/db/schema/index.ts`：目录扫描会重复收集表导致 `drizzle-kit generate` 失败

- **用户/认证/日志/操作日志向 bom-easy 对齐**：
  - 中间件：新增 `clientPermRouteGuard`（客户端 Server Route 权限守卫，捕获 `ClientAuthError` 转状态码 JSON）；`/api/download/log/$id` 改用 `adminPermRouteGuard` 中间件，删除 `api-auth.ts`（`verifyAdminPerm`/`ApiAuthError`），`sf-error-logger` 同步移除 `ApiAuthError` 分支
  - 操作日志：`logExternalRequest()` 落库字段语义对齐——`module`=外部系统标识（调用方传入）、`action`=`login`/`request`（按请求类型）、`targetType`=接口来源类型（默认 `openapi`，调用方可指定）、`targetName`=接口路径，`detail` 含 system/success 并展开 extra
  - 鉴权：`getCurrentAdmin`/`getCurrentClient` 将未删除约束下沉到 SQL 层（`and(eq, isNull)`），保留 JS 侧防御校验；管理员找回密码重置后补 `clearAdminUserCache`
  - 基础设施：`sanitizeError()` 递归脱敏 `error.cause`（含非 Error 对象，防敏感字段透传 + 循环/深度防护）
  - 测试补强：操作日志 `logCrud`/`logExternalRequest` 覆盖（默认 admin、ALS 上下文、system 兜底），admin/client `getCurrent*` 的 where 条件哨兵断言（EQ + ISNULL 防 `&&` 吞条件）

- **埋点模块重构为神策简化模型（track 命名体系）**：表/服务/路由/权限码统一更名
  - 表：`event`→`track_event`（列 `event`→`name`）、`preset_event`→`track_event_meta`、`preset_property`→`track_property_meta`，Schema 合并为 `src/db/schema/track.ts`
  - 服务：`src/services/event/`→`src/services/track/`，`trackEvent()` 增加 per-session 频控（60 条/分钟）与时间钳制（过去 1 天 ~ 未来 5 分钟）
  - 路由：`/admin/events/*`→`/admin/track/*`（`/admin/track/query`、`/admin/track/analytics`、`/admin/track/event-meta`、`/admin/track/property-meta`），菜单「预设事件/预设属性」→「元事件/元属性」
  - 权限码：`event:view/query/manage`→`track:view/query/manage`
  - SDK 入参：`trackEventSFn` payload 字段 `event`→`name`
  - 预置清单裁剪：元事件 9→5、元属性 16→11，`ensurePreset*` 增补清理逻辑

- **管理端角色改名 `role`→`admin_role`**：表、`admin_user.role_id`→`admin_role_id`、模块 `src/services/admin-role/`、路由 `/admin/admin-roles`、权限码 `role:*`→`admin-role:*`、审计模块名 `admin_role`

- **DB 迁移基线重置**：统一 generate+migrate（移除 db:push），重建 `drizzle/0000_initial.sql`（17 张表全量建表，允许清库）

- **主题体系重构（对齐 bom-easy）**：
  - 具名主题注册表 `app/src/theme/themes.ts`：每个端一个主题预设（`ThemePreset`），`data-theme` 承载完整主题名（如 `admin-brown-light`）；管理端棕 `#795548`、前台中性灰
  - CSS 令牌链路：新增 `shared-tokens.css` 共享中性令牌（`--t-*`），两端 `--t-brand-*` 品牌色阶 → `--s-*` 语义令牌 → `@theme` 映射；`@custom-variant dark (&:is([data-theme$="-dark"] *))` 统一暗色变体，废弃 `.dark` class 双轨
  - `use-theme-mode` 重写为 `useSyncExternalStore`（跨标签页 + 系统主题联动），签名改为 `useThemeMode(preset)`，返回 `scheme`（dataTheme + antd 主色）
  - 管理端品牌色由绿 `#00b96b` 换棕 `#795548`（暗色 `#a1887f`），antd `colorPrimary`/`colorInfo` 从注册表读取（`colorInfo` 派生 Link 链接色）；`borderRadius: 0` 直角风格，Tailwind radius 全 0（保留 `rounded-full`）
  - 管理端侧边栏主题按钮保持三态循环（亮/暗/跟随系统）
  - `AdminRootDocument` 补齐主题 init 脚本（修复首屏闪烁），两个 `<head>` 增加内联 `@layer` 顺序声明；init 脚本由 `themes.ts` 注册表推导 storageKey 与 dataTheme，杜绝脚本与注册表手工双写漂移
  - `use-theme-mode` 的 DOM 应用改为直接读取 localStorage/媒体查询最新值（规避 SSR 水合首帧用服务端快照覆盖主题），`storage` 监听按主题键过滤
  - 硬编码颜色清理：`#1677ff`→`var(--s-primary)`、`zinc/blue/gray`→语义令牌类；Monaco 暗色检测改 `data-theme` 判断；内联非零圆角归零
  - 管理端 logo/favicon 蓝 `#1677ff`→棕 `#795548`；前台 storageKey `theme`→`client-theme`

- **AdminPageContent 挪回 app**：布局组件（标题栏 + 内容区）自 `@fsdx/ui-spa` 迁至 `app/src/components/admin/AdminPageContent.tsx`，26 处路由页面导入改 `#/components/admin/AdminPageContent`，ui-spa 移除对应导出；标题栏定高改 CSS 变量 `--admin-header-height`，内容区高度按 `calc(100vh - var(--admin-header-height))` 计算内部滚动，便于子元素按已知高度布局

- 目录分层：新增 `src/constants/`、`src/validators/`、`src/utils/`、`src/types/`；`lib/query` 类型迁入 `types/query.ts`；删除 `format-date` 改用 dayjs 内联

- 缓存拆分：`lib/cache/cache.ts`→`core.ts` + 按模块 `*.cache.ts` 实例文件，新增 `adminUserCache`

- 新增 `lib/request-context`（AsyncLocalStorage 操作者身份）+ `lib/buffer/batch-writer`（通用缓冲写入器，event/operation-log 复用）

- 操作日志：`logCrud()` 一行式审计封装 + `logExternalRequest()`（从 ALS 读操作者），`operation_log` 新增 `operator_type` 列；32 处 CRUD 审计调用迁移

- 中间件统一：`resolveAdminAuthContext()` 一步校验 + `adminPermRouteGuard`（Server Route）+ api-auth 复用；中间件不直接查 DB，委托 `getAdminUserForAuth()`/`getClientUserForAuth()`（带缓存）

- 新增客户端 RBAC 框架：`client_role` 表 + `client-permissions.ts` + `clientAuthGuard`/`clientPermGuard`，init 种子 `client-super-admin`/`normal-user`，注册分配默认角色

- Schema 单一来源：admins/clients/admin-role 服务输入类型改 `z.infer` 派生，消除 `as XxxInput` 桥接断言

- 分层违规清理：captcha/file/forgot-password 的 DB 逻辑从 `.functions.ts` 提取到 `.server.ts`；news `generateSlug` 去重（消除循环依赖）

- antd-static 桥接：message/modal/notification 经 `App.useApp` 捕获，31 处静态 message 调用迁移；AdminProvider 加 `<StyleProvider layer>` + 品牌色 `#00b96b`

- 样式分层：两份 global.css 预声明 `@layer theme, base, antd, components, utilities` + 裸 `a` 语义色兜底

- 新增 `sfn-helpers.ts`（safeSfnCall/unwrapSfn）+ `hooks/use-sfn-call.ts` + `PermissionTags` + `useCrudPage`

- **权限模块迁至顶层 `src/permissions/`**：权限码从 `src/constants/permissions/` 提升为顶层领域模块（与 `src/db/` 同级），30 处 `#/constants/permissions/*` 引用改为 `#/permissions/*`，同步更新 AGENTS.md 与 skill 文档路径

- **权限命名全对称（破坏性重构）**：`permissions.ts` → `admin-permissions.ts`，符号全量加 `Admin` 前缀（`PERMISSIONS`→`ADMIN_PERMISSIONS`、`PermissionDef`→`AdminPermissionDef`、`hasPermission`→`hasAdminPermission` 等），与 `client-permissions.ts` 的 `Client*` 命名对齐

- **权限码分隔符规范化**：`file_explorer:*`→`file-explorer:*`、`dict:*_item`→`dict:*-item`；审计模块名 `file_explorer`/`admin_role` 同步为 kebab（`operation_log.module` 数据格式变更）

- **组件命名规范化**：`components/admin/nav-config.tsx` → `NavConfig.tsx`

### Fix

- **`@fsdx/ai-rich-editor` 对话状态与自动应用修复**：
  - **「思考中/已思考」按消息判定**：思考气泡的 loading/标题由全局 `chat.isLoading` 改为按「该消息是否为正在流式生成的最后一条」判定（经 `MessageStreamContext` 注入），避免已完成消息在后续生成期间误显示「思考中…」、与进行中的串了
  - **`autoApply` 取最后一个 HTML 代码块**：流结束回调改为取回复中最后一个代码块（而非第一个），修改类回复（先贴旧/分块再给最终产物）能正确应用改动后的完整片段；新增 `lastHtmlFragment` 纯函数与单测
  - **提取失败可感知**：`autoApply` 开启但回复未检测到 HTML 代码块时，经 `notify` 提示「已跳过自动应用」，不再静默不生效
  - **发送后过渡 loading**：发送消息后、首个 assistant 内容到达前，消息区末尾显示「请求中…」加载占位（TanStack AI 的 assistant 消息为惰性创建，等待期 messages 末尾仍是 user），消除模型反馈前的空白等待
  - **HTML 代码块流式实时同步**：`autoApply` 开启时，AI 流式生成中的 HTML 代码块累计新增达到阈值（默认 200 字符）即同步到编辑器与预览，边生成边看到成型效果；新增 `currentHtmlFragment`（支持未闭合代码块提取）纯函数与单测

- **[infra] 修复 OpenAI 兼容（Chat Completions）推理模型思考内容被丢弃**：
  - **根因**：`@tanstack/ai` 的 OpenAI 兼容适配器在默认 Chat Completions 面上 `extractReasoning` 为空实现，而 DeepSeek-R1/Qwen3/Moonshot 等厂商的思考增量在 `delta.reasoning_content`（部分为 `delta.reasoning`/`reasoning_details`）而非 `delta.content`，故被静默丢弃——导致 `@fsdx/ai-rich-editor` 无「思考中…」气泡，且推理阶段前端全程静默、思考结束后正文才涌入，观感呈「伪流式」（实际服务端/客户端流式链路无缓冲）
  - **修复**：新增 `shared-services/ai/ai.reasoning-adapter.ts`（`ReasoningCompatibleChatAdapter` 子类重写 `extractReasoning`，兼容 `reasoning_content`/`reasoning`/`reasoning_details` 三种字段与 `{content|text}` 对象形态）；`ai.provider.ts` 由 `openaiCompatible()` 改为自建 OpenAI client + 统一返回该子类，非推理模型无该字段自然返回 undefined、零回归；`openai` 提升为 app 直接依赖
  - **能力位语义收敛**：`createModel`/`toModelDef` 能力位映射移除，`reasoning/jsonOutput/toolCalls` 等模型元数据保留供管理页展示与解析，`extractReasoning` 改为无条件尝试提取
  - 前端 `@fsdx/ai-rich-editor` 的 `ThinkingPart` 渲染链路与 `useChat` 已具备，无需改动

- **AI 厂商管理弹窗编辑模型不回显**：`AiProviderFormModal` 表单设了 `preserve={false}`，在 `Modal destroyOnHidden` 重挂载下会导致 `Form.List` 的模型行嵌套字段值丢失（真实浏览器复现：厂商字段回显、模型名/展示名为空）。修复为：移除 `preserve={false}`；外层按每次打开自增 `key` 重挂载内容组件（重建表单实例），编辑以当前厂商为 `initialValues`、新增预置一个空模型行；`Form.List` 改用标准解构 `({ key, name, ...restField })`（不再把 `key` spread 进 `Form.Item`）；模型名字段用 `Input` 保证回显

- **前台登录后 Header 登录态不刷新**：客户端登录成功仅 `navigate` 到首页，`ClientAuthProvider` 不重挂载导致 Header 仍显示未登录；登录页 `onSubmit` 成功后补充调用 `useClientAuth().refetch()`，使用户名/消息/退出入口即时更新

- **统一 Asia/Shanghai 时区基准（定时任务/日志切割/按天查询）**：
  - `@fsdx/lib` 新增 `@fsdx/lib/date-format`（dayjs 实现）：`DEFAULT_TASK_TIME_ZONE`（`Asia/Shanghai`）、`DATE_ONLY_REGEX`、`toDateString` / `parseDateOnly` / `toDayRange`，天边界解析不依赖服务器时区（`TZ=UTC` 下已验证）
  - 定时任务：`registerTask` 支持 `timeZone` 字段，`CronJob` 默认按 `Asia/Shanghai` 调度（原依赖服务器本地时区，UTC 服务器上「每天 3:00」会偏成北京时间 11:00）
  - 日志体系：pino 日志文件名按天切割与 `cleanExpiredLogs()` 清理截止统一按 `Asia/Shanghai` 计算，与任务调度时区一致
  - 按天查询：operation-log 列表、埋点事件列表与事件分析的 `startDate/endDate` 边界改用 `toDayRange`（原 `new Date("YYYY-MM-DD")` 按 UTC 解析导致窗口偏移，事件查询页传 `endOf("day")` 再 +1 天造成边界溢出）；schema 增加 `YYYY-MM-DD` 格式校验；事件查询/分析页改传 date-only，与操作日志一致

- **中间件 import-protection 告警**：`resolveAdminAuthContext`/`resolveClientAuthContext` 下沉到 `middleware/*.server.ts`，中间件 guard 在 `.server()` 回调内动态导入；客户端构建剥离回调后不再残留 `.server` 依赖（此前 admin 侧因函数被 export 无法被死代码消除而告警）

- **AdminRootDocument `<title>` 告警**：`{siteName} 管理后台` 两个 children 改为模板字符串，消除 React title 数组警告

- **登录/注册/找回密码页 tsc 报错**：`form.Subscribe` 的 `selector` 泛型推断被 `NoInfer` + 默认值阻断（TS 6），改为全量 FormState 订阅（去掉 selector），`state.canSubmit`/`state.isSubmitting`/`state.values.email` 直接读取，消除 FormState 类型不匹配

### Docs

- **文档体系边界治理（对齐 bom-easy documentation-architecture）**：
  - 新增 `docs/documentation-architecture.md` 作为文档边界模型 SSOT：六层体系（AGENTS → guide → skills → commands → checklists → docs）、内容性质→归属映射表、事实 SSOT 表、引用图、文档元信息块约定、维护规则
  - AGENTS.md 新增「文档体系」章节（L0-L5 分层 + 归属判定 + 事实不复制 + 引用单向可追踪），README 文档索引补收录
  - 新增 `.agents/guide.md` 任务导航：任务 → skills/docs/commands/checklists 映射 + 文档索引
  - docs/ 6 篇平台类文档头部补元信息块（定位 / SSOT / 引用关系 / 更新触发）
  - 数量/清单类事实收敛：README 与 docs 中「17 张表」「9 个缓存实例」「61 个权限常量」等改为「当前值 + 以代码为准」标注，数字准确性由权威文档兜底

- **文档全面校准 + 去重收敛**（对齐请求 ID 贯通、Prometheus 指标、routes/services 分层重构、i18n/track 服务拆分、TS 7 / Biome 2.5 等代码现状）：
  - 事实校准：AGENTS / README 技术栈版本（TypeScript 7、Biome 2.5）、删除已移除的 `pnpm changeset` 命令、README 命令表精简为常用项；缓存实例数 8 → **9**（新增 track 频控 `sessionRateCache`）；迁移失败行为按代码改为 `try/catch` + `logger.warn` 容错（非 fail-fast）；Server Route 例外补充 `routes/api/metrics.tsx`；`operation_log` ER 图补充 `request_id` 列并注明该表 camelCase 列命名例外；`dict` 缓存启动加载描述修正为懒加载；`configTranslationCache` 归属修正为 `shared-services/config/`；i18n 拆分后路径更新（`i18n-ui.server.ts` / `i18n-content.server.ts`）；track 服务子文件索引（meta/validate/analytics）；SF 错误日志移除已删除的 `ApiAuthError`、补充 `ClientAuthError` 与埋指标/`toClientError` 归一化；环境变量补充 `DB_POOL_*` 连接池参数；文件存储物理路径修正为 `{STORAGE_DIR}/uploads/{date}/{name}`；登录时序图 SFn 命名统一 `SFn` 后缀
  - 新增基础设施入文档：请求 ID 贯通（requestIdMiddleware / `x-request-id` / `operation_log.request_id`）与 Prometheus 指标（`/api/metrics`、3 个预置指标、进程内聚合边界）写入 AGENTS / architecture-overview / deployment-ops / architecture skill
  - 去重收敛：技术栈版本、命令表、缓存实例清单、中间件执行链路、单实例一致性边界、服务层三层契约等重复声明各收敛为单一事实来源 + 交叉引用（auth-permission-model / server-function skill / cache-system / deployment-ops 各为权威载体，其余改链接）
  - skills 同步：cache 实例表 8→9 并与 cache-system 互标同步提示；server-function 全局错误日志改 `AdminAuthError`/`ClientAuthError` + `toClientError`；architecture 补 `lib/metrics`、请求 ID、Prometheus；permission 补权限清单引用

- **新增数据库迁移 skills（db-sqlite / db-mysql）**：
  - 沉淀 PostgreSQL → SQLite 完整迁移指南为 `db-sqlite` skill：基于 drizzle v1.0-rc.4 + node:sqlite 异步驱动基态，覆盖驱动选型、pg-core→sqlite-core 类型映射、约束差异（部分唯一索引/ON UPDATE CASCADE/降序索引）、**事务同步化（node-sqlite 'sync' kind 事务回调必须同步，否则提前提交）**、时间序列 SQL 改写、日期类型 Date→number、测试 mock 终结符适配与迁移执行流程
  - 新增 `db-mysql` skill：mysql2 异步驱动，事务与普通查询全部保持 await、日期保持 Date，迁移面最小；覆盖 uuid→char(36)、jsonb→json、json 列默认值限制等 MySQL 特有差异
  - db-schema skill 相关链接、AGENTS.md 数据库章节同步补齐目标库速查与 drizzle v1 基态说明

- **子包文档补齐 + 文档/技能对齐**：
  - 新增三个子包 README（`packages/lib/README.md` / `packages/ui-ssr/README.md` / `packages/ui-spa/README.md`），含 subpath 导出清单、宿主集成约束与依赖边界；根 README、AGENTS.md、architecture-overview 建立对子包文档的引用
  - 删除已完成的历史方案 `docs/monorepo-restructure.md`（其包边界内容由三个子包 README 承接）
  - docs 事实对齐：README（17 张表 / 8 个缓存实例 / `db:push`→`db:generate`+`db:migrate`）、cache-system（`@fsdx/lib/cache-core` 与实例路径、启动时序）、database-design（`admin_role_ids` / `client_role_ids` JSONB 多角色，无外键）、auth-permission-model（客户端 RBAC、61 个权限常量、`resolveAdminAuthContext` 现状实现）、event-tracking（预置 5 事件 / 11 属性、路径与函数名）、deployment-ops（core 基础设施路径、env 位于 `app/`）
  - skills 对齐：8 个 skill 修正过时路径与流程（core subpath 迁移、`@fsdx/ui-spa/table` 与 `antd-static` 导入、`logCrud` 一行式审计、mockDb 17 张表清单、`db:generate`+`db:migrate` 迁移流程）
  - **文档瘦身**：AGENTS.md 552 → 276 行（与 skill 重复的细节压缩为「硬规则 + skill 链接」，删除已修复的历史节；`src/services/` 准入门槛、就近原则、Server Route 例外补入 server-function skill，jsonb `$type` 约定补入 db-schema skill，`logExternalRequest` 字段语义补入 architecture skill）；`auth-permission-model.md` 640 → 552 行（删除重复性角色关系/客户端缓存 flow 与散乱文字，保留并时效修正整体架构、管理员登录、客户端注册登录、系统初始化四张图，按查考级组织）
  - 文档 review 修正：README 快速开始 env 路径指向 `app/.env.example`；i18n skill「支持的语言」片段去掉与导入重复的本地声明；cache-system 启动时序图更正 dict 缓存为懒加载（仅 config/track 元数据启动热加载）

- **文档引用源与事实校准（`.agents` 为引用权威，`.opencode` 不再作为文档引用来源）**：
  - AGENTS 命令表 `/deploy` 与 CHANGELOG 条目中 `.opencode/commands/*` 引用改为 `.agents/commands/*`；软链机制描述保留并明确内容以 `.agents/` 为准
  - 事实修正：缓存清单口径统一（`sessionRateCache` 位于 `track.validate.ts`，AGENTS / cache-system / README 三处一致）；`operation_log` 操作者列名 `operator_id`→`operatorId`（camelCase 例外）；auth-permission-model 登录/初始化页路径补 `index.tsx`、bcrypt cost 表述补自助重置=12（明确排除 init 的 cost=10）；deployment-ops init 页路径修正
  - 规则层补全：db-schema skill 补 `track_event_meta` / `track_property_meta` varchar 主键例外；test-writing skill 补按子模块/子功能拆分测试文件命名说明；命令表补 `/check-architecture`；documentation-architecture skills 清单补全至 10 个（AGENTS core 目录树模块明细已移交给 core README，见下条收敛记录）
  - 清理 `.opencode/` 未入库残留（node_modules / package.json / package-lock.json / .DS_Store），仅保留指向 `.agents/` 的软链视图

- **工程结构描述收敛（消除重复罗列）**：
  - AGENTS「工程结构」树去重：`lib/` 段删文件明细（薄壳名保留在注释）、core 段删模块明细只留 `utils/i18n/cache/infra` 四桶分层（导出清单指向 core README），避免与包 README 双份维护
  - architecture-overview 删除「目录职责矩阵」与「关键文件索引」两节（前者职责/规则与 AGENTS 树及既有章节重复，后者前 10 行即 AGENTS 树注释、后 9 行系文档导航）：改为「目录职责」引用段（指向 AGENTS 工程结构/包边界/依赖方向）+「相关文档」导航表，文件级职责不再重复罗列
  - architecture-overview「系统分层架构」图与「路由分层」树收敛为概览：删除 services 22 个模块名、core 模块清单与「17 张表 + 9 个缓存」等易漂移枚举（图内改指向 `src/services/`、core README、database-design、cache-system），路由树改分组概览并以 `src/routes/`（`routeTree.gen.ts`）为 SSOT

- **文档体系统一治理（doc:check 守门补强 + markdown 风格成文）**：
  - CHANGELOG 结构重整：历史积压条目按分类拆分为版本段并合并重复分类标题，恢复「每个分类仅一个块」规则；AGENTS / deploy command 的 CHANGELOG 规则一致
  - doc:check 守门补强：新增 skill 数量事实（`computeFacts` 扫描 `.agents/skills`，拦截「N 个 skill」漂移），扫描范围扩展至 `.agents/` 规则文档、子包 README 与 deploy README（CHANGELOG 为历史记录不参与当前事实比对）
  - documentation-architecture 新增「markdown 风格规范」章节（文件结构/标题层级/表格/代码块/中文排版/CHANGELOG 结构/skill 与 command 结构模板），AGENTS 文档体系章节补引用；修正 skill 清单 10→12（补 derive-project / upstream-sync）
  - deploy command 补 H1 标题，与其余 command 结构对齐

### 依赖升级

- **major 版本升级（批次 C）**：
  - **typescript 6→7.0.2**：原生 Go 移植编译器（约 10x 加速），仅使用 CLI `tsc --noEmit` 无程序化 API 依赖，tsconfig 无已弃用选项（bundler 解析/显式 types/无 baseUrl）零适配，app 全量 tsc 降至约 1s
  - **openai 6→7.4.0**：要求 Node 22+（运行时 v24 满足），`ai.ts` 调用无需改动
  - **nodemailer 8→9.0.4**：破坏性变更仅涉远程内容 TLS 校验与 `NoAuth`→`ENOAUTH` 错误码，`mail.ts` 不受影响（@types/nodemailer 保持 8.x 兼容）
  - **lucide-react 0.577→1.29.0**：1.x 为 0.x 重编号，peer 兼容 React 19，所用图标名全部保留
  - **jsdom 28→30.0.1**：3 处 `@vitest-environment jsdom` 测试验证通过
  - **@types/node 22→24**：对齐 node v24 运行时（非 26，避免超前类型）
  - **@biomejs/biome 2.4.5→2.5.7**：新规则自动修复（`organizeImports` 导出排序、`useOptionalChain` 5 处语义等价变换），schema 同步 2.5.7

- **批量升级 patch + minor 依赖（29 个）**：
  - TanStack 全家桶：react-router 1.170.21、react-start 1.168.38、router-plugin 1.168.26、react-form/react-form-start 1.33.3、router-devtools 1.167.1、react-devtools 0.10.9、devtools-vite 0.8.3
  - React 生态：react/react-dom 19.2.8、@types/react 19.2.18、@vitejs/plugin-react 6.0.5、vite 8.2.1
  - antd 生态：antd 6.5.3、@ant-design/icons 6.3.2
  - 核心库：i18next 26.3.6、react-i18next 17.0.11、jose 6.2.8、hono 4.13.0、@hono/node-server 2.1.0、pg 8.22.0、dompurify 3.4.13、isomorphic-dompurify 3.22.0、@alicloud/dysmsapi20170525 4.6.0
  - 构建/工具：tailwindcss 4.3.3、vitest 4.1.10、tsx 4.23.9、monaco-editor 0.56.0、nitro 260610-beta、@radix-ui/react-slot 1.3.3、@types/pg 8.20.4、@types/nodemailer 8.0.1

- **antd 6.5.3 已官方修复 Card/Image 复合组件 JSX 声明缺陷**：删除 `app/src/types/antd-fix.d.ts` 与 `packages/ui-spa/src/antd-fix.d.ts`，移除 `Select`/`DictSelect` 的 `role="combobox"` 及 `UploadFile` aria 空串等绕过

- **workspace peer 对齐单实例**：ui-spa/ui-ssr 的 `react`/`react-dom` peer 收紧至 `^19.2.8`，ui-spa 的 `antd`/`@ant-design/icons`/`@tanstack/react-router`/`monaco-editor` peer 同步对齐 app 实际版本

- **共享依赖上移根 package.json**（私有 monorepo，版本统一在根管理）：
  - `dependencies`：`react`/`react-dom`/`i18next`（app + ui 包 / core 多包直接使用）；`devDependencies`：共享工具链 `vitest`/`@types/react*`/`@types/node`/`@testing-library/*`/`jsdom`
  - app 删除 16 个冗余声明（`pino`/`jose`/`openai` 等仅经 `@fsdx/lib` 间接使用，不直接 import）
  - core/ui-ssr/ui-spa 移除 `react`/`react-dom` peer 声明，单实例由根 `node_modules` 唯一副本保证（依赖根 hoisting 隐式解析）
  - ui-spa 保留 `antd`/`@ant-design/icons`/`@tanstack/react-router`/`monaco-editor`/`@wangeditor/*`/`dayjs` peer（单实例约束不变）

- **移除 changeset 工具链**：库包全部 `private: true` 不发布，删除根 `changeset`/`version`/`release` 脚本、`@changesets/cli` 依赖与 `.changeset/` 目录

### Breaking Changes

- **单人多角色改造（双端 RBAC）**：`admin_user.role_id` / `client_user.client_role_id` 单角色外键 → `admin_role_ids` / `client_role_ids`（jsonb string[]，多角色权限取并集）
  - 迁移 `0001_curious_maximus.sql`：新增 jsonb 数组列并回填旧单角色数据后删除旧列
  - 管理员/客户端用户管理页角色字段改多选；新增 `/admin/client-roles` 客户端角色管理页（含 `client-role:view/create/edit/delete` 权限码与菜单项）
  - `AdminUser.roleName` → `roleNames: string[]`；`getAdminRolePermissions` / `getClientRolePermissions` 改为按角色 id 数组合并权限

## 历史版本

- [v1.0.0 - 2026-06-23](docs/archive/changelog/v1.0.0.md)

# 权限码清单（自动生成）

> 单一事实来源：`src/permissions/admin-permissions.ts`（管理端）、`src/permissions/client-permissions.ts`（客户端）
> 重新生成：`pnpm doc:gen`

## 管理端权限码（62 个）

| 分组 | 权限码 | 名称 | 说明 |
|------|--------|------|------|
| admin | `admin:view` | 查看管理员 | 允许查看管理员列表 |
| admin | `admin:create` | 创建管理员 | 允许创建新的管理员账号 |
| admin | `admin:edit` | 编辑管理员 | 允许编辑管理员信息 |
| admin | `admin:delete` | 删除管理员 | 允许删除管理员账号 |
| admin-role | `admin-role:view` | 查看角色 | 允许查看角色列表 |
| admin-role | `admin-role:create` | 创建角色 | 允许创建新的角色 |
| admin-role | `admin-role:edit` | 编辑角色 | 允许编辑角色信息和权限分配 |
| admin-role | `admin-role:delete` | 删除角色 | 允许删除角色 |
| ai | `ai:test` | AI 测试 | 允许使用 AI 模型测试页面进行模型调用测试 |
| ai | `ai:chat` | AI 对话 | 允许使用通用 AI 流式对话能力（供 AI 富编辑器等业务模块调用） |
| client | `client:view` | 查看客户端用户 | 允许查看前台注册用户列表 |
| client | `client:create` | 创建客户端用户 | 允许创建新的客户端用户账号 |
| client | `client:edit` | 编辑客户端用户 | 允许编辑客户端用户信息 |
| client | `client:delete` | 删除客户端用户 | 允许删除客户端用户账号 |
| client-role | `client-role:view` | 查看客户端角色 | 允许查看客户端角色列表 |
| client-role | `client-role:create` | 创建客户端角色 | 允许创建新的客户端角色 |
| client-role | `client-role:edit` | 编辑客户端角色 | 允许编辑客户端角色信息和权限分配 |
| client-role | `client-role:delete` | 删除客户端角色 | 允许删除客户端角色 |
| config | `config:view` | 查看配置 | 允许查看系统配置项 |
| config | `config:create` | 创建配置 | 允许新增系统配置项 |
| config | `config:edit` | 编辑配置 | 允许修改系统配置项的值 |
| config | `config:delete` | 删除配置 | 允许删除系统配置项 |
| config | `config:export` | 导出配置 | 允许将系统配置导出为 JSON 文件 |
| config | `config:import` | 导入配置 | 允许从 JSON 文件导入系统配置项 |
| dashboard | `dashboard:view` | 查看仪表盘 | 允许查看管理端首页统计信息 |
| dict | `dict:view` | 查看字典 | 允许查看字典类型和条目 |
| dict | `dict:create` | 创建字典 | 允许创建新的字典类型 |
| dict | `dict:edit` | 编辑字典 | 允许编辑字典类型信息 |
| dict | `dict:delete` | 删除字典 | 允许删除字典类型 |
| dict | `dict:create-item` | 创建字典条目 | 允许在字典中新增条目 |
| dict | `dict:edit-item` | 编辑字典条目 | 允许编辑字典条目内容 |
| dict | `dict:delete-item` | 删除字典条目 | 允许删除字典条目 |
| dict | `dict:export` | 导出字典 | 允许将字典数据导出为 JSON 文件 |
| dict | `dict:import` | 导入字典 | 允许从 JSON 文件导入字典数据 |
| file | `file:view` | 查看文件 | 允许查看文件列表 |
| file | `file:upload` | 上传文件 | 允许上传新文件 |
| file | `file:edit` | 编辑文件 | 允许修改文件属性（如转为永久存储） |
| file | `file:delete` | 删除文件 | 允许删除文件 |
| file-explorer | `file-explorer:view` | 浏览存储目录 | 允许浏览 STORAGE_DIR 目录结构 |
| file-explorer | `file-explorer:upload` | 上传文件 | 允许向存储目录上传文件 |
| file-explorer | `file-explorer:delete` | 删除条目 | 允许删除存储目录中的文件或目录 |
| file-explorer | `file-explorer:rename` | 重命名条目 | 允许重命名存储目录中的文件或目录 |
| file-explorer | `file-explorer:mkdir` | 创建目录 | 允许在存储目录中创建子目录 |
| log | `log:view` | 查看日志 | 允许查询和查看系统日志 |
| log | `log:download` | 下载日志 | 允许下载系统日志文件 |
| message | `message:view` | 查看消息 | 允许查看全部用户消息列表 |
| message | `message:send` | 发送消息 | 允许向管理端或客户端用户发送消息 |
| message | `message:delete` | 删除消息 | 允许删除任意用户消息 |
| news | `news:view` | 查看新闻 | 允许查看新闻列表和详情 |
| news | `news:create` | 创建新闻 | 允许创建新的新闻文章 |
| news | `news:edit` | 编辑新闻 | 允许编辑已有新闻的内容 |
| news | `news:delete` | 删除新闻 | 允许删除新闻（软删除） |
| news | `news:publish` | 发布新闻 | 允许发布、归档等状态变更操作 |
| news | `news:export` | 导出新闻 | 允许将新闻数据导出为 CSV 或 JSON 文件 |
| news | `news:import` | 导入新闻 | 允许从 JSON 文件导入新闻数据 |
| track | `track:view` | 查看元数据 | 允许查看元事件和元属性定义 |
| track | `track:query` | 查询分析 | 允许查询触发事件和查看分析图表 |
| track | `track:manage` | 管理元数据 | 允许新增、编辑、删除元事件和元属性 |
| translation | `translation:view` | 查看翻译 | 允许查看 UI 翻译和实体字段翻译 |
| translation | `translation:manage` | 管理翻译 | 允许新增、编辑、删除翻译内容 |
| translation | `translation:export` | 导出翻译 | 允许将翻译数据导出为 JSON 文件 |
| translation | `translation:import` | 导入翻译 | 允许从 JSON 文件导入翻译数据 |

## 客户端权限码（0 个）

| 分组 | 权限码 | 名称 | 说明 |
|------|--------|------|------|



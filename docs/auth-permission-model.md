# 身份认证与权限模型

## 概述

本项目采用**双用户体系 + RBAC + JWT** 的认证授权架构：

| 用户体系 | 入口路由 | Cookie 名 | 是否支持 RBAC | 注册方式 |
|----------|----------|-----------|---------------|----------|
| 管理端 (admin) | `/admin/login` | `fsdx_admin_token` | 是（role 表） | 仅管理员手动创建 |
| 客户端 (client) | `/login` | `fsdx_client_token` | 否 | 公开注册 + 邮箱验证码 |

两套体系使用**独立的 Cookie**，允许同一浏览器同时登录管理员和前台用户。

---

## 整体架构

```mermaid
flowchart TB
    subgraph Browser["浏览器"]
        direction LR
        AdminPage["/admin/*"]
        ClientPage["前台页面"]
    end

    subgraph TanStackStart["TanStack Start"]
        subgraph RequestMiddleware["请求中间件"]
            Locale["localeMiddleware"]
            CSRF["createCsrfMiddleware<br/>(仅 ServerFn)"]
        end

        subgraph ServerFunctions["Server Functions"]
            direction TB
            subgraph AdminSF["管理端 SF"]
                Login["adminLoginFn"]
                CurrentAdmin["getCurrentAdminFn"]
                Protected["其他受保护 SF"]
            end
            subgraph ClientSF["客户端 SF"]
                ClientLogin["clientLoginFn"]
                ClientRegister["clientRegisterFn"]
                CurrentClient["getCurrentClientFn"]
            end
        end

        subgraph AuthMiddleware["鉴权中间件"]
            AuthGuard["adminAuthGuard<br/>JWT 校验 + 用户查询"]
            PermGuard["adminPermGuard<br/>权限校验工厂"]
        end
    end

    subgraph DB["PostgreSQL"]
        AdminTbl["admin_user"]
        RoleTbl["role<br/>(permissions: JSONB)"]
        ClientTbl["client_user"]
        CaptchaTbl["captcha_code"]
    end

    Browser --> RequestMiddleware
    RequestMiddleware --> ServerFunctions
    AdminSF --> AuthMiddleware
    Protected -.->|".middleware([adminPermGuard(PERM)])"| PermGuard
    PermGuard -->|"组合调用"| AuthGuard
    AuthGuard --> AdminTbl
    AuthGuard --> RoleTbl
    ClientSF --> ClientTbl
    ClientSF --> CaptchaTbl
```

---

## 数据库模型

### ER 图

```mermaid
erDiagram
    role {
        uuid id PK "defaultRandom()"
        varchar name UK "角色名称"
        varchar slug UK "角色标识"
        jsonb permissions "权限码数组，如 ['news:*','admin:view']"
        text description "角色描述"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at "软删除"
    }

    admin_user {
        uuid id PK "defaultRandom()"
        varchar username UK "用户名"
        varchar email UK "邮箱"
        varchar password_hash "bcrypt 哈希"
        varchar avatar "头像"
        uuid role_id FK "关联角色"
        boolean is_root "是否超级管理员(仅一个)"
        varchar status "active/disabled"
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at "软删除"
    }

    client_user {
        uuid id PK "defaultRandom()"
        varchar username UK "用户名"
        varchar email UK "邮箱"
        varchar password_hash "bcrypt 哈希"
        varchar avatar "头像"
        varchar status "active/disabled"
        boolean email_verified "邮箱是否验证"
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at "软删除"
    }

    captcha_code {
        uuid id PK "defaultRandom()"
        varchar type "email/sms/image"
        varchar target "目标(邮箱/手机/图形token)"
        varchar code "验证码值"
        boolean used "是否已使用"
        timestamp expired_at "过期时间"
        timestamp created_at
    }

    role ||--o{ admin_user : "role_id FK"
```

### `admin_user` 表关键约束

- `is_root` 列有 **部分唯一索引**：`CREATE UNIQUE INDEX idx_admin_user_single_root ON admin_user (is_root) WHERE is_root = true`，从数据库层面保证全局仅一个 root 管理员。
- `role_id` 为必填字段（`NOT NULL`），包括 root 管理员也必须关联一个角色。

### `role.permissions` 字段

权限以 `jsonb` 格式存储，值为字符串数组：

```json
["news:*", "admin:view", "admin:create", "dict:*", "dashboard:view"]
```

支持三种通配形式：
- `"**"` — 超级通配符，匹配所有权限
- `"news:*"` — 分组通配符，匹配该模块下所有操作
- `"news:view"` — 精确匹配

### `admin_user` vs `client_user` 差异

| 特性 | admin_user | client_user |
|------|------------|-------------|
| RBAC 角色 | `role_id` FK（必填） | 无 |
| is_root | 有（部分唯一索引） | 无 |
| 邮箱验证 | 无 | `email_verified` 字段 |
| 注册入口 | 管理员手动创建 | 公开 `/register` |
| 认证缓存 | 无 | 内存缓存（5 分钟 TTL） |
| 中间件保护 | `adminAuthGuard` / `adminPermGuard` | `beforeLoad` 内调用 `getCurrentClientFn` |

---

## 身份认证流程

### 管理员登录时序

```mermaid
sequenceDiagram
    participant Browser as 浏览器
    participant LoginSF as adminLoginFn<br/>(Server Function)
    participant Server as adminLogin()<br/>(.server.ts)
    participant DB as PostgreSQL
    participant JWT as signToken()

    Browser->>LoginSF: POST { username, password }
    LoginSF->>Server: adminLogin(username, password)

    Server->>DB: SELECT * FROM admin_user WHERE username = ?
    DB-->>Server: user row

    alt 用户不存在 / 已删除 / 状态非 active
        Server-->>LoginSF: { success: false, message: "用户名或密码错误" }
        LoginSF-->>Browser: 错误信息
    else 用户校验通过
        Server->>Server: bcrypt.compare(password, passwordHash)
        alt 密码错误
            Server-->>LoginSF: { success: false, message: "用户名或密码错误" }
        else 密码正确
            Server->>DB: UPDATE admin_user SET last_login_at = now()
            Server->>JWT: signToken({ userId, username, userType: "admin" })
            JWT-->>Server: JWT Token (HS256, 7 天有效)
            Server-->>LoginSF: { success: true, user, token }
            LoginSF->>Browser: setCookie("fsdx_admin_token", token, httpOnly)
            Browser->>Browser: 跳转 /admin
        end
    end
```

### 客户端注册与登录流程

```mermaid
sequenceDiagram
    participant Browser as 浏览器
    participant RegisterSF as clientRegisterFn
    participant LoginSF as clientLoginFn
    participant Server as clientAuth.server.ts
    participant DB as PostgreSQL
    participant Captcha as captcha.server.ts

    Note over Browser,Captcha: === 注册流程 ===

    Browser->>RegisterSF: POST { username, email, password, captcha }
    RegisterSF->>Server: clientRegister()

    Server->>Captcha: verifyCaptcha("email", email, captcha)
    alt 验证码无效或过期
        Captcha-->>Server: false
        Server-->>RegisterSF: { success: false, message: "验证码错误或已过期" }
    else 验证码有效
        Server->>DB: 检查用户名/邮箱唯一性
        alt 已存在
            Server-->>RegisterSF: { success: false, message: "用户名或邮箱已存在" }
        else 可用
            Server->>DB: INSERT INTO client_user
            Server-->>RegisterSF: { success: true }
            Browser->>Browser: 跳转 /login
        end
    end

    Note over Browser,Captcha: === 登录流程 ===

    Browser->>LoginSF: POST { username, password }
    LoginSF->>Server: clientLogin()
    Server->>DB: SELECT * FROM client_user WHERE username = ?
    Server->>Server: bcrypt.compare(password, passwordHash)
    Server->>JWT: signToken({ userId, username, userType: "client" })
    Server-->>LoginSF: { success: true, user, token }
    LoginSF->>Browser: setCookie("fsdx_client_token", token, httpOnly)
```

### JWT Token 结构

| 字段 | 说明 |
|------|------|
| 算法 | HS256（`jose` 库） |
| 密钥 | `process.env.JWT_SECRET`（懒加载缓存为 `Uint8Array`） |
| 有效期 | 7 天 |
| 载荷 | `{ userId: string; username: string; userType: "admin" \| "client" }` |

`userType` 字段用于区分管理端和客户端 token，防止跨体系 token 滥用。`verifyToken` 失败时返回 `null`（不抛异常）。

---

## 权限模型 (RBAC)

### 权限码体系

权限码格式：`{模块}:{操作}`，共定义 **49 个权限常量**，按模块分组：

| 模块 | 权限码 |
|------|--------|
| `news` | `view`, `create`, `edit`, `delete`, `publish`, `export`, `import` |
| `admin` | `view`, `create`, `edit`, `delete` |
| `client` | `view`, `create`, `edit`, `delete` |
| `role` | `view`, `create`, `edit`, `delete` |
| `dict` | `view`, `create`, `edit`, `delete`, `create_item`, `edit_item`, `delete_item`, `export`, `import` |
| `config` | `view`, `create`, `edit`, `delete`, `export`, `import` |
| `file` | `view`, `upload`, `edit`, `delete` |
| `log` | `view`, `download` |
| `dashboard` | `view` |
| `event` | `view`, `query`, `manage` |
| `translation` | `view`, `manage`, `export`, `import` |
| `ai` | `test` |

每个权限常量通过 `definePermission(code, name, desc)` 创建，返回 `{ code, name, desc, group }` 结构（`group` 由 code 前缀自动推导）。

### 权限匹配算法

```mermaid
flowchart TD
    Start(["matchPermission(rolePermissions, requiredCode)"])
    Start --> Check1{"rolePermissions<br/>包含 '**' ?"}
    Check1 -->|是| Match(["✅ 匹配通过"])
    Check1 -->|否| Check2{"rolePermissions<br/>包含精确 requiredCode ?"}
    Check2 -->|是| Match
    Check2 -->|否| Check3{"requiredCode 含 ':' ?"}
    Check3 -->|否| NoMatch(["❌ 无权限"])
    Check3 -->|是| Check4{"rolePermissions<br/>包含 'module:*' ?"}
    Check4 -->|是| Match
    Check4 -->|否| NoMatch
```

三级优先级：
1. **`**` 超级通配符**：拥有全部权限，直接通过
2. **精确匹配**：如角色有 `news:create`，请求 `news:create` 通过
3. **分组通配符**：如角色有 `news:*`，请求 `news:create` / `news:edit` 等均通过

关键函数：
- `matchPermission(rolePermissions, requiredCode)` — 核心匹配逻辑
- `hasPermission(rolePermissions, PermissionDef)` — 单个权限校验
- `hasAnyPermission(rolePermissions, PermissionDef[])` — 任意满足（OR）
- `hasAllPermissions(rolePermissions, PermissionDef[])` — 全部满足（AND）

### 角色-用户-权限关系

```mermaid
flowchart LR
    subgraph AdminUsers["管理员用户"]
        Root["Root 管理员<br/>is_root = true"]
        Admin1["管理员 A"]
        Admin2["管理员 B"]
    end

    subgraph Roles["角色"]
        SuperRole["super-admin<br/>permissions: ['**']"]
        EditorRole["editor<br/>permissions: ['news:*', 'dict:view']"]
        ViewerRole["viewer<br/>permissions: ['news:view', 'dashboard:view']"]
    end

    subgraph PermLogic["权限判定"]
        Match["matchPermission()"]
    end

    Root -->|"role_id FK"| SuperRole
    Admin1 -->|"role_id FK"| EditorRole
    Admin2 -->|"role_id FK"| ViewerRole

    SuperRole -->|"自动跳过 DB 查询<br/>直接设置 ['**']"| Match
    EditorRole -->|"从 DB 读取"| Match
    ViewerRole -->|"从 DB 读取"| Match

    Match --> Result1["请求 news:create → ✅"]
    Match --> Result2["请求 admin:delete → ❌ 权限不足"]
```

---

## 中间件与守卫

### 中间件执行链路

```mermaid
flowchart TD
    SF["Server Function 调用"]
    CSRF["CSRF 中间件<br/>(Origin/Referer 校验)"]
    Locale["Locale 中间件"]
    PermGuard["adminPermGuard(requiredPerm)"]
    AuthGuard["adminAuthGuard"]
    Handler["handler() 执行业务逻辑"]

    SF --> CSRF
    CSRF --> Locale
    Locale --> PermGuard
    PermGuard -->|".middleware([adminAuthGuard])"| AuthGuard
    AuthGuard -->|"注入 AdminAuthContext"| PermCheck{"hasPermission()"}
    PermCheck -->|"✅ 有权限"| Handler
    PermCheck -->|"❌ 无权限"| Error403["throw AdminAuthError('权限不足', 403)"]

    subgraph AuthGuardDetails["adminAuthGuard 执行细节"]
        direction TB
        A1["getCookie('fsdx_admin_token')"]
        A2["verifyToken() → 校验 JWT"]
        A3["userType === 'admin' ?"]
        A4["db.query.adminUser → 查用户"]
        A5{"isRoot ?"}
        A6["rolePermissions = ['**']"]
        A7["db.query.role → 读取权限"]
        A8["注入 context: { user, rolePermissions }"]

        A1 --> A2 --> A3 --> A4 --> A5
        A5 -->|是| A6 --> A8
        A5 -->|否| A7 --> A8
    end

    AuthGuard -.-> AuthGuardDetails
```

### `adminAuthGuard` 逻辑

```mermaid
flowchart TD
    Start(["Server Function 调用管理员鉴权中间件"])
    GetCookie["读取 Cookie: 'fsdx_admin_token'"]
    CheckToken{"token 存在?"}
    VerifyJWT["verifyToken(token)"]
    CheckJWT{"JWT 有效?"}
    CheckType{"userType === 'admin'?"}
    QueryUser["db.query.adminUser"]
    CheckUser{"用户存在且<br/>deletedAt = NULL<br/>status = 'active'?"}
    CheckRoot{"isRoot ?"}
    SetAllPerms["设置 rolePermissions = ['**']<br/>（不查询 role 表）"]
    QueryRole["db.query.role<br/>读取 role.permissions"]
    InjectContext["注入 context:<br/>{ user, rolePermissions }"]
    Proceed(["执行 handler"])

    Start --> GetCookie
    GetCookie --> CheckToken
    CheckToken -->|否| Err401a["❌ 401: 未登录或登录已过期"]
    CheckToken -->|是| VerifyJWT
    VerifyJWT --> CheckJWT
    CheckJWT -->|否| Err401b["❌ 401: 未登录或登录已过期"]
    CheckJWT -->|是| CheckType
    CheckType -->|否| Err403a["❌ 403: 无权访问管理端"]
    CheckType -->|是| QueryUser
    QueryUser --> CheckUser
    CheckUser -->|否| Err403b["❌ 403: 账号已被禁用或删除"]
    CheckUser -->|是| CheckRoot
    CheckRoot -->|是| SetAllPerms
    CheckRoot -->|否| QueryRole
    SetAllPerms --> InjectContext
    QueryRole --> InjectContext
    InjectContext --> Proceed
```

### `adminPermGuard` 工厂函数

```typescript
// 在 .middleware([adminPermGuard(permission)]) 中的编译结果等价于：
createMiddleware({ type: "function" })
  // 第一步：adminAuthGuard 校验登录并注入 context
  .middleware([adminAuthGuard])
  // 第二步：校验指定权限
  .server(async (opts) => {
    const ctx = opts.context as AdminAuthContext;
    if (!hasPermission(ctx.rolePermissions, required)) {
      throw new AdminAuthError("权限不足", 403);
    }
    return opts.next();
  });
```

**使用示例**：

```typescript
// 仅需登录
export const myFn = createServerFn({ method: "GET" })
  .middleware([adminAuthGuard])
  .handler(async () => { ... });

// 需登录 + 特定权限
export const deleteNewsFn = createServerFn({ method: "POST" })
  .middleware([adminPermGuard(PERMISSIONS.NEWS_DELETE)])
  .handler(async () => { ... });
```

### `AdminAuthError`

自定义错误类，携带 HTTP 状态码：

| 错误信息 | 状态码 | 场景 |
|----------|--------|------|
| `"未登录或登录已过期"` | 401 | Cookie 不存在或 JWT 验证失败 |
| `"无权访问管理端"` | 403 | JWT 的 `userType` 不是 `"admin"` |
| `"账号已被禁用或删除"` | 403 | 用户被软删除或状态非 active |
| `"权限不足"` | 403 | `adminPermGuard` 中权限匹配失败 |

---

## Root 管理员

### 特性

Root 管理员是系统首次初始化时创建的特殊账号，具有以下特性：

1. **全局唯一** — `admin_user` 表通过部分唯一索引 `idx_admin_user_single_root` 保证仅有一个 `is_root = true` 的记录
2. **自动拥有全部权限** — 在 `adminAuthGuard` 中，`isRoot` 用户直接设置 `rolePermissions = ["**"]`，**不查询角色表**。这意味着即使 root 关联的角色被删除或权限变更，root 仍保留全部权限
3. **不可禁用** — `admin-user.server.ts` 中 `updateAdminUser` 禁止设置 root 用户 `status !== "active"`
4. **不可删除** — `admin-user.server.ts` 中 `deleteAdminUser` 禁止删除 root 用户

### 系统初始化

```mermaid
sequenceDiagram
    participant Browser as 浏览器
    participant InitPage as /admin/init
    participant InitServer as init.server.ts
    participant DB as PostgreSQL

    Browser->>InitPage: 首次访问系统
    InitPage->>InitServer: checkInitStatus()
    InitServer->>DB: SELECT FROM admin_user WHERE is_root = true
    DB-->>InitServer: null（未初始化）
    InitServer-->>InitPage: false → 显示初始化页面

    Browser->>InitPage: 提交初始化表单
    InitPage->>InitServer: initSystem({ admin: { username, password, email }, siteName, smtp, ai })

    critical 数据库事务
        InitServer->>DB: BEGIN TRANSACTION
        InitServer->>DB: 再次检查 is_root = true 是否存在
        InitServer->>DB: INSERT INTO role (name="超级管理员", slug="super-admin", permissions=["**"])
        InitServer->>DB: INSERT INTO admin_user (is_root=true, role_id=新角色ID, ...)
        InitServer->>DB: INSERT INTO system_config (site_name, smtp_*, ai_*)
        InitServer->>DB: COMMIT
    end

    InitServer->>InitServer: loadConfigCache() 刷新配置缓存
    InitServer-->>InitPage: { success: true }
    Browser->>Browser: 跳转 /admin/login
```

### 路由守卫联动

- `/admin/init` 的 `beforeLoad`：若 `checkInitStatus()` 为 true → 重定向到 `/admin/login`
- `/admin/login` 的 `beforeLoad`：若 `checkInitStatus()` 为 false → 重定向到 `/admin/init`

两条路由互为守门人，确保用户始终停留在正确页面。

---

## 客户端认证

### 客户端认证 Context

客户端认证通过 React Context 实现全局状态共享：

```
__root.tsx (SSR Document)
└── ClientAuthProvider (React Context)
    ├── 前台页面组件
    ├── useClientAuth() hook → { user, isLoading, refetch, logout }
    └── 子组件通过 useClientAuth() 消费
```

`ClientAuthProvider` 挂载时自动调用 `getCurrentClientFn()` 获取当前登录用户，并通过 Context 向下传递。

### 客户端用户内存缓存

`getCurrentClient()` 使用 5 分钟 TTL 的内存缓存（`clientUserCache`）减少重复数据库查询：

```mermaid
flowchart TD
    Start(["getCurrentClient(token)"])
    CheckToken{"token 存在?"}
    VerifyJWT["verifyToken(token)"]
    CheckJWT{"JWT 有效且<br/>userType === 'client'?"}
    CheckCache{"缓存命中且<br/>status === 'active'?"}
    ReturnCache(["返回缓存的用户信息"])
    QueryDB["db.query.clientUser"]
    CheckUser{"用户存在且<br/>deletedAt = NULL<br/>status = 'active'?"}
    SetCache["写入缓存<br/>clientUserCache.set()"]
    ReturnUser(["返回用户信息"])
    ReturnNull(["返回 null"])

    Start --> CheckToken
    CheckToken -->|否| ReturnNull
    CheckToken -->|是| VerifyJWT
    VerifyJWT --> CheckJWT
    CheckJWT -->|否| ReturnNull
    CheckJWT -->|是| CheckCache
    CheckCache -->|是| ReturnCache
    CheckCache -->|否| QueryDB
    QueryDB --> CheckUser
    CheckUser -->|否| ReturnNull
    CheckUser -->|是| SetCache
    SetCache --> ReturnUser
```

缓存失效场景：
- 管理员修改客户端用户状态时，`client-user.server.ts` 主动调用 `clientUserCache.delete(userId)`
- 管理员删除客户端用户时，同样清除缓存

### 管理员端认证状态

管理员端在 `/admin/_admin` 布局路由的 `beforeLoad` 中调用 `getCurrentAdminFn`，返回值通过路由 context 传递给所有子页面。该布局设置 `ssr: false`，所有鉴权在客户端完成。

---

## CSRF 保护

在 `src/start.ts` 中注册 `createCsrfMiddleware`：

```typescript
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});
```

- **仅对 Server Function 请求生效**，页面渲染请求不受影响
- 默认校验 `Origin`、`Referer`、`Sec-Fetch-Site` 头，拒绝跨站请求
- 位于 `requestMiddleware` 数组中，在 `localeMiddleware` 之后执行

---

## 安全要点汇总

| 层面 | 措施 |
|------|------|
| 密码存储 | bcrypt 哈希（admin 创建用 cost=12，client 注册用 cost=10） |
| Token | HS256 JWT，7 天有效期，httpOnly Cookie |
| Cookie | 管理端/客户端独立 Cookie，避免相互覆盖 |
| CSRF | TanStack Start 内置 CSRF 中间件，仅 ServerFn 生效 |
| 权限 | RBAC + 三级权限匹配，root 自动绕过角色表 |
| 软删除 | 所有用户/角色表使用 `deleted_at`，查询始终过滤 |
| 防并发初始化 | 数据库事务内二次校验 is_root |
| 构建安全 | Vite 配置禁止 `bcryptjs` / `drizzle-orm` 进入客户端 bundle |
| Root 保护 | 数据库唯一索引 + 禁用/删除拦截 |

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/lib/jwt/jwt.ts` | JWT 签发/校验、Cookie 名称常量 |
| `src/lib/permissions/permissions.ts` | 权限码常量定义、权限匹配算法 |
| `src/middleware/admin-auth.ts` | adminAuthGuard / adminPermGuard 中间件 |
| `src/services/admin-auth/admin-auth.server.ts` | 管理员登录、当前管理员查询 |
| `src/services/client-auth/client-auth.server.ts` | 客户端登录、注册、当前用户查询（含缓存） |
| `src/services/client-auth/client-auth.functions.ts` | 客户端认证 Server Function 包装器 |
| `src/services/init/init.server.ts` | 系统初始化（checkInitStatus / initSystem） |
| `src/routes/admin/_admin/users/admins/admins.server.ts` | 管理员 CRUD（含 root 禁用/删除拦截） |
| `src/routes/admin/_admin/users/clients/clients.server.ts` | 客户端用户 CRUD |
| `src/services/role/role.server.ts` | 角色 CRUD |
| `src/db/schema/admin-user.ts` | admin_user 表（含部分唯一索引） |
| `src/db/schema/client-user.ts` | client_user 表 |
| `src/db/schema/role.ts` | role 表（permissions JSONB） |
| `src/routes/admin/_admin.tsx` | 管理端布局：beforeLoad 鉴权 |
| `src/routes/admin/login.tsx` | 管理端登录页 |
| `src/routes/admin/init.tsx` | 系统初始化页 |
| `src/components/client/ClientAuthProvider.tsx` | 客户端认证 Context |
| `src/start.ts` | CSRF 中间件注册 |

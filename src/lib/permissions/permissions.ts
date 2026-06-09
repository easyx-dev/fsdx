/**
 * 权限码常量定义及元数据
 * 格式：{模块}:{操作}
 * 使用 definePermission 工厂创建权限常量，分组由 code 前缀自动推导
 */

/**
 * 创建权限码常量
 * 返回值即权限的完整定义对象，直接作为 permGuard / hasPermission 的入参
 */
function definePermission<C extends string, N extends string, D extends string>(
	code: C,
	name: N,
	desc: D,
) {
	const group = code.split(":")[0];
	return { code, name, desc, group } as const;
}

// ─── 权限码常量 ───

export const PERMISSIONS = {
	// 新闻管理
	NEWS_VIEW: definePermission(
		"news:view",
		"查看新闻",
		"允许查看新闻列表和详情",
	),
	NEWS_CREATE: definePermission(
		"news:create",
		"创建新闻",
		"允许创建新的新闻文章",
	),
	NEWS_EDIT: definePermission(
		"news:edit",
		"编辑新闻",
		"允许编辑已有新闻的内容",
	),
	NEWS_DELETE: definePermission(
		"news:delete",
		"删除新闻",
		"允许删除新闻（软删除）",
	),
	NEWS_PUBLISH: definePermission(
		"news:publish",
		"发布新闻",
		"允许发布、归档等状态变更操作",
	),
	// 管理员管理
	ADMIN_VIEW: definePermission(
		"admin:view",
		"查看管理员",
		"允许查看管理员列表",
	),
	ADMIN_CREATE: definePermission(
		"admin:create",
		"创建管理员",
		"允许创建新的管理员账号",
	),
	ADMIN_EDIT: definePermission(
		"admin:edit",
		"编辑管理员",
		"允许编辑管理员信息",
	),
	ADMIN_DELETE: definePermission(
		"admin:delete",
		"删除管理员",
		"允许删除管理员账号",
	),
	// 客户端用户
	CLIENT_VIEW: definePermission(
		"client:view",
		"查看客户端用户",
		"允许查看前台注册用户列表",
	),
	CLIENT_CREATE: definePermission(
		"client:create",
		"创建客户端用户",
		"允许创建新的客户端用户账号",
	),
	CLIENT_EDIT: definePermission(
		"client:edit",
		"编辑客户端用户",
		"允许编辑客户端用户信息",
	),
	CLIENT_DELETE: definePermission(
		"client:delete",
		"删除客户端用户",
		"允许删除客户端用户账号",
	),
	// 角色管理
	ROLE_VIEW: definePermission("role:view", "查看角色", "允许查看角色列表"),
	ROLE_CREATE: definePermission("role:create", "创建角色", "允许创建新的角色"),
	ROLE_EDIT: definePermission(
		"role:edit",
		"编辑角色",
		"允许编辑角色信息和权限分配",
	),
	ROLE_DELETE: definePermission("role:delete", "删除角色", "允许删除角色"),
	// 字典管理
	DICT_VIEW: definePermission(
		"dict:view",
		"查看字典",
		"允许查看字典类型和条目",
	),
	DICT_CREATE: definePermission(
		"dict:create",
		"创建字典",
		"允许创建新的字典类型",
	),
	DICT_EDIT: definePermission("dict:edit", "编辑字典", "允许编辑字典类型信息"),
	DICT_DELETE: definePermission("dict:delete", "删除字典", "允许删除字典类型"),
	DICT_CREATE_ITEM: definePermission(
		"dict:create_item",
		"创建字典条目",
		"允许在字典中新增条目",
	),
	DICT_EDIT_ITEM: definePermission(
		"dict:edit_item",
		"编辑字典条目",
		"允许编辑字典条目内容",
	),
	DICT_DELETE_ITEM: definePermission(
		"dict:delete_item",
		"删除字典条目",
		"允许删除字典条目",
	),
	// 系统配置
	CONFIG_VIEW: definePermission(
		"config:view",
		"查看配置",
		"允许查看系统配置项",
	),
	CONFIG_CREATE: definePermission(
		"config:create",
		"创建配置",
		"允许新增系统配置项",
	),
	CONFIG_EDIT: definePermission(
		"config:edit",
		"编辑配置",
		"允许修改系统配置项的值",
	),
	CONFIG_DELETE: definePermission(
		"config:delete",
		"删除配置",
		"允许删除系统配置项",
	),
	// 文件管理
	FILE_VIEW: definePermission("file:view", "查看文件", "允许查看文件列表"),
	FILE_UPLOAD: definePermission("file:upload", "上传文件", "允许上传新文件"),
	FILE_EDIT: definePermission(
		"file:edit",
		"编辑文件",
		"允许修改文件属性（如转为永久存储）",
	),
	FILE_DELETE: definePermission("file:delete", "删除文件", "允许删除文件"),
	// 日志管理
	LOG_VIEW: definePermission("log:view", "查看日志", "允许查询和查看系统日志"),
	// 仪表盘
	DASHBOARD_VIEW: definePermission(
		"dashboard:view",
		"查看仪表盘",
		"允许查看管理端首页统计信息",
	),
	// 翻译管理
	TRANSLATION_VIEW: definePermission(
		"translation:view",
		"查看翻译",
		"允许查看 UI 翻译和实体字段翻译",
	),
	TRANSLATION_MANAGE: definePermission(
		"translation:manage",
		"管理翻译",
		"允许新增、编辑、删除翻译内容",
	),
} as const;

// ─── 对外类型 ───

// ─── 权限匹配 ───

/**
 * 检查角色权限是否匹配指定权限码
 * 匹配优先级：**（超级通配符）→ 精确匹配 → group:*（分组通配符）
 */
export function matchPermission(
	rolePermissions: string[],
	requiredCode: string,
): boolean {
	// 超级通配符：拥有全部权限
	if (rolePermissions.includes("**")) return true;
	// 精确匹配
	if (rolePermissions.includes(requiredCode)) return true;
	// 分组通配符：匹配 module:* 前缀
	const colonIndex = requiredCode.indexOf(":");
	if (colonIndex !== -1) {
		const groupWildcard = `${requiredCode.slice(0, colonIndex + 1)}*`;
		if (rolePermissions.includes(groupWildcard)) return true;
	}
	return false;
}

/** 权限完整定义对象类型 */
export type PermissionDef = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** 权限码字符串类型 */
export type PermissionCode = PermissionDef["code"];

/** 所有权限码的元数据映射（从 PERMISSIONS 自动派生） */
export const PERMISSION_META: Record<PermissionCode, PermissionDef> =
	Object.fromEntries(
		Object.values(PERMISSIONS).map((d) => [d.code, d]),
	) as Record<PermissionCode, PermissionDef>;

/** 所有权限码列表 */
export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS).map(
	(d) => d.code,
);

/** 按分组归类的权限列表（从 PERMISSIONS 自动派生） */
export const PERMISSIONS_BY_GROUP: Record<string, PermissionDef[]> =
	Object.values(PERMISSIONS).reduce<Record<string, PermissionDef[]>>(
		(acc, d) => {
			const list = acc[d.group] ?? [];
			list.push(d);
			acc[d.group] = list;
			return acc;
		},
		{},
	);

/**
 * 检查角色是否拥有指定权限
 */
export function hasPermission(
	rolePermissions: string[],
	required: PermissionDef,
): boolean {
	return matchPermission(rolePermissions, required.code);
}

/**
 * 检查角色是否拥有任一权限
 */
export function hasAnyPermission(
	rolePermissions: string[],
	required: PermissionDef[],
): boolean {
	return required.some((p) => matchPermission(rolePermissions, p.code));
}

/**
 * 检查角色是否拥有全部权限
 */
export function hasAllPermissions(
	rolePermissions: string[],
	required: PermissionDef[],
): boolean {
	return required.every((p) => matchPermission(rolePermissions, p.code));
}

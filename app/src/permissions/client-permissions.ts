/**
 * 客户端权限码常量定义
 * 格式 {模块}:{操作}，分组由 code 前缀自动推导
 * 当前无业务模块，权限码集为空；业务模块扩展时在此填充并配套 client_role 表初始化
 */
import { matchPermission } from "@fsdx/core/match-permission";

/**
 * 创建权限码常量
 * 返回值即权限的完整定义对象，直接作为 clientPermGuard / hasAdminPermission 的入参
 */
function definePermission<C extends string, N extends string, D extends string>(
	code: C,
	name: N,
	desc: D,
) {
	const group = code.split(":")[0];
	return { code, name, desc, group } as const;
}

/** 客户端权限完整定义对象类型 */
export type ClientPermissionDef = ReturnType<typeof definePermission>;

export const CLIENT_PERMISSIONS: Record<string, ClientPermissionDef> = {
	// 业务模块权限码预留位（例）：
	// BAM_VIEW: definePermission("bam:view", "经分会查看", "允许查看经分会数据"),
};

/** 客户端权限码字符串类型 */
export type ClientPermissionCode = ClientPermissionDef["code"];

/** 所有客户端权限码的元数据映射（当前为空集合） */
export const CLIENT_PERMISSION_META: Record<string, ClientPermissionDef> =
	Object.fromEntries(Object.values(CLIENT_PERMISSIONS).map((d) => [d.code, d]));

/** 所有客户端权限码列表（当前为空集合） */
export const ALL_CLIENT_PERMISSIONS: string[] = Object.values(
	CLIENT_PERMISSIONS,
).map((d) => d.code);

/** 按分组归类的客户端权限列表（当前为空集合） */
export const CLIENT_PERMISSIONS_BY_GROUP: Record<
	string,
	ClientPermissionDef[]
> = Object.values(CLIENT_PERMISSIONS).reduce<
	Record<string, ClientPermissionDef[]>
>((acc, d) => {
	const list = acc[d.group] ?? [];
	list.push(d);
	acc[d.group] = list;
	return acc;
}, {});

/**
 * 检查客户端角色是否拥有指定权限
 */
export function hasClientPermission(
	rolePermissions: string[],
	required: ClientPermissionDef,
): boolean {
	return matchPermission(rolePermissions, required.code);
}

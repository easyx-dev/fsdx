/**
 * 权限匹配纯函数：判断角色权限列表是否匹配指定权限码
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

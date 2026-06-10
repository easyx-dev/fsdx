/**
 * 管理端认证 Context：全局共享当前管理员信息，提供 refetch 能力
 */

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getCurrentAdminFn } from "#/routes/admin/_admin";
import type { AdminUser } from "#/server/admin-auth/admin-auth.types";

interface AdminAuthContextType {
	/** 当前登录管理员，null 表示未登录 */
	user: AdminUser | null;
	/** 首次加载中 */
	isLoading: boolean;
	/** 重新获取当前管理员信息（登录/退出后调用） */
	refetch: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(
	undefined,
);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AdminUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const loadUser = useCallback(async () => {
		const u = await getCurrentAdminFn();
		setUser(u);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		loadUser().finally(() => {
			if (!cancelled) setIsLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [loadUser]);

	const refetch = useCallback(() => {
		setIsLoading(true);
		loadUser().finally(() => setIsLoading(false));
	}, [loadUser]);

	return (
		<AdminAuthContext.Provider value={{ user, isLoading, refetch }}>
			{children}
		</AdminAuthContext.Provider>
	);
}

/**
 * 获取当前管理端认证状态
 * 必须在 AdminAuthProvider 内部使用
 */
export function useAdminAuth(): AdminAuthContextType {
	const context = useContext(AdminAuthContext);
	if (!context) {
		throw new Error("useAdminAuth 必须在 AdminAuthProvider 内部使用");
	}
	return context;
}

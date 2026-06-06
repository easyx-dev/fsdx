/**
 * 认证 Context：全局共享当前用户信息，提供 refetch 能力
 */

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getCurrentUserFn } from "#/routes/admin/_admin";
import type { AuthUser } from "#/server/auth/current-user";

interface AuthContextType {
	/** 当前登录用户，null 表示未登录 */
	user: AuthUser | null;
	/** 首次加载中 */
	isLoading: boolean;
	/** 重新获取当前用户信息（登录/退出后调用） */
	refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const loadUser = useCallback(async () => {
		const u = await getCurrentUserFn();
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
		<AuthContext.Provider value={{ user, isLoading, refetch }}>
			{children}
		</AuthContext.Provider>
	);
}

/**
 * 获取当前认证状态
 * 必须在 AuthProvider 内部使用
 */
export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth 必须在 AuthProvider 内部使用");
	}
	return context;
}

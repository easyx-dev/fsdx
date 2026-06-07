/**
 * 认证模块共享类型定义
 */

/** 统一用户信息类型 */
export interface AuthUser {
	id: string;
	username: string;
	email: string;
	avatar?: string | null;
	isRoot: boolean;
	roleName?: string;
	userType: "admin" | "client";
}

/** JWT Payload 类型（解耦自 jwt 模块） */
export interface JwtUserPayload {
	userId: string;
	username: string;
	userType: "admin" | "client";
}

export interface AdminLoginResult {
	success: boolean;
	message?: string;
	user?: { id: string; username: string; email: string };
	token?: string;
}

export interface ClientLoginResult {
	success: boolean;
	message?: string;
	user?: { id: string; username: string; email: string };
	token?: string;
}

export interface ClientRegisterResult {
	success: boolean;
	message: string;
}

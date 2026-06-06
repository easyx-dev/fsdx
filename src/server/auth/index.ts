/**
 * 认证模块统一导出
 */

export type { AdminLoginResult } from "./admin";
export { adminLoginService } from "./admin";

export type { ClientLoginResult, ClientRegisterResult } from "./client";
export { clientLoginService, clientRegisterService } from "./client";

export type { AuthUser } from "./current-user";
export { getCurrentUser } from "./current-user";

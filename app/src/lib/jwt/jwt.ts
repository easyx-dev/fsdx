/**
 * JWT 模块壳：createJwt 工厂来自 @fsdx/core/jwt
 * 密钥从环境变量显式传入；Cookie 名称约定见 constants/cookie-names.ts
 */

import type { JwtModule } from "@fsdx/core/jwt";
import { createJwt } from "@fsdx/core/jwt";
import { logger } from "#/lib/logger/logger";

export type { JwtModule, JwtPayload } from "@fsdx/core/jwt";

/** 应用级 JWT 模块：密钥从环境变量 JWT_SECRET 读取 */
export const jwt: JwtModule = createJwt({
	secret: process.env.JWT_SECRET || "",
	logger,
});

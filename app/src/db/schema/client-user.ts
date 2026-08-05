/**
 * 客户端用户表
 */
import {
	boolean,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { clientRole } from "./client-role";

export const clientUser = pgTable("client_user", {
	id: uuid().defaultRandom().primaryKey(),
	username: varchar({ length: 50 }).unique().notNull(),
	email: varchar({ length: 255 }).unique().notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	avatar: varchar({ length: 500 }),
	clientRoleId: uuid("client_role_id").references(() => clientRole.id),
	status: varchar({ length: 20 }).default("active").notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

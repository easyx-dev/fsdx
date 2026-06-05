/**
 * 管理员用户表
 */
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { role } from "./role";

export const adminUser = pgTable("admin_user", {
	id: uuid().defaultRandom().primaryKey(),
	username: varchar({ length: 50 }).unique().notNull(),
	email: varchar({ length: 255 }).unique().notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	avatar: varchar({ length: 500 }),
	roleId: uuid("role_id")
		.references(() => role.id)
		.notNull(),
	status: varchar({ length: 20 }).default("active").notNull(),
	lastLoginAt: timestamp("last_login_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
});

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

export const clientUser = pgTable("client_user", {
	id: uuid().defaultRandom().primaryKey(),
	username: varchar({ length: 50 }).unique().notNull(),
	email: varchar({ length: 255 }).unique().notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	avatar: varchar({ length: 500 }),
	status: varchar({ length: 20 }).default("active").notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	lastLoginAt: timestamp("last_login_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
});

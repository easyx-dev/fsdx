/**
 * 验证码表
 */
import {
	boolean,
	index,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const captchaCode = pgTable(
	"captcha_code",
	{
		id: uuid().defaultRandom().primaryKey(),
		type: varchar({ length: 20 }).notNull(), // email | sms
		target: varchar({ length: 255 }).notNull(), // 邮箱或手机号
		code: varchar({ length: 10 }).notNull(),
		used: boolean().default(false).notNull(),
		expiredAt: timestamp("expired_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("idx_captcha_target_type").on(table.target, table.type)],
);

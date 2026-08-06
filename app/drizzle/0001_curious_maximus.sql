ALTER TABLE "admin_user" DROP CONSTRAINT "admin_user_admin_role_id_admin_role_id_fk";
--> statement-breakpoint
ALTER TABLE "client_user" DROP CONSTRAINT "client_user_client_role_id_client_role_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_user" ADD COLUMN "admin_role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "client_user" ADD COLUMN "client_role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- 回填：将旧单角色列数据迁入新数组列
UPDATE "admin_user" SET "admin_role_ids" = jsonb_build_array("admin_role_id") WHERE "admin_role_id" IS NOT NULL;--> statement-breakpoint
UPDATE "client_user" SET "client_role_ids" = jsonb_build_array("client_role_id") WHERE "client_role_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_user" DROP COLUMN "admin_role_id";--> statement-breakpoint
ALTER TABLE "client_user" DROP COLUMN "client_role_id";
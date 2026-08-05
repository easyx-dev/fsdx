CREATE TABLE "admin_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "admin_role_name_unique" UNIQUE("name"),
	CONSTRAINT "admin_role_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"avatar" varchar(500),
	"admin_role_id" uuid NOT NULL,
	"is_root" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "admin_user_username_unique" UNIQUE("username"),
	CONSTRAINT "admin_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "captcha_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"target" varchar(255) NOT NULL,
	"code" varchar(10) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expired_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "client_role_name_unique" UNIQUE("name"),
	CONSTRAINT "client_role_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"avatar" varchar(500),
	"client_role_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "client_user_username_unique" UNIQUE("username"),
	CONSTRAINT "client_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "dict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "dict_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dict_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dict_slug" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"value" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"extra_type" varchar(20),
	"extra" text,
	"color" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"original_name" varchar(500) NOT NULL,
	"stored_name" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" bigint NOT NULL,
	"path" varchar(1000) NOT NULL,
	"status" varchar(20) DEFAULT 'temp' NOT NULL,
	"expired_at" timestamp with time zone,
	"created_by_type" varchar(20),
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_translation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"locale" varchar(10) NOT NULL,
	"value" text NOT NULL,
	"value_type" varchar(20) DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ct_entity_field_locale" UNIQUE("entity_type","entity_id","field_name","locale")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_type" varchar(20) NOT NULL,
	"recipient_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"type" varchar(50) DEFAULT 'system' NOT NULL,
	"status" varchar(20) DEFAULT 'unread' NOT NULL,
	"related_link" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"description" text,
	"content" text,
	"cover_image_id" uuid,
	"external_url" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "operation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" uuid,
	"operatorName" varchar(100) NOT NULL,
	"operatorType" varchar(20) DEFAULT 'admin' NOT NULL,
	"module" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"targetType" varchar(50) NOT NULL,
	"targetId" varchar(500),
	"targetName" varchar(500),
	"detail" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"client_visible" boolean DEFAULT false NOT NULL,
	"value_type" varchar(20),
	"group_name" varchar(50),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "track_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"user_id" uuid,
	"session_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_event_meta" (
	"name" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_property_meta" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL,
	"data_type" varchar(20) DEFAULT 'string' NOT NULL,
	"description" text,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ui_translation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" varchar(10) NOT NULL,
	"key" varchar(300) NOT NULL,
	"value" text NOT NULL,
	"value_type" varchar(20) DEFAULT 'input' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ui_trans_locale_key" UNIQUE("locale","key")
);
--> statement-breakpoint
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_admin_role_id_admin_role_id_fk" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_user" ADD CONSTRAINT "client_user_client_role_id_client_role_id_fk" FOREIGN KEY ("client_role_id") REFERENCES "public"."client_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_item" ADD CONSTRAINT "dict_item_dict_slug_dict_slug_fk" FOREIGN KEY ("dict_slug") REFERENCES "public"."dict"("slug") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_cover_image_id_file_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_created_by_id_admin_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_updated_by_id_admin_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."admin_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_admin_user_single_root" ON "admin_user" USING btree ("is_root") WHERE "admin_user"."is_root" = true;--> statement-breakpoint
CREATE INDEX "idx_captcha_target_type" ON "captcha_code" USING btree ("target","type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dict_item_dict_slug_value" ON "dict_item" USING btree ("dict_slug","value");--> statement-breakpoint
CREATE INDEX "idx_file_sha256" ON "file" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "idx_ct_entity_locale" ON "content_translation" USING btree ("entity_type","entity_id","locale");--> statement-breakpoint
CREATE INDEX "idx_message_recipient" ON "message" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE INDEX "idx_news_created_at" ON "news" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_operation_log_module" ON "operation_log" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_operation_log_operator" ON "operation_log" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "idx_operation_log_created_at" ON "operation_log" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_system_config_group" ON "system_config" USING btree ("group_name");--> statement-breakpoint
CREATE INDEX "idx_track_event_time" ON "track_event" USING btree ("time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_track_event_name_time" ON "track_event" USING btree ("name","time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_track_event_user_id" ON "track_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_track_event_session_id" ON "track_event" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_track_event_created_at" ON "track_event" USING btree ("created_at");
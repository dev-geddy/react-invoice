CREATE TYPE "public"."connector_dcr_mode" AS ENUM('off', 'allowlist', 'open');--> statement-breakpoint
CREATE TABLE "connector_config" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'mcp' NOT NULL,
	"dcrMode" "connector_dcr_mode" DEFAULT 'off' NOT NULL,
	"redirectHosts" text[] DEFAULT '{"claude.ai","claude.com"}' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connector_config_kind_unique" UNIQUE("kind")
);
--> statement-breakpoint
ALTER TABLE "oauth_client" ADD COLUMN "origin" text DEFAULT 'dynamic' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_client" ADD COLUMN "createdByUserId" text;--> statement-breakpoint
ALTER TABLE "oauth_client" ADD COLUMN "allowLoopbackPorts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
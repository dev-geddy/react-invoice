CREATE TYPE "public"."user_token_type" AS ENUM('password_reset', 'email_change');--> statement-breakpoint
CREATE TABLE "user_token" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" "user_token_type" NOT NULL,
	"tokenHash" text NOT NULL,
	"newEmail" text,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_token_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "user_token" ADD CONSTRAINT "user_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
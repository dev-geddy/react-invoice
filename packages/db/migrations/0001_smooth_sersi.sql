CREATE TABLE "email_config" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"apiKeyEnc" text,
	"fromEmail" text,
	"fromName" text,
	"replyTo" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_config_provider_unique" UNIQUE("provider")
);

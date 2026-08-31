CREATE TABLE "analytics_config" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'google_analytics' NOT NULL,
	"measurementId" text,
	"cookieBannerEnabled" boolean DEFAULT true NOT NULL,
	"cookieBannerText" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_config_kind_unique" UNIQUE("kind")
);

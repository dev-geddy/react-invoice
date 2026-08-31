ALTER TABLE "invoice_config" ADD COLUMN "taxYearStartMonth" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_config" ADD COLUMN "taxYearStartDay" integer DEFAULT 6 NOT NULL;
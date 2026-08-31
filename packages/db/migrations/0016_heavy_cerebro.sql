CREATE TABLE "invoice_config" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'invoice' NOT NULL,
	"brandName" text DEFAULT '' NOT NULL,
	"brandSubName" text DEFAULT '' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_config_kind_unique" UNIQUE("kind")
);

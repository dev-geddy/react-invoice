CREATE TABLE "invoice_series" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"brandName" text DEFAULT '' NOT NULL,
	"brandSubName" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_series_code_unique" UNIQUE("code")
);

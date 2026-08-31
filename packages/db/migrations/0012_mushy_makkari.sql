CREATE TYPE "public"."invoice_party_kind" AS ENUM('provider', 'customer');--> statement-breakpoint
CREATE TABLE "invoice_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceId" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"dateProvided" date NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"qtyType" text DEFAULT '' NOT NULL,
	"rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_party" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceId" text NOT NULL,
	"kind" "invoice_party_kind" NOT NULL,
	"companyName" text DEFAULT '' NOT NULL,
	"companyRegNo" text DEFAULT '' NOT NULL,
	"companyVatNo" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"addressLine1" text DEFAULT '' NOT NULL,
	"addressLine2" text DEFAULT '' NOT NULL,
	"addressLine3" text DEFAULT '' NOT NULL,
	"addressLine4" text DEFAULT '' NOT NULL,
	"billingBankAccountIban" text DEFAULT '' NOT NULL,
	"billingBankAccountBic" text DEFAULT '' NOT NULL,
	"billingBankAccountNo" text DEFAULT '' NOT NULL,
	"billingBankAccountSortCode" text DEFAULT '' NOT NULL,
	CONSTRAINT "invoice_party_invoice_kind_key" UNIQUE("invoiceId","kind")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"invoiceDate" date NOT NULL,
	"series" text DEFAULT '' NOT NULL,
	"number" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT '€' NOT NULL,
	"vatRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"brandName" text DEFAULT '' NOT NULL,
	"brandSubName" text DEFAULT '' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_entry" ADD CONSTRAINT "invoice_entry_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_party" ADD CONSTRAINT "invoice_party_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_entry_invoice_idx" ON "invoice_entry" USING btree ("invoiceId","position");--> statement-breakpoint
CREATE INDEX "invoice_created_idx" ON "invoice" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "invoice_series_idx" ON "invoice" USING btree ("series");
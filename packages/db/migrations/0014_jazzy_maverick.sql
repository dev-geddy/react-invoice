CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

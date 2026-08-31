CREATE TYPE "public"."oauth_token_type" AS ENUM('access', 'refresh');--> statement-breakpoint
CREATE TABLE "oauth_auth_code" (
	"id" text PRIMARY KEY NOT NULL,
	"codeHash" text NOT NULL,
	"clientId" text NOT NULL,
	"userId" text NOT NULL,
	"redirectUri" text NOT NULL,
	"scopes" text[] NOT NULL,
	"resource" text,
	"codeChallenge" text NOT NULL,
	"codeChallengeMethod" text DEFAULT 'S256' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_auth_code_codeHash_unique" UNIQUE("codeHash")
);
--> statement-breakpoint
CREATE TABLE "oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"clientSecretHash" text,
	"clientName" text NOT NULL,
	"redirectUris" text[] NOT NULL,
	"grantTypes" text[] DEFAULT '{"authorization_code","refresh_token"}' NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"tokenEndpointAuthMethod" text DEFAULT 'none' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp,
	CONSTRAINT "oauth_client_clientId_unique" UNIQUE("clientId")
);
--> statement-breakpoint
CREATE TABLE "oauth_token" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "oauth_token_type" NOT NULL,
	"tokenHash" text NOT NULL,
	"clientId" text NOT NULL,
	"userId" text NOT NULL,
	"scopes" text[] NOT NULL,
	"resource" text,
	"familyId" text NOT NULL,
	"parentId" text,
	"userTokenVersion" integer NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_token_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "oauth_auth_code" ADD CONSTRAINT "oauth_auth_code_clientId_oauth_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_auth_code" ADD CONSTRAINT "oauth_auth_code_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_clientId_oauth_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_token_family_idx" ON "oauth_token" USING btree ("familyId");--> statement-breakpoint
CREATE INDEX "oauth_token_user_client_idx" ON "oauth_token" USING btree ("userId","clientId");
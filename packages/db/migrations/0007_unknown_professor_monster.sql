CREATE TABLE "speech_config" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'deepgram' NOT NULL,
	"apiKeyEnc" text,
	"sttModel" text,
	"ttsModel" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "speech_config_provider_unique" UNIQUE("provider")
);

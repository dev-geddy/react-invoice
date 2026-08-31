-- Custom SQL migration file, put your code below! --
-- Seed the singleton Google Analytics config row so a fresh database already
-- carries the default cookie-banner copy (the admin UI reflects it at once).
-- No measurement id => analytics stays off until an operator sets one.
-- Idempotent: re-runs hit the `kind` unique constraint and do nothing.
INSERT INTO "analytics_config" ("id", "kind", "measurementId", "cookieBannerEnabled", "cookieBannerText")
VALUES (
	'0f4a1c8e-9d3b-4f26-8a71-5c2e6b0d7a14',
	'google_analytics',
	NULL,
	true,
	'We use cookies to measure how this site is used, via Google Analytics. Analytics only runs if you accept.'
)
ON CONFLICT ("kind") DO NOTHING;

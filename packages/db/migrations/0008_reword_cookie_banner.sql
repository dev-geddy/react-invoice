-- Custom SQL migration file, put your code below! --
-- Reword the default cookie-banner copy. The 0006 seed led with the cost
-- ("cookies", "Google Analytics") and gave no reason to accept, so most
-- visitors declined or ignored it and nothing was ever measured.
--
-- Only rewrites rows still carrying the untouched 0006 text: the copy is
-- operator-editable (`L2-ANALYTICS-08`), and a migration must never clobber
-- an operator's edit. Idempotent — a second run matches nothing.
UPDATE "analytics_config"
SET "cookieBannerText" = 'Can we count your visit? It shows us which pages actually help people — we only ever look at totals, and never use it for ads. It runs on Google Analytics cookies, and only if you accept.'
WHERE "kind" = 'google_analytics'
	AND "cookieBannerText" = 'We use cookies to measure how this site is used, via Google Analytics. Analytics only runs if you accept.';

# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately through GitHub's
[Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository (Security tab → "Report a vulnerability").

Please include:
- a description of the issue and its impact,
- steps to reproduce (proof of concept if possible),
- affected version / commit.

We aim to acknowledge reports within a few days and will keep you updated on
the fix. Please give us reasonable time to address the issue before any public
disclosure.

## Scope

`backflip` is a self-hosted starter foundation — you deploy it and supply your
own secrets. Before running it anywhere non-local, make sure you have:

- set a strong, unique `AUTH_SECRET` (`openssl rand -base64 33`),
- set a strong, unique `ENCRYPTION_KEY` (`openssl rand -base64 32`),
- replaced the example database credentials,
- seeded the admin owner with a strong `ADMIN_PASSWORD`.

The default values shipped in `.env.example` are for local development only and
must never be used in a deployed environment.

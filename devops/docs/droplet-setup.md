# Droplet setup

One-time provisioning of a fresh droplet. Safe to re-run — idempotent.
Two flavors — pick one, plus a db script:

| Script | App runtime | Proxy / TLS | Node |
|---|---|---|---|
| `setup-droplet-for-pm2.sh` | pm2 on host | nginx + certbot (Let's Encrypt) | nvm Node 24 + corepack yarn 4 |
| `setup-droplet-for-docker.sh` | pm2 on host, db in Docker | native Caddy (auto-TLS) | apt Node 24 (NodeSource) |

Database (pm2 flavor — run one after setup):
- `setup-droplet-db-native.sh` — Postgres 17 (PGDG apt), loopback only, creates role + db, prints `DATABASE_URL`
- `setup-droplet-db-docker.sh` — Docker engine for the db-only compose stack (container starts on first deploy)

The docker flavor already includes Docker; its db comes up on first deploy.

## What both flavors do
- Create a locked `backflip` app user (no password, no ssh) — pm2 + the app run as it, `/var/www/<domain>` belongs to it; root does only system work (packages, db, proxy)
- Install base packages, add 2G swap (if none present)
- Harden SSH: key-only (password + keyboard-interactive auth disabled), `MaxAuthTries 4`, no X11 forwarding
- Install fail2ban (sshd jail: 5 retries → 1h ban) and enable unattended security upgrades
- Configure `ufw`: allow SSH, 80, 443; deny everything else
- Install pm2 with a systemd startup unit
- Create `/var/www/<domain>` and `/var/www/<domain>/shared` (persistent instance data — future admin file uploads; deploys never touch it). Release slots `blue/`/`green/` are created by the first deploys

## Run it — pm2 flavor (nginx + Let's Encrypt)
Domain is a required parameter; point its A record at the droplet first for
TLS to issue during setup (if DNS isn't ready, setup warns + continues and
prints the certbot command to re-run later):
```bash
./devops/setup-droplet-for-pm2.sh -h <host> -i <ssh-key> -d <domain> -m <email>
./devops/setup-droplet-db-native.sh -h <host> -i <ssh-key>     # or setup-droplet-db-docker.sh
```
`-m` is the Let's Encrypt account email (expiry notices); omit to register without one.

Multi-instance: re-run setup with different `-n <app-name> -d <domain> --app-port <port>` (+ db script with `--db-name`/`--db-user`) to host another instance on the same droplet — own `/opt/<name>`, pm2 app, nginx site, cert. Deploys with matching `-n`/`--app-port` touch only that instance.

## Run it — docker flavor (Caddy)
```bash
./devops/setup-droplet-for-docker.sh -h <host> -i <ssh-key>
```

## First-time env files
Copy the templates, fill in real values:
```bash
cp devops/env/production.env.example .env.production
cp devops/env/production.env.local.example .env.production.local
```
- `.env.production` → droplet `.env`: `POSTGRES_*`, `DATABASE_URL` (`127.0.0.1:5432`), `ENCRYPTION_KEY`, `DOMAIN`
- `.env.production.local` → droplet `.env.local`: `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTH_URL`, optional `AUTH_GOOGLE_*`

With `setup-droplet-db-native.sh`, use the `DATABASE_URL` it prints.

Pass both to the first deploy run via `--env` / `--env-local` (see [deploy-local.md](./deploy-local.md)). Omit on later deploys — they never overwrite droplet env.

## One-off owner seed
Run once, after the first deploy, to create the admin user:
```bash
scp -i <ssh-key> .env.init root@<host>:/var/www/<domain>/.env.init
ssh -i <ssh-key> root@<host> 'chown backflip:backflip /var/www/<domain>/.env.init && sudo -H -u backflip bash -c ". \$HOME/.nvm/nvm.sh 2>/dev/null; cd /var/www/<domain> && corepack yarn init-owner" && rm /var/www/<domain>/.env.init'
```
Seed script reads `/var/www/<domain>/.env` + `.env.init` directly on the host, as the `backflip` user (the nvm sourcing is a no-op on the docker flavor's system node).

## Troubleshooting
- `Permission denied (publickey)` → `chmod 600 <ssh-key>`.
- Password SSH login stops working after setup — intended. Access is key-only; if the key is lost, use the DigitalOcean web console to recover.
- certbot failed at setup → DNS not pointing at the droplet yet. Re-run the certbot command the script printed once the A record resolves.
- Ran `ufw` changes and lost SSH access? Reboot the droplet from the DigitalOcean console — `ufw` always allows SSH by default here, but a manual firewall edit outside this script can still lock you out.
- Safe to re-run any setup script any time — they only install/configure what's missing.
- Build OOM on small droplets → mitigated by the 2G swap setup creates.
- Don't run both flavors on one droplet — nginx and Caddy both want ports 80/443.

# Deployment

Deploy backflip to a DigitalOcean droplet. Routine path is **Drone CI: push to `master` ships production** ([deploy-drone.md](./devops/docs/deploy-drone.md)); the scripts below are the break-glass path from your machine, and GitHub Actions is a manual `workflow_dispatch` alternative. App runs via pm2 (Next standalone build) on the host. Two droplet flavors:

- **pm2 flavor** (preferred): nvm Node 24 + yarn 4, nginx reverse proxy + Let's Encrypt TLS, Postgres native or in Docker (separate db script)
- **docker flavor**: apt Node 24, native Caddy for TLS, Postgres in Docker

Scripts live in `devops/`; one doc below per build setup.

## Prerequisites
- A DigitalOcean droplet (Ubuntu LTS), running, root SSH access
- Your local SSH private key for that droplet
- A domain with an A record pointing at the droplet's IP

## Quick start (pm2 flavor)
```bash
./devops/setup-droplet-for-pm2.sh -h <host> -i <ssh-key> -d <domain> -m <letsencrypt-email>
./devops/setup-droplet-db-native.sh -h <host> -i <ssh-key>        # prints DATABASE_URL
cp devops/env/production.env.example .env.production              # fill in values
cp devops/env/production.env.local.example .env.production.local  # fill in values
./devops/deploy-for-pm2.sh -h <host> -i <ssh-key> -d <domain> --env .env.production --env-local .env.production.local
```
App is live at `https://<domain>`.

Docker flavor: `setup-droplet-for-docker.sh -d <domain>` + `deploy-for-docker.sh -d <domain>`, same env files (Caddy still reads `DOMAIN` from env at deploy).

## Docs
| Doc | Covers |
|---|---|
| [devops/docs/droplet-setup.md](./devops/docs/droplet-setup.md) | One-time droplet provisioning, env files, owner seed |
| [devops/docs/deploy-local.md](./devops/docs/deploy-local.md) | Deploying from your own machine |
| [devops/docs/deploy-github-actions.md](./devops/docs/deploy-github-actions.md) | Deploying via GitHub Actions |
| [devops/docs/deploy-drone.md](./devops/docs/deploy-drone.md) | Deploying via Drone CI |

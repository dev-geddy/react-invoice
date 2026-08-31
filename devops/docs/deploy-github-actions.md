# Deploy via GitHub Actions

Workflow: `.github/workflows/deploy.yml` — a thin wrapper over `devops/deploy-for-pm2-build-locally.sh`.

The build happens **on the Actions runner** (`ubuntu-latest`, Node 24 + corepack with yarn caching): install → typecheck → Next standalone build → tarball artifact. Only the artifact ships to the droplet; migrations run from the runner through an ssh tunnel (droplet Postgres is loopback-only). Same blue/green flip and rollback semantics as every pm2-flavor deploy — matches the pm2 droplet flavor (`setup-droplet-for-pm2.sh`).

## Secrets
Set under **Settings → Secrets and variables → Actions**.

| Secret | What | Required? |
|---|---|---|
| `DEPLOY_HOST` | Droplet host/IP | always |
| `DEPLOY_DOMAIN` | Instance domain (deploy dir /var/www/<domain>) | always |
| `DEPLOY_SSH_KEY` | Private SSH key, no passphrase | always |
| `DEPLOY_ENV` | Full contents of `.env.production` | first deploy / env changes only |
| `DEPLOY_ENV_LOCAL` | Full contents of `.env.production.local` | first deploy / env changes only |

Get key contents:
```bash
cat ~/.ssh/id_ed25519
```

## Run it
**Actions** tab → **Deploy** workflow → **Run workflow**.

## Auto-deploy on push to master
The workflow only runs manually (`workflow_dispatch`) by default. To deploy on every push to `master`, uncomment the `push` trigger at the top of `.github/workflows/deploy.yml`.

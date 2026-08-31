# Deploy via Drone CI

`.drone.yml` holds two pipelines:

| Pipeline | Trigger | Does |
|---|---|---|
| `ci` | push, pull_request | `yarn install --immutable` → `typecheck` → `lint`. No secrets, no droplet access. |
| `deploy` | **push to `master`**, or promote | Builds the artifact and ships it to production (below). |

**Push to master deploys production.** That is the normal path — merge a PR, Drone ships it. Promote
is the manual re-run of the same pipeline against an older master build. Both run the identical
steps; the local `./devops/deploy-for-pm2-build-locally.sh` is the break-glass path for shipping
from a workstation without waiting on CI.

On a master push `ci` and `deploy` run in parallel. `ci` does not gate `deploy` — `deploy` runs its
own typecheck before it builds or touches the droplet, so a type error cannot ship; lint is advisory.

Pipeline: `deploy` — a thin wrapper over `devops/deploy-for-pm2-build-locally.sh`.

The build happens **on the Drone runner** (`node:24-bookworm-slim`): `corepack yarn install` → typecheck → Next standalone build → tarball artifact. Only the artifact ships to the droplet; migrations run from the runner through an ssh tunnel (droplet Postgres is loopback-only). The droplet needs no Node deps, no build — same blue/green flip and rollback semantics as every pm2-flavor deploy.

Matches the pm2 droplet flavor (`setup-droplet-for-pm2.sh`). The runner image is Debian (glibc) on purpose — the artifact's traced `node_modules` must match the droplet's Ubuntu; don't swap in an alpine image.

## Secrets
| Secret | What | Required? |
|---|---|---|
| `deploy_host` | Droplet host/IP | always |
| `deploy_domain` | Instance domain (deploy dir /var/www/<domain>) | always |
| `deploy_ssh_key` | Private SSH key, no passphrase | always |
| `deploy_env` | Full contents of `.env.production` | optional |
| `deploy_env_local` | Full contents of `.env.production.local` | optional |

⚠️ When the two `deploy_env*` secrets are set, **every** deploy overwrites the droplet's `.env` and
`.env.local` with them. Hand-editing those files on the droplet is then pointless — update the
secret instead. Leave the secrets unset if you'd rather own the env files on the droplet.

Add via Drone CLI:
```bash
drone secret add --repository <repo> --name deploy_host --data <host>
drone secret add --repository <repo> --name deploy_ssh_key --data @path/to/key
drone secret update --repository <repo> --name deploy_env --data @.env.production
```
Or under the repo's **Settings → Secrets** in the Drone UI.

## Run it
Push to `master` — that's it. Watch:
```bash
drone build ls <repo> --limit 5
drone build logs <repo> <build> deploy
```

Re-deploy an older master build (or retry a failed one) without a new commit:
```bash
drone build promote <repo> <build> production
```
Two master pushes in quick succession race each other — Drone has no concurrency group here.

## Rollback
From any machine with the droplet key:
```bash
./devops/rollback-for-pm2.sh -h <host> -i <ssh-key> -d <domain>
```

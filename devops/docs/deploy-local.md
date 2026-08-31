# Deploy from your machine

Two deploy scripts, matching the droplet flavor (see [droplet-setup.md](./droplet-setup.md)):
- `deploy-for-pm2.sh` — pm2-flavor droplet (nvm node, nginx; db native or docker)
- `deploy-for-docker.sh` — docker-flavor droplet (apt node, Caddy, docker db)

Both take the same flags. Examples below use `deploy-for-pm2.sh` — swap the
name for the docker flavor.

## Prerequisites
- `bash`, `ssh`, `rsync` installed locally
- Droplet already provisioned (see [droplet-setup.md](./droplet-setup.md))

## First deploy
Uploads env files too — needed once, or whenever env changes:
```bash
./devops/deploy-for-pm2.sh -h <host> -i <ssh-key> --env .env.production --env-local .env.production.local
```

## Subsequent deploys
```bash
./devops/deploy-for-pm2.sh -h <host> -i <ssh-key> -d <domain>
```

## Fast deploys: build locally
`deploy-for-pm2-build-locally.sh` (same flags) builds on your machine, ships a
~13M artifact, extracts it into the inactive slot and flips — no `yarn install`
or build on the droplet. Migrations run from your machine through an SSH tunnel
(droplet Postgres is loopback-only). Guard aborts if the artifact contains
non-portable native binaries (fall back to `deploy-for-pm2.sh`).
```bash
./devops/deploy-for-pm2-build-locally.sh -h <host> -i <ssh-key> -d <domain>
```

## Correct deploys: build in a droplet-like container
`deploy-for-pm2-build-docker.sh` (same flags) runs the build inside a
`linux/amd64` glibc Node 24 container, so the artifact's native modules are the
ones the droplet can actually load — not your machine's. Everything after the
build (upload, extract, tunnel migrations, flip, pm2, health) is identical to
the build-locally flow, including blue/green and rollback.

```bash
./devops/deploy-for-pm2-build-docker.sh -h <host> -i <ssh-key> -d <domain>
```

Extra flags:

| Flag | Meaning |
|---|---|
| `--build-only` | Build, verify and print the artifact path + size. Contacts no remote host. |
| `--platform <p>` | Build platform, default `linux/amd64`. Set `linux/arm64` for an arm droplet. |
| `--no-cache` | Ignore the BuildKit cache (cold build; useful for measuring). |

Verify without deploying:
```bash
./devops/deploy-for-pm2-build-docker.sh --build-only
tar -tzf .artifacts/backflip-artifact.tgz | head
```

### Which one should I use?
Speed is roughly a wash — pick on correctness.

| | build-locally | build-docker | on the droplet |
|---|---|---|---|
| Artifact native binaries | your OS/arch | **the droplet's** | the droplet's |
| Cold build (measured, Apple Silicon) | ~9s | ~47s | minutes (1-2 vCPU) |
| Warm build, source changed | ~8s | ~13s | minutes |
| Needs Docker | no | yes | no |

`build-docker` is the right default **as soon as any native module stops being
inert**. Today the only one is `sharp` (Next's image optimizer) and nothing
renders `next/image`, so `build-locally` still gets away with shipping macOS
binaries — its guard warns about exactly this and hard-fails on anything else.

On Apple Silicon the container build is only ~2x native because Docker Desktop
emulates amd64 with Rosetta. Keep **Settings → General → "Use Rosetta for
x86_64/amd64 emulation"** on; under plain QEMU this flow is much slower.

## What happens (blue/green)
1. rsyncs the repo to `/var/www/<domain>` on the droplet (droplet-build flavor only)
2. `yarn install`
3. ensures the db is up (pm2 flavor: `pg_isready` for native postgres, compose up + health wait for docker db; docker flavor: compose up + health wait)
4. `yarn workspace web build` (Next standalone)
5. runs Drizzle migrations
6. assembles the release into the **inactive slot** (`blue/` or `green/` — the one `current` doesn't point at), links `shared -> ../shared`
7. flips the `current` symlink to the new slot — the go-live moment
8. `pm2 startOrRestart` the app
9. proxy: docker flavor renders + reloads Caddy; pm2 flavor leaves nginx alone (setup owns it)
10. health-checks (pm2 online + HTTP on :80)

Any failure before the flip leaves the previous slot serving untouched.
`/var/www/<domain>/shared` is persistent instance data (future admin file
uploads) — deploys never modify it.

## Skip migrations
Add `--skip-migrations` to skip step 5 (e.g. deploying an unrelated hotfix):
```bash
./devops/deploy-for-pm2.sh -h <host> -i <ssh-key> -d <domain> --skip-migrations
```

## Rollback
Flip back to the previous slot (code only — migrations are not reverted):
```bash
./devops/rollback-for-pm2.sh -h <host> -i <ssh-key> -d <domain>
```
Refuses if the other slot is empty (e.g. right after the very first deploy).
Clean path — redeploy an older ref (rebuilds that version, env untouched):
```bash
git checkout <ref>
./devops/deploy-for-pm2.sh -h <host> -i <ssh-key> -d <domain>
```

#!/usr/bin/env bash
# @spec L2-DEVOPS-13
# Remote fragment: print the HTTP status code the local proxy answers with on
# :80, retrying for ~24s. "000" = no response at all.
# Env: none.
set -uo pipefail

code="000"
for _ in $(seq 1 8); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:80 || echo 000)"
  [ "$code" != "000" ] && break
  sleep 3
done
printf '%s' "$code"

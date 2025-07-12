#!/bin/sh

set -e

: "${PNPM_HOME:=/app/.pnpm-store}"

mkdir -p "${PNPM_HOME}"

chown -R "${USER_UID}":"${USER_GID}" "/app/node_modules"

export NPM_TOKEN="$(cat /run/secrets/npm_token)"

pnpm store prune --force || :
pnpm install --ignore-scripts || pnpm install --ignore-scripts --force

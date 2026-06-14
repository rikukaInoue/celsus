#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs dependencies so tests, typecheck and linters work out of the box.
set -euo pipefail

# Only run in the remote (web) environment; local setups manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT"

# 1. Backstage monorepo (root) — yarn 4 workspaces (packages/* and plugins/*).
#    Invoke the repo-pinned Yarn release directly so we don't depend on Corepack
#    downloading Yarn at runtime (the web network policy blocks that). Plain
#    `install` (not --immutable) lets the cached container state be reused.
YARN_RELEASE="$(ls "$ROOT"/.yarn/releases/yarn-*.cjs 2>/dev/null | head -1)"
echo "[session-start] yarn install (Backstage root) via ${YARN_RELEASE:-yarn}…"
if [ -n "$YARN_RELEASE" ]; then
  node "$YARN_RELEASE" install
else
  yarn install
fi

# 2. critic service — a standalone pnpm project nested in the yarn monorepo.
#    - COREPACK_ENABLE_STRICT=0: don't let Corepack refuse pnpm because the root
#      package.json declares "packageManager: yarn".
#    - strict-dep-builds=false: native build scripts (onnxruntime-node, esbuild)
#      are not needed for typecheck/test/lint, so don't fail the install on them.
#    - confirm-modules-purge=false: stay non-interactive if a re-link is needed.
echo "[session-start] pnpm install (services/critic)…"
cd "$ROOT/services/critic"
COREPACK_ENABLE_STRICT=0 pnpm install \
  --config.strict-dep-builds=false \
  --config.confirm-modules-purge=false

echo "[session-start] done."

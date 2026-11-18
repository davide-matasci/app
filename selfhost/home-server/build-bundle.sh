#!/bin/sh
# Builds the Standard Notes "home server" (one Node.js process, SQLite, no
# MySQL/localstack) from standardnotes/server into a self-contained
# tarball for an Alpine (musl) root, such as myos's Linux layer.
#
# Run inside Alpine (the fork's workflow uses the alpine container):
#   sh selfhost/home-server/build-bundle.sh OUT_DIR
# Env: SERVER_REF (commit of standardnotes/server to build).
set -eu

OUT="${1:?usage: build-bundle.sh OUT_DIR}"
SERVER_REF="${SERVER_REF:-b7d2f3664e005aba6e4df14eb73dc3f2e622f5a2}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"

apk add --no-cache nodejs npm git python3 make g++ sqlite-dev tar gzip >/dev/null

git init -q "$WORK/src"
git -C "$WORK/src" fetch -q --depth 1 https://github.com/standardnotes/server.git "$SERVER_REF"
git -C "$WORK/src" checkout -q FETCH_HEAD

cd "$WORK/src"
yarn() { node .yarn/releases/yarn-*.cjs "$@"; }
yarn install
yarn workspaces foreach -Rpt --from @standardnotes/home-server run build

# Production-only copy: compiled JavaScript and runtime dependencies.
mkdir -p "$WORK/sn"
tar cf - --exclude=.git --exclude='*.ts' --exclude='*.map' . | tar xf - -C "$WORK/sn"
cd "$WORK/sn"
yarn workspaces focus @standardnotes/home-server --production
rm -rf packages/home-server/dist/data packages/home-server/.env
cp "$HERE/start.sh" "$HERE/env.example" "$HERE/activate-premium.js" "$HERE/sync-diag.js" .
echo "$SERVER_REF" > SERVER_REF

arch="$(uname -m)"
mkdir -p "$OUT"
tar czf "$OUT/sn-home-server-musl-$arch.tar.gz" -C "$WORK" sn
echo "Built $OUT/sn-home-server-musl-$arch.tar.gz from standardnotes/server@$SERVER_REF"

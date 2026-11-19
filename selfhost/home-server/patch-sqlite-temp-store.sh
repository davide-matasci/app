#!/bin/sh
# Makes the home server keep SQLite's temporary files in memory
# (PRAGMA temp_store = MEMORY) instead of on disk.
#
# Why: under myos's Linux layer, SQLite can't use its temporary files, so any
# query that spills to one fails with "SQLITE_IOERR: disk I/O error". A sort of
# more than ~2 MB does (e.g. a sync page with large notes), so a new device's
# first sync stopped at that page for good.
#
# Patches the compiled DataSource of each service that opens the database.
# Safe to run again. build-bundle.sh runs it; on an existing install:
#   linux --root /data/alpine sh /opt/sn/patch-sqlite-temp-store.sh
#   linux --root /data/alpine sh /opt/sn/start.sh restart
set -eu

SN="${1:-/opt/sn}"
INIT='await this.dataSource.initialize();'
# One read of this.dataSource: the getter builds a new, unconnected DataSource on every read.
PATCHED="const dataSource = this.dataSource; await dataSource.initialize(); if (dataSource.options.type === 'sqlite') { await dataSource.query('PRAGMA temp_store = MEMORY'); }"

for service in auth revisions syncing-server; do
  file="$SN/packages/$service/dist/src/Bootstrap/DataSource.js"
  if grep -q 'temp_store = MEMORY' "$file"; then
    echo "already patched: $service"
    continue
  fi
  if [ "$(grep -c "$INIT" "$file")" != 1 ]; then
    echo "can't patch $file: the code it changes isn't there exactly once" >&2
    exit 1
  fi
  sed -i "s|$INIT|$PATCHED|" "$file"
  echo "patched: $service"
done

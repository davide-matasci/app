# Standard Notes home server on myos

The lightweight way to self-host: Standard Notes' **home server** mode, a
single Node.js process with SQLite (plus a small Redis), instead of the
Docker stack in `../`. It runs on any Alpine (musl) Linux root, and so on
[myos](https://github.com/davide-matasci/myos) through its Linux layer
(`docs/linux-compat.md` there).

| File | What |
|---|---|
| `build-bundle.sh` | builds the server from `standardnotes/server` into `sn-home-server-musl-<arch>.tar.gz` (run in Alpine) |
| `start.sh` | runs Redis and the server, restarts it if it exits; `start.sh restart` after editing `.env` |
| `env.example` | the settings, copied to `/var/lib/sn/.env` |
| `../../.github/workflows/fork.home-server.yml` | builds the tarball for x86_64 and aarch64 and attaches it to a release |

Tested on Alpine 3.24 / Node 24 (Linux kernel): register, sync a note,
sign in from a fresh browser, registration lock, restart. On myos: Node's
JIT, threads and an HTTP server pass on the Linux layer; the full server
there is what the steps below test.

## 0. Build the download (once per server version)

GitHub → **Actions → Fork Home Server bundle → Run workflow**. It publishes
a release `home-server-b7d2f36` with
`sn-home-server-musl-x86_64.tar.gz` and `...-aarch64.tar.gz` (~80 MB each).

## 1. Install on myos

As root on myos, with the Linux layer loaded (`grep linux /proc/modules`)
and `/data` holding the Alpine root (`get-alpine`). Check space first: the
server needs ~250 MB in `/data` (`df /data`; a disk written straight from
the image has only 64 MiB, see myos `docs/install.md`).

```sh
A=/data/alpine
linux --root $A apk add nodejs redis openssl
cd $A/tmp && curl -fLO https://github.com/davide-matasci/app/releases/download/home-server-b7d2f36/sn-home-server-musl-x86_64.tar.gz
linux --root $A tar xzf /tmp/sn-home-server-musl-x86_64.tar.gz -C /opt
linux --root $A mkdir -p /var/lib/sn
cp $A/opt/sn/env.example $A/var/lib/sn/.env
```

Fill in `$A/var/lib/sn/.env` (vim): five secrets, generated with
`linux --root $A openssl rand -hex 32` (one per line), and your domains.

## 2. Try it

```sh
linux --root /data/alpine sh /opt/sn/start.sh &
sleep 20; curl -s http://127.0.0.1:3000/healthcheck      # OK
```

Logs: `/data/alpine/var/lib/sn/server.log` and `redis.log`.

## 3. HTTPS

The apps need `https://sync.example.com`. Caddy gets the certificate
automatically and forwards to the server:

```sh
linux --root /data/alpine apk add caddy
cat > /data/alpine/etc/caddy/Caddyfile <<'EOF'
sync.example.com {
	@private path /admin* /internal*
	respond @private 404
	reverse_proxy 127.0.0.1:3000
}
EOF
linux --root /data/alpine caddy run --config /etc/caddy/Caddyfile &
```

DNS: an A record `sync` → the VPS's address; ports 80 and 443 open.

## 4. Start at boot

Append to `/data/etc/rc.local` (after the line that loads the layer):

```sh
linux --root /data/alpine sh /opt/sn/start.sh > /dev/null 2>&1 &
linux --root /data/alpine caddy run --config /etc/caddy/Caddyfile > /tmp/caddy.log 2>&1 &
```

## 5. Use it

Follow `../README.md` from step 4 ("Point the web app at it"): GitHub Pages
custom domain, `SYNC_SERVER_URL` = `https://sync.example.com`, create your
account, then set `DISABLE_USER_REGISTRATION=true` in `.env` and
`linux --root /data/alpine sh /opt/sn/start.sh restart`.

## Backups

The whole state is `/data/alpine/var/lib/sn` (the SQLite database and
uploads). Copy it off the machine regularly, e.g. with `scp` from another
computer (dropbear listens on port 2222). For a consistent copy while it
runs, use `linux --root /data/alpine sqlite3 /var/lib/sn/home_server.sqlite
".backup /var/lib/sn/backup.sqlite"` (`apk add sqlite`) and copy that file.

## Updating

Run the workflow with a newer `standardnotes/server` commit, then on myos:
back up `/var/lib/sn`, unpack the new tarball over `/opt/sn` (remove the old
`/opt/sn` first), and `start.sh restart`.

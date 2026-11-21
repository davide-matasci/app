# Self-hosting the sync server (personal fork)

This folder runs your own Standard Notes sync server on a cloud VPS, with
automatic HTTPS. The fork's web app (GitHub Pages) and iOS app can then sync
to it instead of `api.standardnotes.com`.

**On myos, or anywhere without Docker:** use the lighter home server in
the server fork, [`davide-matasci/server`](https://github.com/davide-matasci/server/blob/main/selfhost/home-server/README.md)
(`selfhost/home-server/`), for steps 1–3 below, then continue here from step 4.

Fork-only files: nothing here exists upstream, so upstream merges are not
affected. `docker-compose.yml` and `localstack_bootstrap.sh` come from
[standardnotes/server](https://github.com/standardnotes/server)
(`docker-compose.example.yml` and `docker/localstack_bootstrap.sh`, commit
`b7d2f36`). Caddy, safer defaults and the domain settings were added here.

## Why your own domain

The official server only accepts the official web app, so the fork's
`github.io` site can't sign in there. Your server can allow your site, but
Safari blocks sign-in cookies between unrelated domains. With one domain, all
three addresses count as the same site and sign-in works in every browser:

| Address | What it is |
|---|---|
| `notes.example.com` | the fork's web app (GitHub Pages custom domain) |
| `sync.example.com` | this server (sync API) |
| `files.example.com` | this server (attachments) |

Replace `example.com` with your domain everywhere below.

## 1. VPS

- Any provider. Ubuntu 24.04, **at least 2 GB RAM** (4 GB is comfortable:
  MySQL, Redis, localstack and the server run together), 20 GB+ disk.
- Firewall: allow only ports 22, 80 and 443.
- Install Docker: `curl -fsSL https://get.docker.com | sh`
- On a 2 GB machine add swap:
  ```sh
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

## 2. DNS

At your domain registrar, create:

| Name | Type | Value |
|---|---|---|
| `sync` | A | your VPS's IPv4 address |
| `files` | A | your VPS's IPv4 address |
| `notes` | CNAME | `davide-matasci.github.io` |

(Add AAAA records too if the VPS has IPv6.)

## 3. Start the server

On the VPS:

```sh
git clone --depth 1 https://github.com/davide-matasci/app.git
cd app/selfhost
cp .env.example .env
nano .env      # replace every CHANGE value
```

Generate each secret (database passwords and the four keys) with
`openssl rand -hex 32`, one per value.

```sh
mkdir -p data logs uploads
docker compose up -d
docker compose logs -f server   # first start takes a few minutes
```

Check it: `https://sync.example.com/healthcheck` should answer `OK`.

## 4. Point the web app at it

In GitHub, on `davide-matasci/app`:

1. **Settings → Pages → Custom domain**: `notes.example.com`, save, wait for
   the DNS check, then tick **Enforce HTTPS**.
2. **Settings → Secrets and variables → Actions → Variables**: add
   `SYNC_SERVER_URL` = `https://sync.example.com`.
3. **Actions → Fork Web (GitHub Pages) → Run workflow**.

The site moves to `https://notes.example.com/` (the build adapts to the root
path automatically). Remove the variable and run the workflow again to go
back to the official server.

## 5. Create your account, then lock registration

1. Open `https://notes.example.com`, **Create account**.
2. On the VPS set `AUTH_SERVER_DISABLE_USER_REGISTRATION=true` in `.env`, then
   `docker compose up -d`.

On the iOS app (or any official app) you can also choose the server at sign-in:
**Advanced options → Custom sync server** → `https://sync.example.com`.

## 6. Move your notes over

Your official account and your server account are separate.

1. In the official app, signed into the old account: **Preferences →
   Backups → Download backup** (choose the decrypted backup if you'll use a
   different password).
2. In the fork, signed into the new account: **Preferences → Backups →
   Import backup**.
3. Attachments are not in that backup: download the ones you need from the
   old account and re-attach them.

Paid features (files, some editors) depend on a subscription, which a new
self-hosted account doesn't have. Standard Notes' help pages on self-hosting
explain the options for subscriptions on self-hosted servers.

## Backups

Your notes are end-to-end encrypted, but the server is now the only copy
besides your devices. Back up the database regularly, e.g. daily with cron:

```sh
cd ~/app/selfhost && docker compose exec -T db sh -c \
  'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' \
  | gzip > ~/sn-backup-$(date +%F).sql.gz
```

Copy the dumps (and `uploads/`) off the VPS. The apps' own encrypted backups
(**Preferences → Backups**) are a good second layer.

## Updating

```sh
cd ~/app/selfhost
docker compose pull && docker compose up -d
```

Take a database backup first. Once things work, set `SERVER_IMAGE_TAG` in
`.env` to a specific version so the server changes only when you choose.

## Troubleshooting

- **"Load failed" / network error at sign-in**: `CORS_ALLOWED_ORIGINS` must
  exactly match the web app address (`https://notes.example.com`, no trailing
  slash). Restart with `docker compose up -d` after changing `.env`.
- **Signed out after a while in Safari**: the web app and server are on
  different domains; use subdomains of the same domain.
- **Certificate errors**: DNS must point at the VPS and ports 80/443 must be
  open before Caddy can get certificates. See `docker compose logs caddy`.
- **Server keeps restarting**: `docker compose logs server`; usually a
  missing value in `.env` or too little memory.

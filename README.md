# Jigsaw

A self-hosted web hosting control panel built with React Router 7. Manage websites, databases, and services through a modern web UI -- no cPanel or Plesk licence required.

Each user site runs in isolated Docker containers with its own network, Nginx + PHP-FPM web server, and MariaDB database. Optional per-site SFTP access can be enabled with one click.

## Documentation website

The [`docs/`](docs/) directory is a **static HTML/CSS site** (no build step) suitable for [GitHub Pages](https://docs.github.com/en/pages). After enabling Pages for the repository (Settings → Pages → GitHub Actions), pushes to `main` that touch `docs/` deploy the site. It includes install prerequisites, architecture, configuration, development, security, and troubleshooting — browse it locally by opening `docs/index.html` or read the same content on the deployed Pages URL.

## Table of Contents

- [Features](#features)
- [Documentation website](#documentation-website)
- [Quick Install](#quick-install)
- [DNS Setup](#dns-setup)
- [Manual Install](#manual-install)
- [Post-Install](#post-install)
- [Upgrading](#upgrading)
- [Architecture](#architecture)
- [Configuration Reference](#configuration-reference)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Development](#development)
- [Useful Commands](#useful-commands)
- [Publish Docker Images](#publish-docker-images)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Licence](#licence)

## Features

- **Site management** -- create, start, stop, restart, and delete websites from the browser
- **WordPress-ready** -- optional WordPress sites use a dedicated **WordPress container image** (official core + same Nginx/PHP stack as generic PHP sites); the panel copies core into the site folder, writes `wp-config.php`, and runs that image for the web container
- **Isolated containers** -- every site gets its own Docker network and web server, with optional database
- **Auto-generated credentials** -- database and SFTP passwords are created with cryptographic randomness
- **Automatic SSL** -- Traefik provisions and renews Let's Encrypt certificates for every site
- **User authentication** -- Keycloak provides login, self-service registration, password reset, MFA, and brute-force protection
- **Role-based access** -- admin users can manage all sites and users; regular users see only their own
- **Server dashboard** -- real-time CPU, RAM, disk, and network stats for admins
- **Docker admin** -- view running containers, prune unused resources, all from the panel
- **SFTP per site** -- optional SFTP container with auto-assigned port (range 2200-2299) and generated credentials
- **Per-site home folders** -- site content lives under `/home/<user>/<site>/public_html`
- **Activity log** -- track who did what across the panel
- **Traefik dashboard** -- protected by OAuth2 Proxy + Keycloak, accessible to admins

## Quick Install

### Prerequisites

| Requirement | Details |
|-------------|---------|
| **OS** | Ubuntu 22.04+ or Debian 12+ (installer uses APT; other distros are untested) |
| **Hardware** | At least ~2 GB RAM; enough disk for Docker images, PostgreSQL, and site content |
| **Network** | Public IPv4 (typical); **ports 80 and 443** reachable from the internet for Let's Encrypt HTTP-01 |
| **DNS** | A domain you control; see [DNS Setup](#dns-setup) before running the installer |
| **Access** | SSH with sudo; the script must run as **root** |

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/03c/jigsaw/main/install.sh | sudo bash
```

To save the script to disk first (review or air-gapped workflows):

```bash
curl -fsSL https://raw.githubusercontent.com/03c/jigsaw/main/install.sh -o /tmp/jigsaw-install.sh && chmod +x /tmp/jigsaw-install.sh && sudo /tmp/jigsaw-install.sh
```

The installer will:
1. Install Docker and Docker Compose if not present
2. Clone the repository to `/opt/jigsaw`
3. Ask for your domain, email, and Keycloak admin password
4. Auto-generate all secrets (database passwords, session key, OIDC client secret, OAuth2 proxy cookie secret), reusing existing `.env` secrets on reruns
5. Validate DNS records for the panel and auth subdomains
6. Patch the Keycloak realm JSON with your domain, client secret, and admin credentials
7. Pull prebuilt panel, PHP, and WordPress site images from GHCR
8. Start the full stack (Traefik, OAuth2 Proxy, PostgreSQL, Keycloak, Jigsaw panel)
9. Wait for PostgreSQL and Keycloak to become healthy
10. Update Keycloak client redirect URIs to match your domain
11. Run database migrations (`drizzle-kit push`)
12. Validate SSL certificates for the panel and auth domains

If you've already cloned the repo, run the script directly:

```bash
sudo ./install.sh
```

> **Note:** The installer sets `.env` file permissions to `600` to protect secrets. On reruns, it preserves previously generated passwords.

## DNS Setup

Point three A records to your server's public IP **before** running the installer:

| Record | Type | Value |
|--------|------|-------|
| `panel.example.com` | A | `<your-server-ip>` |
| `auth.panel.example.com` | A | `<your-server-ip>` |
| `traefik.panel.example.com` | A | `<your-server-ip>` |

Each site you create will also need its own A record pointing to the same IP.

The installer validates DNS resolution against public DNS (Cloudflare) before proceeding. If public DNS is unreachable, it falls back to the local resolver but warns about private/loopback results. You can skip DNS checks with `SKIP_DNS_CHECK=1 sudo ./install.sh`.

## Manual Install

If you prefer to set things up yourself instead of using the installer:

```bash
# 1. Clone
git clone https://github.com/03c/jigsaw.git /opt/jigsaw
cd /opt/jigsaw

# 2. Create .env from the example and fill in your values
cp .env.example .env
nano .env

# 3. Generate secrets for .env
#    POSTGRES_PASSWORD:           openssl rand -base64 32 | tr -d '/+='
#    SESSION_SECRET:              openssl rand -hex 32
#    KEYCLOAK_CLIENT_SECRET:      openssl rand -base64 48 | tr -d '/+='
#    OAUTH2_PROXY_COOKIE_SECRET:  openssl rand -base64 32

# 4. Patch the Keycloak realm with your values
sed -i "s|JIGSAW_CLIENT_SECRET_PLACEHOLDER|<your-client-secret>|g" keycloak/jigsaw-realm.json
sed -i "s|JIGSAW_ADMIN_EMAIL_PLACEHOLDER|<your-email>|g" keycloak/jigsaw-realm.json
sed -i "s|JIGSAW_PANEL_DOMAIN_PLACEHOLDER|<your-panel-domain>|g" keycloak/jigsaw-realm.json
sed -i "s|JIGSAW_ADMIN_PASSWORD_PLACEHOLDER|<your-keycloak-admin-password>|g" keycloak/jigsaw-realm.json

# 5. Create data directories
mkdir -p data/sites data/databases data/postgres docker/compose

# 6. Pull prebuilt images
docker pull ghcr.io/03c/jigsaw/panel:latest
docker pull ghcr.io/03c/jigsaw/php:8.4
docker pull ghcr.io/03c/jigsaw/wordpress:8.4
docker tag ghcr.io/03c/jigsaw/php:8.4 jigsaw-php:8.4
docker tag ghcr.io/03c/jigsaw/wordpress:8.4 jigsaw-wordpress:8.4

# 7. Start the stack
docker compose up -d

# 8. Wait for PostgreSQL, then run migrations
docker compose exec jigsaw npm run db:push
```

> **Important:** Make sure all four placeholders in `keycloak/jigsaw-realm.json` are replaced. The realm file is modified in-place -- the installer does this automatically but manual setup requires explicit `sed` commands for each placeholder.

## Post-Install

1. Open `https://panel.example.com` -- you'll be redirected to Keycloak
2. Log in with username **admin** and the Keycloak admin password you entered during install, **or** use **Register** on the Keycloak page to create a new account (new users get the standard `user` role and can host sites up to their limit)
3. You're now in the Jigsaw dashboard
4. To create additional users manually, or to turn off public sign-up, go to `https://auth.panel.example.com` and use the Keycloak admin console (Realm settings → Login → User registration)
5. The Traefik dashboard is available at `https://traefik.panel.example.com` (protected by Keycloak via OAuth2 Proxy)

### Host your first WordPress site

1. In the panel, create an **A record** for your site hostname (e.g. `blog.example.com`) pointing to the same server IP as the panel
2. **Dashboard → Create site**: enter a name and domain, keep **Create database** and **Install WordPress** enabled (default), submit
3. Wait for provisioning: the panel copies WordPress core from the **WordPress site image** into your site folder, writes `wp-config.php`, and starts the `jigsaw-wordpress` web container (not a download inside the panel process)
4. Open `https://your-site-domain` in a browser — complete WordPress’s install wizard (site title, admin user, password)
5. Optional: enable **SFTP** on the site to upload themes/plugins, or use WordPress’s built-in updater

> **Note:** Email verification for new accounts is off by default (`verifyEmail: false` in the realm template). Enable it in Keycloak if you need verified addresses before users can log in.

## Upgrading

To upgrade an existing Jigsaw installation to the latest version:

```bash
cd /opt/jigsaw

# Pull the latest code
git pull

# Pull the latest Docker images
docker compose pull

# Apply any database schema changes
docker compose exec jigsaw npm run db:push

# Recreate containers with the new images
docker compose up -d
```

Alternatively, rerun the installer which handles all of the above (it preserves your existing `.env` secrets):

```bash
sudo ./install.sh
```

> **Note:** `drizzle-kit push` is non-destructive -- it only adds new columns/tables and never drops existing data. Always back up your database before upgrading in production.

## Architecture

```
Internet
   |
[Traefik]  ports 80/443, auto-SSL via Let's Encrypt
   |
   ├── panel.example.com
   │   └── Jigsaw Panel  (React Router 7, Node.js, port 3000)
   │
   ├── auth.panel.example.com
   │   └── Keycloak      (OIDC/PKCE authentication, port 8080)
   │
   ├── traefik.panel.example.com
   │   └── Traefik Dashboard  (protected by OAuth2 Proxy + Keycloak)
   │
   └── site-domains...
       ├── site-a_web    (Nginx + PHP-FPM, or WordPress image)   ┐
       ├── site-a_db     (MariaDB)                              ├─ isolated network per site
       ├── site-a_sftp   (optional, port 2200+)                  ┘
       │
       ├── site-b_web                                              ┐
       ├── site-b_db                                              ├─ isolated network per site
       └── ...                                                    ┘

Internal services (not internet-facing):
   ├── PostgreSQL 17  (shared: Jigsaw panel data + Keycloak data)
   └── OAuth2 Proxy   (forward-auth for Traefik dashboard)

Networks:
   ├── traefik_public   (Traefik, OAuth2 Proxy, Keycloak, Jigsaw, site web containers)
   ├── jigsaw_internal  (PostgreSQL, Keycloak, Jigsaw)
   └── jigsaw_<slug>_net  (per-site isolated network)
```

### Data Flow

1. All HTTP/HTTPS traffic enters through Traefik on ports 80 (redirected to 443) and 443
2. Traefik terminates TLS using Let's Encrypt certificates (HTTP challenge)
3. Requests are routed by `Host()` header to the appropriate backend
4. The Jigsaw panel communicates with Docker via the host socket to orchestrate site containers
5. Each site's web container is connected to both the site's isolated network and `traefik_public`
6. Database containers are only connected to their site's isolated network (not internet-accessible)
7. **WordPress sites** use image `jigsaw-wordpress:8.4` (extends the PHP image with baked WordPress core). Customer files still live on the host under `/home/.../public_html` (bind-mounted); the image supplies the runtime and a one-time copy of core when the volume is empty

## Configuration Reference

All configuration is in the `.env` file. See [`.env.example`](.env.example) for the production template, or [`.env.local.example`](.env.local.example) for local development.

### Production Variables (`.env`)

| Variable | Description | Default / Notes |
|----------|-------------|-----------------|
| `PANEL_DOMAIN` | Domain for the panel (Keycloak at `auth.<domain>`, Traefik at `traefik.<domain>`) | Required |
| `ACME_EMAIL` | Email for Let's Encrypt certificate notifications | Required |
| `POSTGRES_USER` | PostgreSQL username | `jigsaw` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Auto-generated by `install.sh` |
| `KEYCLOAK_ADMIN` | Keycloak admin console username | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin console password | Set during install |
| `KEYCLOAK_CLIENT_ID` | OIDC client ID shared between Keycloak and the panel | `jigsaw-panel` |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret shared between Keycloak and the panel | Auto-generated by `install.sh` |
| `KEYCLOAK_CONSOLE_URL` | URL used for admin Keycloak navigation links | `https://auth.<PANEL_DOMAIN>` |
| `TRAEFIK_DASHBOARD_URL` | URL used for admin Traefik navigation links | `https://traefik.<PANEL_DOMAIN>/dashboard/` |
| `OAUTH2_PROXY_COOKIE_SECRET` | Secret for OAuth2 Proxy session cookies (protects Traefik dashboard) | Auto-generated by `install.sh` |
| `SITE_WEB_IMAGE_TEMPLATE` | Docker image template for generic PHP site web containers | `jigsaw-php:{phpVersion}` |
| `SITE_WORDPRESS_IMAGE_TEMPLATE` | Image for WordPress site web containers | `jigsaw-wordpress:{phpVersion}` |
| `SITE_DB_IMAGE` | Docker image for site database containers | `mariadb:lts` |
| `SITE_SFTP_IMAGE` | Docker image for per-site SFTP containers | `atmoz/sftp` |
| `SITES_BASE_PATH_HOST` | Host filesystem path for site folders | `/home` |
| `SITES_BASE_PATH_PANEL` | Mounted path inside the panel container for writing site files | `/host-home` |
| `DOCKER_SOCKET_PATH` | Docker daemon socket override | `/var/run/docker.sock` (Linux) |
| `SESSION_SECRET` | Encryption key for panel session cookies | Auto-generated by `install.sh` |

The file `keycloak/jigsaw-realm.json` is imported on first Keycloak boot. It enables **self-service user registration** by default (`registrationAllowed`, `verifyEmail`); adjust these in the JSON before install or later in the Keycloak admin UI.

### Local Development Variables (`.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `development` |
| `PANEL_URL` | App URL for OIDC callback generation | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://jigsaw:jigsaw_secret@localhost:5432/jigsaw` |
| `KEYCLOAK_ISSUER_URL` | Internal Keycloak realm URL for server-to-server OIDC calls | `http://localhost:8080/realms/jigsaw` |
| `KEYCLOAK_PUBLIC_URL` | Browser-facing Keycloak realm URL (used for authorization redirects) | Same as `KEYCLOAK_ISSUER_URL` |
| `KEYCLOAK_CLIENT_ID` | OIDC client ID | `jigsaw-panel` |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret | `dev-jigsaw-client-secret` |
| `KEYCLOAK_CONSOLE_URL` | Keycloak admin console URL for sidebar links | `http://localhost:8080` |
| `SESSION_SECRET` | Session cookie signing key | `dev-session-secret-change-me` |

> **Note:** In production, `KEYCLOAK_ISSUER_URL` is derived from the compose environment (`https://auth.<PANEL_DOMAIN>/realms/jigsaw`). In local dev, both the panel and the browser use `localhost:8080`, so `KEYCLOAK_ISSUER_URL` and `KEYCLOAK_PUBLIC_URL` are typically the same.

## Database Schema

The panel uses PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/). The schema is defined in `app/models/schema.ts`.

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Panel users synced from Keycloak. Fields: `id`, `keycloak_id`, `email`, `name`, `role` (admin/user), `max_sites` (default 5), timestamps. |
| `sites` | Hosted websites. Fields: `id`, `user_id` (FK), `name`, `slug` (unique), `domain`, `status` (creating/running/stopped/error), `php_version`, `network_name`, timestamps. |
| `services` | Docker containers per site (web, database, sftp). Fields: `id`, `site_id` (FK), `type`, `container_id`, `container_name`, `status`, `config` (JSONB), timestamps. |
| `activity_log` | Audit trail. Fields: `id`, `user_id` (nullable FK), `action`, `details`, timestamp. |

### Relationships

- A **user** has many **sites** and **activity log** entries
- A **site** has many **services** (one web, one database, optional SFTP)
- Deleting a user cascades to their sites; deleting a site cascades to its services

## Project Structure

```
jigsaw/
├── app/
│   ├── components/             # UI components
│   │   ├── layout/
│   │   │   └── sidebar.tsx         # Navigation sidebar
│   │   └── ui/
│   │       ├── stat-card.tsx       # Dashboard stat cards
│   │       └── status-badge.tsx    # Site/service status indicators
│   ├── lib/                    # Server-side utilities (*.server.ts)
│   │   ├── admin-links.server.ts   # Keycloak/Traefik sidebar URL resolution
│   │   ├── auth.server.ts         # Keycloak OIDC (PKCE flow via openid-client v6)
│   │   ├── crypto.server.ts       # Password/slug/UUID generation
│   │   ├── db.server.ts           # PostgreSQL connection via Drizzle ORM
│   │   ├── docker.server.ts       # Docker container orchestration (dockerode)
│   │   ├── images.server.ts       # Site image resolution and env overrides
│   │   ├── session.server.ts      # Cookie session + auth/admin guards
│   │   └── stats.server.ts        # System & Docker stats (systeminformation)
│   ├── models/
│   │   └── schema.ts              # Drizzle schema (users, sites, services, activity_log)
│   ├── routes/                    # React Router 7 file-based routes
│   │   ├── home.tsx               # Root redirect (→ /dashboard or /auth/login)
│   │   ├── auth.login.tsx         # Initiates Keycloak OIDC login
│   │   ├── auth.callback.tsx      # Handles OIDC callback, creates session
│   │   ├── auth.logout.tsx        # Destroys session
│   │   ├── dashboard.tsx          # Dashboard layout (requires auth)
│   │   ├── dashboard._index.tsx   # Dashboard home: site list, quick stats
│   │   ├── dashboard.sites.new.tsx    # Create new site form
│   │   ├── dashboard.sites.$id.tsx    # Site detail: start/stop/restart/delete/SFTP
│   │   ├── dashboard.profile.tsx  # User profile
│   │   ├── admin.tsx              # Admin layout (requires admin role)
│   │   ├── admin._index.tsx       # Admin dashboard: server stats, Docker stats
│   │   ├── admin.users.tsx        # User management list
│   │   ├── admin.users.$id.tsx    # Edit user (role, max sites)
│   │   ├── admin.sites.tsx        # All sites overview
│   │   └── admin.server-mgmt.tsx  # Docker management, resource pruning
│   ├── app.css                    # Global styles (Tailwind CSS 4)
│   ├── root.tsx                   # HTML shell, fonts, Outlet, error boundary
│   └── routes.ts                  # Central route configuration
├── docker/
│   ├── templates/
│   │   ├── web/                   # Per-site Nginx + PHP-FPM image
│   │   │   ├── Dockerfile
│   │   │   ├── default.conf       # Nginx config
│   │   │   └── supervisord.conf   # Supervisor for Nginx + PHP-FPM
│   │   ├── wordpress/             # WordPress site image (extends web image + baked WP core)
│   │   │   └── Dockerfile
│   │   └── site/
│   │       └── index.html         # Default landing page template for new sites
│   └── init-keycloak-db.sql       # Creates Keycloak database in shared PostgreSQL
├── keycloak/
│   └── jigsaw-realm.json          # Realm template with roles, client, placeholders
├── scripts/
│   └── prepare-dev-realm.mjs      # Generates dev realm JSON from template + .env.local
├── .github/
│   └── workflows/
│       └── docker-publish.yml     # CI: builds and pushes panel, PHP, and WordPress images to GHCR
├── Dockerfile                     # Multi-stage build for the panel (Node 22 Alpine)
├── docker-compose.yml             # Production: Traefik + OAuth2 Proxy + PostgreSQL + Keycloak + Panel
├── docker-compose.local.yml       # Local dev: PostgreSQL + Keycloak only
├── drizzle.config.ts              # Drizzle Kit config (schema path, DB URL)
├── install.sh                     # Interactive production installer
├── .env.example                   # Production environment template
├── .env.local.example             # Local development environment template
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript config (strict, path aliases)
├── vite.config.ts                 # Vite: Tailwind CSS 4 + React Router + tsconfig paths
└── react-router.config.ts         # React Router config (SSR enabled)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + Backend | [React Router 7](https://reactrouter.com/) (SSR, loaders, actions) |
| Database (panel) | [PostgreSQL 17](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/) |
| Database (sites) | [MariaDB](https://mariadb.org/) LTS (one per site) |
| Auth | [Keycloak 26](https://www.keycloak.org/) (OIDC/PKCE via [openid-client v6](https://github.com/panva/openid-client)) |
| Reverse Proxy | [Traefik v3.6](https://traefik.io/) (auto-SSL via Let's Encrypt) |
| Dashboard Auth | [OAuth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) (protects Traefik dashboard) |
| Container Management | [dockerode](https://github.com/apocas/dockerode) (Node.js Docker SDK) |
| System Monitoring | [systeminformation](https://github.com/sebhildebrandt/systeminformation) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Runtime | [Node.js 22 LTS](https://nodejs.org/) |
| CI/CD | [GitHub Actions](https://github.com/features/actions) (Docker image publishing to GHCR) |

## Development

For a fast local dev loop, run the app on your host with HMR and only run backing services (PostgreSQL + Keycloak) in Docker.

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- npm (included with Node.js)

### Quick Start

```bash
# Install dependencies
npm install

# Create local env file (only needed on first setup)
cp .env.local.example .env.local

# Bootstrap: starts PostgreSQL + Keycloak in Docker, then pushes the DB schema
npm run dev:bootstrap

# Start the dev server with HMR
npm run dev
```

The app runs at `http://localhost:5173` and Keycloak at `http://localhost:8080`.

### Default Local Credentials

| Service | Username | Password |
|---------|----------|----------|
| Keycloak admin console | `admin` | `admin` (change in `.env.local`) |

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with HMR (port 5173) |
| `npm run build` | Production build (output in `build/`) |
| `npm run start` | Serve production build (port 3000) |
| `npm run typecheck` | Run `react-router typegen` then `tsc` |
| `npm run dev:bootstrap` | Start local services + push DB schema (combines `dev:services:up` + `db:push`) |
| `npm run dev:services:up` | Start PostgreSQL + Keycloak via Docker Compose |
| `npm run dev:services:down` | Stop local services |
| `npm run dev:services:logs` | Tail local service logs |
| `npm run dev:realm` | Regenerate `keycloak/jigsaw-realm.dev.json` from template (called by `dev:services:up`) |
| `npm run db:push` | Push Drizzle schema to the database (non-destructive) |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

### How Local Dev Works

1. `npm run dev:realm` reads `.env.local` and generates `keycloak/jigsaw-realm.dev.json` from the template `keycloak/jigsaw-realm.json`, replacing placeholders with local dev values
2. `docker-compose.local.yml` starts PostgreSQL and Keycloak with the dev realm file bind-mounted
3. Keycloak imports the realm on first boot (takes 15-30 seconds to initialize)
4. The Vite dev server runs the React Router app with SSR, connecting to the local PostgreSQL and Keycloak instances
5. The app communicates with Docker via the host socket for container orchestration

### PowerShell (Windows)

```powershell
Copy-Item .env.local.example .env.local
```

If using Docker Desktop on Windows, uncomment `DOCKER_SOCKET_PATH=//./pipe/docker_engine` in `.env.local`.

### Full-Stack Parity

To test Traefik + TLS + router labels exactly like production, run the full stack in Docker (`docker compose up -d`) and point local domains accordingly.

## Useful Commands

```bash
# View logs
docker compose logs -f
docker compose logs -f jigsaw

# Local dev services
npm run dev:services:up
npm run dev:services:down
npm run dev:services:logs
npm run dev:bootstrap

# Restart the panel after code changes (production)
docker compose restart jigsaw

# Pull latest panel image and restart
docker compose pull jigsaw && docker compose up -d jigsaw

# Run database migrations (production)
docker compose exec jigsaw npm run db:push

# Open Drizzle Studio for local database inspection
npm run db:studio

# Open a shell in the panel container
docker compose exec jigsaw sh

# Stop everything
docker compose down

# Stop everything and remove volumes (destructive!)
docker compose down -v

# Type-check the codebase
npm run typecheck
```

## Publish Docker Images

The CI workflow (`.github/workflows/docker-publish.yml`) automatically builds and pushes Docker images to GHCR on every push to `main` or on version tags (`v*`). You can also trigger it manually via `workflow_dispatch`.

### Images Published

| Image | Source | Tags |
|-------|--------|------|
| `ghcr.io/03c/jigsaw/panel` | `./Dockerfile` | `latest` (main branch), `v*` (tags), `sha-*` |
| `ghcr.io/03c/jigsaw/php` | `./docker/templates/web/Dockerfile` | `8.4`, `sha-*` |
| `ghcr.io/03c/jigsaw/wordpress` | `./docker/templates/wordpress/Dockerfile` (build-arg `BASE_IMAGE` = published `php:8.4`) | `8.4`, `sha-*` |

### Manual Build and Push

```bash
docker build -t ghcr.io/03c/jigsaw/panel:latest .
docker build -t ghcr.io/03c/jigsaw/php:8.4 docker/templates/web/
docker build -f docker/templates/wordpress/Dockerfile --build-arg BASE_IMAGE=ghcr.io/03c/jigsaw/php:8.4 -t ghcr.io/03c/jigsaw/wordpress:8.4 .
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
docker push ghcr.io/03c/jigsaw/panel:latest
docker push ghcr.io/03c/jigsaw/php:8.4
docker push ghcr.io/03c/jigsaw/wordpress:8.4
```

## Security

### Session Security

- Session cookies are encrypted with `SESSION_SECRET` and configured as `httpOnly`, `sameSite: lax`, and `secure` in production
- Session lifetime is 7 days
- All authentication flows use PKCE (Proof Key for Code Exchange) to prevent authorization code interception

### Credential Generation

- Database passwords, SFTP credentials, and slugs are generated using Node.js `crypto.randomBytes`
- The install script uses `openssl rand` for all generated secrets
- The `.env` file is created with `chmod 600` permissions

### Network Isolation

- Each site runs in its own Docker network (`jigsaw_<slug>_net`)
- Database containers are only attached to the site's isolated network (not internet-facing)
- Web containers are connected to both the site network and `traefik_public` for routing
- The Traefik dashboard is protected by OAuth2 Proxy + Keycloak forward-auth

### Recommendations

- Change the default Keycloak admin password immediately after install
- Enable MFA in Keycloak for admin accounts
- Keep the Docker socket (`/var/run/docker.sock`) access restricted -- the panel container requires it for orchestration
- Use strong, unique values for `SESSION_SECRET`, `KEYCLOAK_CLIENT_SECRET`, and `POSTGRES_PASSWORD`
- Regularly update Docker images and the host OS
- Back up `data/postgres`, `data/sites`, and `data/databases` directories

## Troubleshooting

### Keycloak: "password authentication failed for user jigsaw"

Your PostgreSQL data was initialized with a different password than the one in `.env`. For a fresh install, reset PostgreSQL data and rerun:

```bash
docker compose down && sudo rm -rf data/postgres && sudo ./install.sh
```

### Traefik: "client version 1.24 is too old"

Update to the latest repo and recreate containers:

```bash
git pull && docker compose down && docker compose up -d
```

### SSL certificate timeout

If install times out waiting for SSL certificates, verify:
1. `panel.example.com`, `auth.panel.example.com`, and `traefik.panel.example.com` DNS A records point to this server
2. Ports 80 and 443 are reachable from the internet (check firewall rules)
3. Let's Encrypt rate limits haven't been hit (check `docker compose logs traefik`)

### Keycloak not ready: "Unexpected Server Error" or "Authentication is temporarily unavailable"

Keycloak needs 15-60 seconds to fully initialize on first boot. Check:

```bash
docker compose logs -f keycloak jigsaw
docker compose exec -T jigsaw node -e "fetch('http://keycloak:8080/realms/jigsaw/.well-known/openid-configuration').then((r)=>r.text().then((t)=>console.log(r.status,t.slice(0,120)))).catch((e)=>{console.error(e);process.exit(1)})"
```

### Keycloak: "Invalid parameter: redirect_uri"

Update the `jigsaw-panel` client redirect URI in the Keycloak admin console (`https://auth.<domain>`) to exactly:

```
https://<your-panel-domain>/auth/callback
```

Then restart the panel:

```bash
docker compose restart jigsaw
```

### ERR_TOO_MANY_REDIRECTS after login

Clear cookies for your panel domain and auth subdomain, then retry using the exact configured panel domain (not IP or alternate hostname).

### OIDC issuer mismatch

If logs include `OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED` with issuer mismatch (`expected http://keycloak:8080/...` vs `issuer https://auth.<domain>/...`), pull the latest config and recreate the panel:

```bash
git pull && docker compose up -d --force-recreate jigsaw
```

### TLS certificate names wrong after domain change

Recreate Traefik certificates:

```bash
docker compose down
docker volume rm $(docker volume ls -q | grep traefik_letsencrypt)
docker compose up -d
```

### Local dev: Keycloak not responding

After `npm run dev:services:up`, Keycloak takes 15-30 seconds to import the realm and start. Verify readiness:

```bash
curl -sf http://localhost:8080/realms/jigsaw/.well-known/openid-configuration | head -c 120
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the detailed feature plan and development priorities.

## Licence

MIT

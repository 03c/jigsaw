# Jigsaw

A self-hosted web hosting control panel built with React Router 7. Manage websites, databases, and services through a modern web UI -- no cPanel or Plesk licence required.

Each user site runs in isolated Docker containers with its own network, Nginx + PHP-FPM web server, and MariaDB database. Optional per-site SFTP access can be enabled with one click.

## Features

- **Site management** -- create, start, stop, restart, and delete websites from the browser
- **Isolated containers** -- every site gets its own Docker network, web server, and database
- **Auto-generated credentials** -- database and SFTP passwords are created with cryptographic randomness
- **Automatic SSL** -- Traefik provisions and renews Let's Encrypt certificates for every site
- **User authentication** -- Keycloak provides login, password reset, MFA, and brute-force protection
- **Role-based access** -- admin users can manage all sites and users; regular users see only their own
- **Server dashboard** -- real-time CPU, RAM, disk, and network stats for admins
- **Docker admin** -- view running containers, prune unused resources, all from the panel
- **SFTP per site** -- optional SFTP container with auto-assigned port and generated credentials
- **Activity log** -- track who did what across the panel

## Quick Install

**Requirements:** Ubuntu 22.04+ (or Debian 12+), a domain name with DNS pointed to the server, and ports 80/443 open.

```bash
curl -fsSL https://raw.githubusercontent.com/03c/jigsaw/main/install.sh -o /tmp/jigsaw-install.sh && chmod +x /tmp/jigsaw-install.sh && sudo /tmp/jigsaw-install.sh
```

The installer will:
1. Install Docker and Docker Compose if not present
2. Clone the repository to `/opt/jigsaw`
3. Ask for your domain, email, and Keycloak admin password
4. Auto-generate all secrets (database passwords, session key, OIDC client secret), reusing existing `.env` secrets on reruns
5. Build the PHP site image
6. Start the full stack (Traefik, PostgreSQL, Keycloak, Jigsaw panel)
7. Run database migrations
8. Print your panel URL and first-login instructions

If you've already cloned the repo, run the script directly:

```bash
sudo ./install.sh
```

## DNS Setup

Point two A records to your server's public IP:

| Record | Type | Value |
|--------|------|-------|
| `panel.example.com` | A | `<your-server-ip>` |
| `auth.panel.example.com` | A | `<your-server-ip>` |

Each site you create will also need its own A record pointing to the same IP.

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
#    POSTGRES_PASSWORD:       openssl rand -base64 32 | tr -d '/+='
#    SESSION_SECRET:          openssl rand -hex 32
#    KEYCLOAK_CLIENT_SECRET:  openssl rand -base64 48 | tr -d '/+='

# 4. Patch the Keycloak realm with your client secret and admin email
sed -i "s|JIGSAW_CLIENT_SECRET_PLACEHOLDER|<your-client-secret>|" keycloak/jigsaw-realm.json
sed -i "s|JIGSAW_ADMIN_EMAIL_PLACEHOLDER|<your-email>|" keycloak/jigsaw-realm.json

# 5. Create data directories
mkdir -p data/sites data/databases data/postgres docker/compose

# 6. Build the PHP site image
docker build -t jigsaw-php:8.4 docker/templates/web/

# 7. Start the stack
docker compose up -d --build

# 8. Wait for PostgreSQL, then run migrations
docker compose exec jigsaw npm run db:push
```

## Post-Install

1. Open `https://panel.example.com` -- you'll be redirected to Keycloak
2. Log in with username **admin** and password **admin** (temporary)
3. Keycloak will prompt you to set a new password
4. You're now in the Jigsaw dashboard as an admin
5. To create additional users, go to `https://auth.panel.example.com` and use the Keycloak admin console

## Troubleshooting

If Keycloak fails with `password authentication failed for user "jigsaw"`, your PostgreSQL data was initialized with a different password than the one in `.env`.

For a fresh install, reset PostgreSQL data and rerun:

```bash
docker compose down && sudo rm -rf data/postgres && sudo ./install.sh
```

If Traefik logs `client version 1.24 is too old. Minimum supported API version is 1.44`, update to the latest repo and recreate containers:

```bash
git pull && docker compose down && docker compose up -d --build
```

## Architecture

```
Internet
   |
[Traefik]  ports 80/443, auto-SSL
   |
   ├── Jigsaw Panel  (React Router 7, Node.js)
   ├── Keycloak      (authentication)
   ├── PostgreSQL     (shared: panel data + Keycloak data)
   │
   ├── site-a_web    (Nginx + PHP-FPM)   ┐
   ├── site-a_db     (MariaDB)           ├─ isolated network per site
   ├── site-a_sftp   (optional)          ┘
   │
   ├── site-b_web                        ┐
   ├── site-b_db                         ├─ isolated network per site
   └── ...                               ┘
```

## Configuration

All configuration is in the `.env` file. See [`.env.example`](.env.example) for all available options.

| Variable | Description |
|----------|-------------|
| `PANEL_DOMAIN` | Domain for the panel (Keycloak is at `auth.<domain>`) |
| `ACME_EMAIL` | Email for Let's Encrypt certificate notifications |
| `POSTGRES_PASSWORD` | PostgreSQL password (auto-generated) |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin console password |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret shared between Keycloak and the panel |
| `SESSION_SECRET` | Encryption key for session cookies |

## Project Structure

```
jigsaw/
├── app/
│   ├── components/         # UI components (sidebar, cards, badges)
│   ├── lib/                # Server utilities
│   │   ├── auth.server.ts      # Keycloak OIDC (PKCE flow)
│   │   ├── db.server.ts        # PostgreSQL via Drizzle ORM
│   │   ├── docker.server.ts    # Docker container orchestration
│   │   ├── session.server.ts   # Cookie session + auth guards
│   │   ├── crypto.server.ts    # Password/slug/UUID generation
│   │   └── stats.server.ts     # System & Docker stats
│   ├── models/
│   │   └── schema.ts           # Drizzle schema (users, sites, services, activity_log)
│   ├── routes/                 # React Router 7 routes
│   │   ├── auth.*.tsx          # Login, callback, logout
│   │   ├── dashboard.*.tsx     # User dashboard, site management
│   │   └── admin.*.tsx         # Admin panel, user management, server stats
│   ├── root.tsx
│   └── routes.ts               # Route config
├── docker/
│   ├── templates/web/          # Nginx + PHP-FPM Dockerfile & config
│   └── init-keycloak-db.sql    # Creates Keycloak DB in shared PostgreSQL
├── keycloak/
│   └── jigsaw-realm.json       # Keycloak realm with roles, client, default admin
├── docker-compose.yml          # Full stack: Traefik + PostgreSQL + Keycloak + Panel
├── Dockerfile                  # Multi-stage build for the panel (Node 22)
├── drizzle.config.ts
├── install.sh                  # Interactive installer
├── .env.example
├── package.json
└── tsconfig.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + Backend | React Router 7 (SSR, loaders, actions) |
| Database (panel) | PostgreSQL 17 via Drizzle ORM |
| Database (sites) | MariaDB 11 (one per site) |
| Auth | Keycloak 26 (OIDC/PKCE) |
| Reverse Proxy | Traefik v3 (auto-SSL) |
| Container Mgmt | dockerode (Node.js Docker SDK) |
| Styling | Tailwind CSS 4 |
| Runtime | Node.js 22 LTS |

## Development

To work on the panel locally:

```bash
npm install

# Start a local PostgreSQL (or use the Docker one)
docker compose up postgres -d

# Set DATABASE_URL for local dev
export DATABASE_URL=postgres://jigsaw:jigsaw_secret@localhost:5432/jigsaw

# Push the schema
npm run db:push

# Start the dev server with HMR
npm run dev
```

The dev server runs at `http://localhost:5173`. Auth routes won't work without Keycloak -- for local development you can also bring up the full stack with `docker compose up -d` and access it via the configured domain.

## Useful Commands

```bash
# View logs
docker compose logs -f
docker compose logs -f jigsaw

# Restart the panel after code changes
docker compose restart jigsaw

# Rebuild and restart the panel
docker compose up -d --build jigsaw

# Run database migrations
docker compose exec jigsaw npm run db:push

# Open a shell in the panel container
docker compose exec jigsaw sh

# Stop everything
docker compose down

# Stop everything and remove volumes (destructive!)
docker compose down -v
```

## Licence

MIT

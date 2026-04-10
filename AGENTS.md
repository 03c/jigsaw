# Jigsaw Development Guide

## Overview

Jigsaw is a self-hosted web hosting control panel built with React Router 7 (SSR). Single TypeScript application (not a monorepo) using server-side rendering with loaders and actions. The panel manages per-site Docker containers via the host socket.

See `README.md` for full user-facing docs, architecture, and configuration reference.

## Quick Reference

| Item | Value |
|------|-------|
| Language | TypeScript (strict mode) |
| Framework | React Router 7 (SSR) |
| ORM | Drizzle ORM (PostgreSQL) |
| Auth | Keycloak 26 via openid-client v6 (OIDC/PKCE) |
| Styling | Tailwind CSS 4 |
| Runtime | Node.js 22 LTS |
| Package manager | npm |
| Build tool | Vite 7 |
| Container management | dockerode |

## Development Workflow

### First-Time Setup

1. `npm install` -- install dependencies
2. `cp .env.local.example .env.local` -- only needed once; the file is gitignored
3. `npm run dev:bootstrap` -- starts PostgreSQL + Keycloak in Docker and pushes the DB schema
4. `npm run dev` -- starts the dev server at http://localhost:5173

### Day-to-Day

1. `npm run dev:services:up` -- start backing services (if not already running)
2. `npm run dev` -- start the dev server with HMR
3. Make changes; the browser reloads automatically
4. `npm run dev:services:down` -- stop backing services when done

### Services

| Service | How to start | Port | Notes |
|---------|-------------|------|-------|
| PostgreSQL + Keycloak | `npm run dev:services:up` | 5432, 8080 | Docker Compose via `docker-compose.local.yml` |
| Dev server (Vite HMR) | `npm run dev` | 5173 | React Router 7 dev mode with SSR |
| Drizzle Studio | `npm run db:studio` | 4983 (default) | Database GUI |

## Key Caveats

- **Docker is required**: The application talks to Docker via socket (`/var/run/docker.sock`) to manage site containers. Docker must be installed and the daemon running. Without Docker, the dev server will start but site management operations will fail.
- **Keycloak startup**: Keycloak can take 15-30 seconds to fully initialize after `dev:services:up`. The dev server will error on login redirects until Keycloak's realm endpoint is ready. Verify with: `curl -sf http://localhost:8080/realms/jigsaw/.well-known/openid-configuration`
- **Automated tests**: Vitest (`npm test`, `npm run test:integration` with Docker), Playwright E2E (`npm run test:e2e`). See `vitest.config.ts`, `playwright.config.ts`, and `.github/workflows/ci-*.yml`.
- **Linting/typechecking**: Run `npm run typecheck` (runs `react-router typegen && tsc`). There is no ESLint or Prettier configuration.
- **Build**: `npm run build` produces a production build under `build/server/` and `build/client/`.
- **Default dev credentials**: Keycloak admin user is `admin` / `admin` (set in `.env.local`).
- **Dev realm generation**: `npm run dev:realm` is automatically called by `dev:services:up`. It reads `.env.local` and generates `keycloak/jigsaw-realm.dev.json` from `keycloak/jigsaw-realm.json`, replacing placeholder values. This generated file is gitignored.
- **Tear down services**: `npm run dev:services:down` stops PostgreSQL and Keycloak containers.

## Cursor Cloud VM Setup

Docker is required inside the Cloud VM for the backing services and site orchestration.

- **Storage driver**: Requires `fuse-overlayfs` for nested Docker support
- **iptables**: Switch to `iptables-legacy` for Docker networking compatibility
- **Start daemon**: `sudo dockerd` (the daemon must be running before `dev:services:up`)
- **Socket permissions**: `sudo chmod 666 /var/run/docker.sock` for the current user

## Project Layout

```
app/
├── components/          # React UI components
│   ├── layout/          # Sidebar, navigation
│   └── ui/              # Stat cards, status badges
├── lib/                 # Server-only utilities (*.server.ts files)
│   ├── admin-links      # Keycloak/Traefik URL resolution for sidebar
│   ├── auth             # OIDC flow (PKCE, code exchange, token claims)
│   ├── crypto           # Secure password/slug/UUID generation
│   ├── db               # Drizzle ORM PostgreSQL connection
│   ├── docker           # Container lifecycle (create/start/stop/remove)
│   ├── images           # Site image env var resolution
│   ├── session          # Cookie sessions, requireUser/requireAdmin guards
│   └── stats            # System + Docker metrics via systeminformation
├── models/
│   └── schema.ts        # Drizzle schema: users, sites, services, activity_log
├── routes/              # React Router 7 routes (SSR loaders + actions)
│   ├── home.tsx         # Root → /dashboard or /auth/login
│   ├── auth.*.tsx       # Login, callback, logout
│   ├── dashboard.*.tsx  # User dashboard, site CRUD
│   └── admin.*.tsx      # Admin panel, user/site/server management
├── app.css              # Global Tailwind CSS styles
├── root.tsx             # HTML document shell, error boundary
└── routes.ts            # Central route config
```

## Database Schema

Four tables defined in `app/models/schema.ts`:

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `users` | `id`, `keycloak_id`, `email`, `name`, `role` (admin/user), `max_sites` | Synced from Keycloak on first login |
| `sites` | `id`, `user_id`, `name`, `slug`, `domain`, `status`, `php_version`, `network_name` | Status: creating/running/stopped/error |
| `services` | `id`, `site_id`, `type` (web/database/sftp), `container_id`, `container_name`, `status`, `config` (JSONB) | One per container |
| `activity_log` | `id`, `user_id`, `action`, `details` | Audit trail |

**Cascade rules:** Deleting a user cascades to sites → services. Activity log user FK uses `SET NULL`.

**Schema changes:** Use `npm run db:push` (applies changes directly) or `npm run db:generate` + `npm run db:migrate` (migration-file workflow). `db:push` is non-destructive.

## Route Map

| Path | File | Auth | Purpose |
|------|------|------|---------|
| `/` | `home.tsx` | None | Redirect to `/dashboard` or `/auth/login` |
| `/auth/login` | `auth.login.tsx` | None | Initiate OIDC PKCE flow |
| `/auth/callback` | `auth.callback.tsx` | None | Handle OIDC callback, create session |
| `/auth/logout` | `auth.logout.tsx` | None | Destroy session |
| `/dashboard` | `dashboard._index.tsx` | User | Site list, quick stats |
| `/dashboard/sites/new` | `dashboard.sites.new.tsx` | User | Create site form |
| `/dashboard/sites/:id` | `dashboard.sites.$id.tsx` | User | Site detail, start/stop/restart/delete/SFTP |
| `/dashboard/profile` | `dashboard.profile.tsx` | User | User profile |
| `/admin` | `admin._index.tsx` | Admin | Server stats, Docker info |
| `/admin/users` | `admin.users.tsx` | Admin | User management list |
| `/admin/users/:id` | `admin.users.$id.tsx` | Admin | Edit user role, max sites |
| `/admin/sites` | `admin.sites.tsx` | Admin | All sites overview |
| `/admin/server` | `admin.server-mgmt.tsx` | Admin | Docker management, pruning |

## CI/CD

Single GitHub Actions workflow (`.github/workflows/docker-publish.yml`):

- **Triggers:** push to `main`, version tags (`v*`), manual `workflow_dispatch`
- **Registry:** GHCR (`ghcr.io/03c/jigsaw`)
- **Images built:**
  - `panel` from root `Dockerfile` (tagged `latest` on main, tag refs, SHA)
  - `php` from `docker/templates/web/Dockerfile` (tagged `8.4`, SHA)
- **Auth:** `GITHUB_TOKEN` with `packages: write` permission

## Environment Variables

Production: `.env.example` → `.env` (generated by `install.sh` or manually)
Local dev: `.env.local.example` → `.env.local`

The dev server reads `.env.local` via the `--env-file` flag in npm scripts. The production Dockerfile does not embed env vars -- they're injected via Docker Compose environment blocks.

See `README.md` → **Configuration Reference** for the full variable table.

## Docker Architecture

**Production stack** (`docker-compose.yml`):
- Traefik v3 (ports 80/443, Let's Encrypt, Docker provider)
- OAuth2 Proxy (forward-auth for Traefik dashboard)
- PostgreSQL 17 Alpine (shared: panel + Keycloak)
- Keycloak 26 (OIDC provider)
- Jigsaw panel (Node.js, port 3000)

**Local dev stack** (`docker-compose.local.yml`):
- PostgreSQL 17 Alpine (port 5432)
- Keycloak 26 in dev mode (port 8080)

**Per-site containers** (created dynamically by the panel):
- `jigsaw_<slug>_web`: Nginx + PHP-FPM (image: `jigsaw-php:8.4`)
- `jigsaw_<slug>_db`: MariaDB (image: `mariadb:lts`)
- `jigsaw_<slug>_sftp`: SFTP (image: `atmoz/sftp`, port 2200-2299)
- `jigsaw_<slug>_net`: Isolated Docker bridge network

All managed containers are labeled `jigsaw.managed=true` for filtering and cleanup.

## Conventions

- Server-only code uses the `.server.ts` suffix (React Router convention for tree-shaking)
- Path alias `~/` maps to `app/` (configured in `tsconfig.json`)
- UUIDs (`crypto.randomUUID()`) are used as primary keys
- Route files follow React Router flat-file naming: `admin.users.$id.tsx` = `/admin/users/:id`
- All site-related Docker resources use the `jigsaw_<slug>_` prefix

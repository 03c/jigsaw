# Jigsaw Development Guide

## Overview

Jigsaw is a self-hosted web hosting control panel built with React Router 7 (SSR). Single application (not a monorepo) with TypeScript full-stack. See `README.md` for full docs.

## Cursor Cloud specific instructions

### Services

| Service | How to start | Port | Notes |
|---------|-------------|------|-------|
| PostgreSQL + Keycloak | `npm run dev:services:up` | 5432, 8080 | Docker Compose via `docker-compose.local.yml` |
| Dev server (Vite HMR) | `npm run dev` | 5173 | React Router 7 dev mode |

### Development workflow

1. `npm install` — install dependencies
2. `cp .env.local.example .env.local` — only needed on first setup; file is gitignored
3. `npm run dev:bootstrap` — starts PostgreSQL + Keycloak in Docker and pushes DB schema (combines `dev:services:up` + `db:push`)
4. `npm run dev` — starts dev server at http://localhost:5173

### Key caveats

- **Docker is required**: The application talks to Docker via socket (`/var/run/docker.sock`) to manage site containers. Docker must be installed and the daemon running.
- **Keycloak startup**: Keycloak can take 15-30 seconds to fully initialize after `dev:services:up`. The dev server will error on login redirects until Keycloak's realm endpoint is ready. Verify with: `curl -sf http://localhost:8080/realms/jigsaw/.well-known/openid-configuration`
- **No test suite**: The repo has no automated tests (no test framework, no test scripts in `package.json`).
- **Linting/typechecking**: Run `npm run typecheck` (runs `react-router typegen && tsc`). There is no separate ESLint config.
- **Build**: `npm run build` produces a production build under `build/`.
- **Default dev credentials**: Keycloak admin user is `admin` / `admin` (set in `.env.local`).
- **`npm run dev:realm`** is automatically called by `dev:services:up`; it generates `keycloak/jigsaw-realm.dev.json` from the template. This file is gitignored.
- **Tear down services**: `npm run dev:services:down` stops PostgreSQL and Keycloak containers.
- **Docker daemon in Cloud VM**: Requires `fuse-overlayfs` storage driver and `iptables-legacy` for nested Docker support. The daemon must be started with `sudo dockerd` and the socket needs permissions for the current user (`sudo chmod 666 /var/run/docker.sock`).

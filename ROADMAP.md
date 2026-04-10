# Jigsaw Roadmap

This document outlines the planned features and improvements for Jigsaw. Items are grouped by priority tier, with the highest-impact items first. This is a living document -- priorities may shift based on feedback and contributions.

## Legend

- **Status:** Not started / In progress / Done
- **Scope:** The subsystems and files that would need to change

---

## Tier 1: Core Reliability & Quality

These are foundational improvements that increase confidence in the codebase and make future development faster.

### Automated Test Suite

**Status:** Not started

The project currently has no automated tests. Adding a test framework and baseline coverage is the single highest-leverage improvement.

**Plan:**
- Add [Vitest](https://vitest.dev/) as the test runner (already compatible with Vite)
- Add a `test` script to `package.json`
- **Unit tests** for server utilities:
  - `crypto.server.ts` -- password generation, slug generation, UUID format
  - `images.server.ts` -- image template resolution with various env overrides
  - `admin-links.server.ts` -- URL generation for localhost vs production
  - `session.server.ts` -- session user extraction, role guards
- **Integration tests** for database operations:
  - User CRUD via Drizzle
  - Site creation with cascade deletes
  - Activity log entries
- **Route tests** for critical flows (using React Router testing utilities):
  - Auth redirect behavior (`home.tsx`)
  - Loader/action responses for dashboard routes
  - Admin guard enforcement
- **CI integration**: Add a `test` job to the GitHub Actions workflow that runs on PRs

**Scope:** `package.json`, new `app/__tests__/` or colocated `*.test.ts` files, `.github/workflows/`

### ESLint & Prettier Configuration

**Status:** Not started

Add consistent code formatting and linting rules.

**Plan:**
- Add ESLint with the `@typescript-eslint` plugin and React rules
- Add Prettier with a `.prettierrc` config
- Add `lint` and `format` scripts to `package.json`
- Add a lint check to CI
- One-time format pass across the codebase

**Scope:** `package.json`, `.eslintrc.*`, `.prettierrc`, all source files (formatting pass)

### Error Handling & Logging

**Status:** Not started

Improve structured logging and error recovery across server operations.

**Plan:**
- Add a lightweight logger (e.g., [pino](https://github.com/pinojs/pino)) with structured JSON output
- Replace `console.log`/`console.error` with the structured logger
- Add consistent error handling in Docker operations (partial failure recovery when creating multi-container sites)
- Add error boundaries per route section (dashboard, admin) for better UX on failures
- Log activity entries for all admin and site management actions

**Scope:** `app/lib/*.server.ts`, `app/routes/*.tsx`, new `app/lib/logger.server.ts`

---

## Tier 2: Feature Enhancements

### Site Resource Limits

**Status:** Not started

Allow admins to set CPU and memory limits per site container.

**Plan:**
- Add `cpu_limit` and `memory_limit` columns to the `sites` table
- Pass `HostConfig.CpuQuota`, `HostConfig.Memory` to `docker.createContainer()`
- Add UI controls in site creation and admin site management
- Show current resource usage vs limits in the site detail view

**Scope:** `app/models/schema.ts`, `app/lib/docker.server.ts`, `app/routes/dashboard.sites.*.tsx`, `app/routes/admin.sites.tsx`

### Site Backups

**Status:** Not started

Enable manual and scheduled backups of site files and databases.

**Plan:**
- **Manual backups**: Button in site detail view that creates a tarball of `public_html` and a `mysqldump` of the site database
- **Backup storage**: Store backups in `data/backups/<slug>/` with timestamps
- **Backup listing**: Show available backups with download links
- **Restore**: Allow restoring from a backup (with confirmation)
- **Scheduled backups** (future): Cron-style scheduling via a background worker
- Add `backups` table to track backup metadata

**Scope:** New `app/lib/backup.server.ts`, `app/models/schema.ts`, new route `dashboard.sites.$id.backups.tsx`, `docker-compose.yml` (volume mount for backups)

### Site Logs Viewer

**Status:** Not started

Show container logs for site services directly in the panel UI.

**Plan:**
- Fetch last N lines of container logs via `dockerode`
- Stream logs in real-time using Server-Sent Events (SSE) or polling
- Add a logs tab to the site detail view showing web, database, and SFTP logs
- Color-code log levels (stdout vs stderr)

**Scope:** `app/lib/docker.server.ts` (already has `getContainerLogs`), new route or component in `app/routes/dashboard.sites.$id.tsx`

### File Manager

**Status:** Not started

Browse and edit site files from the panel without SFTP.

**Plan:**
- Read directory listings from `SITES_BASE_PATH_PANEL/<user>/<slug>/public_html`
- Allow file upload, download, rename, and delete
- Basic text editor for common file types (HTML, PHP, CSS, JS, config files)
- Enforce file size limits and path traversal protection

**Scope:** New `app/lib/files.server.ts`, new routes `dashboard.sites.$id.files.tsx`

### Email / Notification System

**Status:** Not started

Notify users of important events (site down, backup complete, account changes).

**Plan:**
- Add email configuration (SMTP settings in `.env`)
- Send notifications for: site status changes, backup completion, user role changes
- Optional webhook support for external integrations (Slack, Discord)
- Email templates for each notification type

**Scope:** New `app/lib/email.server.ts`, `.env.example`, new notification preferences in user profile

### Domain Management Improvements

**Status:** Not started

Streamline domain setup and DNS verification.

**Plan:**
- DNS verification check from the panel (resolve domain and compare to server IP)
- Wildcard domain support for multi-tenant setups
- Domain alias support (multiple domains pointing to one site)
- SSL certificate status display in the site detail view

**Scope:** New `app/lib/dns.server.ts`, `app/routes/dashboard.sites.*.tsx`, `app/lib/docker.server.ts` (Traefik label updates)

---

## Tier 3: Advanced Features

### Multi-PHP Version Support

**Status:** Not started

Allow users to choose from multiple PHP versions per site.

**Plan:**
- Build and publish additional PHP images (8.1, 8.2, 8.3, 8.4)
- Add PHP version selector in site creation and settings
- Support changing PHP version on existing sites (recreate web container)
- CI pipeline to build all PHP version images

**Scope:** `docker/templates/web/Dockerfile`, `.github/workflows/docker-publish.yml`, `app/routes/dashboard.sites.*.tsx`

### Database Management UI

**Status:** Not started

Provide basic database management features in the panel.

**Plan:**
- Show database connection details (host, port, user, database name)
- Display database size
- Integrate phpMyAdmin or Adminer as an optional per-site container
- Import/export SQL dumps from the panel

**Scope:** New routes, `app/lib/docker.server.ts` (Adminer container), `app/models/schema.ts`

### Usage Metrics & Billing Foundation

**Status:** Not started

Track per-site resource usage for potential billing or quota enforcement.

**Plan:**
- Periodic collection of container CPU, memory, disk, and bandwidth stats
- New `usage_metrics` table with time-series data
- Dashboard charts showing usage trends per site
- Configurable quotas (disk space, bandwidth) with warnings and enforcement
- Export usage data as CSV

**Scope:** New `app/lib/metrics.server.ts`, `app/models/schema.ts`, new admin routes

### Multi-Node Support

**Status:** Not started

Distribute site containers across multiple Docker hosts.

**Plan:**
- Support Docker Swarm or remote Docker API connections
- Node registration and health monitoring in the admin panel
- Site placement strategy (round-robin, resource-based)
- Node-aware container management

**Scope:** Major refactor of `app/lib/docker.server.ts`, new `app/models/schema.ts` tables, new admin routes

### Plugin / Extension System

**Status:** Not started

Allow extending the panel with custom functionality.

**Plan:**
- Define a plugin API for adding new site service types (e.g., Redis, Node.js apps)
- Plugin registry for discovering available extensions
- Plugin lifecycle management (install, enable, disable, remove)
- Plugin hook points in site creation and management workflows

**Scope:** New `app/lib/plugins.server.ts`, plugin manifest format, new admin routes

---

## Tier 4: Operations & Infrastructure

### Health Checks & Monitoring

**Status:** Not started

Built-in health monitoring and alerting for the panel and managed sites.

**Plan:**
- HTTP health check endpoint for the panel (`/healthz`)
- Periodic health checks for all running site containers
- Site status auto-update based on container health
- Optional integration with external monitoring (Prometheus metrics endpoint)

**Scope:** New route `app/routes/healthz.tsx`, `app/lib/health.server.ts`, `docker-compose.yml`

### Automated SSL for Site Domains

**Status:** Done (via Traefik)

Traefik already handles Let's Encrypt certificates for all routed domains. Future improvements:
- Show certificate expiry dates in the site detail view
- Alert when certificates are failing to renew
- Support custom certificates (upload PEM files)

### Audit Log Improvements

**Status:** Not started

Expand the activity log with more detail and admin tooling.

**Plan:**
- Log all site operations with before/after state
- Filterable log view (by user, action type, date range)
- Log retention policy (auto-purge old entries)
- Export audit log as CSV/JSON

**Scope:** `app/lib/` (add logging calls), `app/routes/admin.activity.tsx` (new route)

### Installer Improvements

**Status:** Not started

Make the install script more robust and flexible.

**Plan:**
- Support for CentOS/RHEL/Fedora (in addition to Ubuntu/Debian)
- Non-interactive mode (all values via environment variables or config file)
- Uninstall script
- Pre-flight check for available disk space and memory
- Optional Cloudflare DNS API integration for automatic DNS record creation

**Scope:** `install.sh`, new `uninstall.sh`

---

## Contributing to the Roadmap

Have a feature idea? Open an issue on GitHub to discuss it. If you'd like to work on any of the items above, please comment on the relevant issue (or open one if it doesn't exist) so we can coordinate.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

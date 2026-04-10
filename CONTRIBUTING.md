# Contributing to Jigsaw

Thanks for your interest in contributing to Jigsaw! This document covers the conventions, setup, and workflow for contributing to the project.

## Getting Started

1. Fork the repository and clone your fork
2. Follow the [Development](README.md#development) section in the README to set up your local environment
3. Create a feature branch from `main`
4. Make your changes
5. Submit a pull request

## Prerequisites

- **Node.js 22+** (LTS)
- **Docker** and **Docker Compose** (for backing services)
- **npm** (included with Node.js)

## Development Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev:bootstrap
npm run dev
```

See [AGENTS.md](AGENTS.md) for detailed developer documentation including the route map, database schema, and project conventions.

The [`docs/`](docs/) folder is the **documentation website** (static HTML/CSS, deployable to GitHub Pages). When you change user-facing install or operations docs, update both the root [README](README.md) and the matching page under `docs/` so the site stays in sync.

## Code Style

### TypeScript

- Strict mode is enabled (`tsconfig.json`)
- Use the `~/` path alias for imports from `app/` (e.g., `import { db } from "~/lib/db.server"`)
- Server-only code must use the `.server.ts` suffix (React Router strips these from client bundles)
- Prefer `async`/`await` over raw Promises
- Use Drizzle ORM for all database operations

### React / Routes

- Routes follow React Router 7 flat-file naming: `admin.users.$id.tsx` for `/admin/users/:id`
- Use loaders for data fetching and actions for mutations (React Router convention)
- Auth guards: use `requireUser()` for authenticated routes, `requireAdmin()` for admin routes
- Keep route files focused -- extract shared logic into `app/lib/` modules

### CSS

- Tailwind CSS 4 utility classes for all styling
- Global styles in `app/app.css`

### Naming Conventions

- Docker resources: `jigsaw_<slug>_<type>` (e.g., `jigsaw_mysite_web`, `jigsaw_mysite_net`)
- Database tables: snake_case
- TypeScript: camelCase for variables/functions, PascalCase for types/interfaces
- UUIDs via `crypto.randomUUID()` for all primary keys

## Type Checking

There is no ESLint or Prettier configuration. The primary quality check is TypeScript:

```bash
npm run typecheck
```

This runs `react-router typegen` (generates route types) followed by `tsc` (TypeScript compiler in check mode).

Run this before submitting a PR to ensure there are no type errors.

## Testing

There is currently no automated test suite. Manual testing is the workflow:

1. Start the dev environment (`npm run dev:bootstrap && npm run dev`)
2. Log in via Keycloak at `http://localhost:5173`
3. Test your changes in the browser
4. For admin features, log in with the `admin` / `admin` credentials

Contributions that add a test framework and initial test coverage are very welcome.

## Database Changes

If your change modifies the database schema (`app/models/schema.ts`):

1. Update the schema file
2. Run `npm run db:push` to apply changes to your local database
3. Verify the changes work as expected
4. Document the schema change in your PR description

For production, `db:push` is non-destructive (adds columns/tables, never drops data). If a migration requires data transformation, document the steps.

## Docker Images

If your change affects the panel Dockerfile or the PHP site image:

1. Test building locally:
   ```bash
   docker build -t jigsaw-panel-test .
   docker build -t jigsaw-php-test:8.4 docker/templates/web/
   ```
2. Verify the built image starts correctly

## Pull Request Guidelines

- Create feature branches from `main`
- Write clear, descriptive commit messages
- Include a description of what changed and why
- Reference any related issues
- Ensure `npm run typecheck` passes
- Test your changes manually

## Reporting Issues

When reporting bugs, please include:

- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information (for UI issues)
- Relevant log output (`docker compose logs -f`)
- Your environment (Docker version, Node version, OS)

## Project Architecture

See the [Architecture](README.md#architecture) section in the README for the system diagram and data flow. For code-level architecture, see [AGENTS.md](AGENTS.md).

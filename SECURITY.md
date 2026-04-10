# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Jigsaw, please report it responsibly. **Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers directly or use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature on this repository.

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and will work with you to understand and address the issue before any public disclosure.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `main` branch | Yes |
| Older commits | No |

Jigsaw is pre-1.0 software. Security fixes are applied to `main` and published as new Docker images.

## Security Model

### Authentication

- **Keycloak** handles all user authentication via OpenID Connect (OIDC) with PKCE
- The panel never stores or handles user passwords directly
- Keycloak provides MFA, brute-force protection, and account lockout out of the box
- OIDC tokens are validated server-side using `openid-client` v6

### Session Management

- Sessions are stored in encrypted cookies (`__jigsaw_session`)
- Cookies are configured as `httpOnly`, `sameSite: lax`, and `secure` (in production)
- Session lifetime: 7 days
- Session encryption uses the `SESSION_SECRET` environment variable

### Authorization

- Two roles: `admin` and `user`
- Role is extracted from Keycloak realm roles on login and stored in the session
- Server-side guards (`requireUser`, `requireAdmin`) protect all authenticated routes
- Users can only see and manage their own sites; admins can manage everything

### Network Security

- **Per-site isolation**: Each site gets its own Docker bridge network (`jigsaw_<slug>_net`)
- **Database isolation**: MariaDB containers are only connected to their site's network (not internet-facing)
- **Traefik dashboard protection**: OAuth2 Proxy + Keycloak forward-auth
- **TLS everywhere**: Traefik auto-provisions Let's Encrypt certificates for all domains
- **HTTP-to-HTTPS redirect**: All HTTP traffic is redirected to HTTPS in production

### Secrets Management

- The install script auto-generates all secrets with `openssl rand`
- The `.env` file is created with `chmod 600` permissions
- Sensitive values (database passwords, OIDC client secret, session secret) are never logged or exposed to the client
- All `*.server.ts` files are stripped from client bundles by React Router

### Docker Socket Access

The panel container requires access to the Docker daemon socket (`/var/run/docker.sock`) for container orchestration. This is a privileged operation. Mitigations:

- The panel only creates containers with `jigsaw.managed=true` labels
- Prune operations filter by `jigsaw.managed=true` to avoid affecting non-Jigsaw containers
- Container names are prefixed with `jigsaw_` to avoid collisions

### Known Limitations

- The Docker socket mount gives the panel container effective root access on the host. This is an inherent limitation of Docker socket-based orchestration. Consider using Docker socket proxies (e.g., Tecnativa/docker-socket-proxy) in high-security environments.
- Session cookies are not bound to IP addresses. Stolen cookies can be replayed from any IP.
- There is no rate limiting at the application level (Keycloak handles login rate limiting; consider adding Traefik rate limiting middleware for the panel).
- SFTP credentials are stored in the `services.config` JSONB column. Access to the database exposes these credentials.

## Dependencies

Key security-relevant dependencies:

| Package | Role |
|---------|------|
| `openid-client` v6 | OIDC/PKCE authentication flow |
| `react-router` v7 | Server-side rendering, cookie sessions |
| `dockerode` | Docker daemon communication |
| `postgres` (porsager/postgres) | PostgreSQL client |

Keep dependencies updated regularly. The project uses npm with a lockfile (`package-lock.json`) for reproducible builds.

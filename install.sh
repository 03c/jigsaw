#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# Jigsaw Control Panel - Install Script
# ===========================================
#
# Usage (fresh server):
#   curl -fsSL https://raw.githubusercontent.com/03c/jigsaw/main/install.sh -o /tmp/jigsaw-install.sh && chmod +x /tmp/jigsaw-install.sh && sudo /tmp/jigsaw-install.sh
#
# Usage (already cloned):
#   chmod +x install.sh && ./install.sh
#

REPO_URL="https://github.com/03c/jigsaw.git"
INSTALL_DIR="/opt/jigsaw"
PANEL_IMAGE="ghcr.io/03c/jigsaw/panel:latest"
PHP_IMAGE="ghcr.io/03c/jigsaw/php:8.4"
SKIP_DNS_CHECK="${SKIP_DNS_CHECK:-0}"

EXISTING_POSTGRES_PASSWORD=""
EXISTING_SESSION_SECRET=""
EXISTING_KEYCLOAK_CLIENT_SECRET=""
EXISTING_OAUTH2_PROXY_COOKIE_SECRET=""

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No colour

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fatal() { err "$@"; exit 1; }

generate_password() {
  openssl rand -base64 "${1:-32}" | tr -d '/+=' | head -c "${1:-32}"
}

generate_hex() {
  openssl rand -hex "${1:-32}"
}

generate_base64() {
  openssl rand -base64 "${1:-32}" | tr -d '\n'
}

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[&|\\]/\\&/g'
}

resolve_ipv4() {
  local host="$1"
  getent ahostsv4 "$host" 2>/dev/null | cut -d' ' -f1 | head -n1
}

resolve_ipv4_public() {
  local host="$1"
  curl -fsS "https://cloudflare-dns.com/dns-query?name=${host}&type=A" \
    -H 'accept: application/dns-json' 2>/dev/null \
    | sed -n 's/.*"data":"\([0-9][0-9.]*\)".*/\1/p' | head -n1
}

is_private_or_loopback_ipv4() {
  local ip="$1"
  [[ "$ip" == 127.* || "$ip" == 10.* || "$ip" == 192.168.* || "$ip" == 169.254.* || "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\..* ]]
}

wait_for_valid_cert() {
  local host="$1"
  local waited=0
  local max_wait=420

  info "Waiting for valid SSL certificate for ${host}..."
  until curl -fsSI --max-time 10 "https://${host}" >/dev/null 2>&1; do
    sleep 10
    waited=$((waited + 10))
    if [[ $waited -ge $max_wait ]]; then
      fatal "Timed out waiting for a valid certificate on https://${host}. Check DNS and: docker compose logs traefik"
    fi
  done

  ok "Valid SSL certificate active: https://${host}"
}

prompt() {
  local var_name="$1" prompt_text="$2" default="${3:-}"
  local value
  local prompt_string
  if [[ -n "$default" ]]; then
    prompt_string="$(echo -e "${BOLD}${prompt_text}${NC} [${default}]: ")"
    if [[ -r /dev/tty ]]; then
      read -rp "$prompt_string" value </dev/tty
    else
      read -rp "$prompt_string" value
    fi
    value="${value:-$default}"
  else
    while [[ -z "${value:-}" ]]; do
      prompt_string="$(echo -e "${BOLD}${prompt_text}${NC}: ")"
      if [[ -r /dev/tty ]]; then
        read -rp "$prompt_string" value </dev/tty
      else
        read -rp "$prompt_string" value
      fi
      [[ -z "$value" ]] && warn "This field is required."
    done
  fi
  printf -v "$var_name" '%s' "$value"
}

prompt_secret() {
  local var_name="$1" prompt_text="$2" default="${3:-}"
  local value
  local prompt_string
  if [[ -n "$default" ]]; then
    prompt_string="$(echo -e "${BOLD}${prompt_text}${NC} [****]: ")"
    if [[ -r /dev/tty ]]; then
      read -srp "$prompt_string" value </dev/tty
      echo >/dev/tty
    else
      read -srp "$prompt_string" value
      echo
    fi
    value="${value:-$default}"
  else
    while [[ -z "${value:-}" ]]; do
      prompt_string="$(echo -e "${BOLD}${prompt_text}${NC}: ")"
      if [[ -r /dev/tty ]]; then
        read -srp "$prompt_string" value </dev/tty
        echo >/dev/tty
      else
        read -srp "$prompt_string" value
        echo
      fi
      [[ -z "$value" ]] && warn "This field is required."
    done
  fi
  printf -v "$var_name" '%s' "$value"
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}"
echo "     ╦╦╔═╗╔═╗╔═╗╦ ╦"
echo "     ║║║ ╦╚═╗╠═╣║║║"
echo "    ╚╝╩╚═╝╚═╝╩ ╩╚╩╝"
echo -e "${NC}"
echo -e "${BOLD}  Jigsaw Control Panel Installer${NC}"
echo ""

# Must be root (or sudo)
if [[ $EUID -ne 0 ]]; then
  fatal "This script must be run as root. Try: sudo bash install.sh"
fi

# Check OS
if [[ ! -f /etc/os-release ]]; then
  fatal "Cannot detect OS. This script supports Ubuntu/Debian."
fi
source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
  warn "This script is designed for Ubuntu/Debian. Your OS: $ID $VERSION_ID"
  if [[ -r /dev/tty ]]; then
    read -rp "Continue anyway? (y/N): " cont </dev/tty
  else
    read -rp "Continue anyway? (y/N): " cont
  fi
  [[ "$cont" != "y" && "$cont" != "Y" ]] && exit 1
fi

# ---------------------------------------------------------------------------
# Step 1: Install Docker if not present
# ---------------------------------------------------------------------------
echo ""
info "Checking prerequisites..."

if command -v docker &>/dev/null; then
  ok "Docker is already installed: $(docker --version)"
else
  info "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  ok "Docker installed: $(docker --version)"
fi

# Verify docker compose
if docker compose version &>/dev/null; then
  ok "Docker Compose: $(docker compose version --short)"
else
  fatal "Docker Compose plugin not found. Please install docker-compose-plugin."
fi

# Ensure other tools we need
for cmd in openssl git sed; do
  if ! command -v "$cmd" &>/dev/null; then
    info "Installing $cmd..."
    apt-get install -y -qq "$cmd"
  fi
done

# ---------------------------------------------------------------------------
# Step 2: Clone or detect repo
# ---------------------------------------------------------------------------
echo ""

# Are we already inside the repo?
if [[ -f "./docker-compose.yml" && -f "./keycloak/jigsaw-realm.json" ]]; then
  INSTALL_DIR="$(pwd)"
  ok "Running from existing Jigsaw directory: $INSTALL_DIR"
else
  prompt INSTALL_DIR "Installation directory" "$INSTALL_DIR"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Directory exists, pulling latest..."
    git -C "$INSTALL_DIR" pull
  else
    info "Cloning Jigsaw into $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  cd "$INSTALL_DIR"
  ok "Repository ready at $INSTALL_DIR"
fi

# ---------------------------------------------------------------------------
# Step 3: Gather configuration
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}--- Configuration ---${NC}"
echo ""
info "We need a few details to set up your panel."
info "Secrets will be auto-generated where possible."
echo ""

if [[ -f .env ]]; then
  info "Existing .env detected, preserving previously generated secrets."
  EXISTING_POSTGRES_PASSWORD=$(sed -n 's/^POSTGRES_PASSWORD=//p' .env | head -n1)
  EXISTING_SESSION_SECRET=$(sed -n 's/^SESSION_SECRET=//p' .env | head -n1)
  EXISTING_KEYCLOAK_CLIENT_SECRET=$(sed -n 's/^KEYCLOAK_CLIENT_SECRET=//p' .env | head -n1)
  EXISTING_OAUTH2_PROXY_COOKIE_SECRET=$(sed -n 's/^OAUTH2_PROXY_COOKIE_SECRET=//p' .env | head -n1)
fi

if [[ -d "data/postgres" && -z "$EXISTING_POSTGRES_PASSWORD" ]]; then
  fatal "Detected existing PostgreSQL data at data/postgres but no POSTGRES_PASSWORD in .env. Restore the original .env or reset PostgreSQL data: docker compose down && rm -rf data/postgres"
fi

prompt       PANEL_DOMAIN   "Panel domain (e.g. panel.example.com)" "server.jigsawhost.com"
prompt       ACME_EMAIL     "Email for Let's Encrypt SSL certificates" "chris.child@gmail.com"
prompt       ADMIN_EMAIL    "Admin user email address" "${ACME_EMAIL:-}"
prompt_secret KC_ADMIN_PASS "Keycloak admin console password"

# Auto-generate secrets
POSTGRES_PASSWORD=${EXISTING_POSTGRES_PASSWORD:-$(generate_password 32)}
SESSION_SECRET=${EXISTING_SESSION_SECRET:-$(generate_hex 32)}
KEYCLOAK_CLIENT_SECRET=${EXISTING_KEYCLOAK_CLIENT_SECRET:-$(generate_password 48)}
OAUTH2_PROXY_COOKIE_SECRET=${EXISTING_OAUTH2_PROXY_COOKIE_SECRET:-$(generate_base64 32)}

echo ""
ok "Domain:           $PANEL_DOMAIN"
ok "ACME email:       $ACME_EMAIL"
ok "Admin email:      $ADMIN_EMAIL"
ok "Secrets:          auto-generated"
echo ""

# Verify DNS before continuing so Let's Encrypt can succeed
if [[ "$SKIP_DNS_CHECK" == "1" ]]; then
  warn "Skipping DNS pre-check (SKIP_DNS_CHECK=1)."
else
  SERVER_PUBLIC_IP="$(curl -4 -sf https://ifconfig.me 2>/dev/null || curl -4 -sf https://api.ipify.org 2>/dev/null || true)"
  if [[ -n "$SERVER_PUBLIC_IP" ]]; then
    PANEL_DOMAIN_IP="$(resolve_ipv4_public "$PANEL_DOMAIN" || true)"
    AUTH_DOMAIN="auth.${PANEL_DOMAIN}"
    AUTH_DOMAIN_IP="$(resolve_ipv4_public "$AUTH_DOMAIN" || true)"
    PANEL_USED_LOCAL_RESOLVER=0
    AUTH_USED_LOCAL_RESOLVER=0

    # Fallback to local resolver only if public DNS lookup is unavailable
    if [[ -z "$PANEL_DOMAIN_IP" ]]; then
      warn "Could not query public DNS for ${PANEL_DOMAIN}; falling back to local resolver."
      PANEL_DOMAIN_IP="$(resolve_ipv4 "$PANEL_DOMAIN" || true)"
      PANEL_USED_LOCAL_RESOLVER=1
    fi

    if [[ -z "$AUTH_DOMAIN_IP" ]]; then
      warn "Could not query public DNS for ${AUTH_DOMAIN}; falling back to local resolver."
      AUTH_DOMAIN_IP="$(resolve_ipv4 "$AUTH_DOMAIN" || true)"
      AUTH_USED_LOCAL_RESOLVER=1
    fi

    if [[ -z "$PANEL_DOMAIN_IP" ]]; then
      fatal "DNS lookup failed for ${PANEL_DOMAIN}. Create an A record to ${SERVER_PUBLIC_IP} before install."
    fi

    if [[ -z "$AUTH_DOMAIN_IP" ]]; then
      fatal "DNS lookup failed for ${AUTH_DOMAIN}. Create an A record to ${SERVER_PUBLIC_IP} before install."
    fi

    if [[ $PANEL_USED_LOCAL_RESOLVER -eq 1 ]] && is_private_or_loopback_ipv4 "$PANEL_DOMAIN_IP"; then
      warn "Local resolver returned ${PANEL_DOMAIN_IP} for ${PANEL_DOMAIN}; skipping strict panel DNS check."
    elif [[ "$PANEL_DOMAIN_IP" != "$SERVER_PUBLIC_IP" ]]; then
      fatal "Public DNS for ${PANEL_DOMAIN} resolves to ${PANEL_DOMAIN_IP}, expected ${SERVER_PUBLIC_IP}. Fix DNS before install."
    fi

    if [[ $AUTH_USED_LOCAL_RESOLVER -eq 1 ]] && is_private_or_loopback_ipv4 "$AUTH_DOMAIN_IP"; then
      warn "Local resolver returned ${AUTH_DOMAIN_IP} for ${AUTH_DOMAIN}; skipping strict auth DNS check."
    elif [[ "$AUTH_DOMAIN_IP" != "$SERVER_PUBLIC_IP" ]]; then
      fatal "Public DNS for ${AUTH_DOMAIN} resolves to ${AUTH_DOMAIN_IP}, expected ${SERVER_PUBLIC_IP}. Fix DNS before install."
    fi

    ok "DNS looks good for panel and auth domains"
  else
    warn "Could not detect server public IPv4 automatically. Skipping DNS pre-check."
  fi
fi

# ---------------------------------------------------------------------------
# Step 4: Write .env
# ---------------------------------------------------------------------------
info "Writing .env file..."

cat > .env <<EOF
# ===========================================
# Jigsaw Control Panel - Generated by install.sh
# Generated: $(date -Iseconds)
# ===========================================

# Domain Configuration
PANEL_DOMAIN=${PANEL_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# PostgreSQL (shared between Keycloak and Jigsaw)
POSTGRES_USER=jigsaw
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Keycloak Admin Console
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=${KC_ADMIN_PASS}

# Keycloak OIDC Client
KEYCLOAK_CLIENT_ID=jigsaw-panel
KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}

# OAuth2 Proxy (protects Traefik dashboard)
OAUTH2_PROXY_COOKIE_SECRET=${OAUTH2_PROXY_COOKIE_SECRET}

# Session encryption secret
SESSION_SECRET=${SESSION_SECRET}
EOF

chmod 600 .env
ok ".env written (permissions: 600)"

# ---------------------------------------------------------------------------
# Step 5: Patch Keycloak realm JSON with generated values
# ---------------------------------------------------------------------------
info "Configuring Keycloak realm..."

REALM_FILE="keycloak/jigsaw-realm.json"

if [[ ! -f "$REALM_FILE" ]]; then
  fatal "Realm file not found: $REALM_FILE"
fi

# Replace placeholders
ESCAPED_KEYCLOAK_CLIENT_SECRET="$(escape_sed_replacement "$KEYCLOAK_CLIENT_SECRET")"
ESCAPED_ADMIN_EMAIL="$(escape_sed_replacement "$ADMIN_EMAIL")"
ESCAPED_PANEL_DOMAIN="$(escape_sed_replacement "$PANEL_DOMAIN")"
ESCAPED_KC_ADMIN_PASS="$(escape_sed_replacement "$KC_ADMIN_PASS")"

sed -i "s|JIGSAW_CLIENT_SECRET_PLACEHOLDER|${ESCAPED_KEYCLOAK_CLIENT_SECRET}|g" "$REALM_FILE"
sed -i "s|JIGSAW_ADMIN_EMAIL_PLACEHOLDER|${ESCAPED_ADMIN_EMAIL}|g" "$REALM_FILE"
sed -i "s|JIGSAW_PANEL_DOMAIN_PLACEHOLDER|${ESCAPED_PANEL_DOMAIN}|g" "$REALM_FILE"
sed -i "s|JIGSAW_ADMIN_PASSWORD_PLACEHOLDER|${ESCAPED_KC_ADMIN_PASS}|g" "$REALM_FILE"

ok "Keycloak realm configured with client secret and admin email"

# ---------------------------------------------------------------------------
# Step 6: Create data directories
# ---------------------------------------------------------------------------
info "Creating data directories..."

mkdir -p data/sites data/databases data/postgres docker/compose
chown -R 1000:1000 data/sites data/databases docker/compose 2>/dev/null || true

ok "Data directories created"

# ---------------------------------------------------------------------------
# Step 7: Pull prebuilt images
# ---------------------------------------------------------------------------
echo ""
info "Pulling prebuilt images..."

if docker pull "$PANEL_IMAGE" >/dev/null; then
  ok "Panel image pulled: $PANEL_IMAGE"
else
  fatal "Failed to pull panel image: $PANEL_IMAGE"
fi

if docker pull "$PHP_IMAGE" >/dev/null; then
  docker tag "$PHP_IMAGE" jigsaw-php:8.4
  ok "Site image pulled: $PHP_IMAGE"
else
  warn "Failed to pull site image ($PHP_IMAGE), building locally instead..."
  docker build -t jigsaw-php:8.4 docker/templates/web/ -q
  ok "Site image built locally: jigsaw-php:8.4"
fi

# ---------------------------------------------------------------------------
# Step 8: Start the stack
# ---------------------------------------------------------------------------
echo ""
info "Starting Jigsaw stack..."
docker compose up -d

ok "Stack started"

# ---------------------------------------------------------------------------
# Step 9: Wait for services to be healthy
# ---------------------------------------------------------------------------
info "Waiting for PostgreSQL to be ready..."

MAX_WAIT=60
WAITED=0
until docker compose exec -T postgres pg_isready -U jigsaw -q 2>/dev/null; do
  sleep 2
  WAITED=$((WAITED + 2))
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    fatal "PostgreSQL did not become ready within ${MAX_WAIT}s. Check: docker compose logs postgres"
  fi
done
ok "PostgreSQL is ready"

info "Waiting for Keycloak to start (this can take 30-60s on first boot)..."
WAITED=0
MAX_WAIT=300
until docker compose exec -T jigsaw node -e "fetch('http://keycloak:8080/realms/jigsaw/.well-known/openid-configuration').then((r)=>process.exit(r.ok ? 0 : 1)).catch(()=>process.exit(1))" &>/dev/null; do
  sleep 5
  WAITED=$((WAITED + 5))
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    if docker compose logs --no-color keycloak 2>/dev/null | grep -q 'password authentication failed for user "jigsaw"'; then
      fatal "Keycloak cannot authenticate to PostgreSQL (password mismatch). If this is a fresh install, run: docker compose down && rm -rf data/postgres && ./install.sh"
    fi
    fatal "Keycloak did not become ready within ${MAX_WAIT}s. Check: docker compose logs keycloak"
  fi
done
ok "Keycloak is ready"

# Ensure Keycloak client redirect URIs match the configured panel domain
info "Updating Keycloak client redirect URIs..."
if docker compose exec -T \
  -e PANEL_DOMAIN="$PANEL_DOMAIN" \
  -e KC_ADMIN_PASS="$KC_ADMIN_PASS" \
  keycloak bash -lc '
    set -e
    /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password "$KC_ADMIN_PASS" >/dev/null
    CLIENT_ID=$(/opt/keycloak/bin/kcadm.sh get clients -r jigsaw -q clientId=jigsaw-panel --fields id --format csv --noquotes)
    /opt/keycloak/bin/kcadm.sh update clients/${CLIENT_ID} -r jigsaw \
      -s "redirectUris=[\"https://${PANEL_DOMAIN}/auth/callback\",\"https://traefik.${PANEL_DOMAIN}/oauth2/callback\",\"http://localhost:5173/auth/callback\",\"http://localhost:3000/auth/callback\"]" \
      -s "webOrigins=[\"https://${PANEL_DOMAIN}\",\"https://traefik.${PANEL_DOMAIN}\",\"http://localhost:5173\",\"http://localhost:3000\"]" >/dev/null
    /opt/keycloak/bin/kcadm.sh set-password -r jigsaw --username admin --new-password "$KC_ADMIN_PASS" >/dev/null
  ' >/dev/null 2>&1; then
  ok "Keycloak client redirect URIs and admin password updated"
else
  warn "Could not auto-update Keycloak client settings. If login fails, check redirect URIs and admin password in Keycloak."
fi

# ---------------------------------------------------------------------------
# Step 10: Run database migrations
# ---------------------------------------------------------------------------
info "Running database migrations..."
docker compose exec -T -e npm_config_update_notifier=false jigsaw npm run db:push
ok "Database schema created"

# ---------------------------------------------------------------------------
# Step 11: Confirm TLS certificates are valid
# ---------------------------------------------------------------------------
wait_for_valid_cert "$PANEL_DOMAIN"
wait_for_valid_cert "auth.${PANEL_DOMAIN}"

# ---------------------------------------------------------------------------
# Done!
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}=============================================${NC}"
echo -e "${GREEN}${BOLD}  Jigsaw installed successfully!${NC}"
echo -e "${GREEN}${BOLD}=============================================${NC}"
echo ""
echo -e "  ${BOLD}Panel:${NC}            https://${PANEL_DOMAIN}"
echo -e "  ${BOLD}Keycloak Admin:${NC}   https://auth.${PANEL_DOMAIN}"
echo -e "  ${BOLD}Traefik Dashboard:${NC} https://traefik.${PANEL_DOMAIN}"
echo ""
echo -e "  ${BOLD}First login:${NC}"
echo -e "    1. Go to https://${PANEL_DOMAIN}"
echo -e "    2. You'll be redirected to Keycloak to log in"
echo -e "    3. Username: ${BOLD}admin${NC}  Password: ${BOLD}<the Keycloak admin password you entered>${NC}"
echo -e "    4. You can change this password later in Keycloak"
echo ""
echo -e "  ${BOLD}DNS required:${NC}"
echo -e "    Point these A records to this server's IP:"
echo -e "      ${CYAN}${PANEL_DOMAIN}${NC}       -> $(curl -4 -sf ifconfig.me 2>/dev/null || echo '<server-ip>')"
echo -e "      ${CYAN}auth.${PANEL_DOMAIN}${NC}  -> $(curl -4 -sf ifconfig.me 2>/dev/null || echo '<server-ip>')"
echo -e "      ${CYAN}traefik.${PANEL_DOMAIN}${NC}  -> $(curl -4 -sf ifconfig.me 2>/dev/null || echo '<server-ip>')"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    docker compose logs -f        # View all logs"
echo -e "    docker compose restart jigsaw  # Restart the panel"
echo -e "    docker compose down            # Stop everything"
echo -e "    docker compose up -d           # Start everything"
echo ""

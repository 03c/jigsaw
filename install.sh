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

prompt       PANEL_DOMAIN   "Panel domain (e.g. panel.example.com)"
prompt       ACME_EMAIL     "Email for Let's Encrypt SSL certificates"
prompt       ADMIN_EMAIL    "Admin user email address" "${ACME_EMAIL:-}"
prompt_secret KC_ADMIN_PASS "Keycloak admin console password"

# Auto-generate secrets
POSTGRES_PASSWORD=$(generate_password 32)
SESSION_SECRET=$(generate_hex 32)
KEYCLOAK_CLIENT_SECRET=$(generate_password 48)

echo ""
ok "Domain:           $PANEL_DOMAIN"
ok "ACME email:       $ACME_EMAIL"
ok "Admin email:      $ADMIN_EMAIL"
ok "Secrets:          auto-generated"
echo ""

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
sed -i "s|JIGSAW_CLIENT_SECRET_PLACEHOLDER|${KEYCLOAK_CLIENT_SECRET}|g" "$REALM_FILE"
sed -i "s|JIGSAW_ADMIN_EMAIL_PLACEHOLDER|${ADMIN_EMAIL}|g" "$REALM_FILE"

ok "Keycloak realm configured with client secret and admin email"

# ---------------------------------------------------------------------------
# Step 6: Create data directories
# ---------------------------------------------------------------------------
info "Creating data directories..."

mkdir -p data/sites data/databases data/postgres docker/compose
chown -R 1000:1000 data/sites data/databases docker/compose 2>/dev/null || true

ok "Data directories created"

# ---------------------------------------------------------------------------
# Step 7: Build the PHP site image
# ---------------------------------------------------------------------------
echo ""
info "Building PHP site image (jigsaw-php:8.4)... this may take a few minutes."
docker build -t jigsaw-php:8.4 docker/templates/web/ -q
ok "PHP site image built: jigsaw-php:8.4"

# ---------------------------------------------------------------------------
# Step 8: Start the stack
# ---------------------------------------------------------------------------
echo ""
info "Starting Jigsaw stack..."
docker compose up -d --build

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
until docker compose exec -T keycloak bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' &>/dev/null; do
  sleep 5
  WAITED=$((WAITED + 5))
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    fatal "Keycloak did not become ready within ${MAX_WAIT}s. Check: docker compose logs keycloak"
  fi
done
ok "Keycloak is ready"

# ---------------------------------------------------------------------------
# Step 10: Run database migrations
# ---------------------------------------------------------------------------
info "Running database migrations..."
docker compose exec -T jigsaw npm run db:push 2>&1 | tail -5
ok "Database schema created"

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
echo -e "    3. Username: ${BOLD}admin${NC}  Password: ${BOLD}admin${NC} (temporary)"
echo -e "    4. You'll be prompted to set a new password"
echo ""
echo -e "  ${BOLD}DNS required:${NC}"
echo -e "    Point these A records to this server's IP:"
echo -e "      ${CYAN}${PANEL_DOMAIN}${NC}       -> $(curl -4 -sf ifconfig.me 2>/dev/null || echo '<server-ip>')"
echo -e "      ${CYAN}auth.${PANEL_DOMAIN}${NC}  -> $(curl -4 -sf ifconfig.me 2>/dev/null || echo '<server-ip>')"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    docker compose logs -f        # View all logs"
echo -e "    docker compose restart jigsaw  # Restart the panel"
echo -e "    docker compose down            # Stop everything"
echo -e "    docker compose up -d           # Start everything"
echo ""

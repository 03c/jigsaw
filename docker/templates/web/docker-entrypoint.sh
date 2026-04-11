#!/bin/sh
set -e
# WordPress image: sync baked core from the image onto an empty bind-mounted web root
if [ -n "${JIGSAW_WORDPRESS_BAKED_PATH:-}" ] && [ -d "${JIGSAW_WORDPRESS_BAKED_PATH}" ]; then
  if [ ! -f /var/www/html/wp-settings.php ]; then
    cp -a "${JIGSAW_WORDPRESS_BAKED_PATH}/." /var/www/html/
  fi
fi
# Avoid recursive chown of the whole tree (conflicts with SFTP uid 1000). Tighten uploads + wp-config only.
WEB_OWNER="${JIGSAW_WEB_OWNER:-www-data}"
WEB_GROUP="${JIGSAW_WEB_GROUP:-www-data}"
if [ -d /var/www/html ]; then
  if [ -d /var/www/html/wp-content/uploads ]; then
    chown -R "${WEB_OWNER}:${WEB_GROUP}" /var/www/html/wp-content/uploads 2>/dev/null || true
    find /var/www/html/wp-content/uploads -type d -exec chmod 755 {} \; 2>/dev/null || true
    find /var/www/html/wp-content/uploads -type f -exec chmod 644 {} \; 2>/dev/null || true
  fi
  if [ -f /var/www/html/wp-config.php ]; then
    chown "${WEB_OWNER}:${WEB_GROUP}" /var/www/html/wp-config.php 2>/dev/null || true
    chmod 640 /var/www/html/wp-config.php 2>/dev/null || true
  fi
fi
exec "$@"

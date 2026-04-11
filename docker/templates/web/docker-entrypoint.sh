#!/bin/sh
set -e
# WordPress image: sync baked core from the image onto an empty bind-mounted web root
if [ -n "${JIGSAW_WORDPRESS_BAKED_PATH:-}" ] && [ -d "${JIGSAW_WORDPRESS_BAKED_PATH}" ]; then
  if [ ! -f /var/www/html/wp-settings.php ]; then
    cp -a "${JIGSAW_WORDPRESS_BAKED_PATH}/." /var/www/html/
  fi
fi
# Ensure PHP-FPM (www-data) can read/write the mounted web root (WordPress uploads, wp-config.php)
if [ -d /var/www/html ]; then
  chown -R www-data:www-data /var/www/html 2>/dev/null || true
  find /var/www/html -type d -exec chmod 755 {} \; 2>/dev/null || true
  find /var/www/html -type f -exec chmod 644 {} \; 2>/dev/null || true
fi
exec "$@"

#!/bin/sh
set -e
# Ensure PHP-FPM (www-data) can read/write the mounted web root (e.g. WordPress uploads, wp-config.php)
if [ -d /var/www/html ]; then
  chown -R www-data:www-data /var/www/html 2>/dev/null || true
  find /var/www/html -type d -exec chmod 755 {} \; 2>/dev/null || true
  find /var/www/html -type f -exec chmod 644 {} \; 2>/dev/null || true
fi
exec "$@"

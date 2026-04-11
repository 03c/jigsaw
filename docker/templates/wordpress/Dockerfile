# Customer WordPress runtime: extends the Jigsaw PHP image (Nginx + PHP-FPM) with WordPress core baked in.
# Pin the WordPress version and verify the official MD5 checksum (reproducible builds).
#
# Build (from repo root):
#   docker build -f docker/templates/wordpress/Dockerfile \
#     --build-arg BASE_IMAGE=jigsaw-php:8.4 -t jigsaw-wordpress:8.4 .

ARG BASE_IMAGE=ghcr.io/03c/jigsaw/php:8.4
FROM ${BASE_IMAGE}

ARG WORDPRESS_VERSION=6.7.2

USER root

RUN apk add --no-cache curl unzip coreutils \
    && curl -fsSL "https://wordpress.org/wordpress-${WORDPRESS_VERSION}.zip" -o /tmp/wp.zip \
    && curl -fsSL "https://wordpress.org/wordpress-${WORDPRESS_VERSION}.zip.md5" -o /tmp/wp.zip.md5 \
    && EXPECTED=$(tr -d '\r\n ' < /tmp/wp.zip.md5) \
    && ACTUAL=$(md5sum /tmp/wp.zip | awk '{print $1}') \
    && test "$ACTUAL" = "$EXPECTED" || (echo "MD5 mismatch: actual=${ACTUAL} expected=${EXPECTED}" >&2; exit 1) \
    && unzip -q /tmp/wp.zip -d /opt/jigsaw \
    && rm /tmp/wp.zip /tmp/wp.zip.md5 \
    && mv /opt/jigsaw/wordpress /opt/jigsaw/wordpress-baked \
    && chown -R www-data:www-data /opt/jigsaw/wordpress-baked

ENV JIGSAW_WORDPRESS_BAKED_PATH=/opt/jigsaw/wordpress-baked

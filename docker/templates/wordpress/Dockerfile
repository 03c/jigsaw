# Customer WordPress runtime: extends the Jigsaw PHP image (Nginx + PHP-FPM) with WordPress core baked in.
# Pin version + SHA256 of the official zip (downloads.wordpress.org) — avoids MD5 mirror drift in CI.
#
# Build (from repo root):
#   docker build -f docker/templates/wordpress/Dockerfile \
#     --build-arg BASE_IMAGE=jigsaw-php:8.4 -t jigsaw-wordpress:8.4 .

ARG BASE_IMAGE=ghcr.io/03c/jigsaw/php:8.4
FROM ${BASE_IMAGE}

ARG WORDPRESS_VERSION=6.7.2
# SHA256 of https://downloads.wordpress.org/release/wordpress-${WORDPRESS_VERSION}.zip (verify after bumping VERSION)
ARG WORDPRESS_SHA256=b6acbc116aabdc5a7c9bc4e861647148a1b444c1f2beec5440261b88f02c3a6e

USER root

# nginx:alpine has no www-data; PHP-FPM expects it for file reads
RUN id -u www-data >/dev/null 2>&1 || (addgroup -S www-data && adduser -S -D -H -G www-data www-data)

RUN apk add --no-cache curl unzip coreutils \
    && curl -fsSL "https://downloads.wordpress.org/release/wordpress-${WORDPRESS_VERSION}.zip" -o /tmp/wp.zip \
    && echo "${WORDPRESS_SHA256}  /tmp/wp.zip" | sha256sum -c - \
    && unzip -q /tmp/wp.zip -d /opt/jigsaw \
    && rm /tmp/wp.zip \
    && mv /opt/jigsaw/wordpress /opt/jigsaw/wordpress-baked \
    && chown -R www-data:www-data /opt/jigsaw/wordpress-baked

ENV JIGSAW_WORDPRESS_BAKED_PATH=/opt/jigsaw/wordpress-baked

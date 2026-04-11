# WordPress site image: same Nginx + PHP stack as jigsaw-php, with official WordPress core under /opt/jigsaw/wordpress-baked.
# Build context: repository root (see CI and docker-publish workflow).
#
#   docker build -f docker/templates/wordpress/Dockerfile \
#     --build-arg BASE_IMAGE=jigsaw-php:8.4 -t jigsaw-wordpress:8.4 .

ARG BASE_IMAGE=ghcr.io/03c/jigsaw/php:8.4
FROM ${BASE_IMAGE}

ARG WORDPRESS_VERSION=6.7.2

USER root

# Base image is nginx:alpine — ensure www-data exists for PHP-FPM and chown
RUN if ! id -u www-data >/dev/null 2>&1; then \
      addgroup -S www-data && adduser -S -D -H -G www-data www-data; \
    fi

RUN apk add --no-cache curl unzip \
    && mkdir -p /opt/jigsaw \
    && curl -fSL --retry 3 --retry-delay 2 \
      "https://downloads.wordpress.org/release/wordpress-${WORDPRESS_VERSION}.zip" \
      -o /tmp/wp.zip \
    && unzip -q /tmp/wp.zip -d /opt/jigsaw \
    && rm -f /tmp/wp.zip \
    && mv /opt/jigsaw/wordpress /opt/jigsaw/wordpress-baked \
    && chown -R www-data:www-data /opt/jigsaw/wordpress-baked

ENV JIGSAW_WORDPRESS_BAKED_PATH=/opt/jigsaw/wordpress-baked

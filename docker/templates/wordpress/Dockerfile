# Customer WordPress runtime: extends the Jigsaw PHP image (Nginx + PHP-FPM) with WordPress core baked in.
# CI builds the `php` image first, then this image FROM that tag.
#
# Build (from repo root):
#   docker build -f docker/templates/wordpress/Dockerfile \
#     --build-arg BASE_IMAGE=jigsaw-php:8.4 -t jigsaw-wordpress:8.4 .

ARG BASE_IMAGE=ghcr.io/03c/jigsaw/php:8.4
FROM ${BASE_IMAGE}

USER root

RUN apk add --no-cache curl unzip \
    && curl -fsSL https://wordpress.org/latest.zip -o /tmp/wp.zip \
    && unzip -q /tmp/wp.zip -d /opt/jigsaw \
    && rm /tmp/wp.zip \
    && mv /opt/jigsaw/wordpress /opt/jigsaw/wordpress-baked \
    && chown -R www-data:www-data /opt/jigsaw/wordpress-baked

# Panel sets this env on WordPress site containers so the entrypoint copies core onto an empty volume once.
ENV JIGSAW_WORDPRESS_BAKED_PATH=/opt/jigsaw/wordpress-baked

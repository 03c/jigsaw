FROM php:8.4-fpm AS php

# Install PHP extensions commonly needed for CMS/web apps
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libzip-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    libonig-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        mysqli \
        pdo_mysql \
        gd \
        zip \
        mbstring \
        curl \
        xml \
        opcache \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# PHP production config
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

# Increase common limits
RUN echo "upload_max_filesize = 64M" >> "$PHP_INI_DIR/php.ini" \
    && echo "post_max_size = 64M" >> "$PHP_INI_DIR/php.ini" \
    && echo "memory_limit = 256M" >> "$PHP_INI_DIR/php.ini" \
    && echo "max_execution_time = 300" >> "$PHP_INI_DIR/php.ini"

# Final image: Nginx + PHP-FPM
FROM nginx:stable-alpine

# Copy PHP-FPM from the build stage
COPY --from=php /usr/local/sbin/php-fpm /usr/local/sbin/php-fpm
COPY --from=php /usr/local/lib/php /usr/local/lib/php
COPY --from=php /usr/local/etc/php /usr/local/etc/php
COPY --from=php /usr/local/etc/php-fpm.conf /usr/local/etc/php-fpm.conf
COPY --from=php /usr/local/etc/php-fpm.d /usr/local/etc/php-fpm.d

# Install runtime dependencies for PHP in the nginx image
RUN apk add --no-cache \
    libpng \
    libjpeg-turbo \
    freetype \
    libzip \
    libxml2 \
    libcurl \
    oniguruma \
    supervisor

# Nginx config
COPY default.conf /etc/nginx/conf.d/default.conf

# Supervisor to run both Nginx and PHP-FPM
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# PHP-FPM: listen on 127.0.0.1:9000
RUN sed -i 's/listen = .*/listen = 127.0.0.1:9000/' /usr/local/etc/php-fpm.d/www.conf 2>/dev/null || true

WORKDIR /var/www/html

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

-- Create a separate database for Keycloak within the same PostgreSQL instance
CREATE DATABASE keycloak;

-- Grant the main user full access to the keycloak database
GRANT ALL PRIVILEGES ON DATABASE keycloak TO jigsaw;

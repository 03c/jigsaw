import { randomBytes, randomUUID } from "node:crypto";

/**
 * Generate a cryptographically secure random password.
 */
export function generatePassword(length = 32): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

/**
 * Generate a safe database username (alphanumeric + underscore only).
 */
export function generateDbUsername(slug: string): string {
  return `db_${slug.replace(/[^a-z0-9]/g, "_")}`.substring(0, 32);
}

/**
 * Generate a safe database name.
 */
export function generateDbName(slug: string): string {
  return `site_${slug.replace(/[^a-z0-9]/g, "_")}`.substring(0, 63);
}

/**
 * Generate a UUID v4.
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Generate a URL-safe slug from a display name.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 63);
}

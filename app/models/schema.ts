import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const siteStatusEnum = pgEnum("site_status", [
  "creating",
  "running",
  "stopped",
  "error",
]);
export const serviceTypeEnum = pgEnum("service_type", [
  "web",
  "database",
  "sftp",
]);
export const serviceStatusEnum = pgEnum("service_status", [
  "running",
  "stopped",
  "error",
  "creating",
]);

// Users table
export const users = pgTable("users", {
  id: text("id").primaryKey(), // UUID
  keycloakId: text("keycloak_id").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  maxSites: integer("max_sites").default(5).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sites table
export const sites = pgTable("sites", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  domain: text("domain").notNull(),
  status: siteStatusEnum("status").default("creating").notNull(),
  phpVersion: text("php_version").default("8.4").notNull(),
  networkName: text("network_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Services table (web, db, sftp containers per site)
export const services = pgTable("services", {
  id: text("id").primaryKey(), // UUID
  siteId: text("site_id")
    .references(() => sites.id, { onDelete: "cascade" })
    .notNull(),
  type: serviceTypeEnum("type").notNull(),
  containerId: text("container_id"),
  containerName: text("container_name").notNull(),
  status: serviceStatusEnum("status").default("creating").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activity log for admin visibility
export const activityLog = pgTable("activity_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sites: many(sites),
  activityLogs: many(activityLog),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  user: one(users, {
    fields: [sites.userId],
    references: [users.id],
  }),
  services: many(services),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  site: one(sites, {
    fields: [services.siteId],
    references: [sites.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

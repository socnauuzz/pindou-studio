import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accessKeys = sqliteTable("access_keys", {
  id: text("id").primaryKey(),
  codeHash: text("code_hash").notNull().unique(),
  codePrefix: text("code_prefix").notNull(),
  plan: text("plan").notNull(),
  usageLimit: integer("usage_limit").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: text("expires_at"),
  status: text("status").notNull().default("active"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const keySessions = sqliteTable("key_sessions", {
  id: text("id").primaryKey(),
  keyId: text("key_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
});

export const keyEvents = sqliteTable("key_events", {
  id: text("id").primaryKey(),
  keyId: text("key_id").notNull(),
  eventType: text("event_type").notNull(),
  createdAt: text("created_at").notNull(),
});

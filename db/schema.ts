import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role", { enum: ["user", "trusted", "admin"] }).notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyUsage = sqliteTable("daily_usage", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  usageDate: text("usage_date").notNull(),
  menuCount: integer("menu_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.usageDate] })]);

export const globalUsage = sqliteTable("global_usage", {
  usageDate: text("usage_date").primaryKey(),
  menuCount: integer("menu_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
});

export const dailyActivity = sqliteTable("daily_activity", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityDate: text("activity_date").notNull(),
  menuBatchCount: integer("menu_batch_count").notNull().default(0),
  menuItemCount: integer("menu_item_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  lastActivityAt: text("last_activity_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.activityDate] }),
  index("daily_activity_date_idx").on(table.activityDate),
]);

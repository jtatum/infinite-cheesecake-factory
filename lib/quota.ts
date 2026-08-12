import { env } from "cloudflare:workers";
import type { AuthenticatedUser } from "./auth";

export type UserRole = "user" | "trusted" | "admin";
export type QuotaKind = "menu" | "image";

type UsageRow = { menu_count: number; image_count: number };
type UserRow = { id: string; email: string; role: UserRole; created_at: string; last_seen_at: string };

const DEFAULT_LIMITS = {
  menu: 10,
  image: 5,
  globalMenu: 100,
  globalImage: 100,
};

function positiveLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function quotaLimits() {
  return {
    menu: positiveLimit("MENU_DAILY_LIMIT", DEFAULT_LIMITS.menu),
    image: positiveLimit("IMAGE_DAILY_LIMIT", DEFAULT_LIMITS.image),
    globalMenu: positiveLimit("GLOBAL_MENU_DAILY_LIMIT", DEFAULT_LIMITS.globalMenu),
    globalImage: positiveLimit("GLOBAL_IMAGE_DAILY_LIMIT", DEFAULT_LIMITS.globalImage),
  };
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function nextResetUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function isBootstrapAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

function database() {
  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");
  return env.DB;
}

export async function syncUser(user: AuthenticatedUser) {
  const db = database();
  await db.prepare(`
    INSERT INTO users (id, email, role, created_at, last_seen_at)
    VALUES (?, ?, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      last_seen_at = CURRENT_TIMESTAMP
  `).bind(user.id, user.email).run();

  const row = await db.prepare(
    "SELECT id, email, role, created_at, last_seen_at FROM users WHERE id = ?"
  ).bind(user.id).first<UserRow>();
  if (!row) throw new Error("Unable to create the user record.");
  return { ...row, role: isBootstrapAdmin(user.email) ? "admin" as const : row.role };
}

export async function usageSnapshot(user: AuthenticatedUser) {
  const profile = await syncUser(user);
  const usage = await database().prepare(
    "SELECT menu_count, image_count FROM daily_usage WHERE user_id = ? AND usage_date = ?"
  ).bind(user.id, todayUtc()).first<UsageRow>();
  const limits = quotaLimits();
  const exempt = profile.role === "trusted" || profile.role === "admin";
  return {
    role: profile.role,
    exempt,
    menu: { used: usage?.menu_count || 0, limit: limits.menu },
    image: { used: usage?.image_count || 0, limit: limits.image },
    resetsAt: nextResetUtc(),
  };
}

async function reserveGlobal(kind: QuotaKind) {
  const limits = quotaLimits();
  const column = kind === "menu" ? "menu_count" : "image_count";
  const limit = kind === "menu" ? limits.globalMenu : limits.globalImage;
  const row = await database().prepare(`
    INSERT INTO global_usage (usage_date, ${column}) VALUES (?, 1)
    ON CONFLICT(usage_date) DO UPDATE SET ${column} = ${column} + 1
    WHERE ${column} < ?
    RETURNING ${column} AS used
  `).bind(todayUtc(), limit).first<{ used: number }>();
  return row ? { ok: true as const, used: row.used, limit } : { ok: false as const, used: limit, limit };
}

async function reserveUser(userId: string, kind: QuotaKind) {
  const limits = quotaLimits();
  const column = kind === "menu" ? "menu_count" : "image_count";
  const limit = limits[kind];
  const row = await database().prepare(`
    INSERT INTO daily_usage (user_id, usage_date, ${column}) VALUES (?, ?, 1)
    ON CONFLICT(user_id, usage_date) DO UPDATE SET ${column} = ${column} + 1
    WHERE ${column} < ?
    RETURNING ${column} AS used
  `).bind(userId, todayUtc(), limit).first<{ used: number }>();
  return row ? { ok: true as const, used: row.used, limit } : { ok: false as const, used: limit, limit };
}

export async function reserveQuota(user: AuthenticatedUser, kind: QuotaKind) {
  const profile = await syncUser(user);
  if (profile.role === "trusted" || profile.role === "admin") {
    const global = await reserveGlobal(kind);
    if (!global.ok) return { ...global, reason: "global" as const };
    return { ok: true as const, exempt: true, role: profile.role, global };
  }

  const personal = await reserveUser(user.id, kind);
  if (!personal.ok) return { ...personal, reason: "personal" as const };
  const global = await reserveGlobal(kind);
  if (!global.ok) {
    const column = kind === "menu" ? "menu_count" : "image_count";
    await database().prepare(`
      UPDATE daily_usage SET ${column} = MAX(${column} - 1, 0)
      WHERE user_id = ? AND usage_date = ?
    `).bind(user.id, todayUtc()).run();
    return { ...global, reason: "global" as const };
  }
  return { ok: true as const, exempt: false, role: profile.role, personal, global };
}

export async function requireAdmin(user: AuthenticatedUser) {
  const profile = await syncUser(user);
  return profile.role === "admin";
}

export async function listUsers() {
  const result = await database().prepare(`
    SELECT id, email, role, created_at, last_seen_at
    FROM users
    ORDER BY last_seen_at DESC
    LIMIT 200
  `).all<UserRow>();
  return result.results;
}

export async function setUserRole(userId: string, role: UserRole) {
  const result = await database().prepare(
    "UPDATE users SET role = ? WHERE id = ? RETURNING id, email, role, created_at, last_seen_at"
  ).bind(role, userId).first<UserRow>();
  return result || null;
}

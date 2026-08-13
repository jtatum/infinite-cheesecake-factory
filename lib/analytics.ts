import { env } from "cloudflare:workers";
import type { AuthenticatedUser } from "./auth";
import { quotaLimits, syncUser, type UserRole } from "./quota";

export type GenerationKind = "menu" | "image";

type DailyAnalyticsRow = {
  activity_date: string;
  active_users: number;
  menu_batches: number;
  menu_items: number;
  images: number;
};

type ActiveUserRow = {
  id: string;
  email: string;
  role: UserRole;
  last_active_at: string;
  active_days: number;
  menu_batches: number;
  menu_items: number;
  images: number;
};

const RETENTION_DAYS = 90;
const DASHBOARD_DAYS = 30;

function database() {
  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");
  return env.DB;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function recordGeneration(user: AuthenticatedUser, kind: GenerationKind, itemCount = 0) {
  await syncUser(user);
  const menuBatches = kind === "menu" ? 1 : 0;
  const menuItems = kind === "menu" ? itemCount : 0;
  const images = kind === "image" ? 1 : 0;
  const db = database();

  await db.batch([
    db.prepare(`
      INSERT INTO daily_activity (
        user_id, activity_date, menu_batch_count, menu_item_count, image_count, last_activity_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, activity_date) DO UPDATE SET
        menu_batch_count = menu_batch_count + excluded.menu_batch_count,
        menu_item_count = menu_item_count + excluded.menu_item_count,
        image_count = image_count + excluded.image_count,
        last_activity_at = CURRENT_TIMESTAMP
    `).bind(user.id, todayUtc(), menuBatches, menuItems, images),
    db.prepare("DELETE FROM daily_activity WHERE activity_date < ?").bind(dateDaysAgo(RETENTION_DAYS - 1)),
    db.prepare("DELETE FROM daily_usage WHERE usage_date < ?").bind(dateDaysAgo(RETENTION_DAYS - 1)),
    db.prepare("DELETE FROM global_usage WHERE usage_date < ?").bind(dateDaysAgo(RETENTION_DAYS - 1)),
  ]);
}

export async function analyticsSnapshot() {
  const startDate = dateDaysAgo(DASHBOARD_DAYS - 1);
  const db = database();
  const [dailyResult, activeUserResult, global] = await Promise.all([
    db.prepare(`
      SELECT
        activity_date,
        COUNT(*) AS active_users,
        SUM(menu_batch_count) AS menu_batches,
        SUM(menu_item_count) AS menu_items,
        SUM(image_count) AS images
      FROM daily_activity
      WHERE activity_date >= ?
      GROUP BY activity_date
      ORDER BY activity_date ASC
    `).bind(startDate).all<DailyAnalyticsRow>(),
    db.prepare(`
      SELECT
        users.id,
        users.email,
        users.role,
        MAX(daily_activity.last_activity_at) AS last_active_at,
        COUNT(*) AS active_days,
        SUM(daily_activity.menu_batch_count) AS menu_batches,
        SUM(daily_activity.menu_item_count) AS menu_items,
        SUM(daily_activity.image_count) AS images
      FROM daily_activity
      JOIN users ON users.id = daily_activity.user_id
      WHERE daily_activity.activity_date >= ?
      GROUP BY users.id, users.email, users.role
      ORDER BY last_active_at DESC
      LIMIT 200
    `).bind(startDate).all<ActiveUserRow>(),
    db.prepare(`
      SELECT menu_count, image_count
      FROM global_usage
      WHERE usage_date = ?
    `).bind(todayUtc()).first<{ menu_count: number; image_count: number }>(),
  ]);

  const byDate = new Map(dailyResult.results.map((row) => [row.activity_date, row]));
  const days = Array.from({ length: DASHBOARD_DAYS }, (_, index) => {
    const date = dateDaysAgo(DASHBOARD_DAYS - 1 - index);
    return byDate.get(date) || {
      activity_date: date,
      active_users: 0,
      menu_batches: 0,
      menu_items: 0,
      images: 0,
    };
  });
  const totals = days.reduce((sum, day) => ({
    activeUserDays: sum.activeUserDays + Number(day.active_users),
    menuBatches: sum.menuBatches + Number(day.menu_batches),
    menuItems: sum.menuItems + Number(day.menu_items),
    images: sum.images + Number(day.images),
  }), { activeUserDays: 0, menuBatches: 0, menuItems: 0, images: 0 });
  const limits = quotaLimits();

  return {
    retentionDays: RETENTION_DAYS,
    windowDays: DASHBOARD_DAYS,
    days,
    totals,
    activeUsers: activeUserResult.results,
    standardQuotaToday: {
      menu: { used: global?.menu_count || 0, limit: limits.globalMenu },
      image: { used: global?.image_count || 0, limit: limits.globalImage },
    },
  };
}

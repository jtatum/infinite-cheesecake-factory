"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type UserRole = "user" | "trusted" | "admin";

type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_seen_at: string;
};

type DailyAnalytics = {
  activity_date: string;
  active_users: number;
  menu_batches: number;
  menu_items: number;
  images: number;
};

type ActiveUser = {
  id: string;
  email: string;
  role: UserRole;
  last_active_at: string;
  active_days: number;
  menu_batches: number;
  menu_items: number;
  images: number;
};

type Analytics = {
  retentionDays: number;
  windowDays: number;
  days: DailyAnalytics[];
  totals: {
    activeUserDays: number;
    menuBatches: number;
    menuItems: number;
    images: number;
  };
  activeUsers: ActiveUser[];
  standardQuotaToday: {
    menu: { used: number; limit: number };
    image: { used: number; limit: number };
  };
};

function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function activityTime(value: string) {
  return new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, analyticsResponse] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/analytics", { cache: "no-store" }),
      ]);
      const usersData = await usersResponse.json() as { users?: ManagedUser[]; error?: string };
      const analyticsData = await analyticsResponse.json() as Analytics & { error?: string };
      if (!usersResponse.ok || !usersData.users) throw new Error(usersData.error || "The guest ledger is unavailable.");
      if (!analyticsResponse.ok || !analyticsData.days) throw new Error(analyticsData.error || "Factory analytics are unavailable.");
      setUsers(usersData.users);
      setAnalytics(analyticsData);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The factory ledger is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  async function changeRole(userId: string, role: UserRole) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const data = await response.json() as { user?: ManagedUser; error?: string };
    if (!response.ok || !data.user) {
      setError(data.error || "The role could not be changed.");
      return;
    }
    setUsers((current) => current.map((user) => user.id === userId ? data.user! : user));
    setAnalytics((current) => current ? {
      ...current,
      activeUsers: current.activeUsers.map((user) => user.id === userId ? { ...user, role } : user),
    } : current);
  }

  const recentDays = useMemo(() => analytics?.days.slice(-14).reverse() || [], [analytics]);
  const maxDailyActivity = Math.max(1, ...recentDays.map((day) => Number(day.menu_batches) + Number(day.images)));
  const today = analytics?.days.at(-1);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/">← RETURN TO THE MENU</Link>
        <span>AUTHORIZED PERSONNEL ONLY</span>
      </header>
      <section className="admin-sheet">
        <p className="eyebrow">FACTORY CONTROL OFFICE</p>
        <h1>Factory ledger</h1>
        <p>Trusted guests and administrators bypass both personal and factory-wide quotas. Activity below counts successful generations and is retained for 90 days.</p>
        {loading && <div className="admin-message">OPENING THE LEDGER…</div>}
        {error && <div className="admin-message admin-message--error">{error}</div>}
        {!loading && analytics && (
          <>
            <div className="metric-grid" aria-label="Thirty-day factory summary">
              <div><span>ACTIVE TODAY</span><strong>{Number(today?.active_users || 0).toLocaleString()}</strong><small>generating users</small></div>
              <div><span>MENU BATCHES · 30D</span><strong>{Number(analytics.totals.menuBatches).toLocaleString()}</strong><small>{Number(analytics.totals.menuItems).toLocaleString()} dishes</small></div>
              <div><span>IMAGES · 30D</span><strong>{Number(analytics.totals.images).toLocaleString()}</strong><small>successful renders</small></div>
              <div><span>STANDARD QUOTA · TODAY</span><strong>{analytics.standardQuotaToday.menu.used}/{analytics.standardQuotaToday.menu.limit}</strong><small>menu · {analytics.standardQuotaToday.image.used}/{analytics.standardQuotaToday.image.limit} image</small></div>
            </div>

            <section className="analytics-section" aria-labelledby="daily-activity-heading">
              <div className="admin-section-heading">
                <div><p className="eyebrow">LAST 14 DAYS</p><h2 id="daily-activity-heading">Daily activity</h2></div>
                <p>One active user generated at least one menu batch or image that UTC day.</p>
              </div>
              <div className="activity-table" role="table" aria-label="Daily generation activity">
                <div className="activity-row activity-row--heading" role="row">
                  <span>DATE</span><span>ACTIVE</span><span>GENERATIONS</span><span>BATCHES</span><span>IMAGES</span>
                </div>
                {recentDays.map((day) => {
                  const activity = Number(day.menu_batches) + Number(day.images);
                  return (
                    <div className="activity-row" role="row" key={day.activity_date}>
                      <span>{shortDate(day.activity_date)}</span>
                      <strong>{Number(day.active_users)}</strong>
                      <span className="activity-bar" aria-label={`${activity} total generations`}><i style={{ width: `${(activity / maxDailyActivity) * 100}%` }} /></span>
                      <span>{Number(day.menu_batches)}</span>
                      <span>{Number(day.images)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="analytics-section" aria-labelledby="active-users-heading">
              <div className="admin-section-heading">
                <div><p className="eyebrow">LAST {analytics.windowDays} DAYS</p><h2 id="active-users-heading">Who is using it</h2></div>
                <p>{analytics.activeUsers.length} generating users in this window.</p>
              </div>
              {analytics.activeUsers.length ? (
                <div className="active-user-table" role="table" aria-label="Active users">
                  <div className="active-user-row active-user-row--heading" role="row">
                    <span>GUEST</span><span>LAST ACTIVE</span><span>DAYS</span><span>BATCHES</span><span>IMAGES</span>
                  </div>
                  {analytics.activeUsers.map((user) => (
                    <div className="active-user-row" role="row" key={user.id}>
                      <span><strong>{user.email}</strong><small>{user.role}</small></span>
                      <span>{activityTime(user.last_active_at)}</span>
                      <span>{Number(user.active_days)}</span>
                      <span>{Number(user.menu_batches)}</span>
                      <span>{Number(user.images)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="admin-message">NO GENERATION ACTIVITY YET</div>}
            </section>

            <section className="analytics-section" aria-labelledby="guest-access-heading">
              <div className="admin-section-heading">
                <div><p className="eyebrow">ACCESS CONTROL</p><h2 id="guest-access-heading">Registered guests</h2></div>
                <p>Last seen includes account checks, even when the guest did not generate anything.</p>
              </div>
              <div className="user-table" role="table" aria-label="Registered users">
                <div className="user-row user-row--heading" role="row">
                  <span>GUEST</span><span>LAST SEEN</span><span>ACCESS</span>
                </div>
                {users.map((user) => (
                  <div className="user-row" role="row" key={user.id}>
                    <span><strong>{user.email}</strong><small>{user.id}</small></span>
                    <span>{new Date(user.last_seen_at.replace(" ", "T") + "Z").toLocaleDateString()}</span>
                    <select value={user.role} onChange={(event) => void changeRole(user.id, event.target.value as UserRole)} aria-label={`Role for ${user.email}`}>
                      <option value="user">Standard quota</option>
                      <option value="trusted">Trusted · fully exempt</option>
                      <option value="admin">Administrator · fully exempt</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ManagedUser = {
  id: string;
  email: string;
  role: "user" | "trusted" | "admin";
  created_at: string;
  last_seen_at: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await response.json() as { users?: ManagedUser[]; error?: string };
    setLoading(false);
    if (!response.ok || !data.users) {
      setError(data.error || "The guest ledger is unavailable.");
      return;
    }
    setError(null);
    setUsers(data.users);
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function changeRole(userId: string, role: ManagedUser["role"]) {
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
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/">← RETURN TO THE MENU</Link>
        <span>AUTHORIZED PERSONNEL ONLY</span>
      </header>
      <section className="admin-sheet">
        <p className="eyebrow">FACTORY CONTROL OFFICE</p>
        <h1>Guest ledger</h1>
        <p>Trusted guests bypass their personal daily quota. The factory-wide safety limit still applies to everyone.</p>
        {loading && <div className="admin-message">OPENING THE LEDGER…</div>}
        {error && <div className="admin-message admin-message--error">{error}</div>}
        {!loading && !error && (
          <div className="user-table" role="table" aria-label="Registered users">
            <div className="user-row user-row--heading" role="row">
              <span>GUEST</span><span>LAST SEEN</span><span>ACCESS</span>
            </div>
            {users.map((user) => (
              <div className="user-row" role="row" key={user.id}>
                <span><strong>{user.email}</strong><small>{user.id}</small></span>
                <span>{new Date(user.last_seen_at).toLocaleDateString()}</span>
                <select value={user.role} onChange={(event) => void changeRole(user.id, event.target.value as ManagedUser["role"])} aria-label={`Role for ${user.email}`}>
                  <option value="user">Standard quota</option>
                  <option value="trusted">Trusted · exempt</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

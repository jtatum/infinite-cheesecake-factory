"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dish } from "../lib/menu";

type AuthState = {
  loading: boolean;
  configured: boolean;
  providers: string[];
  user: null | { id: string; email: string; displayName: string };
  quota?: {
    role: "user" | "trusted" | "admin";
    exempt: boolean;
    menu: { used: number; limit: number };
    image: { used: number; limit: number };
  };
  error?: string;
};

const SEEDS = [
  "late capitalism at brunch",
  "a perfect Wednesday",
  "the last mall on Earth",
  "objects found behind the moon",
  "municipal glamour",
  "the ocean’s performance review",
  "1997, spiritually",
  "foods your future self warned you about",
];

const LAST_SEED_KEY = "infinite-cheesecake-last-seed";

function pickDifferentSeed(previous = "") {
  const choices = SEEDS.filter((candidate) => candidate !== previous);
  const randomIndex = window.crypto.getRandomValues(new Uint32Array(1))[0] % choices.length;
  return choices[randomIndex];
}

function DishCard({ dish, index, onOpen, saved, onSave }: { dish: Dish; index: number; onOpen: () => void; saved: boolean; onSave: () => void }) {
  return (
    <article className="dish-card">
      <div className="dish-card__topline">
        <span>№ {String(index + 1).padStart(4, "0")}</span>
        <span>{dish.category}</span>
      </div>
      <button className="dish-card__body" onClick={onOpen} aria-label={`Generate an image of ${dish.name}`}>
        <span className="dish-card__emoji" aria-hidden="true">{dish.emoji}</span>
        <span className="dish-card__copy">
          <span className="dish-card__title">{dish.name}</span>
          <span className="dish-card__description">{dish.description}</span>
        </span>
        <span className="dish-card__price">{dish.price}</span>
      </button>
      <div className="dish-card__footer">
        <span>
          <a href={dish.source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            SEEDS: {dish.source.title} ↗
          </a>
          {dish.secondarySource && <>
            {" × "}<a href={dish.secondarySource.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{dish.secondarySource.title} ↗</a>
          </>}
        </span>
        <button onClick={onSave}>{saved ? "★ ARCHIVED" : "☆ ARCHIVE"}</button>
      </div>
    </article>
  );
}

function DishModal({ dish, onClose, saved, onSave, onUsage }: { dish: Dish; onClose: () => void; saved: boolean; onSave: () => void; onUsage: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState("Consulting the forbidden pantry…");
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stages = ["Consulting the forbidden pantry…", "Plating the central metaphor…", "Adding one legally distinct cherry…"];
    let stage = 0;
    const interval = window.setInterval(() => {
      stage = Math.min(stage + 1, stages.length - 1);
      setStatus(stages[stage]);
    }, 1100);

    fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: dish.imageToken }),
    })
      .then(async (response) => {
        const responseText = await response.text();
        let data: { image?: string; error?: string };
        try {
          data = JSON.parse(responseText) as typeof data;
        } catch {
          throw new Error(`Image route returned ${response.headers.get("content-type") || "a non-JSON response"} (HTTP ${response.status}).`);
        }
        if (!response.ok || !data.image) throw new Error(data.error || "Runware did not return an image.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setImage(data.image || null);
        onUsage();
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setImageError(error.message);
      })
      .finally(() => window.clearInterval(interval));

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [dish, onUsage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dish-title">
      <button className="modal__backdrop" onClick={onClose} aria-label="Close dish" />
      <section className="modal__panel">
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal__art">
          {image ? <img src={image} alt={`Generated depiction of ${dish.name}`} /> : imageError ? (
            <div className="developing developing--error" role="alert">
              <span>⚠</span>
              <strong>IMAGE KITCHEN OFFLINE</strong>
              <p>{imageError}</p>
            </div>
          ) : (
            <div className="developing" role="status">
              <span>{dish.emoji}</span>
              <strong>{status}</strong>
              <i />
            </div>
          )}
        </div>
        <div className="modal__copy">
          <p className="eyebrow">FRESH FROM THE IMAGE KITCHEN</p>
          <h2 id="dish-title">{dish.name}</h2>
          <p className="modal__description">{dish.description}</p>
          <div className="ingredient-list">
            {dish.ingredients.map((ingredient) => <span key={ingredient}>{ingredient}</span>)}
          </div>
          <div className="warning"><span>⚠</span><p><b>KITCHEN NOTE</b>{dish.warning}</p></div>
          <div className="modal__actions">
            <button className="primary-button" onClick={onSave}>{saved ? "★ In the archive" : "☆ Save this evidence"}</button>
            <span className="modal__price">{dish.price}</span>
          </div>
          <p className="source-note">
            Dream seeded by <a href={dish.source.url} target="_blank" rel="noreferrer">{dish.source.title} ↗</a>
            {dish.secondarySource && <> × <a href={dish.secondarySource.url} target="_blank" rel="noreferrer">{dish.secondarySource.title} ↗</a></>}
            {image && <span> · Rendered by TwinFlow Z-Image-Turbo</span>}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [seed, setSeed] = useState("");
  const [items, setItems] = useState<Dish[]>([]);
  const [selected, setSelected] = useState<Dish | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [chefMode, setChefMode] = useState("CONNECTING TO GEMINI");
  const [auth, setAuth] = useState<AuthState>({ loading: true, configured: false, providers: [], user: null });
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const itemsLengthRef = useRef(items.length);
  const visitorIdRef = useRef("");

  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await response.json() as Omit<AuthState, "loading"> & { error?: string };
      if (!response.ok) throw new Error(data.error || "Account service is unavailable.");
      setAuth({ ...data, loading: false });
      setChefMode(data.user ? "GEMINI CHEF ONLINE" : "SIGN-IN REQUIRED");
    } catch (error) {
      setAuth({ loading: false, configured: false, providers: [], user: null, error: error instanceof Error ? error.message : "Account service is unavailable." });
      setChefMode("ACCOUNT SERVICE OFFLINE");
    }
  }, []);

  useEffect(() => { void refreshAuth(); }, [refreshAuth]);

  useEffect(() => {
    let previous = "";
    try { previous = window.localStorage.getItem(LAST_SEED_KEY) || ""; } catch { /* private browsing is allowed */ }
    const initialSeed = pickDifferentSeed(previous);
    setSeed(initialSeed);
    try { window.localStorage.setItem(LAST_SEED_KEY, initialSeed); } catch { /* deliciously nonessential */ }
  }, []);

  useEffect(() => {
    try {
      setSaved(JSON.parse(window.localStorage.getItem("infinite-cheesecake-archive") || "[]"));
    } catch { /* private browsing is allowed */ }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("infinite-cheesecake-visitor");
      const visitor = stored || window.crypto.randomUUID();
      visitorIdRef.current = visitor;
      if (!stored) window.localStorage.setItem("infinite-cheesecake-visitor", visitor);
    } catch {
      visitorIdRef.current = window.crypto.randomUUID();
    }
  }, []);

  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);

  useEffect(() => {
    if (!loading) {
      setLoadingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setLoadingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const loadMore = useCallback(async (activeSeed = seed, reset = false) => {
    if (loadingRef.current) return;
    if (!auth.user) return;
    if (!activeSeed) return;
    loadingRef.current = true;
    setLoading(true);
    setMenuError(null);
    const offset = reset ? 0 : itemsLengthRef.current;
    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: activeSeed, offset, visitor: visitorIdRef.current }),
      });
      const responseText = await response.text();
      let data: { dishes?: Dish[]; chef?: string; error?: string };
      try {
        data = JSON.parse(responseText) as typeof data;
      } catch {
        throw new Error(`Menu route returned ${response.headers.get("content-type") || "a non-JSON response"} (HTTP ${response.status}). Check the local server log.`);
      }
      if (!response.ok || !data.dishes) throw new Error(data.error || "The menu kitchen failed.");
      const dishes = data.dishes;
      setChefMode("GEMINI CHEF ONLINE");
      setItems((current) => reset ? dishes : [...current, ...dishes]);
      void refreshAuth();
    } catch (error) {
      setChefMode("GEMINI CHEF OFFLINE");
      setMenuError(error instanceof Error ? error.message : "The menu kitchen failed.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [auth.user, refreshAuth, seed]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "700px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const node = sentinel.current;
    if (!auth.user || loading || menuError || items.length === 0 || !node) return;
    if (node.getBoundingClientRect().top <= window.innerHeight + 700) loadMore();
  }, [auth.user, items.length, loading, menuError, loadMore]);

  const toggleSave = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { window.localStorage.setItem("infinite-cheesecake-archive", JSON.stringify(next)); } catch { /* deliciously nonessential */ }
      return next;
    });
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Infinite Cheesecake Factory home">
          <span className="brand__mark">∞</span>
          <span>THE INFINITE<br />CHEESECAKE FACTORY</span>
        </a>
        <div className="factory-status"><i /> FACTORY RUNNING · {chefMode}</div>
        <div className="header-actions">
          {auth.loading ? <span className="account-chip">CHECKING ACCOUNT…</span> : auth.user ? (
            <div className="account-menu">
              <span className="account-chip">
                {auth.quota?.exempt ? "★ TRUSTED GUEST" : `${auth.quota?.menu.used || 0}/${auth.quota?.menu.limit || 10} BATCHES`}
              </span>
              {auth.quota?.role === "admin" && <a className="account-link" href="/admin">ADMIN</a>}
              <form action="/auth/sign-out" method="post"><button className="account-link" type="submit">SIGN OUT</button></form>
            </div>
          ) : <a className="account-login" href="/auth/sign-in?provider=google&returnTo=/">SIGN IN WITH GOOGLE</a>}
          <button className="archive-count" aria-label={`${saved.length} archived dishes`}>★ ARCHIVE <b>{String(saved.length).padStart(2, "0")}</b></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero__issue">MENU ISSUE № ∞ <span>EST. AFTER TIME ENDS</span></div>
        <h1>There is always<br /><em>one more thing</em><br />on the menu.</h1>
        <p className="hero__intro">An inexhaustible restaurant hallucination. Every dish collides two stray facts from the world and ends somewhere considerably less responsible.</p>
        <div className="seed-console">
          <div>
            <span>CURRENT MENU THEME</span>
            <strong>{seed ? `“${seed}”` : "Choosing a timeline…"}</strong>
            <small>A different theme is chosen each visit. Scroll for more dishes from this one.</small>
          </div>
        </div>
        <div className="scroll-notice"><span>SCROLL TO ORDER</span><i>↓</i></div>
        <div className="hero__stamp" aria-hidden="true"><b>OPEN</b><span>FOREVER</span></div>
      </section>

      <section className="menu-section" aria-label="Infinite menu">
        <div className="menu-heading">
          <span>5 DISHES AT A TIME · 10 WIKIPEDIA CONCEPT SEEDS · REPEAT FOREVER</span>
          <p>Next batch begins near the end</p>
        </div>
        <div className="menu-list">
          {items.map((dish, index) => (
            <DishCard key={dish.id} dish={dish} index={index} onOpen={() => setSelected(dish)} saved={saved.includes(dish.id)} onSave={() => toggleSave(dish.id)} />
          ))}
        </div>
        <div className="sentinel" ref={sentinel}>
          {auth.loading ? <><span /><p>CHECKING THE GUEST LIST…</p></> : !auth.configured ? (
            <div className="auth-gate" role="status">
              <strong>THE GUEST LIST IS NOT CONFIGURED</strong>
              <p>Add the Supabase project URL and publishable key to open the kitchen.</p>
            </div>
          ) : !auth.user ? (
            <div className="auth-gate">
              <strong>SIGN IN TO ENTER THE INFINITE DINING ROOM</strong>
              <p>Every guest receives a daily menu and image allowance. No password required.</p>
              <div className="auth-options">
                {auth.providers.map((provider) => (
                  <a key={provider} href={`/auth/sign-in?provider=${provider}&returnTo=/`}>
                    CONTINUE WITH {provider.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>
          ) : loading ? <><span /><p>EXTENDING THE KITCHEN… {loadingSeconds}s</p></> : menuError ? (
            <div className="kitchen-error" role="alert">
              <strong>THE MENU KITCHEN IS OFFLINE</strong>
              <p>{menuError}</p>
              <button onClick={() => loadMore(seed, items.length === 0)}>RETRY GEMINI CHEF</button>
            </div>
          ) : (
            <div className="sentinel__ready">
              <p>THE MENU CONTINUES</p>
              <button type="button" onClick={() => loadMore()}>LOAD FIVE MORE ↓</button>
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>∞ COURSES SERVED AND COUNTING</span>
        <p>No reservations. No substitutions. No discernible exit.</p>
      </footer>

      {selected && <DishModal dish={selected} onClose={() => setSelected(null)} saved={saved.includes(selected.id)} onSave={() => toggleSave(selected.id)} onUsage={refreshAuth} />}
    </main>
  );
}

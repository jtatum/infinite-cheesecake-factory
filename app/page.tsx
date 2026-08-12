"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOUSE_TOPICS, hashString, makeFallbackMenu, type Dish } from "../lib/menu";

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

function fallbackArtwork(dish: Dish) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const hash = hashString(dish.id);
  const palettes = [
    ["#ff6b35", "#f7f0df", "#5b1038"],
    ["#b9e769", "#ffdf4f", "#1f1638"],
    ["#ff8fb1", "#ffd9a0", "#38523b"],
    ["#7656a5", "#edffb3", "#ef612f"],
  ];
  const colors = palettes[hash % palettes.length];
  const gradient = context.createLinearGradient(0, 0, 900, 900);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 900, 900);

  for (let index = 0; index < 24; index += 1) {
    const x = (hash * (index + 11) * 13) % 900;
    const y = (hash * (index + 7) * 29) % 900;
    const size = 16 + ((hash + index * 31) % 90);
    context.globalAlpha = 0.08 + (index % 4) * 0.025;
    context.fillStyle = index % 2 ? colors[1] : "#ffffff";
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
  context.fillStyle = "rgba(20, 11, 21, 0.22)";
  context.beginPath();
  context.ellipse(450, 635, 295, 76, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colors[1];
  context.beginPath();
  context.ellipse(450, 570, 315, 105, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2c1625";
  context.lineWidth = 9;
  context.stroke();

  context.save();
  context.translate(450, 450);
  context.rotate(((hash % 15) - 7) * (Math.PI / 180));
  context.fillStyle = "#d5964d";
  context.beginPath();
  context.moveTo(-225, 95);
  context.lineTo(230, 95);
  context.lineTo(30, 220);
  context.lineTo(-210, 190);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "#fff4c7";
  context.beginPath();
  context.moveTo(-225, -55);
  context.quadraticCurveTo(15, -135, 230, -55);
  context.lineTo(230, 95);
  context.quadraticCurveTo(0, 180, -225, 95);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = colors[0];
  context.beginPath();
  context.moveTo(-225, -55);
  context.quadraticCurveTo(15, -145, 230, -55);
  context.quadraticCurveTo(15, 20, -225, -55);
  context.fill();
  context.stroke();
  context.restore();

  context.font = "152px serif";
  context.textAlign = "center";
  context.fillText(dish.emoji, 450, 315);
  context.fillStyle = "#fff8df";
  context.fillRect(44, 740, 812, 116);
  context.fillStyle = "#241426";
  context.font = "700 24px Arial";
  context.textAlign = "left";
  context.fillText("ARTIST’S RECONSTRUCTION · FACTORY ARCHIVE", 72, 786);
  context.font = "600 20px Arial";
  const shortName = dish.name.length > 60 ? `${dish.name.slice(0, 57)}…` : dish.name;
  context.fillText(shortName.toUpperCase(), 72, 826);
  return canvas.toDataURL("image/jpeg", 0.9);
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
        <a href={dish.source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          SEED: {dish.source.title} ↗
        </a>
        <button onClick={onSave}>{saved ? "★ ARCHIVED" : "☆ ARCHIVE"}</button>
      </div>
    </article>
  );
}

function DishModal({ dish, onClose, saved, onSave }: { dish: Dish; onClose: () => void; saved: boolean; onSave: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState("Consulting the forbidden pantry…");
  const [isDemo, setIsDemo] = useState(false);

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
      body: JSON.stringify({ prompt: dish.imagePrompt, name: dish.name }),
    })
      .then((response) => response.json())
      .then((data: { image?: string | null; demo?: boolean }) => {
        if (cancelled) return;
        setIsDemo(Boolean(data.demo));
        setImage(data.image || fallbackArtwork(dish));
      })
      .catch(() => {
        if (cancelled) return;
        setIsDemo(true);
        setImage(fallbackArtwork(dish));
      })
      .finally(() => window.clearInterval(interval));

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [dish]);

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
          {image ? <img src={image} alt={`Generated depiction of ${dish.name}`} /> : (
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
            {isDemo && <span> · House reconstruction; connect the image kitchen for AI art</span>}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [seed, setSeed] = useState(SEEDS[0]);
  const [items, setItems] = useState(() => makeFallbackMenu(SEEDS[0], 0));
  const [selected, setSelected] = useState<Dish | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [chefMode, setChefMode] = useState("HOUSE CHEF");
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const itemsLengthRef = useRef(items.length);

  useEffect(() => {
    try {
      setSaved(JSON.parse(window.localStorage.getItem("infinite-cheesecake-archive") || "[]"));
    } catch { /* private browsing is allowed */ }
  }, []);

  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);

  const loadMore = useCallback(async (activeSeed = seed, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const offset = reset ? 0 : itemsLengthRef.current;
    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: activeSeed, offset }),
      });
      if (!response.ok) throw new Error("The kitchen blinked");
      const data = (await response.json()) as { dishes: Dish[]; chef: string };
      setChefMode(data.chef === "local-llm" ? "ULTRAHORSE ONLINE" : data.chef === "openai" ? "AI CHEF ONLINE" : "HOUSE CHEF");
      setItems((current) => reset ? data.dishes : [...current, ...data.dishes]);
    } catch {
      const fallback = makeFallbackMenu(activeSeed, offset);
      setItems((current) => reset ? fallback : [...current, ...fallback]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [seed]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "700px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const reroll = () => {
    const next = SEEDS[(SEEDS.indexOf(seed) + 1 + Math.floor(Math.random() * (SEEDS.length - 1))) % SEEDS.length];
    setSeed(next);
    setItems(makeFallbackMenu(next, 0, 6, [...HOUSE_TOPICS].reverse()));
    itemsLengthRef.current = 6;
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => loadMore(next, true), 250);
  };

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
        <button className="archive-count" aria-label={`${saved.length} archived dishes`}>★ ARCHIVE <b>{String(saved.length).padStart(2, "0")}</b></button>
      </header>

      <section className="hero" id="top">
        <div className="hero__issue">MENU ISSUE № ∞ <span>EST. AFTER TIME ENDS</span></div>
        <h1>There is always<br /><em>one more thing</em><br />on the menu.</h1>
        <p className="hero__intro">An inexhaustible restaurant hallucination. Every dish begins with a stray fact from the world and ends somewhere considerably less responsible.</p>
        <div className="seed-console">
          <div><span>CURRENT COSMIC SEED</span><strong>“{seed}”</strong></div>
          <button onClick={reroll}>↻ CONFUSE THE CHEF</button>
        </div>
        <div className="scroll-notice"><span>SCROLL TO ORDER</span><i>↓</i></div>
        <div className="hero__stamp" aria-hidden="true"><b>OPEN</b><span>FOREVER</span></div>
      </section>

      <section className="menu-section" aria-label="Infinite menu">
        <div className="menu-heading">
          <span>TONIGHT’S INFINITE SPECIALS</span>
          <p>Prices subject to emotional availability</p>
        </div>
        <div className="menu-list">
          {items.map((dish, index) => (
            <DishCard key={dish.id} dish={dish} index={index} onOpen={() => setSelected(dish)} saved={saved.includes(dish.id)} onSave={() => toggleSave(dish.id)} />
          ))}
        </div>
        <div className="sentinel" ref={sentinel}>
          {loading ? <><span /><p>EXTENDING THE KITCHEN…</p></> : <p>THE MENU CONTINUES</p>}
        </div>
      </section>

      <footer>
        <span>∞ COURSES SERVED AND COUNTING</span>
        <p>No reservations. No substitutions. No discernible exit.</p>
      </footer>

      {selected && <DishModal dish={selected} onClose={() => setSelected(null)} saved={saved.includes(selected.id)} onSave={() => toggleSave(selected.id)} />}
    </main>
  );
}

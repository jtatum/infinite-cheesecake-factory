export type Dish = {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  warning: string;
  emoji: string;
  ingredients: string[];
  imagePrompt: string;
  source: {
    title: string;
    url: string;
  };
};

export type Topic = {
  title: string;
  extract?: string;
  url?: string;
};

export const HOUSE_TOPICS: Topic[] = [
  { title: "The observable universe" },
  { title: "Municipal bond" },
  { title: "Pigeon photography" },
  { title: "The 1904 Olympic marathon" },
  { title: "Abyssal plain" },
  { title: "Elevator music" },
  { title: "Bog butter" },
  { title: "The color of the sky" },
  { title: "Cargo cult science" },
  { title: "List of unusual deaths" },
  { title: "Moon rabbit" },
  { title: "Phantom time hypothesis" },
];

const forms = [
  "Basque Cheesecake",
  "Cheesecake Flight",
  "No-Bake Cheesecake",
  "Cheesecake Terrine",
  "Cheesecake for Two",
  "Upside-Down Cheesecake",
  "Cheesecake Soufflé",
  "Emergency Cheesecake",
];

const moods = [
  "Remorseful",
  "Government-Issued",
  "Moonlit",
  "Unreasonably Confident",
  "Historically Accurate",
  "Telepathic",
  "Load-Bearing",
  "Ceremonial",
  "Emotionally Waterproof",
  "Post-Human",
];

const sauces = [
  "a reduction of yesterday’s weather",
  "warm administrative caramel",
  "salted déjà vu",
  "a glossy little thunderstorm",
  "forbidden berry coulis",
  "room-temperature moonlight",
  "a jus of pure circumstance",
  "ethically sourced static",
];

const crusts = [
  "graham cracker gravel",
  "compressed fortune cookies",
  "toasted meeting minutes",
  "a suspiciously load-bearing biscuit",
  "crystallized voicemail",
  "archival shortbread",
  "crushed emergency exits",
  "buttered geological time",
];

const garnishes = [
  "one tiny flag with no known country",
  "a legally distinct cherry",
  "three obedient raspberries",
  "an edible footnote",
  "a single pearl of concern",
  "powdered inevitability",
  "a mint leaf that knows your password",
  "one ceremonial onion ring",
];

const prices = [
  "$17.99 + a secret",
  "3 memories",
  "½ moon",
  "$404.00",
  "market regret",
  "one sincere apology",
  "8¼ tokens",
  "free with consequences",
];

const warnings = [
  "May remember you later.",
  "Do not serve near a compass.",
  "Contains one unresolved subplot.",
  "Some assembly in a dream required.",
  "Not technically Tuesday-safe.",
  "Plate may continue without you.",
  "Extremely seasonal in another timeline.",
  "Management has been informed.",
];

const categories = ["CHEF’S ANOMALIES", "POWER LUNCH", "AFTERLIFE", "BRUNCH (PROVISIONAL)"];
const emojis = ["🍰", "🌒", "🫧", "🛰️", "🪼", "🗿", "🧿", "🦐", "🌋", "📎"];

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(list: T[], hash: number, step: number) {
  return list[(hash + step * 7919) % list.length];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function makeFallbackDish(topic: Topic, offset: number, seed: string): Dish {
  const hash = hashString(`${topic.title}:${seed}:${offset}`);
  const mood = pick(moods, hash, 1);
  const form = pick(forms, hash, 2);
  const sauce = pick(sauces, hash, 3);
  const crust = pick(crusts, hash, 4);
  const garnish = pick(garnishes, hash, 5);
  const topicPhrase = topic.title.replace(/^The /, "");
  const name = `${mood} ${topicPhrase} ${form}`;

  return {
    id: `${slug(topic.title)}-${offset}-${hash.toString(16)}`,
    name,
    description: `A dense, improbable cheesecake inspired by ${topicPhrase}, set on ${crust}, finished with ${sauce}, and accompanied by ${garnish}. Our chef insists the connection is obvious.`,
    price: pick(prices, hash, 6),
    category: pick(categories, hash, 7),
    warning: pick(warnings, hash, 8),
    emoji: pick(emojis, hash, 9),
    ingredients: [topicPhrase, crust, sauce, garnish],
    imagePrompt: `Surreal editorial food photograph of ${name}. ${crust}, ${sauce}, ${garnish}. Luxurious absurd restaurant plating, flash photography, no text, no logos.`,
    source: {
      title: topic.title,
      url: topic.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.title.replace(/ /g, "_"))}`,
    },
  };
}

export function makeFallbackMenu(seed: string, offset: number, count = 6, topics = HOUSE_TOPICS) {
  return Array.from({ length: count }, (_, index) =>
    makeFallbackDish(topics[(offset + index) % topics.length], offset + index, seed),
  );
}

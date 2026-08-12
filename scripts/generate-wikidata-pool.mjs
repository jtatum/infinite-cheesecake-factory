import { mkdir, writeFile } from "node:fs/promises";

const ENDPOINT = "https://query.wikidata.org/sparql";
const PER_FAMILY = 100;
const roots = {
  phenomena: ["Q1293220"],
  living: ["Q2996394", "Q2990593"],
  artifacts: ["Q39546", "Q3099911", "Q1882685", "Q987767", "Q834028"],
  materials: ["Q214609", "Q181790", "Q161179", "Q45621"],
  systems: ["Q132364"],
  techniques: ["Q2207288", "Q2695280", "Q11177771", "Q1408288", "Q271588", "Q10988986", "Q11795121", "Q173514", "Q16920758"],
  ideas: ["Q483372"],
  culture: ["Q189819"],
  food: ["Q25403900", "Q11795121", "Q16920758", "Q173514"],
  design: ["Q391414"],
};

function shuffle(rows, seedText) {
  let seed = [...seedText].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

async function queryClass(qid) {
  const query = `SELECT DISTINCT ?item ?article ?itemDescription WHERE {
    ?item wdt:P31 wd:${qid}; schema:description ?itemDescription.
    ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>.
    FILTER(lang(?itemDescription) = "en")
  } LIMIT 500`;
  const url = new URL(ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { "User-Agent": "InfiniteCheesecake/1.0 (local surreal menu game)" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Wikidata returned HTTP ${response.status} for ${qid}`);
  const data = await response.json();
  return data.results?.bindings || [];
}

function wikipediaTitle(articleUrl) {
  const slug = new URL(articleUrl).pathname.replace(/^\/wiki\//, "");
  return decodeURIComponent(slug).replace(/_/g, " ");
}

function acceptable(title, extract) {
  if (!title || !extract || /^(list|lists|index|outline|timeline|bibliography|discography)\b/i.test(title)) return false;
  if (/\b(born|died|living people|fictional character)\b/i.test(extract)) return false;
  if (/\b(massacre|murder|terrorist attack|bombing|fatal crash|genocide|war crime)\b/i.test(`${title} ${extract}`)) return false;
  const words = extract.trim().split(/\s+/).length;
  return words >= 3 && words <= 45;
}

async function main() {
  const all = [];
  const globalTitles = new Set();
  for (const [family, qids] of Object.entries(roots)) {
    const candidates = [];
    for (const qid of qids) candidates.push(...await queryClass(qid));
    const signatures = new Map();
    const chosen = [];
    for (const binding of shuffle(candidates, `infinite-cheesecake-${family}`)) {
      const url = binding.article?.value;
      const extract = binding.itemDescription?.value?.trim();
      if (!url || !extract) continue;
      const title = wikipediaTitle(url);
      const titleKey = title.toLowerCase();
      if (!acceptable(title, extract) || globalTitles.has(titleKey)) continue;
      const signature = extract.toLowerCase().replace(/\b\d{3,4}\b/g, "#").trim();
      if ((signatures.get(signature) || 0) >= 3) continue;
      signatures.set(signature, (signatures.get(signature) || 0) + 1);
      globalTitles.add(titleKey);
      chosen.push({ title, extract, url, family });
      if (chosen.length === PER_FAMILY) break;
    }
    if (chosen.length !== PER_FAMILY) throw new Error(`${family} produced only ${chosen.length}/${PER_FAMILY} subjects from ${candidates.length} bindings`);
    all.push(...chosen);
    console.log(`${family}: ${chosen.length} selected from ${candidates.length} bindings`);
  }
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(new URL("../data/wikipedia-subjects.json", import.meta.url), `${JSON.stringify(all, null, 2)}\n`);
  console.log(`Baked exactly ${all.length} stratified subjects.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { mkdir, writeFile } from "node:fs/promises";

const API = "https://en.wikipedia.org/w/api.php";
const headers = { "User-Agent": "InfiniteCheesecake/1.0 (local surreal menu game)" };
const perFamily = 100;

const families = {
  phenomena: ["Physical phenomena", "Optical phenomena", "Acoustic phenomena", "Weather phenomena", "Geological processes", "Fluid dynamics", "Wave mechanics"],
  living: ["Animal behavior", "Plant morphology", "Symbiosis", "Mimicry", "Bioluminescence", "Extremophiles", "Collective animal behavior"],
  artifacts: ["Scientific instruments", "Mechanical devices", "Optical devices", "Hand tools", "Containers", "Toys", "Laboratory equipment"],
  materials: ["Materials", "Pigments", "Composite materials", "Ceramic materials", "Polymers", "Foams", "Gels", "Glass types"],
  systems: ["Systems theory", "Control theory", "Communication", "Computer networks", "Measurement", "Classification systems", "Information theory", "Protocols"],
  techniques: ["Crafts", "Cooking techniques", "Textile arts", "Printmaking", "Metalworking", "Woodworking", "Food preservation", "Manufacturing processes"],
  ideas: ["Paradoxes", "Cognitive biases", "Thought experiments", "Mathematical objects", "Scientific theories", "Philosophical concepts", "Effects", "Hypotheses"],
  culture: ["Folklore", "Mythological objects", "Divination", "Rituals", "Traditional games", "Storytelling", "Aesthetics", "Performance art"],
  food: ["Culinary terminology", "Cooking techniques", "Fermentation in food processing", "Food preservation", "Food ingredients", "Food science", "Food textures", "Condiments"],
  design: ["Architectural elements", "Furniture", "Ornaments", "Patterns", "Decorative arts", "Interior design", "Landscape design", "Design"],
};

const tragedy = /\b(massacre|murder|terrorist attack|bombing|fatal crash|disaster|genocide|war crime)\b/i;
const routine = /\b(season|team|club|competition|tournament|championship|league|play-?offs?|election|constituency)\b/i;
const humanType = /^(?:[\w-]+(?:ian|ese|ish|ic|i|an)\s+)?(?:academic|actor|actress|activist|architect|artist|athlete|author|bishop|boxer|business(?:man|woman)|chemist|coach|comedian|composer|cyclist|director|diplomat|educator|engineer|explorer|filmmaker|footballer|historian|journalist|judge|lawyer|mathematician|military officer|monarch|musician|nobleman|painter|philosopher|physician|player|poet|politician|priest|professor|racer|researcher|scholar|scientist|sculptor|singer|sociologist|soldier|statesman|theologian|wrestler|writer)\b/i;
const placeType = /^(?:village|town|city|municipality|commune|census-designated place|human settlement|locality|district|borough|county|province|canton|island|river|mountain|glacier|airport|railway station|road|highway|historic place|state park|shopping mall|school|museum)\s+(?:in|of|on|near)\b/i;
const sludgeType = /^(?:company|corporation|government department|political party|radio station|television station|military unit|local authority|sports governing body|brand)\b/i;

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

async function api(params, retries = 7) {
  const query = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params });
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${API}?${query}`, { headers, signal: AbortSignal.timeout(30000) });
      if (response.ok) {
        const data = await response.json();
        await new Promise((resolve) => setTimeout(resolve, 180));
        return data;
      }
      if (attempt === retries - 1) throw new Error(`Wikipedia returned HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter, 1800 * 2 ** attempt)));
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1800 * 2 ** attempt));
    }
  }
}

async function categoryMembers(category) {
  const data = await api({ list: "categorymembers", cmtitle: `Category:${category}`, cmnamespace: "0", cmtype: "page", cmlimit: "500" });
  return data.query?.categorymembers || [];
}

async function hydrate(pages) {
  const output = [];
  for (let offset = 0; offset < pages.length; offset += 50) {
    const batch = pages.slice(offset, offset + 50);
    const data = await api({
      pageids: batch.map((page) => page.pageid).join("|"),
      prop: "description|pageprops",
      ppprop: "disambiguation|wikibase_item",
    });
    output.push(...(data.query?.pages || []));
  }
  return output;
}

function acceptable(page) {
  const title = page.title || "";
  const description = page.description || "";
  if (!title || !description || page.pageprops?.disambiguation !== undefined) return false;
  if (/^(list|lists|index|outline|timeline|bibliography|discography)\b/i.test(title) || /^\d{1,4}(?: BC| AD)?$/i.test(title)) return false;
  if (/\b(born|died|living people|fictional character)\b/i.test(description) || humanType.test(description)) return false;
  if (placeType.test(description) || sludgeType.test(description) || tragedy.test(`${title} ${description}`)) return false;
  if (routine.test(description) && /\b(sport|football|soccer|baseball|basketball|cricket|rugby|tennis|hockey|election)\b/i.test(`${title} ${description}`)) return false;
  return true;
}

function chooseFamily(pages, family) {
  const signatures = new Map();
  const chosen = [];
  for (const page of shuffle(pages.filter(acceptable), `infinite-cheesecake-${family}`)) {
    const signature = (page.description || "").toLowerCase().replace(/\b\d{3,4}\b/g, "#").replace(/\([^)]*\)/g, "").trim();
    const count = signatures.get(signature) || 0;
    if (count >= 3) continue;
    signatures.set(signature, count + 1);
    chosen.push({
      title: page.title,
      extract: page.description.replace(/\s+/g, " ").slice(0, 240),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      family,
    });
    if (chosen.length === perFamily) break;
  }
  if (chosen.length < perFamily) throw new Error(`${family} produced only ${chosen.length}/${perFamily} usable subjects`);
  return chosen;
}

async function buildFamily(family, roots) {
  const candidates = new Map();
  for (const root of roots) {
    const members = await categoryMembers(root);
    for (const page of shuffle(members, `${family}-${root}`).slice(0, 170)) candidates.set(page.pageid, page);
  }
  const hydrated = await hydrate([...candidates.values()]);
  const chosen = chooseFamily(hydrated, family);
  console.log(`${family}: ${chosen.length} selected from ${hydrated.length} candidates`);
  return chosen;
}

async function main() {
  const requested = process.argv.find((arg) => arg.startsWith("--families="))?.split("=")[1]?.split(",") || Object.keys(families);
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.split("=")[1];
  const result = [];
  for (const family of requested) {
    if (!families[family]) throw new Error(`Unknown family: ${family}`);
    result.push(...await buildFamily(family, families[family]));
  }
  const output = outputArg ? new URL(`../${outputArg}`, import.meta.url) : new URL("../data/wikipedia-subjects.json", import.meta.url);
  await mkdir(new URL("./", output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Baked ${result.length} stratified Wikipedia subjects to ${output.pathname}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

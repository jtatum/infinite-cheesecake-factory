import { readFile } from "node:fs/promises";

const path = process.argv[2] || new URL("../data/wikipedia-subjects.json", import.meta.url);
const rows = JSON.parse(await readFile(path, "utf8"));
const errors = [];
const expectedFamilies = ["phenomena", "living", "artifacts", "materials", "systems", "techniques", "ideas", "culture", "food", "design"];

if (!Array.isArray(rows) || rows.length !== 1000) errors.push(`Expected exactly 1000 rows; found ${rows?.length ?? "non-array"}.`);
const titles = new Set();
const urls = new Set();
const familyCounts = new Map();
for (const [index, row] of rows.entries()) {
  for (const field of ["title", "extract", "url", "family"]) {
    if (typeof row[field] !== "string" || !row[field].trim()) errors.push(`Row ${index + 1} has invalid ${field}.`);
  }
  const titleKey = row.title?.trim().toLowerCase();
  if (titles.has(titleKey)) errors.push(`Duplicate title: ${row.title}`);
  titles.add(titleKey);
  if (urls.has(row.url)) errors.push(`Duplicate URL: ${row.url}`);
  urls.add(row.url);
  familyCounts.set(row.family, (familyCounts.get(row.family) || 0) + 1);
  const words = row.extract?.trim().split(/\s+/).length || 0;
  if (words < 2 || words > 50) errors.push(`Bad extract length (${words}) for ${row.title}.`);
  if (/^(list|lists|index|outline|timeline|bibliography|discography)\b/i.test(row.title)) errors.push(`Sludge title: ${row.title}`);
  if (/\b(born|died|living people|fictional character)\b/i.test(row.extract)) errors.push(`Likely human/character: ${row.title}`);
  if (/^(?:village|town|city|municipality|commune|census-designated place|human settlement|locality|district|borough|county|province|canton|island|river|mountain|glacier|airport|railway station)\s+(?:in|of|on|near)\b/i.test(row.extract)) errors.push(`Likely place: ${row.title}`);
  if (/\b(massacre|murder|terrorist attack|bombing|fatal crash|genocide|war crime)\b/i.test(`${row.title} ${row.extract}`)) errors.push(`Bad-tone subject: ${row.title}`);
}
for (const family of expectedFamilies) {
  if (familyCounts.get(family) !== 100) errors.push(`Family ${family} has ${familyCounts.get(family) || 0}, expected 100.`);
}
if (familyCounts.size !== expectedFamilies.length) errors.push(`Expected ${expectedFamilies.length} families; found ${familyCounts.size}.`);

console.log(JSON.stringify({ rows: rows.length, uniqueTitles: titles.size, uniqueUrls: urls.size, families: Object.fromEntries([...familyCounts].sort()), errors: errors.length }, null, 2));
if (errors.length) {
  console.error(errors.slice(0, 100).join("\n"));
  process.exitCode = 1;
}

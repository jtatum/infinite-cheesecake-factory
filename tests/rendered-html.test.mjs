import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Infinite Cheesecake Factory", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>The Infinite Cheesecake Factory<\/title>/i);
  assert.match(html, /THE INFINITE/);
  assert.match(html, /CHEESECAKE FACTORY/);
  assert.match(html, /There is always/);
  assert.match(html, /CURRENT MENU THEME/);
  assert.match(html, /5 DISHES AT A TIME/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps credentials server-side and ships the baked corpus", async () => {
  const [page, menuRoute, imageRoute, envExample, corpus] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/menu/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/image/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../data/wikipedia-subjects.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /GEMINI_API_KEY|RUNWARE_API_KEY/);
  assert.match(menuRoute, /process\.env\.GEMINI_API_KEY/);
  assert.match(imageRoute, /process\.env\.RUNWARE_API_KEY/);
  assert.match(envExample, /GEMINI_MODEL=gemini-3\.1-flash-lite/);
  assert.equal(JSON.parse(corpus).length, 1000);
});

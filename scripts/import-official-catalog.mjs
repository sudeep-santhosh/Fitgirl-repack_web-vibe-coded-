import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://fitgirl-repacks.site/all-my-repacks-a-z/";
const outPath = path.resolve("data/catalog-index.json");
const maxPagesArg = process.argv.find((arg) => arg.startsWith("--pages="));
const maxPages = maxPagesArg ? Number(maxPagesArg.split("=")[1]) : 136;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeEntities(value) {
  return value
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function pageUrl(page) {
  return page === 1 ? baseUrl : `${baseUrl}?lcp_page0=${page}`;
}

function extractEntries(html) {
  const mainStart = html.indexOf("All My Repacks, A-Z");
  const mainEnd = html.indexOf("Leave a Reply", mainStart);
  const chunk = html.slice(mainStart, mainEnd > -1 ? mainEnd : undefined);
  const matches = [...chunk.matchAll(/<li>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/li>/g)];

  return matches
    .map((match) => ({
      title: decodeEntities(match[2]),
      url: match[1],
    }))
    .filter((entry) => entry.url.startsWith("https://fitgirl-repacks.site/"))
    .filter((entry) => !/^\d+$/.test(entry.title) && entry.title !== "Next Page");
}

const seen = new Map();

for (let page = 1; page <= maxPages; page += 1) {
  const url = pageUrl(page);
  console.log(`Fetching ${url}`);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 FitGirl catalog discovery prototype",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed ${url}: ${response.status}`);
  }

  const html = await response.text();
  const entries = extractEntries(html);

  for (const entry of entries) {
    seen.set(entry.url, {
      id: entry.url.replace("https://fitgirl-repacks.site/", "").replace(/\/$/, ""),
      title: entry.title,
      url: entry.url,
    });
  }

  await sleep(120);
}

const catalog = [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(
  outPath,
  `${JSON.stringify(
    {
      source: baseUrl,
      generatedAt: new Date().toISOString(),
      count: catalog.length,
      games: catalog,
    },
    null,
    2,
  )}\n`,
);

console.log(`Saved ${catalog.length} official catalog entries to ${outPath}`);

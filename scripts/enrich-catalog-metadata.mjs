import fs from "node:fs/promises";
import path from "node:path";

const dataDir = "data";
const catalogPath = path.join(dataDir, "catalog-index.json");
const manualTagsPath = path.join(dataDir, "catalog-tags.json");
const fitgirlCachePath = path.join(dataDir, "catalog-metadata-cache.json");
const steamCachePath = path.join(dataDir, "steam-cache.json");
const outputPath = path.join(dataDir, "catalog-enriched.json");

const strictGenres = ["Action", "Adventure", "RPG", "Strategy", "Simulation", "Puzzle", "Horror"];
const strictGenreSet = new Set(strictGenres);
const args = new Set(process.argv.slice(2));
const getArg = (name, fallback = "") => {
  const item = [...args].find((arg) => arg.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : fallback;
};

const options = {
  force: args.has("--force"),
  offline: args.has("--offline"),
  noFitgirlFetch: args.has("--no-fitgirl-fetch"),
  limit: Number(getArg("--limit", "0")),
  delay: Number(getArg("--delay", "350")),
};

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*(?:build|bonus|dlc|edition|windows|fix|multi|crack|update|ost)[^)]*\)/gi, " ")
    .replace(/\b(v|build)\s*[\d.]+[a-z0-9.-]*/gi, " ")
    .replace(/\b(deluxe|ultimate|complete|premium|definitive|gold|goty|collector'?s?|supporter)\s+edition\b/gi, " ")
    .replace(/\b(all\s+)?dlcs?\b/gi, " ")
    .replace(/\bbonus\b|\bcontent\b|\bost\b|\bwindows\s*\d+\s*fix\b/gi, " ")
    .replace(/[+*_:/|()[\],.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tokens(value) {
  return normalizeTitle(value).split(/\s+/).filter((token) => token.length > 1);
}

function scoreTitleMatch(query, candidate) {
  const q = tokens(query);
  const c = tokens(candidate);
  if (!q.length || !c.length) return 0;
  const cSet = new Set(c);
  const hits = q.filter((token) => cSet.has(token)).length;
  const coverage = hits / q.length;
  const exact = normalizeTitle(query) === normalizeTitle(candidate) ? 1 : 0;
  const prefix = normalizeTitle(candidate).startsWith(normalizeTitle(query)) ? 0.2 : 0;
  return coverage + exact + prefix - Math.abs(c.length - q.length) * 0.03;
}

function normalizeGenre(value) {
  const slug = slugify(value);
  const map = new Map([
    ["action", "Action"],
    ["adventure", "Adventure"],
    ["rpg", "RPG"],
    ["role-playing", "RPG"],
    ["role-playing-game", "RPG"],
    ["strategy", "Strategy"],
    ["simulation", "Simulation"],
    ["sim", "Simulation"],
    ["puzzle", "Puzzle"],
    ["horror", "Horror"],
  ]);
  return map.get(slug) || "";
}

function normalizeTag(value) {
  const slug = slugify(value);
  const map = new Map([
    ["open-world", "Open World"],
    ["openworld", "Open World"],
    ["survival", "Survival"],
    ["co-op", "Co-op"],
    ["coop", "Co-op"],
    ["cooperative", "Co-op"],
    ["multi-player", "Multiplayer"],
    ["multiplayer", "Multiplayer"],
    ["online-pvp", "Online PvP"],
    ["pvp", "Online PvP"],
    ["first-person", "First-Person"],
    ["first-person-shooter", "First-Person"],
    ["fps", "First-Person"],
    ["third-person", "Third-Person"],
    ["third-person-shooter", "Third-Person"],
    ["story-rich", "Story Rich"],
    ["souls-like", "Soulslike"],
    ["soulslike", "Soulslike"],
    ["sandbox", "Sandbox"],
    ["roguelike", "Roguelike"],
    ["roguelite", "Roguelike"],
    ["metroidvania", "Metroidvania"],
    ["tactical", "Tactical"],
    ["isometric", "Isometric"],
    ["top-down", "Top Down"],
    ["cyberpunk", "Cyberpunk"],
    ["zombies", "Zombies"],
    ["zombie", "Zombies"],
    ["space", "Space"],
    ["fantasy", "Fantasy"],
    ["historical", "Historical"],
    ["military", "Military"],
    ["post-apocalyptic", "Post-Apocalyptic"],
    ["single-player", "Singleplayer"],
    ["singleplayer", "Singleplayer"],
    ["pc", "PC"],
    ["steam-deck", "Steam Deck"],
  ]);
  if (map.has(slug)) return map.get(slug);
  return value
    ? String(value)
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    : "";
}

function addNormalized(target, values, type) {
  for (const value of values || []) {
    const normalized = type === "genre" ? normalizeGenre(value) : normalizeTag(value);
    if (normalized) target.add(normalized);
  }
}

function addSourceGenres(genreTarget, tagTarget, values) {
  for (const value of values || []) {
    const genre = normalizeGenre(value);
    if (genre) genreTarget.add(genre);
    else {
      const tag = normalizeTag(value);
      if (tag) tagTarget.add(tag);
    }
  }
}

function inferFromKeywords(entry) {
  const text = `${entry.title} ${entry.id}`.toLowerCase();
  const genres = new Set();
  const tags = new Set();
  const has = (...words) => words.some((word) => text.includes(word));

  if (has("resident-evil", "silent-hill", "outlast", "amnesia", "horror", "demonologist")) genres.add("Horror");
  if (has("civilization", "total-war", "xcom", "strategy", "tactics", "sudden-strike")) genres.add("Strategy");
  if (has("simulator", "simulation", "cities-skylines", "planet-coaster", "jurassic-world-evolution")) genres.add("Simulation");
  if (has("puzzle", "portal", "witness", "talos")) genres.add("Puzzle");
  if (has("rpg", "elden-ring", "baldur", "dragon-s-dogma", "cyberpunk", "witcher", "fallout", "coromon")) genres.add("RPG");
  if (has("action", "far-cry", "assassin", "gta", "grand-theft-auto", "devil-may-cry")) genres.add("Action");
  if (!genres.size) genres.add("Adventure");

  if (has("open-world", "grand-theft-auto", "gta", "far-cry", "forza-horizon", "elden-ring", "cyberpunk", "assassin-s-creed")) tags.add("Open World");
  if (has("survival", "subnautica", "forest")) tags.add("Survival");
  if (has("co-op", "coop")) tags.add("Co-op");
  if (has("multiplayer", "online")) tags.add("Multiplayer");
  if (has("far-cry", "cyberpunk", "call-of-duty", "battlefield", "fps")) tags.add("First-Person");
  if (has("gta", "grand-theft-auto", "elden-ring", "assassin-s-creed")) tags.add("Third-Person");
  if (has("story-rich", "telltale", "life-is-strange")) tags.add("Story Rich");
  if (has("cyberpunk")) tags.add("Cyberpunk");
  if (has("zombie", "resident-evil", "dying-light")) tags.add("Zombies");
  if (has("space", "starfield", "mass-effect")) tags.add("Space");
  if (has("elden-ring", "dragon-s-dogma", "baldur", "fantasy")) tags.add("Fantasy");
  if (has("valhalla", "historical")) tags.add("Historical");
  if (has("far-cry", "battlefield", "call-of-duty")) tags.add("Military");

  return { genres, tags };
}

async function steamSearch(normalizedTitle, steamCache) {
  const cacheKey = `search:${normalizedTitle}`;
  if (steamCache[cacheKey]) return steamCache[cacheKey];
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(normalizedTitle)}&cc=us&l=en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Steam search failed: ${response.status}`);
  const data = await response.json();
  const items = (data.items || []).filter((item) => item.type === "app");
  const best = items
    .map((item) => ({ item, score: scoreTitleMatch(normalizedTitle, item.name) }))
    .sort((a, b) => b.score - a.score)[0];
  const result = best && best.score >= 0.62 ? { appid: best.item.id, name: best.item.name, score: best.score } : null;
  steamCache[cacheKey] = result;
  return result;
}

async function steamDetails(appid, steamCache) {
  const cacheKey = `app:${appid}`;
  if (steamCache[cacheKey]) return steamCache[cacheKey];
  const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en`;
  const response = await fetch(detailsUrl);
  if (!response.ok) throw new Error(`Steam details failed: ${response.status}`);
  const data = await response.json();
  const details = data[String(appid)]?.data;
  if (!details) return null;

  let storeTags = [];
  try {
    const pageResponse = await fetch(`https://store.steampowered.com/app/${appid}/?l=en`);
    const html = await pageResponse.text();
    storeTags = [...html.matchAll(/<a[^>]+class="app_tag[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((match) => decodeEntities(match[1]))
      .filter(Boolean)
      .slice(0, 24);
  } catch {
    storeTags = [];
  }

  const result = {
    appid,
    name: details.name,
    genres: (details.genres || []).map((genre) => genre.description),
    tags: [
      ...storeTags,
      ...(details.categories || []).map((category) => category.description),
    ],
  };
  steamCache[cacheKey] = result;
  return result;
}

function fitgirlCachedMetadata(entry, fitgirlCache) {
  const metadata = fitgirlCache[entry.url];
  if (!metadata) return { genres: [], tags: [] };
  return {
    genres: [],
    tags: metadata.tags || [],
  };
}

async function fitgirlFetchMetadata(entry, fitgirlCache) {
  if (fitgirlCache[entry.url]) return fitgirlCachedMetadata(entry, fitgirlCache);
  if (options.noFitgirlFetch || options.offline) return { genres: [], tags: [] };
  const response = await fetch(entry.url, {
    headers: { "user-agent": "Mozilla/5.0 FitGirl catalog enrichment" },
  });
  if (!response.ok) return { genres: [], tags: [] };
  const html = await response.text();
  const genreLine = html.match(/Genres\/Tags:\s*([\s\S]*?)(?:Companies:|Languages:|Original Size:)/i)?.[1] || "";
  const tags = [...genreLine.matchAll(/>([^<>]+)<\/a>/g)].map((match) => decodeEntities(match[1]));
  fitgirlCache[entry.url] = {
    ...(fitgirlCache[entry.url] || {}),
    tags,
    enrichedAt: new Date().toISOString(),
  };
  return { genres: [], tags };
}

function manualOverride(entry, manualTags) {
  const tags = manualTags[entry.id] || {};
  return {
    genres: tags.genre || [],
    tags: [
      ...(tags.subgenre || []),
      ...(tags.perspective || []),
      ...(tags.mode || []),
      ...(tags.theme || []),
      ...(tags.platform || []),
    ],
  };
}

async function enrichEntry(entry, caches) {
  const normalizedTitle = normalizeTitle(entry.title);
  const genres = new Set();
  const tags = new Set();
  const sources = [];
  let steamAppId = null;
  let steamName = "";

  if (!options.offline) {
    try {
      const match = await steamSearch(normalizedTitle, caches.steam);
      if (match?.appid) {
        const details = await steamDetails(match.appid, caches.steam);
        if (details) {
          steamAppId = details.appid;
          steamName = details.name;
          addSourceGenres(genres, tags, details.genres);
          addNormalized(tags, details.tags, "tag");
          sources.push("steam");
        }
      }
    } catch (error) {
      caches.steam[`error:${normalizedTitle}`] = { message: error.message, at: new Date().toISOString() };
    }
  }

  if (!genres.size) {
    const fitgirl = await fitgirlFetchMetadata(entry, caches.fitgirl);
    addSourceGenres(genres, tags, fitgirl.genres);
    addNormalized(tags, fitgirl.tags, "tag");
    if (fitgirl.tags.length) sources.push("fitgirl");
  }

  const manual = manualOverride(entry, caches.manualTags);
  addSourceGenres(genres, tags, manual.genres);
  addNormalized(tags, manual.tags, "tag");
  if (manual.genres.length || manual.tags.length) sources.push("manual");

  if (!genres.size) {
    const inferred = inferFromKeywords(entry);
    inferred.genres.forEach((genre) => genres.add(genre));
    inferred.tags.forEach((tag) => tags.add(tag));
    sources.push("keyword");
  } else {
    const inferred = inferFromKeywords(entry);
    inferred.tags.forEach((tag) => tags.add(tag));
  }

  const normalizedGenres = [...genres].filter((genre) => strictGenreSet.has(genre));
  return {
    id: entry.id,
    title: entry.title,
    normalizedTitle,
    url: entry.url,
    genres: normalizedGenres.length ? normalizedGenres : ["Adventure"],
    tags: [...tags].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    steamAppId,
    steamName,
    sources: [...new Set(sources)],
  };
}

const catalog = await readJson(catalogPath, { games: [] });
const existingOutput = await readJson(outputPath, { games: [] });
const existingMap = new Map((existingOutput.games || []).map((game) => [game.id, game]));
const caches = {
  manualTags: await readJson(manualTagsPath, {}),
  fitgirl: await readJson(fitgirlCachePath, {}),
  steam: await readJson(steamCachePath, {}),
};

const entries = options.limit ? catalog.games.slice(0, options.limit) : catalog.games;
let processed = 0;

for (const entry of entries) {
  if (!options.force && existingMap.has(entry.id)) continue;
  const enriched = await enrichEntry(entry, caches);
  existingMap.set(entry.id, enriched);
  processed += 1;
  if (processed % 25 === 0) {
    await writeJson(steamCachePath, caches.steam);
    await writeJson(fitgirlCachePath, caches.fitgirl);
    await writeJson(outputPath, {
      source: catalog.source,
      generatedAt: new Date().toISOString(),
      count: existingMap.size,
      games: [...existingMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
    });
    console.log(`Processed ${processed} entries`);
  }
  if (!options.offline) await sleep(options.delay);
}

await writeJson(steamCachePath, caches.steam);
await writeJson(fitgirlCachePath, caches.fitgirl);
await writeJson(outputPath, {
  source: catalog.source,
  generatedAt: new Date().toISOString(),
  count: existingMap.size,
  games: [...existingMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
});

console.log(`Enriched ${processed} entries. Total indexed entries: ${existingMap.size}`);

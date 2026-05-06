const officialSource = "https://fitgirl-repacks.site/";
const pageSize = 48;

let catalog = [];
let richGames = [];
let catalogTags = {};
let catalogMetadata = {};
const pendingMetadata = new Set();
let page = 1;

const params = new URLSearchParams(window.location.search);
const filterLabels = new Map([
  ["action", "Action"],
  ["rpg", "RPG"],
  ["racing", "Racing"],
  ["horror", "Horror"],
  ["strategy", "Strategy"],
  ["simulation", "Simulation"],
  ["survival", "Survival"],
  ["open-world", "Open World"],
  ["soulslike", "Soulslike"],
  ["sandbox", "Sandbox"],
  ["tactical", "Tactical"],
  ["roguelike", "Roguelike"],
  ["metroidvania", "Metroidvania"],
  ["first-person", "First Person"],
  ["third-person", "Third Person"],
  ["isometric", "Isometric"],
  ["top-down", "Top Down"],
  ["singleplayer", "Singleplayer"],
  ["multiplayer", "Multiplayer"],
  ["co-op", "Co-op"],
  ["online-pvp", "Online PvP"],
  ["fantasy", "Fantasy"],
  ["zombies", "Zombies"],
  ["space", "Space"],
  ["cyberpunk", "Cyberpunk"],
  ["historical", "Historical"],
  ["military", "Military"],
  ["post-apocalyptic", "Post-Apocalyptic"],
]);

const els = {
  search: document.querySelector("#catalogSearch"),
  genre: document.querySelector("#genreFilter"),
  system: document.querySelector("#systemFilter"),
  richOnly: document.querySelector("#richOnly"),
  sort: document.querySelector("#catalogSort"),
  results: document.querySelector("#catalogResults"),
  count: document.querySelector("#catalogResultCount"),
  pageLabel: document.querySelector("#pageLabel"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  filterToggle: document.querySelector("#filterToggle"),
  sidebar: document.querySelector("#catalogSidebar"),
  drawer: document.querySelector("#quickDrawer"),
  drawerContent: document.querySelector("#drawerContent"),
  drawerScrim: document.querySelector(".drawer-scrim"),
};

function formatDate(value) {
  if (!value) return "Official source";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function compressionRatio(game) {
  return Math.round((1 - game.repackSize / game.originalSize) * 100);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeFilterValue(value) {
  const slug = slugify(value || "");
  return filterLabels.has(slug) ? slug : "";
}

function searchableTags(game, entry) {
  const metadata = catalogMetadata[entry?.url] || {};
  const structuredTags = game?.tags || catalogTags[entry?.id] || inferTags(entry, metadata);
  return [
    ...(game?.genres || []),
    game?.mode,
    ...(game?.systems || []),
    ...(metadata.tags || []),
    ...(structuredTags.genre || []),
    ...(structuredTags.subgenre || []),
    ...(structuredTags.perspective || []),
    ...(structuredTags.mode || []),
    ...(structuredTags.theme || []),
    ...(structuredTags.platform || []),
  ]
    .filter(Boolean)
    .map(slugify);
}

function inferTags(entry, metadata = {}) {
  const text = `${entry?.title || ""} ${entry?.id || ""} ${(metadata.tags || []).join(" ")}`.toLowerCase();
  const includesAny = (words) => words.some((word) => text.includes(word));
  const tags = {
    genre: [],
    subgenre: [],
    perspective: [],
    mode: [],
    theme: [],
    platform: ["PC"],
  };

  if (includesAny(["racing", "forza", "need-for-speed", "nfs", "motogp", "f1-", "wrc", "grid"])) tags.genre.push("Racing");
  if (includesAny(["rpg", "elden-ring", "cyberpunk", "dragon-s-dogma", "baldur", "coromon"])) tags.genre.push("RPG");
  if (includesAny(["horror", "resident-evil", "silent-hill", "demonologist", "outlast", "amnesia"])) tags.genre.push("Horror");
  if (includesAny(["strategy", "civilization", "total-war", "sudden-strike", "xcom"])) tags.genre.push("Strategy");
  if (includesAny(["simulator", "simulation", "jurassic-world-evolution", "cities-skylines"])) tags.genre.push("Simulation");
  if (includesAny(["survival", "survivors", "forest", "subnautica"])) tags.genre.push("Survival");
  if (!tags.genre.length && includesAny(["action", "assassin", "far-cry", "gta", "grand-theft-auto"])) tags.genre.push("Action");

  if (includesAny(["open-world", "open world", "gta", "grand-theft-auto", "far-cry", "forza-horizon", "elden-ring", "cyberpunk", "assassin-s-creed"])) {
    tags.subgenre.push("Open World");
  }
  if (includesAny(["soulslike", "elden-ring", "dark-souls", "lies-of-p"])) tags.subgenre.push("Soulslike");
  if (includesAny(["sandbox", "minecraft", "terraria", "pacha", "evolution"])) tags.subgenre.push("Sandbox");
  if (includesAny(["roguelike", "roguelite", "survivors"])) tags.subgenre.push("Roguelike");
  if (includesAny(["metroidvania"])) tags.subgenre.push("Metroidvania");
  if (includesAny(["tactical", "xcom", "tactics"])) tags.subgenre.push("Tactical");

  if (includesAny(["first-person", "first person", "far-cry", "cyberpunk", "forza", "need-for-speed"])) tags.perspective.push("First Person");
  if (includesAny(["third-person", "third person", "gta", "elden-ring", "assassin", "forza", "need-for-speed"])) tags.perspective.push("Third Person");
  if (includesAny(["isometric", "diablo", "baldur"])) tags.perspective.push("Isometric");
  if (includesAny(["top-down", "top down", "survivors", "coromon"])) tags.perspective.push("Top Down");

  tags.mode.push("Singleplayer");
  if (includesAny(["multiplayer", "online", "pvp", "forza", "grid", "gta"])) tags.mode.push("Multiplayer", "Online PvP");
  if (includesAny(["co-op", "coop", "demonologist", "far-cry"])) tags.mode.push("Co-op");

  if (includesAny(["cyberpunk"])) tags.theme.push("Cyberpunk");
  if (includesAny(["zombie", "resident-evil", "dead-rising", "dying-light"])) tags.theme.push("Zombies");
  if (includesAny(["space", "starfield", "mass-effect"])) tags.theme.push("Space");
  if (includesAny(["fantasy", "elden-ring", "dragon-s-dogma", "baldur", "coromon"])) tags.theme.push("Fantasy");
  if (includesAny(["historical", "valhalla", "assassin-s-creed"])) tags.theme.push("Historical");
  if (includesAny(["military", "far-cry", "call-of-duty", "battlefield"])) tags.theme.push("Military");
  if (includesAny(["post-apocalyptic", "fallout", "metro"])) tags.theme.push("Post-Apocalyptic");

  return Object.fromEntries(Object.entries(tags).map(([key, values]) => [key, [...new Set(values)]]));
}

function richByUrl(entry) {
  return richGames.find((game) => game.sourcePath === entry.url);
}

function displayTags(entry, rich) {
  const metadata = catalogMetadata[entry.url];
  const structured = rich?.tags || catalogTags[entry.id] || inferTags(entry, metadata);
  const tags = [
    ...(rich?.genres || []),
    ...(metadata?.tags || []),
    ...(structured.genre || []),
    ...(structured.subgenre || []),
    ...(structured.perspective || []),
  ];
  return [...new Set(tags)].slice(0, 4);
}

function filteredEntries() {
  const query = els.search.value.trim().toLowerCase();
  const selectedGenre = els.genre.value;
  let items = catalog.filter((entry) => {
    const rich = richByUrl(entry);
    if (els.richOnly.checked && !rich) return false;
    if (query && !`${entry.title} ${entry.id}`.toLowerCase().includes(query)) return false;
    if (selectedGenre && !searchableTags(rich, entry).includes(selectedGenre)) return false;
    if (els.system.value && !rich?.systems.includes(els.system.value)) return false;
    return true;
  });

  if (els.sort.value === "titleDesc") items = items.sort((a, b) => b.title.localeCompare(a.title));
  else if (els.sort.value === "updated") {
    items = items.sort((a, b) => {
      const aRich = richByUrl(a);
      const bRich = richByUrl(b);
      return new Date(bRich?.updated || 0) - new Date(aRich?.updated || 0);
    });
  } else items = items.sort((a, b) => a.title.localeCompare(b.title));

  return items;
}

function richCard(entry, rich) {
  return `
    <article class="game-card" data-game="${rich.title}">
      <div class="poster">
        <img src="${rich.image}" alt="${rich.title} cover" loading="lazy" />
        <span class="poster-title">${rich.title}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${rich.title}</h3>
        <div class="tag-list">${rich.genres.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        <div class="size-row"><span>${formatDate(rich.updated)}</span><strong>${rich.repackSize} GB</strong></div>
        <button class="details-button" type="button" data-game="${rich.title}">Quick Preview</button>
      </div>
    </article>
  `;
}

function generatedCover(entry) {
  const letters = entry.title
    .replace(/[^a-z0-9\s]/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return `
    <div class="generated-cover">
      <span class="generated-logo">FG</span>
      <strong>${letters || "FG"}</strong>
    </div>
  `;
}

function catalogCard(entry) {
  const metadata = catalogMetadata[entry.url];
  const image = metadata?.image;
  const tags = displayTags(entry).map((tag) => `<span class="tag">${tag}</span>`).join("");
  const size = metadata?.repackSize || "Official page";
  const date = metadata?.date ? formatDate(metadata.date.slice(0, 10)) : "Official source";

  return `
    <article class="game-card catalog-preview-card" data-url="${entry.url}">
      <a class="poster catalog-poster" href="${entry.url}" rel="noreferrer">
        ${
          image
            ? `<img src="${image}" alt="${entry.title} cover artwork" loading="lazy" />`
            : generatedCover(entry)
        }
        <span class="poster-title">${entry.title}</span>
      </a>
      <div class="card-body">
        <h3 class="card-title">${entry.title}</h3>
        <div class="tag-list">${tags || `<span class="tag">Official</span>`}</div>
        <div class="size-row"><span>${date}</span><strong>${size}</strong></div>
        <a class="details-button" href="${entry.url}" rel="noreferrer">Official Details</a>
      </div>
    </article>
  `;
}

function render() {
  const items = filteredEntries();
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  page = Math.min(page, pages);
  const start = (page - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  els.count.textContent = items.length.toLocaleString();
  els.pageLabel.textContent = `Page ${page} of ${pages}`;
  els.prevPage.disabled = page <= 1;
  els.nextPage.disabled = page >= pages;
  els.results.innerHTML = visible
    .map((entry) => {
      const rich = richByUrl(entry);
      return rich ? richCard(entry, rich) : catalogCard(entry);
    })
    .join("");
  hydrateVisibleMetadata(visible);
}

function hydrateVisibleMetadata(entries) {
  const shouldHydrate = Boolean(els.search.value.trim() || els.genre.value || els.richOnly.checked);
  if (!shouldHydrate) return;

  const hydrateLimit = els.search.value.trim() ? 48 : 18;

  entries
    .filter((entry) => !richByUrl(entry))
    .filter((entry) => !catalogMetadata[entry.url]?.image)
    .slice(0, hydrateLimit)
    .forEach((entry) => {
      if (pendingMetadata.has(entry.url)) return;
      pendingMetadata.add(entry.url);
      fetch(`/api/metadata?url=${encodeURIComponent(entry.url)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((metadata) => {
          if (!metadata?.image) return;
          catalogMetadata[entry.url] = metadata;
          updateMetadataCard(entry, metadata);
        })
        .catch(() => {})
        .finally(() => pendingMetadata.delete(entry.url));
    });
}

function updateMetadataCard(entry, metadata) {
  const card = document.querySelector(`[data-url="${CSS.escape(entry.url)}"]`);
  if (!card) return;
  const poster = card.querySelector(".catalog-poster");
  const tags = card.querySelector(".tag-list");
  const sizeRow = card.querySelector(".size-row");
  if (poster && metadata.image) {
    poster.innerHTML = `<img src="${metadata.image}" alt="${entry.title} cover artwork" loading="lazy" /><span class="poster-title">${entry.title}</span>`;
  }
  if (tags) {
    tags.innerHTML = displayTags(entry).map((tag) => `<span class="tag">${tag}</span>`).join("");
  }
  if (sizeRow) {
    sizeRow.innerHTML = `<span>${metadata.date ? formatDate(metadata.date.slice(0, 10)) : "Official source"}</span><strong>${metadata.repackSize || "Official page"}</strong>`;
  }
}

function storageSet(key) {
  return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
}

function saveStorageSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function similarGames(game) {
  return richGames
    .filter((candidate) => candidate.title !== game.title)
    .map((candidate) => ({
      candidate,
      score: candidate.genres.filter((genre) => game.genres.includes(genre)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.candidate);
}

function renderDrawer(game) {
  const saved = {
    wishlist: storageSet("wishlist").has(game.title),
    installed: storageSet("installed").has(game.title),
    favorites: storageSet("favorites").has(game.title),
  };
  els.drawerContent.innerHTML = `
    <img class="drawer-cover" src="${game.image}" alt="${game.title} cover" />
    <p class="eyebrow">Quick preview</p>
    <h2 class="drawer-title">${game.title}</h2>
    <div class="tag-list">
      <span class="tag">${game.year}</span>
      ${game.genres.map((tag) => `<span class="tag">${tag}</span>`).join("")}
    </div>
    <div class="spec-grid">
      <div class="spec"><span>Developer</span><strong>Trusted metadata pending</strong></div>
      <div class="spec"><span>Publisher</span><strong>Trusted metadata pending</strong></div>
      <div class="spec"><span>Updated</span><strong>${formatDate(game.updated)}</strong></div>
      <div class="spec"><span>Repack size</span><strong>${game.repackSize} GB</strong></div>
      <div class="spec"><span>Original size</span><strong>${game.originalSize} GB</strong></div>
      <div class="spec"><span>Compression</span><strong>${compressionRatio(game)}% saved</strong></div>
      <div class="spec"><span>Mode</span><strong>${game.mode}</strong></div>
      <div class="spec"><span>Controller</span><strong>${game.controller ? "Supported" : "Keyboard + mouse"}</strong></div>
      <div class="spec"><span>Steam Deck</span><strong>${game.steamDeck ? "Friendly" : "Unverified"}</strong></div>
      <div class="spec"><span>Low-end PC</span><strong>${game.lowEnd ? "Friendly" : "Demanding"}</strong></div>
      <div class="spec"><span>Windows</span><strong>${game.hypervisor ? "Check HV notes" : "Standard"}</strong></div>
      <div class="spec"><span>Version</span><strong>${game.latestVersion}</strong></div>
    </div>
    <div class="warning-box">${game.warning || "No known warning notes in this prototype entry."}</div>
    <div class="drawer-actions">
      <a class="primary-button" href="${game.sourcePath || officialSource}" rel="noreferrer">View Full Details</a>
      <button class="drawer-action ${saved.wishlist ? "is-saved" : ""}" type="button" data-save="wishlist" data-title="${game.title}">Add to Wishlist</button>
      <button class="drawer-action ${saved.installed ? "is-saved" : ""}" type="button" data-save="installed" data-title="${game.title}">Mark Installed</button>
      <button class="drawer-action ${saved.favorites ? "is-saved" : ""}" type="button" data-save="favorites" data-title="${game.title}">Save to Favorites</button>
    </div>
    <h3>You may also like</h3>
    <div class="similar-list">
      ${similarGames(game)
        .map((similar) => `<button type="button" data-game="${similar.title}">${similar.title}</button>`)
        .join("")}
    </div>
  `;
}

function openDrawer(title) {
  const game = richGames.find((item) => item.title === title);
  if (!game) return;
  renderDrawer(game);
  els.drawer.classList.add("is-open");
  els.drawerScrim.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.drawer.classList.remove("is-open");
  els.drawerScrim.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
}

async function loadData() {
  const [catalogResponse, richResponse] = await Promise.all([
    fetch("data/catalog-index.json"),
    fetch("data/top-games.json"),
  ]);
  const catalogData = await catalogResponse.json();
  catalog = catalogData.games || [];
  richGames = await richResponse.json();
  try {
    const tagsResponse = await fetch("data/catalog-tags.json");
    catalogTags = tagsResponse.ok ? await tagsResponse.json() : {};
  } catch {
    catalogTags = {};
  }
  try {
    const metadataResponse = await fetch("data/catalog-metadata-cache.json");
    catalogMetadata = metadataResponse.ok ? await metadataResponse.json() : {};
  } catch {
    catalogMetadata = {};
  }
}

const initialQ = params.get("q") || "";
const initialGenre = normalizeFilterValue(params.get("genre"));
const migratedGenre = !initialGenre ? normalizeFilterValue(initialQ) : "";

els.search.value = migratedGenre ? "" : initialQ;
els.genre.value = initialGenre || migratedGenre;
if (params.get("sort")) els.sort.value = params.get("sort");

["input", "change"].forEach((eventName) => {
  els.search.addEventListener(eventName, () => {
    page = 1;
    render();
  });
});

[els.genre, els.system, els.richOnly, els.sort].forEach((control) => {
  control.addEventListener("change", () => {
    page = 1;
    render();
  });
});

els.prevPage.addEventListener("click", () => {
  page -= 1;
  render();
});

els.nextPage.addEventListener("click", () => {
  page += 1;
  render();
});

els.filterToggle.addEventListener("click", () => {
  els.sidebar.classList.toggle("is-open");
});

document.addEventListener("click", (event) => {
  const gameTarget = event.target.closest("[data-game]");
  if (gameTarget) {
    event.preventDefault();
    openDrawer(gameTarget.dataset.game);
    return;
  }

  const saveTarget = event.target.closest("[data-save]");
  if (saveTarget) {
    const set = storageSet(saveTarget.dataset.save);
    if (set.has(saveTarget.dataset.title)) set.delete(saveTarget.dataset.title);
    else set.add(saveTarget.dataset.title);
    saveStorageSet(saveTarget.dataset.save, set);
    saveTarget.classList.toggle("is-saved");
    return;
  }

  if (event.target.closest("[data-drawer-close]")) closeDrawer();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});

await loadData();
render();

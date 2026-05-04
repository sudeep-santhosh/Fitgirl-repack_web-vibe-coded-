const officialSource = "https://fitgirl-repacks.site/";
const genres = ["Action", "RPG", "Horror", "Racing", "Strategy", "Open World", "Indie", "Co-op"];
const stateKeys = ["wishlist", "installed", "favorites"];

let games = [];
let catalog = [];
let currentTab = "trending";

function slugify(value) {
  return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const els = {
  topGrid: document.querySelector("#topGrid"),
  recentList: document.querySelector("#recentList"),
  newList: document.querySelector("#newList"),
  genreRail: document.querySelector("#genreRail"),
  drawer: document.querySelector("#quickDrawer"),
  drawerContent: document.querySelector("#drawerContent"),
  drawerScrim: document.querySelector(".drawer-scrim"),
  searchOverlay: document.querySelector("#searchOverlay"),
  overlaySearchInput: document.querySelector("#overlaySearchInput"),
  suggestionsList: document.querySelector("#suggestionsList"),
  viewAllResults: document.querySelector("#viewAllResults"),
  overlayGenres: document.querySelector("#overlayGenres"),
};

function storageSet(key) {
  return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
}

function saveStorageSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function compressionRatio(game) {
  return Math.round((1 - game.repackSize / game.originalSize) * 100);
}

function sortedGames(mode) {
  const items = [...games];
  if (mode === "updated") return items.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  if (mode === "new") return items.sort((a, b) => b.year - a.year || new Date(b.updated) - new Date(a.updated));
  return items.sort((a, b) => {
    const aScore = (a.genres.includes("AAA") ? 2 : 0) + (a.steamDeck ? 1 : 0) + (a.hypervisor ? 0.5 : 0);
    const bScore = (b.genres.includes("AAA") ? 2 : 0) + (b.steamDeck ? 1 : 0) + (b.hypervisor ? 0.5 : 0);
    return bScore - aScore;
  });
}

function gameCard(game) {
  const tags = game.genres.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("");
  const badges = [
    game.mode,
    game.controller ? "Controller" : "KB+M",
    game.steamDeck ? "Steam Deck" : "",
    game.hypervisor ? "HV note" : "",
  ]
    .filter(Boolean)
    .map((badge) => `<span class="badge ${badge === "HV note" ? "warn" : ""}">${badge}</span>`)
    .join("");

  return `
    <article class="game-card" data-game="${game.title}">
      <div class="poster">
        <img src="${game.image}" alt="${game.title} cover artwork" loading="lazy" />
        <span class="poster-title">${game.title}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${game.title}</h3>
        <div class="tag-list">${tags}</div>
        <div class="size-row">
          <span>${formatDate(game.updated)}</span>
          <strong>${game.repackSize} GB</strong>
        </div>
        <div class="card-badges">${badges}</div>
        <div class="card-footer">
          <button class="details-button" type="button" data-game="${game.title}">View Details</button>
        </div>
      </div>
    </article>
  `;
}

function renderTopGrid() {
  els.topGrid.innerHTML = sortedGames(currentTab).slice(0, 10).map(gameCard).join("");
}

function miniRow(game) {
  return `
    <article class="mini-row" data-game="${game.title}">
      <img src="${game.image}" alt="${game.title} cover" loading="lazy" />
      <div>
        <strong>${game.title}</strong>
        <span>${game.genres.slice(0, 2).join(" / ")}</span>
      </div>
      <small>${game.repackSize} GB</small>
    </article>
  `;
}

function renderSecondarySections() {
  els.recentList.innerHTML = sortedGames("updated").slice(0, 5).map(miniRow).join("");
  els.newList.innerHTML = sortedGames("new").slice(0, 5).map(miniRow).join("");
  els.genreRail.innerHTML = genres
    .map((genre) => `<a class="genre-card" href="/catalog?genre=${slugify(genre)}">${genre}<span>&rarr;</span></a>`)
    .join("");
  els.overlayGenres.innerHTML = genres
    .map((genre) => `<a href="/catalog?genre=${slugify(genre)}">${genre}</a>`)
    .join("");
}

function similarGames(game) {
  return games
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
  const saved = Object.fromEntries(stateKeys.map((key) => [key, storageSet(key).has(game.title)]));
  const warning = game.warning || "No known warning notes in this prototype entry.";

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
    <div class="warning-box">${warning}</div>
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
  const game = games.find((item) => item.title === title);
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

function openSearch() {
  els.searchOverlay.classList.add("is-open");
  els.searchOverlay.setAttribute("aria-hidden", "false");
  els.overlaySearchInput.focus();
  updateSuggestions();
}

function closeSearch() {
  els.searchOverlay.classList.remove("is-open");
  els.searchOverlay.setAttribute("aria-hidden", "true");
}

function updateSuggestions() {
  const query = els.overlaySearchInput.value.trim().toLowerCase();
  const source = query
    ? catalog.filter((game) => `${game.title} ${game.id}`.toLowerCase().includes(query)).slice(0, 6)
    : games.slice(0, 6).map((game) => ({ title: game.title, url: game.sourcePath, id: game.title.toLowerCase() }));

  els.suggestionsList.innerHTML = source
    .map(
      (game) => `
        <a class="suggestion-row" href="${game.url || officialSource}" rel="noreferrer">
          <span>${game.title}</span>
          <small>Official</small>
        </a>
      `,
    )
    .join("");
  els.viewAllResults.href = `/catalog${query ? `?q=${encodeURIComponent(query)}` : ""}`;
}

async function loadData() {
  const topResponse = await fetch("data/top-games.json");
  games = await topResponse.json();
  const catalogResponse = await fetch("data/catalog-index.json");
  const catalogData = await catalogResponse.json();
  catalog = catalogData.games || [];
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-home-tab]");
  if (tab) {
    currentTab = tab.dataset.homeTab;
    document.querySelectorAll("[data-home-tab]").forEach((button) => button.classList.toggle("is-active", button === tab));
    renderTopGrid();
    return;
  }

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
  if (event.target.closest("[data-search-open]")) openSearch();
  if (event.target.closest("[data-search-close]")) closeSearch();

  const queryButton = event.target.closest("[data-query]");
  if (queryButton) {
    els.overlaySearchInput.value = queryButton.dataset.query;
    updateSuggestions();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    closeSearch();
    closeDrawer();
  }
});

els.overlaySearchInput.addEventListener("input", updateSuggestions);
els.overlaySearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.location.href = els.viewAllResults.href;
  }
});

await loadData();
renderTopGrid();
renderSecondarySections();

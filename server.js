const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || process.env.PORT || 4173);
const metadataCachePath = path.join(root, "data", "catalog-metadata-cache.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function readMetadataCache() {
  try {
    return JSON.parse(fs.readFileSync(metadataCachePath, "utf8"));
  } catch {
    return {};
  }
}

function writeMetadataCache(cache) {
  fs.mkdirSync(path.dirname(metadataCachePath), { recursive: true });
  fs.writeFileSync(metadataCachePath, `${JSON.stringify(cache, null, 2)}\n`);
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

function parseMetadata(html, sourceUrl) {
  const readableText = decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h\d|div)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
  const image = [
    ...html.matchAll(/https?:[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?/gi),
  ]
    .map((match) => match[0].replace(/&#038;|&amp;/g, "&"))
    .find((url) => !url.includes("cropped-icon") && !url.includes("support2") && !url.includes("torrent-stats"));
  const genreLine = html.match(/Genres\/Tags:\s*([\s\S]*?)(?:Companies:|Languages:|Original Size:)/i)?.[1] || "";
  const tags = [...genreLine.matchAll(/>([^<>]+)<\/a>/g)].map((match) => decodeEntities(match[1]));
  const originalSize = readableText.match(/Original Size:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const repackSize = readableText.match(/Repack Size:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const companies = readableText.match(/Companies:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const date = decodeEntities(html.match(/datetime="([^"]+)"/i)?.[1] || "");

  return {
    sourceUrl,
    image,
    tags,
    originalSize,
    repackSize,
    companies,
    date,
    enrichedAt: new Date().toISOString(),
  };
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/metadata") {
    const target = url.searchParams.get("url") || "";
    let parsedTarget;
    try {
      parsedTarget = new URL(target);
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Invalid URL" }));
      return;
    }

    if (parsedTarget.origin !== "https://fitgirl-repacks.site") {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Only official FitGirl URLs are allowed" }));
      return;
    }

    const cache = readMetadataCache();
    if (cache[target]?.image) {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(cache[target]));
      return;
    }

    fetch(target, {
      headers: { "user-agent": "Mozilla/5.0 FitGirl catalog metadata preview" },
    })
      .then((remoteResponse) => {
        if (!remoteResponse.ok) throw new Error(`Remote status ${remoteResponse.status}`);
        return remoteResponse.text();
      })
      .then((html) => {
        const metadata = parseMetadata(html, target);
        cache[target] = metadata;
        writeMetadataCache(cache);
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify(metadata));
      })
      .catch((error) => {
        response.writeHead(502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ error: error.message, sourceUrl: target }));
      });
    return;
  }

  const routePath = url.pathname === "/catalog" ? "/catalog.html" : url.pathname;
  const requestedPath = routePath === "/" ? "index.html" : decodeURIComponent(routePath.slice(1));
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
});

server.listen(port, () => {
  console.log(`Repack Library prototype running at http://localhost:${port}`);
});

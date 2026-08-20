import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = process.env.VITE_SITE_URL || process.env.SITE_URL || "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

const PUBLIC_STATIC_PATHS = [
  "/",
  "/listings",
  "/requests",
  "/terms",
  "/privacy",
];

const LISTINGS_ENDPOINT =
  process.env.VITE_SITEMAP_SOURCE === "supabase"
    ? "supabase"
    : "skip";

// Only ever fetch listing URLs against an explicit production origin.
// Absent VITE_SITE_URL nothing is generated, so no fake/placeholder domain
// can ever leak into the sitemap.
const shouldFetchListingUrls = () =>
  Boolean(SITE_URL) && LISTINGS_ENDPOINT === "supabase";

const fetchActiveListingPaths = async () => {
  if (!shouldFetchListingUrls()) return [];
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log(
      "[sitemap] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing — listing URLs skipped."
    );
    return [];
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/listings?select=id&status=eq.active&limit=5000`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) {
      console.log(
        `[sitemap] listings query failed (status ${res.status}) — listing URLs skipped.`
      );
      return [];
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) {
      console.log("[sitemap] listings query returned unexpected payload — skipping.");
      return [];
    }
    return rows.map((r) => `/listings/${r.id}`);
  } catch (err) {
    console.log("[sitemap] listings query error — listing URLs skipped:", err?.message);
    return [];
  }
};

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const generate = async () => {
  if (!SITE_URL) {
    console.log(
      "[sitemap] VITE_SITE_URL not set — sitemap.xml NOT written. " +
        "Set VITE_SITE_URL to the production origin to generate a sitemap."
    );
    return;
  }

  const origin = SITE_URL.replace(/\/+$/, "");
  const listingPaths = await fetchActiveListingPaths();

  // Stable ordering: static pages first, then listing detail URLs.
  const paths = [...PUBLIC_STATIC_PATHS, ...listingPaths];
  const urls = paths.map((path) => {
    const isRoot = path === "/";
    const loc = origin + (isRoot ? "" : path);
    const isListing = path.startsWith("/listings/");
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <changefreq>${isListing ? "weekly" : "daily"}</changefreq>`,
      `    <priority>${isRoot ? "1.0" : isListing ? "0.8" : "0.7"}</priority>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  const outDir = resolve(__dirname, "..", "dist");
  const outFile = resolve(outDir, "sitemap.xml");
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, xml, "utf8");
  console.log(
    `[sitemap] wrote ${outFile} (${paths.length} URLs, ${
      listingPaths.length ? `${listingPaths.length} active listings` : "static only"
    })`
  );
};

generate()
  .catch((err) => {
    // The sitemap is best-effort: a failure here must never break the build.
    console.error("[sitemap] failed (build continues):", err);
  });
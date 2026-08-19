import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = process.env.VITE_SITE_URL || process.env.SITE_URL || "";

const PUBLIC_STATIC_PATHS = [
  "/",
  "/listings",
  "/requests",
  "/terms",
  "/privacy",
];

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const generate = () => {
  if (!SITE_URL) {
    console.log(
      "[sitemap] VITE_SITE_URL not set — sitemap.xml NOT written. " +
        "Set VITE_SITE_URL to the production origin to generate a sitemap."
    );
    return Promise.resolve();
  }

  const origin = SITE_URL.replace(/\/+$/, "");
  const urls = PUBLIC_STATIC_PATHS.map((path) => {
    const loc = origin + (path === "/" ? "" : path);
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <changefreq>daily</changefreq>`,
      `    <priority>${path === "/" ? "1.0" : "0.7"}</priority>`,
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
  return mkdir(outDir, { recursive: true }).then(() =>
    writeFile(outFile, xml, "utf8").then(() =>
      console.log(`[sitemap] wrote ${outFile}`)
    )
  );
};

generate()
  .catch((err) => {
    console.error("[sitemap] failed (build continues):", err);
  });
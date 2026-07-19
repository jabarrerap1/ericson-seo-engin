// netlify/functions/sitemap.xml.js
//
// Genera un sitemap.xml dinámico con todos los artículos publicados, para
// que Google Search Console pueda descubrirlos e indexarlos.
//
// GET /sitemap.xml (redirigido desde netlify.toml)

const { getBlobStore } = require("./_lib/store");

exports.handler = async () => {
  const store = getBlobStore("ericson-published");
  const index = (await store.get("_index", { type: "json" })) || [];
  const siteUrl =
    process.env.BLOG_BASE_URL || process.env.URL || "https://ericson-seo-engine.netlify.app";

  const urls = index
    .map(
      (p) => `  <url>
    <loc>${siteUrl}/blog/${p.slug}</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>monthly</changefreq>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/blog</loc>
    <changefreq>weekly</changefreq>
  </url>
${urls}
</urlset>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
    body: xml,
  };
};

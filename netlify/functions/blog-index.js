// netlify/functions/blog-index.js
//
// Lista todos los artículos publicados en blog.ericson-laboratoire.com.mx/blog
// con el diseño del sitio principal (ver _lib/layout.js).

const { getBlobStore } = require("./_lib/store");
const L = require("./_lib/layout");

exports.handler = async () => {
  const store = getBlobStore("ericson-published");
  const indexRaw = await store.get("_index", { type: "json" });
  const posts = L.dedupeIndex(indexRaw || []); // más reciente primero

  const siteUrl = process.env.BLOG_BASE_URL || process.env.URL || "";
  const [first, ...rest] = posts;

  const card = (p) => `
    <a class="post" href="/blog/${p.slug}">
      <div class="ph"><img src="${L.coverFor({ title: p.title, keyword: p.meta_description })}" alt="" loading="lazy"></div>
      <div class="bd">
        <span class="meta mono"><span>${L.escapeHtml(L.fmtDate(p.date))}</span></span>
        <h3>${L.escapeHtml(p.title)}</h3>
        <p>${L.escapeHtml(p.meta_description)}</p>
        <span class="more">Leer artículo →</span>
      </div>
    </a>`;

  const feature = first ? `
    <a class="feature" href="/blog/${first.slug}">
      <div class="ph"><img src="${L.coverFor({ title: first.title, keyword: first.meta_description })}" alt=""></div>
      <div class="bd">
        <span class="meta mono"><span>Más reciente</span><span>${L.escapeHtml(L.fmtDate(first.date))}</span></span>
        <h2>${L.escapeHtml(first.title)}</h2>
        <p>${L.escapeHtml(first.meta_description)}</p>
        <span class="more">Leer artículo →</span>
      </div>
    </a>` : "";

  const body = `
<main>
  <section class="bhead"><div class="wrap">
    <div>
      <div class="kicker mono"><i>Blog técnico</i><span>Para spas, clínicas y cosmetólogas</span></div>
      <h1 style="margin-top:22px">Protocolos, activos y <em>operación de cabina.</em></h1>
      <p class="lede">Guías técnicas para profesionales de la estética: cómo elegir activos, estructurar protocolos y operar tu cabina con cosmecéutica de París.</p>
    </div>
    <div class="side">
      <strong>${posts.length}</strong>
      artículos publicados. Uno nuevo cada semana, escrito para quien trabaja en cabina.
    </div>
  </div></section>
  <div class="wrap">
    ${posts.length ? feature : `<p class="empty">Aún no hay artículos publicados.</p>`}
    ${rest.length ? `<div class="sect-h"><h2>Todos los artículos</h2><span class="mono">${rest.length} artículos</span></div>
    <div class="posts">${rest.map(card).join("")}</div>` : ""}
  </div>
  ${L.endCta()}
</main>`;

  const html = L.page({
    title: "Blog técnico | Ericson Laboratoire México",
    description: "Guías técnicas para spas, clínicas y cosmetólogas: protocolos de cabina, activos cosmecéuticos y operación profesional. Ericson Laboratoire México.",
    canonical: siteUrl ? `${siteUrl}/blog` : "",
    ogImage: "https://ericson-laboratoire.com.mx/img/protocolos/perfect-gnx.jpg",
    jsonld: [{
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Blog técnico · Ericson Laboratoire México",
      url: siteUrl ? `${siteUrl}/blog` : undefined,
      publisher: { "@type": "Organization", name: "Ericson Laboratoire México", url: L.SITE },
      blogPost: posts.slice(0, 20).map((p) => ({
        "@type": "BlogPosting", headline: p.title, url: siteUrl ? `${siteUrl}/blog/${p.slug}` : undefined, datePublished: p.date,
      })),
    }],
    body,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
    body: html,
  };
};

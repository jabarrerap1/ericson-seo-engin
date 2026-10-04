// netlify/functions/blog-post.js
//
// Sirve un artículo YA PUBLICADO como página pública e indexable en
// blog.ericson-laboratoire.com.mx/blog/<slug>, con el diseño del sitio
// principal (ver _lib/layout.js).
//
// GET /blog/:slug  (redirigido internamente desde netlify.toml)

const { getBlobStore } = require("./_lib/store");
const L = require("./_lib/layout");

exports.handler = async (event) => {
  const slug = (event.path || "").split("/").filter(Boolean).pop();
  const store = getBlobStore("ericson-published");
  const siteUrl = process.env.BLOG_BASE_URL || process.env.URL || "";

  const post = slug ? await store.get(slug, { type: "json" }) : null;

  if (!post) {
    const body = `<main><section class="ahead"><div class="wrap">
      <p class="mono" style="color:var(--oxide)">Error 404</p>
      <h1 style="margin-top:16px">No encontramos <em>este artículo.</em></h1>
      <p class="lede">Puede que la dirección esté mal escrita o que el artículo se haya retirado.</p>
      <p style="margin-top:28px"><a class="btn" href="/blog">Ver todos los artículos</a></p>
    </div></section></main>`;
    return {
      statusCode: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: L.page({ title: "Artículo no encontrado | Ericson Laboratoire México", description: "", body }),
    };
  }

  const canonical = `${siteUrl}/blog/${slug}`;
  const proto = L.mainProtocol(post);
  const cover = L.coverFor(post);
  const minutes = L.readingMinutes(post.article_html);
  const date = post.published_at || "";

  // Índice de contenidos: agrega id a cada <h2>.
  const toc = [];
  let content = String(post.article_html || "").replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (m, attrs, inner) => {
    const text = L.stripTags(inner);
    const id = "s-" + (toc.length + 1);
    toc.push({ id, text });
    const clean = attrs.replace(/\sid="[^"]*"/i, "");
    return `<h2${clean} id="${id}">${inner}</h2>`;
  });
  content = L.linkProtocols(content);

  // Relacionados: los 3 más recientes distintos a este.
  const index = L.dedupeIndex((await store.get("_index", { type: "json" })) || []);
  const related = index.filter((p) => p.slug !== slug).slice(0, 3);

  const body = `
<main>
  <article>
    <header class="ahead"><div class="wrap">
      <nav class="crumbs mono" aria-label="Ruta"><a href="${L.SITE}/">Inicio</a><span>/</span><a href="/blog">Blog técnico</a></nav>
      <div class="kicker mono"><i>Cosmecéutica profesional</i><span>${L.escapeHtml(proto.name)}</span></div>
      <h1 style="margin-top:20px">${L.escapeHtml(post.title)}</h1>
      ${post.meta_description ? `<p class="lede">${L.escapeHtml(post.meta_description)}</p>` : ""}
      <div class="meta mono"><span>${L.escapeHtml(L.fmtDate(date))}</span><span>${minutes} min de lectura</span><span>Ericson Laboratoire México</span></div>
      <figure class="cover"><img src="${cover}" alt="Protocolo ${L.escapeHtml(proto.name)} en cabina"><figcaption>Protocolo ${L.escapeHtml(proto.name)}</figcaption></figure>
    </div></header>

    <div class="wrap agrid">
      <nav class="toc" aria-label="Contenido">
        ${toc.length ? `<span class="mono">En este artículo</span><ol>${toc.map((t) => `<li><a href="#${t.id}">${L.escapeHtml(t.text)}</a></li>`).join("")}</ol>` : ""}
      </nav>

      <div class="content">${content}</div>

      <aside class="aside">
        <div class="box">
          <span class="mono">Protocolo relacionado</span>
          <h4>${L.escapeHtml(proto.name)}</h4>
          <p>Pasos, tiempos y productos de cada fase del protocolo en cabina.</p>
          <a class="btn ghost" href="https://protocolos.ericson-laboratoire.com.mx/?p=${proto.id}&utm_source=blog&utm_medium=sidebar">Ver protocolo paso a paso</a>
        </div>
        <div class="box dark">
          <span class="mono">Certificación incluida</span>
          <h4>Tu equipo, certificado en cada protocolo</h4>
          <p>Presencial con cita o por Zoom. Sin mínimo de compra para empezar.</p>
          <a class="btn" href="https://wa.me/${L.WA}?text=${encodeURIComponent("Hola, leí \"" + post.title + "\" y quiero información sobre la certificación Ericson")}">Hablar con una especialista</a>
        </div>
        <div class="box">
          <span class="mono">Descarga gratuita</span>
          <h4>Guía de certificación por protocolo</h4>
          <p>Los 16 protocolos, sus tiempos y productos, y cómo certificamos a tu equipo. PDF de 13 páginas.</p>
          <a class="btn ghost" href="${L.SITE}/descargas/guia-certificacion-ericson.pdf">Descargar guía (PDF)</a>
        </div>
      </aside>
    </div>
  </article>

  ${related.length ? `<section class="wrap related" aria-label="Más artículos">
    <div class="sect-h" style="margin-top:40px"><h2>Sigue leyendo</h2><a class="mono" href="/blog" style="color:var(--mute)">Todos los artículos →</a></div>
    <div class="posts">${related.map((p) => `
      <a class="post" href="/blog/${p.slug}">
        <div class="ph"><img src="${L.coverFor({ title: p.title, keyword: p.meta_description })}" alt="" loading="lazy"></div>
        <div class="bd"><span class="meta mono"><span>${L.escapeHtml(L.fmtDate(p.date))}</span></span>
          <h3>${L.escapeHtml(p.title)}</h3><span class="more">Leer artículo →</span></div>
      </a>`).join("")}</div>
  </section>` : ""}

  ${L.endCta()}
</main>`;

  const html = L.page({
    title: `${post.title} | Ericson Laboratoire México`,
    description: post.meta_description || "",
    canonical,
    ogImage: cover,
    ogType: "article",
    jsonld: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.meta_description || undefined,
        image: cover,
        datePublished: date || undefined,
        dateModified: date || undefined,
        mainEntityOfPage: canonical,
        author: { "@type": "Organization", name: "Ericson Laboratoire México", url: L.SITE },
        publisher: { "@type": "Organization", name: "Ericson Laboratoire México", url: L.SITE },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: L.SITE + "/" },
          { "@type": "ListItem", position: 2, name: "Blog técnico", item: `${siteUrl}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
    ],
    body,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
    body: html,
  };
};

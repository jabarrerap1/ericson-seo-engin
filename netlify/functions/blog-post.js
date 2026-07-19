// netlify/functions/blog-post.js
//
// Sirve un artículo YA PUBLICADO como página pública e indexable en
// blog.ericson-laboratoire.com.mx/blog/<slug>. Reemplaza la necesidad de
// WordPress: el sitio principal es HTML estático, así que el blog vive
// aquí, en su propio subdominio servido por Netlify Functions.
//
// GET /blog/:slug  (redirigido internamente desde netlify.toml)

const { getBlobStore } = require("./_lib/store");

exports.handler = async (event) => {
  const slug = (event.path || "").split("/").filter(Boolean).pop();
  if (!slug) {
    return { statusCode: 400, body: "Falta el slug del artículo" };
  }

  const store = getBlobStore("ericson-published");
  const post = await store.get(slug, { type: "json" });

  if (!post) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<h1>Artículo no encontrado</h1><p>Puede que la URL esté mal escrita.</p>`,
    };
  }

  const siteUrl = process.env.BLOG_BASE_URL || process.env.URL || "";
  const canonical = `${siteUrl}/blog/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(post.title)} | Ericson Laboratoire México</title>
<meta name="description" content="${escapeHtml(post.meta_description)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${escapeHtml(post.title)}" />
<meta property="og:description" content="${escapeHtml(post.meta_description)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root { --charcoal: #1a1916; --gold: #b8935a; --offwhite: #f5f0eb; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--offwhite); font-family: 'Jost', sans-serif; color: var(--charcoal); line-height: 1.7; }
  header { background: var(--charcoal); padding: 18px 24px; text-align: center; }
  header a { color: var(--gold); text-decoration: none; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 48px 24px 100px; }
  .kicker { color: var(--gold); font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px; }
  h1 { font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 600; margin: 0 0 24px; }
  .content h2 { font-family: 'Cormorant Garamond', serif; font-size: 26px; margin-top: 40px; }
  .content h3 { font-family: 'Cormorant Garamond', serif; font-size: 20px; }
  .content p, .content li { font-size: 16px; color: #2c2b28; }
  .cta { margin-top: 56px; padding: 28px; background: var(--charcoal); color: var(--offwhite); text-align: center; border-radius: 4px; }
  .cta a { color: var(--gold); font-weight: 500; text-decoration: none; }
</style>
</head>
<body>
  <header><a href="/blog">← Ericson Laboratoire México · Blog Profesional</a></header>
  <div class="wrap">
    <div class="kicker">Cosmecéutica Profesional</div>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="content">${post.article_html}</div>
    <div class="cta">
      ¿Eres profesional de la estética y quieres distribuir Ericson Laboratoire?<br/>
      <a href="https://wa.me/525559898827?text=Quiero%20información%20sobre%20Ericson%20Laboratoire">Habla con nosotros por WhatsApp →</a>
    </div>
  </div>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: html,
  };
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// netlify/functions/blog-index.js
//
// Lista todos los artículos publicados en blog.ericson-laboratoire.com.mx/blog

const { getBlobStore } = require("./_lib/store");

exports.handler = async () => {
  const store = getBlobStore("ericson-published");
  const indexRaw = await store.get("_index", { type: "json" });
  const index = indexRaw || [];

  const items = index
    .slice()
    .reverse()
    .map(
      (p) => `
      <a class="post" href="/blog/${p.slug}">
        <div class="kicker">${escapeHtml(p.date)}</div>
        <h2>${escapeHtml(p.title)}</h2>
        <p>${escapeHtml(p.meta_description)}</p>
      </a>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="google-site-verification" content="AdoQ9BwuVYjRn1UxsQ7n5ah2YtXbggBQBQfV2yp1abk" />
<title>Blog Profesional | Ericson Laboratoire México</title>
<meta name="description" content="Cosmética profesional francesa, protocolos y noticias de Ericson Laboratoire México." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root { --charcoal: #1a1916; --gold: #b8935a; --offwhite: #f5f0eb; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--offwhite); font-family: 'Jost', sans-serif; color: var(--charcoal); }
  header { background: var(--charcoal); padding: 40px 24px; text-align: center; }
  header h1 { font-family: 'Cormorant Garamond', serif; color: var(--offwhite); font-size: 32px; margin: 0 0 8px; }
  header p { color: var(--gold); font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 24px 100px; display: flex; flex-direction: column; gap: 24px; }
  .post { display: block; background: #fff; padding: 24px; border-radius: 4px; text-decoration: none; color: var(--charcoal); border-left: 3px solid var(--gold); }
  .post .kicker { color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .post h2 { font-family: 'Cormorant Garamond', serif; font-size: 24px; margin: 0 0 8px; }
  .post p { margin: 0; color: #555; font-size: 15px; }
  .empty { text-align: center; color: #888; padding: 60px 24px; }
</style>
</head>
<body>
  <header>
    <h1>Ericson Laboratoire México</h1>
    <p>Blog profesional</p>
  </header>
  <div class="wrap">
    ${items || `<div class="empty">Aún no hay artículos publicados.</div>`}
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

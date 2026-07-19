// netlify/functions/preview-article.js
//
// Sirve una página pública (sin login) con vista previa del artículo
// generado, usando la identidad de marca de Ericson Laboratoire, para
// que puedas leerlo completo desde el link que llega por correo antes
// de aprobar la publicación.
//
// GET /.netlify/functions/preview-article?id=<uuid>

const { getBlobStore } = require("./_lib/store");

exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: "Falta el parámetro 'id'" };
  }

  const store = getBlobStore("ericson-drafts");
  const draft = await store.get(id, { type: "json" });

  if (!draft) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<h1>Vista previa no encontrada</h1><p>Puede que ya haya expirado o haya sido publicada.</p>`,
    };
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Vista previa: ${escapeHtml(draft.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --charcoal: #1a1916;
    --gold: #b8935a;
    --offwhite: #f5f0eb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--offwhite);
    font-family: 'Jost', sans-serif;
    color: var(--charcoal);
    line-height: 1.7;
  }
  .badge {
    background: var(--charcoal);
    color: var(--gold);
    text-align: center;
    padding: 10px;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .wrap {
    max-width: 680px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }
  .kicker {
    color: var(--gold);
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px;
    font-weight: 600;
    margin: 0 0 16px;
    color: var(--charcoal);
  }
  .meta {
    border-left: 3px solid var(--gold);
    padding: 10px 16px;
    background: #fff;
    font-size: 14px;
    color: #555;
    margin-bottom: 32px;
  }
  .content h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 24px;
    color: var(--charcoal);
    margin-top: 36px;
  }
  .content h3 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 19px;
    color: var(--charcoal);
  }
  .content p, .content li { font-size: 16px; color: #2c2b28; }
  .footer-note {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #ddd;
    font-size: 13px;
    color: #888;
  }
</style>
</head>
<body>
  <div class="badge">Vista previa — aún no publicado</div>
  <div class="wrap">
    <div class="kicker">Ericson Laboratoire México · Borrador SEO</div>
    <h1>${escapeHtml(draft.title)}</h1>
    <div class="meta">
      <strong>Keyword objetivo:</strong> ${escapeHtml(draft.keyword)}<br/>
      <strong>Meta descripción:</strong> ${escapeHtml(draft.meta_description)}<br/>
      <strong>Slug:</strong> /${escapeHtml(draft.slug)}
    </div>
    <div class="content">
      ${draft.article_html}
    </div>
    <div class="footer-note">
      Usa los botones del correo para <strong>aprobar y publicar</strong> este artículo en ericson-laboratoire.com.mx, o <strong>descartarlo</strong>.
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

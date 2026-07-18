// netlify/functions/approve-article.js
//
// Se activa cuando Antonio hace clic en el botón "Aprobar y publicar" del
// correo. Verifica el token firmado, publica el borrador en WordPress y
// muestra una página de confirmación simple.
//
// GET /.netlify/functions/approve-article?id=<uuid>&token=<hmac>

const { getStore } = require("@netlify/blobs");
const { verify } = require("./_lib/token");

exports.handler = async (event) => {
  const { id, token } = event.queryStringParameters || {};

  if (!id || !token) {
    return htmlResponse(400, "Faltan parámetros en el link.");
  }

  if (!verify(id, "approve", token)) {
    return htmlResponse(403, "Este link no es válido o ya expiró.");
  }

  const store = getStore("ericson-drafts");
  const draft = await store.get(id, { type: "json" });

  if (!draft) {
    return htmlResponse(
      404,
      "Este borrador ya no está disponible (puede que ya se haya publicado o descartado)."
    );
  }

  const { title, article_html, slug, meta_description } = draft;

  const auth = Buffer.from(
    `${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`
  ).toString("base64");

  try {
    const response = await fetch(
      `${process.env.WP_BASE_URL}/wp-json/wp/v2/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          title,
          slug,
          content: article_html,
          status: "publish",
          excerpt: meta_description || "",
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return htmlResponse(502, `Error al publicar en WordPress: ${errText}`);
    }

    const post = await response.json();
    await store.delete(id);

    return htmlResponse(
      200,
      `✅ Publicado correctamente.<br/><a href="${post.link}" style="color:#b8935a;">Ver artículo en vivo</a>`,
      true
    );
  } catch (err) {
    return htmlResponse(500, `Error del servidor: ${err.message}`);
  }
};

function htmlResponse(statusCode, message, success = false) {
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ericson SEO Engine</title>
<style>
  body { font-family: 'Jost', sans-serif; background:#f5f0eb; color:#1a1916; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; padding:24px; }
  .box { background:#fff; border-top:3px solid ${success ? "#b8935a" : "#c0392b"}; padding:32px; border-radius:4px; max-width:420px; }
</style></head>
<body><div class="box">${message}</div></body></html>`,
  };
}

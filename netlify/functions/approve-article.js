// netlify/functions/approve-article.js
//
// Se activa cuando Antonio hace clic en el botón "Aprobar y publicar" del
// correo. Verifica el token firmado, mueve el borrador de "ericson-drafts"
// a "ericson-published" (queda visible en blog.ericson-laboratoire.com.mx),
// actualiza el índice del blog, y muestra una página de confirmación.
//
// GET /.netlify/functions/approve-article?id=<uuid>&token=<hmac>

const { getBlobStore } = require("./_lib/store");
const { verify } = require("./_lib/token");

exports.handler = async (event) => {
  const { id, token } = event.queryStringParameters || {};

  if (!id || !token) {
    return htmlResponse(400, "Faltan parámetros en el link.");
  }

  if (!verify(id, "approve", token)) {
    return htmlResponse(403, "Este link no es válido o ya expiró.");
  }

  const draftsStore = getBlobStore("ericson-drafts");
  const draft = await draftsStore.get(id, { type: "json" });

  if (!draft) {
    return htmlResponse(
      404,
      "Este borrador ya no está disponible (puede que ya se haya publicado o descartado)."
    );
  }

  if (draft.status === "generating") {
    return htmlResponse(
      409,
      "⏳ Este artículo todavía se está generando. Espera unos segundos y vuelve a abrir el link de aprobación desde el correo."
    );
  }

  if (draft.status === "error") {
    return htmlResponse(500, `Hubo un error generando este artículo: ${draft.error || ""}`);
  }

  const { title, article_html, slug, meta_description, keyword } = draft;

  try {
    const publishedStore = getBlobStore("ericson-published");

    // Evita colisión de slugs
    let finalSlug = slug;
    let attempt = 1;
    while (await publishedStore.get(finalSlug)) {
      attempt += 1;
      finalSlug = `${slug}-${attempt}`;
    }

    const published_at = new Date().toISOString();

    await publishedStore.setJSON(finalSlug, {
      title,
      article_html,
      meta_description,
      keyword,
      published_at,
    });

    // Actualiza el índice del blog
    const index = (await publishedStore.get("_index", { type: "json" })) || [];
    index.push({
      slug: finalSlug,
      title,
      meta_description,
      date: published_at.slice(0, 10),
    });
    await publishedStore.setJSON("_index", index);

    await draftsStore.delete(id);

    const siteUrl = process.env.BLOG_BASE_URL || process.env.URL || "";
    const liveUrl = `${siteUrl}/blog/${finalSlug}`;

    return htmlResponse(
      200,
      `✅ Publicado correctamente.<br/><a href="${liveUrl}" style="color:#b8935a;">Ver artículo en vivo</a>`,
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

// netlify/functions/discard-article.js
//
// Se activa cuando Antonio hace clic en "Descartar" en el correo.
// Borra el borrador; no publica nada.
//
// GET /.netlify/functions/discard-article?id=<uuid>&token=<hmac>

const { getBlobStore } = require("./_lib/store");
const { verify } = require("./_lib/token");

exports.handler = async (event) => {
  const { id, token } = event.queryStringParameters || {};

  if (!id || !token) {
    return htmlResponse(400, "Faltan parámetros en el link.");
  }

  if (!verify(id, "discard", token)) {
    return htmlResponse(403, "Este link no es válido o ya expiró.");
  }

  const store = getBlobStore("ericson-drafts");
  await store.delete(id);

  return htmlResponse(200, "🗑️ Artículo descartado. No se publicó nada.", true);
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
};

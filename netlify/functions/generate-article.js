// netlify/functions/generate-article.js
//
// Punto de entrada RÁPIDO. Netlify corta las funciones normales a los
// pocos segundos, y generar un artículo completo con Claude tarda más que
// eso — por eso este endpoint solo prepara el borrador (id + links) y
// dispara la generación real en una "background function" (sin límite de
// tiempo corto), que actualiza el borrador cuando termina.
//
// Env vars requeridas en Netlify:
//   ANTHROPIC_API_KEY

const crypto = require("crypto");
const { getBlobStore } = require("./_lib/store");
const { sign } = require("./_lib/token");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let keyword, volume;
  try {
    const body = JSON.parse(event.body || "{}");
    keyword = body.keyword;
    volume = body.volume || null;
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  if (!keyword) {
    return { statusCode: 400, body: "Missing 'keyword' in request body" };
  }

  const id = crypto.randomUUID();
  const store = getBlobStore("ericson-drafts");
  await store.setJSON(id, { keyword, status: "generating" });

  const siteUrl = process.env.BLOG_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  const preview_url = `${siteUrl}/.netlify/functions/preview-article?id=${id}`;
  const approve_token = sign(id, "approve");
  const discard_token = sign(id, "discard");
  const approve_url = `${siteUrl}/.netlify/functions/approve-article?id=${id}&token=${approve_token}`;
  const discard_url = `${siteUrl}/.netlify/functions/discard-article?id=${id}&token=${discard_token}`;

  // Dispara la generación real en segundo plano (no esperamos a que termine)
  const bgUrl = `${siteUrl}/.netlify/functions/generate-article-background`;
  fetch(bgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, keyword, volume }),
  }).catch(() => {
    // Si falla el disparo, el borrador se queda en "generating";
    // preview-article lo reportará como pendiente.
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      keyword,
      status: "generating",
      preview_url,
      approve_url,
      discard_url,
      note: "El artículo se está generando. Espera 20-30 segundos y abre preview_url para verlo.",
    }),
  };
};

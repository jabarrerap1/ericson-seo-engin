// netlify/functions/generate-article.js
//
// Genera un artículo SEO completo para ericson-laboratoire.com.mx usando
// la API de Claude, y lo guarda temporalmente (Netlify Blobs) para que
// pueda revisarse en /.netlify/functions/preview-article?id=... antes de
// aprobar la publicación por WhatsApp.
//
// Sigue el mismo patrón de proxy serverless que ya usas en purelift.com.mx
// y ianegocios.io.
//
// Env vars requeridas en Netlify (Site settings > Environment variables):
//   ANTHROPIC_API_KEY

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");
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

  const systemPrompt = `Eres el redactor de contenido SEO de Ericson Laboratoire México, distribuidor exclusivo de una cosmecéutica profesional francesa de alta gama para spas, clínicas de medicina estética y profesionales de cabina.

VOZ DE MARCA:
- Tono: experto, clínico pero cálido, nunca vendedor agresivo. Hablas a profesionales (esteticistas, dermatólogos, dueños de spa), no a consumidor final.
- Vocabulario técnico correcto (activos, protocolos, pathologies cutáneas) pero explicado con claridad.
- Nunca haces afirmaciones médicas que requieran receta o diagnóstico — Ericson Laboratoire es cosmética profesional, no producto farmacéutico. Evita lenguaje que sugiera curar enfermedades (cumple con NOM-141-SSA1/SCFI-2012).
- Identidad visual de referencia (para describir imágenes/CTAs): charcoal #1a1916 y dorado #b8935a, tipografías Cormorant Garamond (títulos) + Jost (cuerpo).
- Siempre que sea natural, menciona que Ericson Laboratoire es el distribuidor exclusivo autorizado en México y que los productos están dirigidos a profesionales (no venta directa a público).

FORMATO DE SALIDA:
Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta estructura exacta:
{
  "title": "Título SEO (máx 60 caracteres, incluye la keyword principal)",
  "meta_description": "Meta descripción (máx 155 caracteres, incluye keyword y llamada a la acción)",
  "slug": "slug-en-minusculas-sin-acentos",
  "article_html": "Artículo completo en HTML semántico (h2, h3, p, ul/li). 900-1200 palabras. Debe incluir: introducción, 3-4 secciones con subtítulos, y una sección final de cierre invitando a contactar a Ericson Laboratoire como distribuidor profesional. NO incluyas <html>, <head> ni <body>, solo el contenido del artículo.",
  "image_alt": "Descripción para generar/alt-text de una imagen destacada del artículo",
  "internal_link_suggestions": ["2-3 sugerencias de páginas internas a las que enlazar, ej: /pathologies, /distribuidores, /catalogo"]
}`;

  const userPrompt = `Escribe un artículo SEO optimizado para la keyword: "${keyword}"${
    volume ? ` (búsquedas mensuales aproximadas: ${volume})` : ""
  }.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: `Anthropic API error: ${errText}` };
    }

    const data = await response.json();
    const textBlock = data.content.find((b) => b.type === "text");
    if (!textBlock) {
      return { statusCode: 502, body: "No text content returned from Claude" };
    }

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    let article;
    try {
      article = JSON.parse(cleaned);
    } catch (e) {
      return {
        statusCode: 502,
        body: `Failed to parse article JSON: ${e.message}\nRaw: ${cleaned}`,
      };
    }

    // Guarda el borrador para poder previsualizarlo antes de aprobar
    const id = crypto.randomUUID();
    const store = getStore("ericson-drafts");
    await store.setJSON(id, { keyword, ...article, status: "pending" });

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const preview_url = `${siteUrl}/.netlify/functions/preview-article?id=${id}`;
    const approve_token = sign(id, "approve");
    const discard_token = sign(id, "discard");
    const approve_url = `${siteUrl}/.netlify/functions/approve-article?id=${id}&token=${approve_token}`;
    const discard_url = `${siteUrl}/.netlify/functions/discard-article?id=${id}&token=${discard_token}`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        keyword,
        preview_url,
        approve_url,
        discard_url,
        ...article,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};

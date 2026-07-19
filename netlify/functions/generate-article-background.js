// netlify/functions/generate-article-background.js
//
// Background Function (nota el sufijo "-background" en el nombre — Netlify
// lo reconoce automáticamente y le da hasta 15 minutos en vez de los ~10
// segundos de una función normal). Aquí es donde realmente se llama a
// Claude para redactar el artículo; cuando termina, actualiza el borrador
// que generate-article.js ya había creado.
//
// Netlify no permite personalizar la respuesta de una background function
// (siempre regresa 202 de inmediato), así que este archivo no necesita
// devolver nada útil — el resultado se consulta vía preview-article.js.

const { getBlobStore } = require("./_lib/store");

exports.handler = async (event) => {
  let id, keyword, volume;
  try {
    const body = JSON.parse(event.body || "{}");
    id = body.id;
    keyword = body.keyword;
    volume = body.volume || null;
  } catch (e) {
    return;
  }

  if (!id || !keyword) return;

  const store = getBlobStore("ericson-drafts");

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
      await store.setJSON(id, {
        keyword,
        status: "error",
        error: `Anthropic API error: ${errText}`,
      });
      return;
    }

    const data = await response.json();
    const textBlock = data.content.find((b) => b.type === "text");
    if (!textBlock) {
      await store.setJSON(id, {
        keyword,
        status: "error",
        error: "No text content returned from Claude",
      });
      return;
    }

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    let article;
    try {
      article = JSON.parse(cleaned);
    } catch (e) {
      await store.setJSON(id, {
        keyword,
        status: "error",
        error: `Failed to parse article JSON: ${e.message}`,
      });
      return;
    }

    await store.setJSON(id, { keyword, ...article, status: "ready" });
  } catch (err) {
    await store.setJSON(id, {
      keyword,
      status: "error",
      error: `Server error: ${err.message}`,
    });
  }
};

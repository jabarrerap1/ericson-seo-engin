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
//
// PUBLICACIÓN AUTOMÁTICA (2-oct-2026): en cuanto el artículo queda listo se
// publica directo en el blog (misma lógica que approve-article.js), sin
// esperar el clic de "Aprobar". Después se manda un correo informativo vía
// Brevo con el link en vivo, o un aviso si algo falló. Para volver al modo
// con aprobación manual, define AUTO_PUBLISH=false en Netlify.

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
  console.log(`generate-article-background: generando "${keyword}" (${id})`);

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
        max_tokens: 8000,
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
      await notifyError(keyword, `Error de la API de Anthropic: ${errText.slice(0, 500)}`);
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
      await notifyError(keyword, "Claude no regresó texto.");
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
      await notifyError(keyword, `No se pudo leer el JSON del artículo: ${e.message}`);
      return;
    }

    await store.setJSON(id, { keyword, ...article, status: "ready" });

    if (process.env.AUTO_PUBLISH === "false") {
      console.log(`generate-article-background: borrador ${id} listo (AUTO_PUBLISH=false, no se publica)`);
      return;
    }

    const liveUrl = await publishDraft(id, { keyword, ...article });
    console.log(`generate-article-background: publicado -> ${liveUrl}`);
    await notify(
      `✅ Nuevo artículo publicado en el blog: ${article.title}`,
      `<p>Se publicó automáticamente el artículo de esta semana.</p>
       <p><strong>${escapeHtml(article.title)}</strong><br/>Keyword: ${escapeHtml(keyword)}</p>
       <p><a href="${liveUrl}" style="color:#b8935a;font-weight:600;">Ver artículo en vivo</a></p>`
    );
  } catch (err) {
    console.error(`generate-article-background: ${err.stack || err.message}`);
    await store.setJSON(id, {
      keyword,
      status: "error",
      error: `Server error: ${err.message}`,
    });
    await notifyError(keyword, `Server error: ${err.message}`);
  }
};

// Mueve el borrador a "ericson-published" y actualiza el índice del blog.
// Misma lógica que approve-article.js. Regresa la URL en vivo.
async function publishDraft(id, draft) {
  const draftsStore = getBlobStore("ericson-drafts");
  const publishedStore = getBlobStore("ericson-published");
  const { title, article_html, slug, meta_description, keyword } = draft;

  const baseSlug = slug || slugify(title || keyword);
  let finalSlug = baseSlug;
  let attempt = 1;
  while (await publishedStore.get(finalSlug)) {
    attempt += 1;
    finalSlug = `${baseSlug}-${attempt}`;
  }

  const published_at = new Date().toISOString();
  await publishedStore.setJSON(finalSlug, {
    title,
    article_html,
    meta_description,
    keyword,
    published_at,
  });

  const index = (await publishedStore.get("_index", { type: "json" })) || [];
  index.push({ slug: finalSlug, title, meta_description, date: published_at.slice(0, 10) });
  await publishedStore.setJSON("_index", index);

  await draftsStore.delete(id);

  const siteUrl = process.env.BLOG_BASE_URL || process.env.URL || "";
  return `${siteUrl}/blog/${finalSlug}`;
}

function slugify(s) {
  return String(s || "articulo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function notifyError(keyword, message) {
  await notify(
    "⚠️ Ericson SEO Engine — no se publicó el artículo de esta semana",
    `<p>Keyword: <strong>${escapeHtml(keyword)}</strong></p><p>${escapeHtml(message)}</p>`
  );
}

// Correo informativo vía Brevo. Si faltan las variables, solo deja log.
async function notify(subject, innerHtml) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Ericson SEO Engine";
  const to = process.env.NOTIFY_EMAIL || "jabarrerap@gmail.com";
  if (!apiKey || !senderEmail) {
    console.error("BREVO_API_KEY o BREVO_SENDER_EMAIL no configurados; no se envió aviso.");
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "api-key": apiKey },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent: `<div style="font-family:Arial,sans-serif;background:#f5f0eb;padding:24px;color:#1a1916;">
          <div style="max-width:520px;margin:0 auto;background:#fff;border-top:3px solid #b8935a;padding:28px;">
          <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#b8935a;margin:0 0 8px;">Ericson Laboratoire · Blog</p>
          ${innerHtml}</div></div>`,
      }),
    });
    if (!res.ok) console.error(`Brevo rechazó el correo: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error(`Error de red enviando correo vía Brevo: ${e.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

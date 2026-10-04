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
const { SYSTEM_PROMPT } = require("./_lib/brand-context");

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

  const systemPrompt = SYSTEM_PROMPT;

  const userPrompt = `Escribe el artículo de esta semana para la keyword: "${keyword}"${
    volume ? ` (búsquedas mensuales aproximadas: ${volume})` : ""
  }. Elige los protocolos de la lista que mejor respondan a esa búsqueda y sigue todas las reglas.`;

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

    article.article_html = cleanArticleHtml(article.article_html, article.title);

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
       <p><a href="${liveUrl}" style="color:#8C3B1F;font-weight:600;">Ver artículo en vivo</a></p>`
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

// Red de seguridad sobre el HTML que regresa Claude: quita un <h1> o un primer
// <h2> que repita el título (la página ya lo muestra) y frases que contradicen
// el modelo comercial actual (la línea para casa sí se vende al público a
// través de las cabinas).
function cleanArticleHtml(html, title) {
  let out = String(html || "").trim();
  out = out.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "");
  const first = out.match(/^\s*<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (first) {
    const norm = (s) => String(s).replace(/<[^>]+>/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
    const a = norm(first[1]), b = norm(title || "");
    if (b && (a.startsWith(b.slice(0, 25)) || b.startsWith(a.slice(0, 25)))) out = out.slice(first[0].length).trim();
  }
  out = out.replace(/[^.<>]*no se venden? (?:al|a) p[uú]blico(?: en)? general[^.<>]*\./gi, "");
  return out;
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
        htmlContent: `<div style="font-family:Arial,sans-serif;background:#F3F1EC;padding:24px;color:#121212;">
          <div style="max-width:520px;margin:0 auto;background:#fff;border-top:3px solid #8C3B1F;padding:28px;">
          <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8C3B1F;margin:0 0 8px;">Ericson Laboratoire · Blog</p>
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

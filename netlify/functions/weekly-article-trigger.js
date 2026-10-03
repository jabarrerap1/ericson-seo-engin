// netlify/functions/weekly-article-trigger.js
//
// SCHEDULED FUNCTION (ver configuración de horario en netlify.toml, sección
// [functions."weekly-article-trigger"]). Reemplaza al workflow de n8n que
// antes disparaba esto desde una instancia externa en Railway.
//
// Cada semana:
//   1. Toma la siguiente keyword pendiente de keywords.json (igual que
//      get-next-keyword.js).
//   2. Crea un borrador y dispara generate-article-background.js para que
//      Claude redacte el artículo (igual que generate-article.js).
//   3. generate-article-background.js publica el artículo automáticamente al
//      terminar y te avisa por correo (vía Brevo) con el link en vivo.
//
// Env vars requeridas (además de las que ya usan las demás funciones):
//   BREVO_API_KEY      — API key transaccional de Brevo
//   BREVO_SENDER_EMAIL — remitente verificado en Brevo
//   BREVO_SENDER_NAME  — opcional, default "Ericson SEO Engine"
//   NOTIFY_EMAIL       — a quién avisar (default jabarrerap@gmail.com)
//
// NOTA (9-sep-2026): la primera corrida de prueba se invocó 3 veces en unos
// segundos (visible en los logs de Netlify) sin que quedara claro por qué —
// posiblemente el propio scheduler de Netlify. Se agregó un candado corto
// en Blobs para que, si eso vuelve a pasar, solo la primera invocación haga
// trabajo real y las demás salgan de inmediato sin consumir otra keyword.

const crypto = require("crypto");
const { getBlobStore } = require("./_lib/store");

const KEYWORDS_URL =
  "https://raw.githubusercontent.com/jabarrerap1/ericson-seo-engin/main/keywords.json";

const LOCK_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

exports.handler = async () => {
  const internalUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  const notifyEmail = process.env.NOTIFY_EMAIL || "jabarrerap@gmail.com";

  try {
    // 0. Candado anti-duplicados: si ya corrimos hace menos de 5 minutos,
    // salir sin hacer nada (evita consumir varias keywords si el scheduler
    // dispara la función más de una vez seguida).
    const lockStore = getBlobStore("ericson-locks");
    const lastRun = await lockStore.get("weekly-trigger-last-run", { type: "text" });
    const now = Date.now();
    if (lastRun && now - Number(lastRun) < LOCK_WINDOW_MS) {
      console.log(
        `weekly-article-trigger: invocación duplicada ignorada (última corrida hace ${
          now - Number(lastRun)
        }ms)`
      );
      return;
    }
    await lockStore.set("weekly-trigger-last-run", String(now));

    // 1. Siguiente keyword pendiente (misma lógica que get-next-keyword.js)
    const response = await fetch(KEYWORDS_URL);
    if (!response.ok) {
      console.error(`No se pudo leer keywords.json: ${response.status}`);
      await notifyError(notifyEmail, `No se pudo leer keywords.json: ${response.status}`);
      return;
    }
    const data = await response.json();
    const queue = data.queue || [];

    const keywordStore = getBlobStore("ericson-keywords");
    const used = (await keywordStore.get("used", { type: "json" })) || [];
    const next = queue.find((k) => !used.includes(k.keyword));

    if (!next) {
      console.error("No quedan keywords pendientes en keywords.json.");
      await notifyError(
        notifyEmail,
        "No quedan keywords pendientes en keywords.json. Agrega más para que el blog siga publicando."
      );
      return;
    }

    used.push(next.keyword);
    await keywordStore.setJSON("used", used);
    console.log(`weekly-article-trigger: keyword seleccionada -> ${next.keyword}`);

    // 2. Crear borrador y disparar la generación en background (misma
    // lógica que generate-article.js)
    const id = crypto.randomUUID();
    const draftsStore = getBlobStore("ericson-drafts");
    await draftsStore.setJSON(id, { keyword: next.keyword, status: "generating" });

    const bgUrl = `${internalUrl}/.netlify/functions/generate-article-background`;
    try {
      const bgRes = await fetch(bgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, keyword: next.keyword, volume: next.volume || null }),
      });
      console.log(`weekly-article-trigger: background respondió ${bgRes.status}`);
      if (bgRes.status !== 202 && !bgRes.ok) {
        await notifyError(
          notifyEmail,
          `No se pudo iniciar la redacción del artículo "${next.keyword}" (HTTP ${bgRes.status}).`
        );
      }
    } catch (e) {
      console.error(`No se pudo disparar generate-article-background: ${e.message}`);
      await notifyError(
        notifyEmail,
        `No se pudo iniciar la redacción del artículo "${next.keyword}": ${e.message}`
      );
    }

    // PUBLICACIÓN AUTOMÁTICA (2-oct-2026): ya no se envía correo con botón
    // de "Aprobar". generate-article-background.js publica el artículo en
    // cuanto termina y manda un correo informativo con el link en vivo.
  } catch (err) {
    console.error(`Error inesperado en weekly-article-trigger: ${err.stack || err.message}`);
    await notifyError(notifyEmail, `Error inesperado en weekly-article-trigger: ${err.message}`);
  }
};

async function notifyError(to, message) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Ericson SEO Engine";
  if (!apiKey || !senderEmail) return;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject: "⚠️ Ericson SEO Engine — no se generó artículo esta semana",
        htmlContent: `<p style="font-family:sans-serif;">${escapeHtml(message)}</p>`,
      }),
    });
    if (!res.ok) {
      console.error(`Brevo rechazó el correo de error: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.error(`Error de red enviando correo de error vía Brevo: ${e.message}`);
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

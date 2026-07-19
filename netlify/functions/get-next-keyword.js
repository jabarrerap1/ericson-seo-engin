// netlify/functions/get-next-keyword.js
//
// Devuelve la siguiente keyword sin usar de keywords.json. En vez de
// reescribir el archivo en GitHub (lo cual requeriría un token con permisos
// de escritura), el "usado" se registra en Netlify Blobs. keywords.json
// sigue siendo la fuente humana editable — solo agrega nuevas keywords ahí
// cuando se te acaben.
//
// GET /.netlify/functions/get-next-keyword

const { getBlobStore } = require("./_lib/store");

const KEYWORDS_URL =
  "https://raw.githubusercontent.com/jabarrerap1/ericson-seo-engin/main/keywords.json";

exports.handler = async () => {
  try {
    const response = await fetch(KEYWORDS_URL);
    if (!response.ok) {
      return {
        statusCode: 502,
        body: `No se pudo leer keywords.json: ${response.status}`,
      };
    }
    const data = await response.json();
    const queue = data.queue || [];

    const store = getBlobStore("ericson-keywords");
    const used = (await store.get("used", { type: "json" })) || [];

    const next = queue.find((k) => !used.includes(k.keyword));

    if (!next) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "No quedan keywords pendientes en la cola. Agrega más en keywords.json.",
        }),
      };
    }

    used.push(next.keyword);
    await store.setJSON("used", used);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};

// netlify/functions/_lib/store.js
//
// Netlify Blobs a veces falla con "MissingBlobsEnvironmentError" en sitios
// nuevos por un bug conocido de detección automática (ver
// https://answers.netlify.com/t/missingblobsenvironmenterror-on-fresh-sites).
// Este helper evita el problema pasando siteID y token explícitos cuando
// están disponibles como variables de entorno, y cae de vuelta al modo
// automático si no.
//
// Env vars opcionales:
//   BLOBS_SITE_ID — el Project ID / API ID del sitio en Netlify
//   BLOBS_TOKEN   — un Personal Access Token generado en
//                    Netlify → User settings → Applications → New access token

const { getStore } = require("@netlify/blobs");

function getBlobStore(name) {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }

  return getStore(name);
}

module.exports = { getBlobStore };

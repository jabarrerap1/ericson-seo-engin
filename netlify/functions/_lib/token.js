// netlify/functions/_lib/token.js
//
// Genera y verifica un token firmado (HMAC) para que los links de
// "Aprobar" / "Descartar" en el correo no puedan ser adivinados o
// reutilizados por alguien que no sea Antonio.
//
// Env var requerida: APPROVAL_SECRET (cualquier cadena larga y aleatoria,
// defínela una sola vez en Netlify y no la cambies o invalidarás links
// pendientes).

const crypto = require("crypto");

function sign(id, action) {
  const secret = process.env.APPROVAL_SECRET || "";
  return crypto
    .createHmac("sha256", secret)
    .update(`${id}:${action}`)
    .digest("hex")
    .slice(0, 24);
}

function verify(id, action, token) {
  if (!token) return false;
  const expected = sign(id, action);
  // Comparación segura contra timing attacks
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };

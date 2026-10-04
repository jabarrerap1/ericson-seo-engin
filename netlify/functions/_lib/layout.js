// netlify/functions/_lib/layout.js
//
// Diseño compartido del blog, alineado con ericson-laboratoire.com.mx,
// protocolos.ericson-laboratoire.com.mx y productos.ericson-laboratoire.com.mx:
// papel y tinta, Bodoni Moda + IBM Plex, un solo acento óxido.

const SITE = "https://ericson-laboratoire.com.mx";
const WA = "525559898827";
const GA = "G-G01HE5H965";
const IMG = SITE + "/img/protocolos/";

// Protocolos que se enlazan automáticamente dentro de los artículos
// y que definen la imagen de portada de cada artículo.
const PROTOCOLS = [
  { id: "perfectgnx", name: "Perfect [GNX]", re: /perfect\s*\[?gnx\]?/i, img: "perfect-gnx.jpg", words: ["mancha", "pigment", "melasma", "tono", "luminosidad"] },
  { id: "linebtx", name: "Line Correction", re: /line\s+correction/i, img: "line-correction.jpg", words: ["arruga", "líneas de expresión", "botox", "relleno"] },
  { id: "supreme4d", name: "Supreme 4D", re: /supreme\s*4d/i, img: "supreme-4d.jpg", words: ["antiedad", "anti-edad", "envejecimiento", "piel madura", "firmeza"] },
  { id: "vcontour", name: "V-Contour Lift", re: /v-?contour/i, img: "v-contour-lift.jpg", words: ["flacidez", "óvalo", "lifting", "papada"] },
  { id: "novapeel", name: "Novapeel [AHA]", re: /novapeel/i, img: "novapeel-aha.jpg", words: ["aha", "exfoliación", "peeling", "ácido glicólico", "ácidos"] },
  { id: "actibiotic", name: "Acti-Biotic", re: /acti-?biotic/i, img: "acti-biotic.jpg", words: ["acné", "piel grasa", "poros", "sebo", "imperfecciones"] },
  { id: "vitamin", name: "Vitamin Energy", re: /vitamin\s+energy/i, img: "vitamin-energy.jpg", words: ["vitamina c", "fatiga", "apagada"] },
  { id: "eyezone", name: "Eye Zone", re: /eye\s+zone/i, img: "eye-zone.jpg", words: ["ojeras", "contorno de ojos", "bolsas"] },
  { id: "hydra", name: "Hydra Advanced", re: /hydra\s+advanced/i, img: "hydra-advanced.jpg", words: ["hidrata", "deshidrat", "piel seca"] },
  { id: "biom", name: "Biom+ Sensitive", re: /biom\+?\s*sensitive|biologic\s+defense/i, img: "biom-sensitive.jpg", words: ["sensible", "reactiva", "rojez", "microbioma", "rosácea"] },
  { id: "puroxy", name: "Pur Oxygène", re: /pur\s+oxyg[eè]ne/i, img: "pur-oxygene.jpg", words: ["contaminación", "detox", "oxígeno"] },
  { id: "osmoslim", name: "Osmo-Slim", re: /osmo-?slim/i, img: "osmo-slim.jpg", words: ["retención", "celulitis", "corporal", "drenaje"] },
  { id: "cryoslim", name: "Cryo-Slimming", re: /cryo-?slim/i, img: "cryo-slimming.jpg", words: ["criotermia", "frío", "adiposa"] },
];

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Protocolo principal de un artículo: el que más se menciona por nombre;
// si no menciona ninguno, el que más coincide por palabras clave.
function mainProtocol(post) {
  const text = (post.title + " " + (post.keyword || "") + " " + stripTags(post.article_html)).toLowerCase();
  let best = null, bestScore = 0;
  for (const p of PROTOCOLS) {
    const byName = (text.match(new RegExp(p.re.source, "gi")) || []).length * 5;
    const byWord = p.words.reduce((a, w) => a + (text.split(w).length - 1), 0);
    const score = byName + byWord;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best || PROTOCOLS[0];
}

function coverFor(post) {
  return IMG + mainProtocol(post).img;
}

// Enlaza la primera mención de cada protocolo a su ficha paso a paso,
// sin tocar etiquetas ni texto que ya esté dentro de un enlace.
function linkProtocols(html) {
  const done = new Set();
  let inLink = 0;
  return String(html || "").split(/(<[^>]+>)/g).map((part) => {
    if (part.startsWith("<")) {
      if (/^<a[\s>]/i.test(part)) inLink++;
      if (/^<\/a>/i.test(part)) inLink = Math.max(0, inLink - 1);
      return part;
    }
    if (inLink) return part;
    let out = part;
    for (const p of PROTOCOLS) {
      if (done.has(p.id)) continue;
      const m = out.match(p.re);
      if (m) {
        done.add(p.id);
        out = out.replace(p.re, `<a class="plink" href="https://protocolos.ericson-laboratoire.com.mx/?p=${p.id}&utm_source=blog&utm_medium=articulo">${m[0]}</a>`);
      }
    }
    return out;
  }).join("");
}

function readingMinutes(html) {
  const words = stripTags(html).split(" ").filter(Boolean).length;
  return Math.max(2, Math.round(words / 200));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  if (isNaN(d)) return iso;
  const m = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d.getUTCDate()} de ${m[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

const CSS = `
:root{--paper:#F3F1EC;--paper-2:#EAE6DE;--white:#FFF;--ink:#121212;--ink-2:#3E3D3A;--mute:#76736C;--line:rgba(18,18,18,.14);--line-strong:rgba(18,18,18,.32);--oxide:#8C3B1F;--oxide-soft:#F1E3DB;
--serif:'Bodoni Moda','Didot',Georgia,serif;--sans:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;--wrap:1240px;--gut:clamp(16px,4vw,40px)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%;height:auto}a{color:inherit}
:focus-visible{outline:2px solid var(--oxide);outline-offset:3px}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 var(--gut)}
.mono{font-family:var(--mono);font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.bar{background:var(--ink);color:#EDEAE3;font-size:13px}
.bar .wrap{display:flex;gap:14px;align-items:center;justify-content:center;min-height:40px;text-align:center}
.bar a{color:#fff;text-underline-offset:3px}.bar .dot{width:6px;height:6px;border-radius:50%;background:#D9795A;flex:none}
@media (max-width:560px){.bar .long{display:none}}@media (min-width:561px){.bar .short{display:none}}
header.nav{position:sticky;top:0;z-index:40;background:rgba(243,241,236,.94);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:68px;gap:24px}
.brand{display:flex;flex-direction:column;text-decoration:none;line-height:1}
.brand b{font-weight:600;font-size:17px;letter-spacing:.24em}
.brand span{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--mute);margin-top:6px}
.nav nav{display:flex;gap:28px;font-size:14px}.nav nav a{text-decoration:none;color:var(--ink-2)}
.nav nav a:hover,.nav nav a[aria-current]{color:var(--ink)}.nav nav a[aria-current]{text-decoration:underline;text-underline-offset:6px}
@media (max-width:980px){.nav nav{display:none}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:48px;padding:0 22px;border:1px solid var(--ink);background:var(--ink);color:#fff;text-decoration:none;font-size:14px;font-weight:500;cursor:pointer;transition:background .2s,color .2s}
.btn:hover{background:#000}.btn.ghost{background:transparent;color:var(--ink)}.btn.ghost:hover{background:var(--ink);color:#fff}
.btn.sm{height:40px;padding:0 16px;font-size:13px}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(38px,5.2vw,68px);line-height:1.03;letter-spacing:-.015em;text-wrap:balance}
h1 em{font-style:italic}
.kicker{display:flex;gap:14px;align-items:center;flex-wrap:wrap;color:var(--ink-2)}
.kicker i{font-style:normal;padding:4px 8px;border:1px solid var(--line-strong)}
.lede{font-size:18px;line-height:1.55;color:var(--ink-2);max-width:36em;margin-top:18px}
/* índice */
.bhead{border-bottom:1px solid var(--line)}
.bhead .wrap{padding-top:56px;padding-bottom:40px;display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:end}
.bhead .side{border-top:1px solid var(--line);padding-top:16px;font-size:14px;color:var(--ink-2)}
.bhead .side strong{display:block;font-family:var(--serif);font-weight:400;font-size:30px;line-height:1;color:var(--ink);margin-bottom:6px}
.feature{display:grid;grid-template-columns:1.1fr .9fr;gap:0;background:var(--white);border:1px solid var(--line);text-decoration:none;margin-top:40px;transition:border-color .2s}
.feature:hover{border-color:var(--ink)}
.feature .ph{position:relative;min-height:340px;background:var(--paper-2);overflow:hidden}
.feature .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.05)}
.feature .bd{padding:36px;display:flex;flex-direction:column;gap:14px;justify-content:center}
.feature h2{font-family:var(--serif);font-weight:400;font-size:clamp(28px,3vw,40px);line-height:1.08;text-wrap:balance}
.feature p{color:var(--ink-2)}
.meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--mute)}
.more{font-family:var(--mono);font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--oxide);margin-top:6px}
.sect-h{display:flex;justify-content:space-between;align-items:baseline;gap:16px;border-bottom:1px solid var(--ink);padding-bottom:10px;margin:56px 0 20px}
.sect-h h2{font-family:var(--serif);font-weight:400;font-size:clamp(24px,3vw,32px);line-height:1.1}.sect-h span{color:var(--mute)}
.posts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.post{display:flex;flex-direction:column;background:var(--white);border:1px solid var(--line);text-decoration:none;min-width:0;transition:border-color .2s,transform .2s}
.post:hover{border-color:var(--ink);transform:translateY(-2px)}
.post .ph{aspect-ratio:16/10;background:var(--paper-2);overflow:hidden}
.post .ph img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.05)}
.post .bd{padding:18px 18px 20px;display:flex;flex-direction:column;gap:8px;flex:1}
.post h3{font-family:var(--serif);font-weight:400;font-size:22px;line-height:1.15;text-wrap:balance}
.post p{font-size:14px;color:var(--ink-2);line-height:1.5}
.post .more{margin-top:auto;padding-top:12px;border-top:1px solid var(--line)}
.empty{padding:60px 0;color:var(--mute)}
/* artículo */
.ahead{border-bottom:1px solid var(--line)}
.ahead .wrap{padding-top:40px;padding-bottom:40px}
.crumbs{display:flex;gap:8px;flex-wrap:wrap;color:var(--mute);margin-bottom:26px}.crumbs a{text-decoration:none}.crumbs a:hover{color:var(--ink)}
.ahead h1{max-width:18em}
.ahead .lede{max-width:40em}
.ahead .meta{margin-top:22px;padding-top:16px;border-top:1px solid var(--line);max-width:760px}
.cover{margin-top:32px;aspect-ratio:21/8;background:var(--paper-2);overflow:hidden;position:relative}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 35%;filter:grayscale(1) contrast(1.05)}
.cover figcaption{position:absolute;left:16px;bottom:14px;color:#fff;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,.4)}
.agrid{display:grid;grid-template-columns:220px minmax(0,1fr) 300px;gap:48px;padding-top:48px;padding-bottom:24px;align-items:start}
.toc{position:sticky;top:96px}
.toc .mono{color:var(--mute);display:block;margin-bottom:10px}
.toc ol{list-style:none;border-top:1px solid var(--line)}
.toc li a{display:block;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px;line-height:1.4;color:var(--ink-2);text-decoration:none}
.toc li a:hover{color:var(--ink)}
.content{font-size:18px;line-height:1.75;color:var(--ink-2);max-width:40em}
.content>*+*{margin-top:1.05em}
.content h2{font-family:var(--serif);font-weight:400;color:var(--ink);font-size:clamp(26px,2.8vw,34px);line-height:1.15;margin-top:2em;padding-top:.6em;border-top:1px solid var(--line);scroll-margin-top:96px}
.content>h2:first-child{margin-top:0;padding-top:0;border-top:0}
.content h3{font-family:var(--sans);font-weight:600;color:var(--ink);font-size:19px;line-height:1.35;margin-top:1.6em}
.content ul,.content ol{padding-left:1.2em}.content li+li{margin-top:.4em}.content li::marker{color:var(--oxide)}
.content strong{color:var(--ink);font-weight:600}
.content a{color:var(--ink);text-decoration-color:var(--oxide);text-underline-offset:3px}
.content a.plink{background:var(--oxide-soft);text-decoration:none;padding:0 4px;border-bottom:1px solid var(--oxide)}
.content blockquote{border-left:2px solid var(--oxide);padding-left:18px;font-family:var(--serif);font-size:22px;line-height:1.4;color:var(--ink)}
.content table{width:100%;border-collapse:collapse;font-size:15px;display:block;overflow-x:auto}
.content th,.content td{border-bottom:1px solid var(--line);padding:10px 12px 10px 0;text-align:left;vertical-align:top}
.aside{position:sticky;top:96px;display:flex;flex-direction:column;gap:16px}
.box{background:var(--white);border:1px solid var(--line);padding:22px;display:flex;flex-direction:column;gap:12px}
.box.dark{background:var(--ink);color:#EDEAE3;border-color:var(--ink)}
.box.dark .btn{background:#fff;color:var(--ink);border-color:#fff}.box.dark .btn:hover{background:transparent;color:#fff}
.box h4{font-family:var(--serif);font-weight:400;font-size:24px;line-height:1.15}
.box p{font-size:14px;line-height:1.5}
.box .mono{color:var(--oxide)}.box.dark .mono{color:#D9795A}
.box .btn{width:100%}
.related{border-top:1px solid var(--line);margin-top:48px}
.endcta{background:var(--ink);color:#EDEAE3;margin-top:64px}
.endcta .wrap{display:grid;grid-template-columns:1.2fr .8fr;gap:40px;align-items:end;padding-top:56px;padding-bottom:56px}
.endcta h2{font-family:var(--serif);font-weight:400;font-size:clamp(30px,3.6vw,46px);line-height:1.06;color:#fff}
.endcta h2 em{font-style:italic}
.endcta p{color:#C9C6BF;margin-top:14px;max-width:34em}
.endcta .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.endcta .btn{background:#fff;color:var(--ink);border-color:#fff}.endcta .btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}
footer.foot{background:var(--ink);color:#C9C6BF;border-top:1px solid rgba(255,255,255,.12)}
footer.foot .wrap{padding-top:48px;padding-bottom:32px}
.fcols{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:32px}.fcols>*{min-width:0}
footer.foot .brand b{color:#fff}footer.foot .brand span{color:#9C998F}
footer.foot h4{font-family:var(--mono);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin-bottom:12px}
footer.foot ul{list-style:none;display:flex;flex-direction:column;gap:8px;font-size:14px}
footer.foot a{text-decoration:none}footer.foot a:hover{color:#fff}footer.foot p{font-size:14px;line-height:1.55}
.legal{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.14);margin-top:36px;padding-top:18px;font-size:12px;color:#9C998F}
@media (max-width:1100px){.agrid{grid-template-columns:minmax(0,1fr) 280px}.toc{display:none}}
@media (max-width:980px){
  .bhead .wrap,.endcta .wrap{grid-template-columns:1fr;gap:24px}.endcta .row{justify-content:flex-start}
  .feature{grid-template-columns:1fr}.feature .ph{min-height:0;aspect-ratio:16/9}
  .posts{grid-template-columns:1fr 1fr}
  .agrid{grid-template-columns:1fr;gap:32px}.aside{position:static}
  .fcols{grid-template-columns:1fr 1fr}
}
@media (max-width:640px){.posts{grid-template-columns:1fr}.content{font-size:17px}.feature .bd{padding:24px}.cover{aspect-ratio:16/9}}
@media (max-width:420px){.fcols{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

function page({ title, description, canonical, ogImage, ogType = "website", jsonld = [], body }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-site-verification" content="AdoQ9BwuVYjRn1UxsQ7n5ah2YtXbggBQBQfV2yp1abk">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="${ogType}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ""}
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${CSS}</style>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA}');
document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';
if(h.indexOf('wa.me')>-1)gtag('event','cta_click',{cta:'whatsapp',source:'blog'});
else if(h.indexOf('.pdf')>-1)gtag('event','cta_click',{cta:'guia_pdf',source:'blog'});
else if(h.indexOf('protocolos.')>-1)gtag('event','cta_click',{cta:'protocolo',label:h.split('?p=')[1]||'',source:'blog'});},true);</script>
</head>
<body>
${chromeTop()}
${body}
${footer()}
</body>
</html>`;
}

function chromeTop() {
  return `<div class="bar"><div class="wrap">
  <span class="dot" aria-hidden="true"></span>
  <span class="long">Cada protocolo Ericson incluye la certificación de tu equipo · presencial o por Zoom · sin mínimo de compra.</span>
  <span class="short">Certificación incluida.</span>
  <a href="https://wa.me/${WA}?text=${encodeURIComponent("Hola, quiero agendar mi formación presencial Ericson")}">Agenda tu formación</a>
</div></div>
<header class="nav"><div class="wrap">
  <a class="brand" href="${SITE}/" aria-label="Ericson Laboratoire México, sitio principal"><b>ERICSON</b><span>LABORATOIRE PARIS · MÉXICO</span></a>
  <nav aria-label="Principal">
    <a href="${SITE}/">Inicio</a>
    <a href="https://protocolos.ericson-laboratoire.com.mx/">Protocolos</a>
    <a href="https://productos.ericson-laboratoire.com.mx/">Productos para casa</a>
    <a href="/blog" aria-current="page">Blog técnico</a>
    <a href="${SITE}/ericson-conocenos.html">Conócenos</a>
  </nav>
  <a class="btn ghost sm" href="https://wa.me/${WA}?text=${encodeURIComponent("Hola, leí el blog de Ericson y quiero hablar con una especialista")}">WhatsApp</a>
</div></header>`;
}

function endCta() {
  return `<section class="endcta"><div class="wrap">
  <div>
    <p class="mono" style="color:#D9795A;margin:0">Para spas, clínicas y cosmetólogas</p>
    <h2 style="margin-top:12px">Elige el protocolo. <em>Nosotros certificamos a tu equipo.</em></h2>
    <p>16 protocolos de cabina de París, con certificación presencial o por Zoom incluida en la compra y sin mínimo para empezar.</p>
  </div>
  <div class="row">
    <a class="btn" href="${SITE}/descargas/guia-certificacion-ericson.pdf">Descargar guía de certificación</a>
    <a class="btn ghost" href="https://wa.me/${WA}?text=${encodeURIComponent("Hola, quiero agendar 15 minutos con una especialista Ericson")}">Hablar 15 min con una especialista</a>
  </div>
</div></section>`;
}

function footer() {
  return `<footer class="foot"><div class="wrap">
  <div class="fcols">
    <div>
      <a class="brand" href="${SITE}/"><b>ERICSON</b><span>LABORATOIRE PARIS · MÉXICO</span></a>
      <p style="margin-top:18px;max-width:28em">Cosmecéutica profesional francesa desde 1962. Distribuidor exclusivo en México: Operadora Abyzu S.A. de C.V.</p>
    </div>
    <div><h4>Profesionales</h4><ul>
      <li><a href="${SITE}/#certificacion">Certificación</a></li>
      <li><a href="https://pro.ericson-laboratoire.com.mx/">Portal Pro</a></li>
      <li><a href="https://eleskincare.ericson-laboratoire.com.mx/">Catálogo Eleskincare</a></li>
    </ul></div>
    <div><h4>Herramientas</h4><ul>
      <li><a href="https://protocolos.ericson-laboratoire.com.mx/">Guía de protocolos</a></li>
      <li><a href="https://productos.ericson-laboratoire.com.mx/">Productos para casa</a></li>
      <li><a href="${SITE}/ericson-conocenos.html">Conócenos</a></li>
      <li><a href="/blog">Blog técnico</a></li>
    </ul></div>
    <div><h4>Contacto</h4><ul>
      <li><a href="https://wa.me/${WA}">+52 55 5989 8827</a></li>
      <li>contacto@operadoraabyzu.com</li>
    </ul></div>
  </div>
  <div class="legal"><span>© ${new Date().getFullYear()} Ericson Laboratoire México · Operadora Abyzu S.A. de C.V.</span><a href="${SITE}/aviso-de-privacidad/">Aviso de privacidad</a></div>
</div></footer>`;
}

// Quita duplicados del índice (mismo título publicado dos veces): se queda el más reciente.
function dedupeIndex(index) {
  const seen = new Set();
  return (index || []).slice().reverse().filter((p) => {
    const k = String(p.title || "").trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

module.exports = {
  SITE, WA, PROTOCOLS, escapeHtml, stripTags, mainProtocol, coverFor, linkProtocols,
  readingMinutes, fmtDate, page, endCta, dedupeIndex,
};

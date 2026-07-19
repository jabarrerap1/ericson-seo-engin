// netlify/functions/robots.txt.js
//
// GET /robots.txt — permite el rastreo y apunta a sitemap.xml.

exports.handler = async () => {
  const siteUrl =
    process.env.BLOG_BASE_URL || process.env.URL || "https://ericson-seo-engine.netlify.app";

  const body = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body,
  };
};

<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="robots" content="noindex"/>
        <title>XML Sitemap – Airlines Group Travel</title>
        <style>
          body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px 16px; color: #14213d; }
          .wrap { max-width: 1000px; margin: 0 auto; }
          h1 { color: #0b3d91; font-size: 1.6rem; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e3e7ee; }
          th { background: #f4f6fa; }
          a { color: #0b3d91; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>XML Sitemap</h1>
          <p><xsl:value-of select="count(s:urlset/s:url)"/> URLs · generated automatically on every publish.</p>
          <table>
            <tr><th>URL</th><th>Last modified</th><th>Priority</th></tr>
            <xsl:for-each select="s:urlset/s:url">
              <tr>
                <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                <td><xsl:value-of select="s:lastmod"/></td>
                <td><xsl:value-of select="s:priority"/></td>
              </tr>
            </xsl:for-each>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>

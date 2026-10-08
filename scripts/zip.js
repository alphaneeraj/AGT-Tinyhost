// Builds a brochure-only copy of the site for tiiny.host's free plan and writes agt-site.zip.
// No admin, no forms, no data collection (their free-plan scanner rejects those); quote buttons
// link to the full site, and canonical URLs point there so search engines treat it as the main site.
// Usage: npm run zip
import fs from 'node:fs';
import path from 'node:path';

process.env.BROCHURE = 'true';
process.env.BASE_PATH = ''; // tiiny.host serves the ZIP from the domain root
const { ROOT, config } = await import('../src/config.js');
const { buildSite } = await import('../src/build.js');
const { makeSiteZip } = await import('../src/publish.js');

const build = buildSite();
const zip = makeSiteZip();
const out = path.join(ROOT, 'agt-site.zip');
fs.writeFileSync(out, zip);
const mb = (zip.length / 1024 / 1024).toFixed(2);
console.log(`Brochure build (${build.sitemapUrls} pages, canonical → ${config.siteUrl}) → ${out} (${mb} MB)${zip.length > 3 * 1024 * 1024 ? '  ⚠️ over the 3 MB free-plan limit' : ''}`);
console.log('Note: dist/ now holds the brochure build. Run "npm run build" before previewing the full site.');

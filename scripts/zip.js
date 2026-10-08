// Builds a copy of the site for tiiny.host (served from the domain root) and writes agt-site.zip.
// Usage: npm run zip   (override the address with SITE_URL=https://yourname.tiiny.site npm run zip)
import fs from 'node:fs';
import path from 'node:path';

process.env.SITE_URL ||= 'https://airlinesgrouptravel.tiiny.site';
const { ROOT } = await import('../src/config.js');
const { buildSite } = await import('../src/build.js');
const { makeSiteZip } = await import('../src/publish.js');

const build = buildSite();
const zip = makeSiteZip();
const out = path.join(ROOT, 'agt-site.zip');
fs.writeFileSync(out, zip);
const mb = (zip.length / 1024 / 1024).toFixed(2);
console.log(`Built ${build.sitemapUrls} URLs for ${process.env.SITE_URL} → ${out} (${mb} MB)${zip.length > 3 * 1024 * 1024 ? '  ⚠️ over the 3 MB free-plan limit' : ''}`);
console.log('Note: dist/ now holds the tiiny.host build. Run "npm run build" before previewing the GitHub Pages version.');

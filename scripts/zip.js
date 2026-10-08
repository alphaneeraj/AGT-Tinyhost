// Builds the site and writes agt-site.zip for manual upload at tiiny.host/manage: npm run zip
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
import { buildSite } from '../src/build.js';
import { makeSiteZip } from '../src/publish.js';

const build = buildSite();
const zip = makeSiteZip();
const out = path.join(ROOT, 'agt-site.zip');
fs.writeFileSync(out, zip);
const mb = (zip.length / 1024 / 1024).toFixed(2);
console.log(`Built ${build.sitemapUrls} URLs → ${out} (${mb} MB)${zip.length > 3 * 1024 * 1024 ? '  ⚠️ over the 3 MB free-plan limit' : ''}`);

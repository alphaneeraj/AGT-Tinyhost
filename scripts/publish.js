// Builds and uploads the site to tiiny.host via its API (Solo plan+): npm run publish:tiiny
import { buildSite } from '../src/build.js';
import { publishSite } from '../src/publish.js';

try {
  const build = buildSite();
  console.log(`Built ${build.sitemapUrls} URLs in ${build.ms} ms`);
  const result = await publishSite();
  console.log(`Published to ${result.url} via ${result.method}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

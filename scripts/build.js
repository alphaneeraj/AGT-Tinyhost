// Rebuilds dist/ from the database without starting the server: npm run build
import { buildSite } from '../src/build.js';

const result = buildSite();
console.log(`Built ${result.sitemapUrls} sitemap URLs (${result.blogPosts} blog posts, ${result.flightPages} flight pages) in ${result.ms} ms → dist/`);

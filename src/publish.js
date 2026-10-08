import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';

// Cache static assets on srht.site; HTML stays fresh so new posts show up immediately.
const SITE_CONFIG = {
  notFound: '404.html',
  fileConfigs: [
    { glob: '*.html', options: { cacheControl: 'max-age=300' } },
    { glob: '*.xml', options: { cacheControl: 'max-age=300' } },
    { glob: '*.txt', options: { cacheControl: 'max-age=300' } },
    { glob: '*.css', options: { cacheControl: 'max-age=86400' } },
    { glob: '*.js', options: { cacheControl: 'max-age=86400' } },
    { glob: '*.png', options: { cacheControl: 'max-age=2592000' } },
    { glob: '*.jpg', options: { cacheControl: 'max-age=2592000' } },
    { glob: '*.webp', options: { cacheControl: 'max-age=2592000' } },
    { glob: '*.svg', options: { cacheControl: 'max-age=2592000' } },
    { glob: '*.ico', options: { cacheControl: 'max-age=2592000' } },
  ],
};

const MUTATION = `mutation publish($domain: String!, $content: Upload!, $protocol: Protocol!, $subdirectory: String!, $siteConfig: SiteConfig) {
  publish(domain: $domain, content: $content, protocol: $protocol, subdirectory: $subdirectory, siteConfig: $siteConfig) { domain }
}`;

function makeTarball() {
  if (!fs.existsSync(path.join(config.paths.dist, 'index.html'))) {
    throw new Error('dist/ is empty – run a build first.');
  }
  const out = path.join(ROOT, 'data', 'site.tar.gz');
  // COPYFILE_DISABLE stops macOS tar from adding ._ AppleDouble files.
  execFileSync('tar', ['-C', config.paths.dist, '-czf', out, '.'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  return out;
}

/** Uploads dist/ to pages.sr.ht. Requires SRHT_TOKEN with the pages.sr.ht/PAGES:RW scope. */
export async function publishSite() {
  if (!config.srhtToken) throw new Error('SRHT_TOKEN is not set. Create a token at https://meta.sr.ht/oauth2 and add it to .env');
  const tarball = makeTarball();
  const blob = new Blob([fs.readFileSync(tarball)], { type: 'application/gzip' });
  const auth = { Authorization: `Bearer ${config.srhtToken}` };

  // GraphQL multipart upload (same call the official `hut` CLI makes) – supports the custom 404 page.
  const form = new FormData();
  form.append('operations', JSON.stringify({
    query: MUTATION,
    variables: { domain: config.srhtDomain, content: null, protocol: 'HTTPS', subdirectory: '/', siteConfig: SITE_CONFIG },
  }));
  form.append('map', JSON.stringify({ 0: ['variables.content'] }));
  form.append('0', blob, 'site.tar.gz');

  const res = await fetch('https://pages.sr.ht/query', { method: 'POST', headers: auth, body: form });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (res.ok && json?.data?.publish) {
    return { ok: true, method: 'graphql', domain: json.data.publish.domain, url: config.siteUrl, at: new Date().toISOString() };
  }

  // Fallback: the simple REST endpoint documented for curl.
  const legacy = new FormData();
  legacy.append('content', blob, 'site.tar.gz');
  const res2 = await fetch(`https://pages.sr.ht/publish/${config.srhtDomain}`, { method: 'POST', headers: auth, body: legacy });
  if (res2.ok) return { ok: true, method: 'rest', domain: config.srhtDomain, url: config.siteUrl, at: new Date().toISOString() };

  const detail = json?.errors?.map((e) => e.message).join('; ') || text.slice(0, 300);
  throw new Error(`Publish failed (GraphQL ${res.status}: ${detail}; REST ${res2.status}: ${(await res2.text()).slice(0, 200)})`);
}

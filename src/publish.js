import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { zipDirectory } from './zip.js';

const API = 'https://ext.tiiny.host/v1';

/** Builds the upload ZIP from dist/ (index.html at the ZIP root, as tiiny.host expects). */
export function makeSiteZip() {
  if (!fs.existsSync(path.join(config.paths.dist, 'index.html'))) {
    throw new Error('dist/ is empty – run a build first.');
  }
  return zipDirectory(config.paths.dist);
}

async function call(method, form) {
  const res = await fetch(`${API}/upload`, { method, headers: { 'x-api-key': config.tiinyApiKey }, body: form });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

/**
 * Publishes dist/ to tiiny.host through its API (requires a Solo plan or higher and TIINY_API_KEY).
 * Updates the existing site in place; creates it on the first publish.
 */
export async function publishSite() {
  if (!config.tiinyApiKey) {
    throw new Error('TIINY_API_KEY is not set. The tiiny.host API needs a Solo plan or higher – on the free plan use "Download site ZIP" and upload it at tiiny.host/manage.');
  }
  const zip = makeSiteZip();
  const form = () => {
    const f = new FormData();
    f.append('files', new Blob([zip], { type: 'application/zip' }), 'agt-site.zip');
    f.append('domain', config.tiinyDomain);
    return f;
  };

  let res = await call('PUT', form());
  let method = 'update';
  if (!res.ok && [400, 404].includes(res.status)) {
    // Site doesn't exist yet – create it.
    res = await call('POST', form());
    method = 'create';
  }
  if (!res.ok) {
    const detail = res.json?.message || res.json?.error || res.text.slice(0, 300);
    throw new Error(`tiiny.host publish failed (${res.status}): ${detail}`);
  }
  return { ok: true, method, domain: config.tiinyDomain, url: config.siteUrl, bytes: zip.length, at: new Date().toISOString() };
}

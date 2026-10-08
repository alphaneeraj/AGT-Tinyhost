import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Posts are JSON files committed to the repo by the live admin:
//   content/blog/<slug>.json      → /blog/<slug>/
//   content/flights/<slug>.json   → /flights/<slug>/
const DIRS = { blog: 'blog', flight: 'flights' };

const DEFAULTS = {
  title: '', slug: '', meta_title: '', meta_description: '', excerpt: '', content_html: '',
  cover_image: '', cover_alt: '', author: 'Airlines Group Travel', tags: '', faqs: [],
  airline: '', origin: '', destination: '', price_from: '', status: 'draft',
  published_at: null, updated_at: null,
};

function readType(type) {
  const dir = path.join(config.paths.content, DIRS[type]);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const post = { ...DEFAULTS, ...raw, type, slug: raw.slug || f.replace(/\.json$/, '') };
      post.id = `${type}:${post.slug}`;
      // Templates expect FAQs as a JSON string (same shape the admin stores).
      post.faqs = JSON.stringify(Array.isArray(post.faqs) ? post.faqs : []);
      post.updated_at = post.updated_at || post.published_at || new Date().toISOString();
      return post;
    });
}

/** Published posts of a type, newest first. Posts dated in the future stay hidden until then. */
export function publishedPosts(type, now = new Date()) {
  return readType(type)
    .filter((p) => p.status === 'published' && p.published_at && new Date(p.published_at) <= now)
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
}

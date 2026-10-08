import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config, ROOT } from './src/config.js';
import { leads, posts, slugify } from './src/db.js';
import { buildSite } from './src/build.js';
import { makeSiteZip, publishSite } from './src/publish.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

// ---- state -------------------------------------------------------------------

const state = { lastBuild: null, lastPublish: null, publishing: false };

function rebuild() {
  state.lastBuild = buildSite();
  if (config.autoPublish && config.tiinyApiKey) schedulePublish();
  return state.lastBuild;
}

let publishTimer = null;
function schedulePublish() {
  clearTimeout(publishTimer);
  publishTimer = setTimeout(() => runPublish().catch(() => {}), 3000);
}

async function runPublish() {
  if (state.publishing) throw new Error('A publish is already running.');
  state.publishing = true;
  try {
    state.lastPublish = await publishSite();
    return state.lastPublish;
  } catch (err) {
    state.lastPublish = { ok: false, error: err.message, at: new Date().toISOString() };
    console.error('[publish]', err.message);
    throw err;
  } finally {
    state.publishing = false;
  }
}

// ---- auth --------------------------------------------------------------------

const SECRET = config.sessionSecret || crypto.randomBytes(32).toString('hex');
if (!config.sessionSecret) console.warn('[warn] SESSION_SECRET not set – admin sessions reset on every restart.');
if (!config.adminPassword) console.warn('[warn] ADMIN_PASSWORD not set – admin login is disabled until you set it in .env');

const SESSION_COOKIE = 'agt_admin';
const SESSION_TTL = 12 * 60 * 60 * 1000;
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_TTL })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(SESSION_COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(SESSION_COOKIE.length + 1).split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

function requireAdmin(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Not signed in' });
  // Custom header blocks cross-site form/CSRF requests to the admin API.
  if (req.method !== 'GET' && req.get('X-AGT-Admin') !== '1') return res.status(403).json({ error: 'Missing admin header' });
  req.admin = session.u;
  next();
}

// Simple in-memory sliding-window rate limiter.
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, list] of hits) {
      const kept = list.filter((t) => t > cutoff);
      kept.length ? hits.set(k, kept) : hits.delete(k);
    }
  }, windowMs).unref();
  return (key) => {
    const cutoff = Date.now() - windowMs;
    const list = (hits.get(key) || []).filter((t) => t > cutoff);
    list.push(Date.now());
    hits.set(key, list);
    return list.length > max;
  };
}

const loginLimited = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const leadLimited = rateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

// ---- public lead endpoint (the static site's form posts here) ----------------

const siteOrigin = new URL(config.siteUrl).origin;
const allowedOrigins = new Set(
  [siteOrigin, `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`,
    ...config.allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean)],
);

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.options('/api/leads', (req, res) => {
  const origin = req.get('Origin');
  if (origin && allowedOrigins.has(origin)) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Accept', Vary: 'Origin' });
  }
  res.sendStatus(204);
});

app.post('/api/leads', express.urlencoded({ extended: false, limit: '32kb' }), express.json({ limit: '32kb' }), (req, res) => {
  const origin = req.get('Origin');
  const wantsJson = (req.get('Accept') || '').includes('application/json');
  if (origin && allowedOrigins.has(origin)) res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
  // Send the visitor back to the site they came from (live site or local preview).
  const back = origin && allowedOrigins.has(origin) && origin !== 'null' ? origin : siteOrigin;
  const finish = (ok, status, error) => {
    if (wantsJson) return res.status(status).json(ok ? { ok: true } : { ok: false, error });
    return res.redirect(303, `${back}/${ok ? 'thank-you' : 'form-error'}/`);
  };

  if (origin && origin !== 'null' && !allowedOrigins.has(origin)) return finish(false, 403, 'Origin not allowed');
  if (leadLimited(req.ip)) return finish(false, 429, 'Too many requests');

  const b = req.body || {};
  // Bots: honeypot filled, or submitted faster than a human could (ts is set by site.js on page load).
  const ts = Number(b.ts);
  if (b.website || (ts && Date.now() - ts < 2500)) return finish(true, 200);

  const lead = {
    name: clip(b.name, 120),
    email: clip(b.email, 160).toLowerCase(),
    phone: clip(b.phone, 40),
    from_city: clip(b.from_city, 120),
    to_city: clip(b.to_city, 120),
    depart_date: clip(b.depart_date, 20),
    return_date: clip(b.return_date, 20),
    passengers: clip(b.passengers, 20),
    trip_type: clip(b.trip_type, 30),
    cabin: clip(b.cabin, 30),
    message: String(b.message ?? '').trim().slice(0, 2000),
    source_page: clip(b.source_page, 300),
    utm: clip(b.utm, 500),
    ip: req.ip || '',
    user_agent: clip(req.get('User-Agent'), 300),
  };
  if (!lead.name || (!lead.phone && !lead.email)) return finish(false, 400, 'Name and phone or email are required');
  if (lead.email && !EMAIL_RE.test(lead.email)) return finish(false, 400, 'Invalid email');
  if (lead.phone && lead.phone.replace(/\D/g, '').length < 7) return finish(false, 400, 'Invalid phone');

  const saved = leads.create(lead);
  console.log(`[lead] #${saved.id} ${saved.name} ${saved.from_city} → ${saved.to_city}`);
  finish(true, 201);
});

// ---- admin auth routes ----------------------------------------------------------------

app.post('/admin/login', express.json({ limit: '4kb' }), (req, res) => {
  if (loginLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!config.adminPassword) return res.status(503).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });
  const { username = '', password = '' } = req.body || {};
  if (!safeEqual(username, config.adminUser) || !safeEqual(password, config.adminPassword)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const secure = req.secure ? '; Secure' : '';
  res.set('Set-Cookie', `${SESSION_COOKIE}=${makeSession(username)}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${SESSION_TTL / 1000}${secure}`);
  res.json({ ok: true });
});

app.post('/admin/logout', (req, res) => {
  res.set('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0`);
  res.json({ ok: true });
});

// ---- admin API -------------------------------------------------------------------

const api = express.Router();
api.use(requireAdmin);
api.use(express.json({ limit: '5mb' }));

api.get('/me', (req, res) => res.json({ user: req.admin }));

api.get('/status', (req, res) => {
  res.json({
    siteUrl: config.siteUrl,
    tiinyDomain: config.tiinyDomain,
    leadEndpoint: config.leadEndpoint,
    publishConfigured: !!config.tiinyApiKey,
    autoPublish: config.autoPublish,
    publishing: state.publishing,
    lastBuild: state.lastBuild,
    lastPublish: state.lastPublish,
    counts: {
      blogPublished: posts.published('blog').length,
      blogTotal: posts.list({ type: 'blog' }).length,
      flightPublished: posts.published('flight').length,
      flightTotal: posts.list({ type: 'flight' }).length,
    },
    leads: leads.stats(),
  });
});

// Admin content is trusted, but never let a pasted <script> or inline handler reach the public site,
// and convert Quill's internal list markup (<ol><li data-list="bullet">) into real <ul>/<ol> lists.
function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<span class="ql-ui"[^>]*><\/span>/g, '')
    .replace(/<ol>([\s\S]*?)<\/ol>/g, (m, inner) => {
      if (!inner.includes('data-list=')) return m;
      const tag = /data-list="(bullet|checked|unchecked)"/.test(inner) ? 'ul' : 'ol';
      return `<${tag}>${inner.replace(/\sdata-list="[^"]*"/g, '')}</${tag}>`;
    })
    .replace(/(<p><br><\/p>)+$/, '');
}

function normalizePost(body, existing) {
  const type = existing?.type || body.type;
  if (!['blog', 'flight'].includes(type)) throw new Error('type must be "blog" or "flight"');
  const title = clip(body.title ?? existing?.title, 200);
  if (!title) throw new Error('Title is required');
  const slug = slugify(body.slug || existing?.slug || title);
  if (posts.slugTaken(type, slug, existing?.id || 0)) throw new Error(`The URL slug "${slug}" is already used by another ${type} page`);

  let faqs = body.faqs ?? existing?.faqs ?? '[]';
  if (typeof faqs === 'string') {
    try { faqs = JSON.parse(faqs || '[]'); } catch { throw new Error('FAQs must be valid JSON'); }
  }
  if (!Array.isArray(faqs)) throw new Error('FAQs must be a list');
  faqs = faqs.map((f) => ({ q: clip(f.q, 300), a: String(f.a ?? '').trim().slice(0, 2000) })).filter((f) => f.q && f.a);

  const status = body.status === 'published' ? 'published' : 'draft';
  let published_at = body.published_at ? new Date(body.published_at) : null;
  if (published_at && Number.isNaN(published_at.getTime())) throw new Error('Invalid publish date');
  published_at = published_at ? published_at.toISOString().replace(/\.\d{3}Z$/, 'Z') : (existing?.published_at || null);

  const content = cleanHtml(String(body.content_html ?? existing?.content_html ?? ''));

  const pick = (k, n) => clip(body[k] ?? existing?.[k] ?? '', n);
  return {
    type, slug, title, status, published_at,
    meta_title: pick('meta_title', 200),
    meta_description: pick('meta_description', 320),
    excerpt: pick('excerpt', 400),
    content_html: content,
    cover_image: pick('cover_image', 500),
    cover_alt: pick('cover_alt', 200),
    author: pick('author', 120) || 'Airlines Group Travel',
    tags: pick('tags', 300),
    faqs: JSON.stringify(faqs),
    airline: pick('airline', 120),
    origin: pick('origin', 120),
    destination: pick('destination', 120),
    price_from: pick('price_from', 40),
  };
}

const withBuild = (data) => {
  let build;
  try { build = rebuild(); } catch (err) { build = { error: err.message }; }
  return { ...data, build };
};

api.get('/posts', (req, res) => {
  const list = posts.list({ type: req.query.type, status: req.query.status || undefined });
  res.json(list.map(({ content_html, ...rest }) => ({ ...rest, words: content_html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length })));
});

api.get('/posts/:id', (req, res) => {
  const post = posts.get(Number(req.params.id));
  post ? res.json(post) : res.status(404).json({ error: 'Not found' });
});

api.post('/posts', (req, res) => {
  try {
    const post = posts.create(normalizePost(req.body));
    res.status(201).json(withBuild({ post }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

api.put('/posts/:id', (req, res) => {
  const existing = posts.get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Not found' });
  try {
    const post = posts.update(existing.id, normalizePost(req.body, existing));
    res.json(withBuild({ post }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

api.delete('/posts/:id', (req, res) => {
  const ok = posts.remove(Number(req.params.id));
  ok ? res.json(withBuild({ ok })) : res.status(404).json({ error: 'Not found' });
});

const ALLOWED_IMAGES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
api.post('/upload', express.raw({ type: Object.keys(ALLOWED_IMAGES), limit: '8mb' }), (req, res) => {
  const ext = ALLOWED_IMAGES[req.get('Content-Type')];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Upload a JPG, PNG, WebP, GIF or AVIF image (max 8 MB).' });
  const base = slugify(path.parse(decodeURIComponent(req.get('X-Filename') || 'image')).name).slice(0, 50);
  const month = new Date().toISOString().slice(0, 7);
  const dir = path.join(config.paths.uploads, month);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${base}-${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, name), req.body);
  const url = `/uploads/${month}/${name}`;
  // Copy straight into dist so the preview can show it before the next build.
  fs.mkdirSync(path.join(config.paths.dist, 'uploads', month), { recursive: true });
  fs.copyFileSync(path.join(dir, name), path.join(config.paths.dist, 'uploads', month, name));
  res.status(201).json({ url });
});

api.get('/leads', (req, res) => res.json(leads.list({ status: req.query.status || undefined, q: req.query.q || undefined })));

api.patch('/leads/:id', (req, res) => {
  const { status, notes } = req.body || {};
  if (status && !['new', 'contacted', 'quoted', 'booked', 'closed', 'spam'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const lead = leads.update(Number(req.params.id), { status, notes: notes === undefined ? undefined : String(notes).slice(0, 5000) });
  lead ? res.json(lead) : res.status(404).json({ error: 'Not found' });
});

api.delete('/leads/:id', (req, res) => {
  leads.remove(Number(req.params.id)) ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
});

api.get('/leads.csv', (req, res) => {
  const rows = leads.list({ status: req.query.status || undefined });
  const cols = ['id', 'created_at', 'status', 'name', 'phone', 'email', 'from_city', 'to_city', 'depart_date', 'return_date', 'passengers', 'trip_type', 'cabin', 'message', 'notes', 'source_page', 'utm', 'ip'];
  // Prefix formula-looking cells so spreadsheets don't execute them.
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^([=@\t\r]|[+\-](?![\d\s(]))/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="agt-leads-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send('﻿' + csv);
});

api.post('/build', (req, res) => {
  try { res.json(rebuild()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ZIP of the whole site for manual upload at tiiny.host/manage (works on the free plan).
api.get('/site.zip', (req, res) => {
  try {
    rebuild();
    const zip = makeSiteZip();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="agt-site-${new Date().toISOString().slice(0, 10)}.zip"`,
      'X-Zip-Bytes': String(zip.length),
    });
    res.send(zip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.get('/site-size', (req, res) => {
  try { res.json({ bytes: makeSiteZip().length }); } catch (err) { res.status(500).json({ error: err.message }); }
});

api.post('/publish', async (req, res) => {
  try {
    rebuild();
    res.json(await runPublish());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/admin/api', api);

// ---- admin UI + local preview of the static site ------------------------------------------

app.use('/admin/vendor/quill', express.static(path.join(ROOT, 'node_modules', 'quill', 'dist')));
app.use('/admin', (req, res, next) => {
  res.set({ 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
  next();
}, express.static(config.paths.admin, { cacheControl: false, etag: false, lastModified: false }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(express.static(config.paths.dist, { extensions: ['html'] }));
app.use((req, res) => {
  const notFound = path.join(config.paths.dist, '404.html');
  fs.existsSync(notFound) ? res.status(404).sendFile(notFound) : res.status(404).send('Not found');
});

// ---- start ------------------------------------------------------------------------

rebuild();
app.listen(config.port, () => {
  console.log(`AGT admin:   http://localhost:${config.port}/admin/`);
  console.log(`Preview:     http://localhost:${config.port}/`);
  console.log(`Live site:   ${config.siteUrl}  (API publish ${config.tiinyApiKey ? 'ready' : 'off – use Download site ZIP'})`);
  console.log(`Lead form →  ${config.leadEndpoint}`);
});

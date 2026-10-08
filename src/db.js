import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.paths.db), { recursive: true });

export const db = new DatabaseSync(config.paths.db);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- Blog posts and flight pages share one table; "type" tells them apart.
  CREATE TABLE IF NOT EXISTS posts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    type             TEXT NOT NULL CHECK (type IN ('blog', 'flight')),
    slug             TEXT NOT NULL,
    title            TEXT NOT NULL,
    meta_title       TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    excerpt          TEXT NOT NULL DEFAULT '',
    content_html     TEXT NOT NULL DEFAULT '',
    cover_image      TEXT NOT NULL DEFAULT '',
    cover_alt        TEXT NOT NULL DEFAULT '',
    author           TEXT NOT NULL DEFAULT 'Airlines Group Travel',
    tags             TEXT NOT NULL DEFAULT '',
    faqs             TEXT NOT NULL DEFAULT '[]',
    airline          TEXT NOT NULL DEFAULT '',
    origin           TEXT NOT NULL DEFAULT '',
    destination      TEXT NOT NULL DEFAULT '',
    price_from       TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at     TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE (type, slug)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    from_city    TEXT NOT NULL DEFAULT '',
    to_city      TEXT NOT NULL DEFAULT '',
    depart_date  TEXT NOT NULL DEFAULT '',
    return_date  TEXT NOT NULL DEFAULT '',
    passengers   TEXT NOT NULL DEFAULT '',
    trip_type    TEXT NOT NULL DEFAULT '',
    cabin        TEXT NOT NULL DEFAULT '',
    message      TEXT NOT NULL DEFAULT '',
    source_page  TEXT NOT NULL DEFAULT '',
    utm          TEXT NOT NULL DEFAULT '',
    ip           TEXT NOT NULL DEFAULT '',
    user_agent   TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'booked', 'closed', 'spam')),
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_posts_type_status ON posts (type, status, published_at);
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);
`);

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export const POST_FIELDS = [
  'type', 'slug', 'title', 'meta_title', 'meta_description', 'excerpt', 'content_html',
  'cover_image', 'cover_alt', 'author', 'tags', 'faqs', 'airline', 'origin', 'destination',
  'price_from', 'status', 'published_at',
];

export const LEAD_FIELDS = [
  'name', 'email', 'phone', 'from_city', 'to_city', 'depart_date', 'return_date', 'passengers',
  'trip_type', 'cabin', 'message', 'source_page', 'utm', 'ip', 'user_agent',
];

export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'post';
}

// ---- posts -----------------------------------------------------------------

export const posts = {
  list({ type, status } = {}) {
    const where = [];
    const args = [];
    if (type) { where.push('type = ?'); args.push(type); }
    if (status) { where.push('status = ?'); args.push(status); }
    const sql = `SELECT * FROM posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY COALESCE(published_at, created_at) DESC, id DESC`;
    return db.prepare(sql).all(...args);
  },
  published(type) {
    return this.list({ type, status: 'published' });
  },
  get(id) {
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  },
  slugTaken(type, slug, exceptId = 0) {
    return !!db.prepare('SELECT 1 FROM posts WHERE type = ? AND slug = ? AND id != ?').get(type, slug, exceptId);
  },
  create(data) {
    const row = { ...data, updated_at: now() };
    if (row.status === 'published' && !row.published_at) row.published_at = now();
    const cols = Object.keys(row);
    const info = db
      .prepare(`INSERT INTO posts (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => row[c]));
    return this.get(Number(info.lastInsertRowid));
  },
  update(id, data) {
    const current = this.get(id);
    if (!current) return null;
    const row = { ...data, updated_at: now() };
    if (row.status === 'published' && !row.published_at && !current.published_at) row.published_at = now();
    const cols = Object.keys(row);
    db.prepare(`UPDATE posts SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...cols.map((c) => row[c]), id);
    return this.get(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM posts WHERE id = ?').run(id).changes > 0;
  },
};

// ---- leads -----------------------------------------------------------------

export const leads = {
  list({ status, q } = {}) {
    const where = [];
    const args = [];
    if (status) { where.push('status = ?'); args.push(status); }
    if (q) {
      where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR from_city LIKE ? OR to_city LIKE ?)');
      args.push(...Array(5).fill(`%${q}%`));
    }
    return db
      .prepare(`SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`)
      .all(...args);
  },
  get(id) {
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  },
  create(data) {
    const cols = LEAD_FIELDS.filter((c) => data[c] !== undefined);
    const info = db
      .prepare(`INSERT INTO leads (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => String(data[c])));
    return this.get(Number(info.lastInsertRowid));
  },
  update(id, { status, notes }) {
    const sets = [];
    const args = [];
    if (status !== undefined) { sets.push('status = ?'); args.push(status); }
    if (notes !== undefined) { sets.push('notes = ?'); args.push(notes); }
    if (!sets.length) return this.get(id);
    db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...args, id);
    return this.get(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM leads WHERE id = ?').run(id).changes > 0;
  },
  stats() {
    const total = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
    const fresh = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'").get().n;
    const week = db
      .prepare("SELECT COUNT(*) AS n FROM leads WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')")
      .get().n;
    return { total, new: fresh, last7Days: week };
  },
};

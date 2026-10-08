# AGT-Tinyhost

Promotional website for **[AirlinesGroupTravel.com](https://www.airlinesgrouptravel.com)**, hosted for free on
**[srht.site](https://srht.site)** (SourceHut Pages), with a small admin portal for publishing
**blog posts** and **flight pages** and for managing **leads** from the quote form.

- Live site: `https://airlinesgrouptravel.srht.site` (set by `SITE_URL`)
- Phone used across the whole site: **+1-888-609-1015** (change it in `src/config.js` → `brand.phone`, then `npm run icons`)

---

## How it works

```
 ┌──────────────────────────── Admin server (Node.js, this repo) ────────────────────────────┐
 │  /admin  ── rich-text editor (Quill) ──► SQLite (data/agt.sqlite) ──► static generator ──► dist/ │
 │  /api/leads  ◄── quote form POSTs from the live site; leads appear in /admin → Leads          │
 └──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │  "Publish to srht.site" (pages.sr.ht API)
                                               ▼
                     https://airlinesgrouptravel.srht.site   (static HTML only)
```

srht.site only serves static files and blocks third-party scripts and cross-origin `fetch`.
So:

1. Every page is pre-rendered HTML with self-hosted CSS/JS (no CDNs, no trackers), which matches the srht.site CSP.
2. The admin server stores content and rebuilds `dist/` on **every save or delete**, including the sitemap.
3. The quote form is a plain HTML `<form method="POST">` that submits straight to this server's `/api/leads`.
   The server saves the lead and redirects the visitor back to `/thank-you/` on the live site.
   This server therefore has to be reachable on the internet over **HTTPS** for leads to arrive (see *Deploying the admin server*).

## Features

| Area | What you get |
| --- | --- |
| Pages | Home, Group Travel, Flights (index + pages), Blog (index + posts, paginated), About, Contact, Privacy, Disclaimer, Thank-you, Form-error, custom 404 |
| SEO | Unique title/description, canonical, `robots` meta, hreflang, Open Graph, **Twitter card** (`summary_large_image`), author/article meta |
| Schema (JSON-LD) | `TravelAgency`/`Organization`, `WebSite`, `WebPage`, **`BreadcrumbList`** on every inner page, `BlogPosting`, `Service`, `FAQPage`, `Blog`, `CollectionPage`, `AboutPage`, `ContactPage` |
| Breadcrumbs | Visible breadcrumb trail plus matching schema on every inner page |
| Auto-generated files | `sitemap.xml` (with `lastmod` + image entries, styled by `sitemap.xsl`), `robots.txt` (AI crawlers allowed), `llms.txt`, `llms-full.txt`, `feed.xml` (RSS), `site.webmanifest` |
| Icons | `favicon.svg`, `favicon.ico` (16/32/48), `apple-touch-icon.png`, PWA icons 192/512, 1200×630 `og-image.png` |
| Performance/UX | No external requests, about 15 KB of CSS, deferred JS, lazy images, mobile-first layout, sticky click-to-call button, accessible skip link and FAQ accordions |
| Admin: content | Quill rich-text editor (headings, lists, links, images, video, code, alignment), raw HTML mode, image upload, cover image, slug control, draft/publish, publish date, tags, FAQ builder, SEO fields with length counters and a Google preview |
| Admin: flight pages | Same editor plus Airline / From / To / “Group fares from” fields |
| Admin: leads | Leads inbox with search, status (new → contacted → quoted → booked → closed / spam), internal notes, delete, CSV export, new-lead badge (polls every minute) |
| Lead protection | Honeypot field, minimum fill time, per-IP rate limit, origin allow-list, server-side validation |
| Admin security | Signed HttpOnly SameSite=Strict session cookie, login rate limit, CSRF header check, `noindex` on admin |

## Quick start (local)

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`).

```bash
git clone https://github.com/<you>/AGT-Tinyhost.git
cd AGT-Tinyhost
npm install
cp .env.example .env      # then set ADMIN_PASSWORD and SESSION_SECRET
npm start
```

- Admin portal: http://localhost:3000/admin/
- Local preview of the static site: http://localhost:3000/

## Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Public URL of the static site, e.g. `https://airlinesgrouptravel.srht.site`. Used in canonical URLs, sitemap, OG tags. |
| `SRHT_DOMAIN` | pages.sr.ht domain to publish to (defaults to the host of `SITE_URL`). |
| `SRHT_TOKEN` | SourceHut personal access token with scope **`pages.sr.ht/PAGES:RW`** (create one at https://meta.sr.ht/oauth2). |
| `AUTO_PUBLISH` | `true` publishes to srht.site automatically after each save or delete. |
| `LEAD_ENDPOINT` | **Public HTTPS** URL of this server's `/api/leads`. It is baked into the form on every page, so rebuild and publish after changing it. |
| `ALLOWED_ORIGINS` | Extra origins allowed to post leads (the `SITE_URL` origin is always allowed). |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Admin login. |
| `SESSION_SECRET` | Long random string used to sign admin sessions. |
| `TRUST_PROXY` | Set to `1` behind nginx/Caddy/Render/Railway so rate limits see the real visitor IP. |
| `PORT` | Admin server port (default 3000). |

## Publishing to srht.site

1. Create a SourceHut account named **`airlinesgrouptravel`**. Your site domain is then `airlinesgrouptravel.srht.site`.
2. Create an OAuth2 personal access token at https://meta.sr.ht/oauth2 with the `pages.sr.ht/PAGES:RW` grant and put it in `SRHT_TOKEN`.
3. Click **Admin → Build & publish → Publish to srht.site**, or run:

```bash
npm run publish:srht
```

Publishing uploads a tarball of `dist/` through the pages.sr.ht GraphQL API (the same call `hut pages publish` makes). It also sets
`404.html` as the not-found page and adds cache headers. If that call fails, it falls back to the REST `/publish` endpoint.

> Using a custom domain (e.g. `go.airlinesgrouptravel.com`) later? Point a CNAME to `pages.sr.ht`, then change `SITE_URL` and `SRHT_DOMAIN`.

## Day-to-day workflow

- **Write a blog post:** Admin → Blog posts → **New** → write → **Publish**. The page, blog index, homepage cards, related posts, sitemap, RSS and llms files all regenerate. With `AUTO_PUBLISH=true` it also goes live; otherwise click *Publish to srht.site*.
- **Add a flight page:** Admin → Flight pages → **New**. Fill in airline, route and fare. The page appears at `/flights/<slug>/`.
- **Unpublish:** open the post and click **Save draft**. It disappears from the site and sitemap on the next build.
- **Leads:** Admin → Leads. Change the status as you work each lead, add notes, or export a CSV.

## Deploying the admin server

The live form needs a public HTTPS URL for `LEAD_ENDPOINT`. Any Node host works. Mount persistent storage for `data/` (SQLite DB) and `uploads/`.

**Docker (VPS, Railway, Fly.io, Render…)**

```bash
docker build -t agt-tinyhost .
docker run -d --name agt -p 3000:3000 --env-file .env -v agt-data:/app/data -v agt-uploads:/app/uploads agt-tinyhost
```

**Plain VPS with pm2 behind Caddy (automatic HTTPS)**

```bash
npm ci --omit=dev && pm2 start "npm start" --name agt
# Caddyfile:  admin.yourdomain.com { reverse_proxy localhost:3000 }
```

Then set `LEAD_ENDPOINT=https://admin.yourdomain.com/api/leads` and `TRUST_PROXY=1`, restart, and publish once so every page carries the new form URL.

**Back up** `data/agt.sqlite` and `uploads/` regularly. They hold all your posts and leads, and are intentionally not committed to git.

## Project layout

```
server.js               Express app: admin API, lead endpoint, uploads, local preview
src/config.js           Env config + brand facts (phone, address, social links)
src/db.js               SQLite schema and queries (posts, leads)
src/build.js            Static site generator, sitemap, robots, llms, RSS, manifest
src/publish.js          Upload to pages.sr.ht
src/templates/          HTML layout, SEO head, schema, page templates
public/                 Static assets copied into every build (CSS, JS, icons)
admin/                  Admin portal (HTML/CSS/JS, Quill served from node_modules)
scripts/                build, publish and icon-generation CLIs
```

## Scripts

| Command | Does |
| --- | --- |
| `npm start` | Run admin server and preview on `PORT` |
| `npm run dev` | Same, restarting on file changes |
| `npm run build` | Regenerate `dist/` from the database |
| `npm run publish:srht` | Build and publish to srht.site |
| `npm run icons` | Re-render favicons and the OG image from `public/favicon.svg` (needed after changing the phone number) |

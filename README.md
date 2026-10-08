# AGT-Tinyhost

Promotional website for **[AirlinesGroupTravel.com](https://www.airlinesgrouptravel.com)**, hosted for free on
**[tiiny.host](https://tiiny.host)**, with a small admin portal for publishing
**blog posts** and **flight pages** and for managing **leads** from the quote form.

- Live site: `https://airlinesgrouptravel.tiiny.site` (set by `SITE_URL`)
- Phone used across the whole site: **+1-888-609-1015** (change it in `src/config.js` → `brand.phone`, then `npm run icons`)

---

## How it works

```
 ┌──────────────────────────── Admin server (Node.js, this repo) ────────────────────────────┐
 │  /admin  ── rich-text editor (Quill) ──► SQLite (data/agt.sqlite) ──► static generator ──► dist/ │
 │  /api/leads  ◄── quote form POSTs from the live site; leads appear in /admin → Leads          │
 └──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │  "Download site ZIP" → Upload at tiiny.host/manage
                                               │  (or one-click API publish on the Solo plan+)
                                               ▼
                     https://airlinesgrouptravel.tiiny.site   (static HTML only)
```

tiiny.host only serves static files (no PHP, no database). So:

1. Every page is pre-rendered HTML with self-hosted CSS/JS (no CDNs, no trackers).
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
| `SITE_URL` | Public URL of the static site, e.g. `https://airlinesgrouptravel.tiiny.site`. Must match your tiiny.host link name. |
| `TIINY_DOMAIN` | tiiny.host site to update through the API (defaults to the host of `SITE_URL`). |
| `TIINY_API_KEY` | tiiny.host API key (Solo plan+). Leave empty on the free plan. |
| `AUTO_PUBLISH` | `true` publishes to tiiny.host automatically after each save or delete (needs the API key). |
| `LEAD_ENDPOINT` | **Public HTTPS** URL of this server's `/api/leads`. It is baked into the form on every page, so rebuild and publish after changing it. |
| `ALLOWED_ORIGINS` | Extra origins allowed to post leads (the `SITE_URL` origin is always allowed). |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Admin login. |
| `SESSION_SECRET` | Long random string used to sign admin sessions. |
| `TRUST_PROXY` | Set to `1` behind nginx/Caddy/Render/Railway so rate limits see the real visitor IP. |
| `PORT` | Admin server port (default 3000). |

## Publishing to tiiny.host

**Free plan (what you have now: 1 project, 3 MB, tiiny banner)**

1. Admin → **Build & publish** → **Download site ZIP** (or run `npm run zip`, which writes `agt-site.zip`).
2. Go to https://tiiny.host/manage → **Upload file** → choose the ZIP. Set the link name to `airlinesgrouptravel`
   so the site lives at `https://airlinesgrouptravel.tiiny.site`.
   If that name is taken, pick another one and set `SITE_URL` in `.env` to match. Canonical URLs, the sitemap and OG tags all use it. Then download and upload the ZIP again.
3. After adding posts, download a fresh ZIP and replace the project. On the free plan that means deleting the project and uploading again under the same link name.

The admin page shows the current ZIP size and warns you when it goes over the 3 MB free limit. Large blog images are what usually push it over, so compress them before uploading.

**Solo plan or higher (API, custom domain, custom 404, no banner)**

1. tiiny.host → Manage Account → create an **API key** and put it in `.env` as `TIINY_API_KEY`.
2. Click **Publish via tiiny.host API**, or run `npm run publish:tiiny`. The site is updated in place (`PUT /v1/upload`) and created on the first publish.
3. Optional: `AUTO_PUBLISH=true` publishes after every save.

> Custom domain later (e.g. `go.airlinesgrouptravel.com`)? Connect it in tiiny.host, then change `SITE_URL` and `TIINY_DOMAIN`.

## Day-to-day workflow

- **Write a blog post:** Admin → Blog posts → **New** → write → **Publish**. The page, blog index, homepage cards, related posts, sitemap, RSS and llms files all regenerate. Then download the ZIP and upload it to tiiny.host (or publish via the API on the Solo plan).
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
src/publish.js          Site ZIP + tiiny.host API publish
src/zip.js              Dependency-free ZIP writer
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
| `npm run zip` | Build and write `agt-site.zip` for manual upload |
| `npm run publish:tiiny` | Build and publish through the tiiny.host API (Solo plan+) |
| `npm run icons` | Re-render favicons and the OG image from `public/favicon.svg` (needed after changing the phone number) |

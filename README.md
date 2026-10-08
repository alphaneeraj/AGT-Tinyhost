# AGT-Tinyhost

Promotional website for **[AirlinesGroupTravel.com](https://www.airlinesgrouptravel.com)** with a **live admin** for blog posts,
flight pages and leads. **100% free:** no servers, no paid plans.

- **Live site:** https://alphaneeraj.github.io/AGT-Tinyhost/
- **Live admin:** https://alphaneeraj.github.io/AGT-Tinyhost/admin/
- **Phone across the whole site:** **+1-888-609-1015** (change it in `src/config.js` → `brand.phone`, then run `npm run icons`)

---

## How it works (all free)

```
  You, in the live admin (/admin/)
     │  write / edit / delete a post            reads & updates leads
     ▼                                                   ▲
  GitHub repo (content/*.json + images)      Google Sheet "Leads" (Apps Script web app)
     │  every save = a commit                            ▲
     ▼                                                   │  quote form submissions
  GitHub Actions: npm run build ──► GitHub Pages ──► visitors ─┘
  (pages, sitemap.xml, robots.txt, llms.txt, llms-full.txt, RSS – about 1 minute)
```

| Piece | Free service |
| --- | --- |
| Website hosting | GitHub Pages (public repo) |
| Rebuild on every save + daily run for scheduled posts | GitHub Actions (unlimited for public repos) |
| Blog / flight page storage | JSON files in this repo (`content/blog`, `content/flights`), images in `content/uploads` |
| Lead inbox | A Google Sheet plus Google Apps Script (`google-apps-script/Code.gs`) |
| Admin | A static page; it talks to the GitHub API and the Apps Script directly from your browser |

## Features

| Area | What you get |
| --- | --- |
| Pages | Home, Group Travel, Flights (index + pages), Blog (index + posts, paginated), About, Contact, Privacy, Disclaimer, Thank-you, 404 |
| SEO | Unique title/description, canonical, robots meta, hreflang, Open Graph, **Twitter card** (`summary_large_image`), article meta |
| Schema (JSON-LD) | `TravelAgency`/`Organization`, `WebSite`, `WebPage`, **`BreadcrumbList`**, `BlogPosting`, `Service`, `FAQPage`, `Blog`, `CollectionPage`, `AboutPage`, `ContactPage` |
| Breadcrumbs | Visible breadcrumb trail plus matching schema on every inner page |
| Auto-generated | `sitemap.xml` (lastmod + images, styled), `robots.txt`, `llms.txt`, `llms-full.txt`, `feed.xml`, `site.webmanifest` |
| Icons | `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, PWA icons, 1200×630 `og-image.png` |
| Live admin: content | Quill rich-text editor, raw HTML mode, image uploads, cover image, slug control, draft / publish / **schedule**, tags, FAQ builder, SEO fields with counters and a Google preview, deploy status |
| Live admin: flight pages | Same editor plus Airline / From / To / “Group fares from” |
| Live admin: leads | Search, status (new → contacted → quoted → booked → closed / spam), notes, delete, CSV export, new-lead badge |
| Spam protection | Honeypot field and minimum fill time on the quote form |

---

## One-time setup

### 1. Live admin sign-in (GitHub token)

The admin saves posts into this repo, so it needs a GitHub token that can only touch this one repo.

1. Open https://github.com/settings/personal-access-tokens/new (a *fine-grained* token).
2. **Name:** `AGT admin`. **Expiration:** the longest offered. When it expires, make a new one the same way.
3. **Repository access:** *Only select repositories* → `alphaneeraj/AGT-Tinyhost`.
4. **Permissions → Repository permissions:**
   - **Contents: Read and write** (required, to save posts and images)
   - **Actions: Read-only** (optional, shows “Site is up to date / updating…” in the admin)
5. Click **Generate token** and copy it (it starts with `github_pat_`).
6. Open the live admin and paste it into **GitHub access token**.

The token is stored only in your browser. Use **Sign out** on shared computers.

### 2. Free lead inbox (Google Sheet)

1. Go to https://sheets.new and name the sheet `AGT Leads`.
2. Click **Extensions → Apps Script**. Delete the sample code and paste in everything from [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. On the `SECRET` line, replace `CHANGE-ME-TO-A-LONG-RANDOM-SECRET` with your own long random text. This is your **Leads key**. Save.
4. Click **Deploy → New deployment → ⚙ → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**, then **Authorize access** and allow it. Google may warn that the app is unverified: click *Advanced → Go to project*. It's your own script.
5. Copy the **Web app URL** (it ends in `/exec`).
6. Put it in [`site.config.json`](site.config.json) as `"leadsWebAppUrl": "https://script.google.com/macros/s/…/exec"`. You can edit the file right on GitHub (✏️ → Commit). The site rebuilds and the quote forms start sending leads.
7. In the live admin, sign out and sign in again with your token **and** the Leads key.

> If you change `Code.gs` later, use **Deploy → Manage deployments → ✏️ → Version: New version** so the URL stays the same.

Until step 6 is done, the quote form asks visitors to call +1-888-609-1015 instead, so no lead is silently lost.

---

## Day-to-day

- **New blog post:** Admin → *Blog posts* → **+ New blog post** → write → **Publish**. It's live in about a minute. The sitemap, RSS, `llms*.txt`, homepage cards and related posts all update.
- **Schedule a post:** set a future *Publish date* and click **Publish**. The daily build (06:00 UTC) puts it live on that day.
- **Flight pages:** Admin → *Flight pages* → **+ New flight page**.
- **Unpublish:** open the post → **Save draft**.
- **Leads:** Admin → *Leads*. You'll also find every lead in the Google Sheet.

## Settings (`site.config.json`)

| Key | Meaning |
| --- | --- |
| `siteUrl` | Public URL of the site (used in canonical URLs, sitemap, OG tags). |
| `repo` / `branch` | Where the admin saves content. |
| `leadsWebAppUrl` | Apps Script web app URL for the quote form and the Leads page. |

## Local preview (optional)

Requires Node.js 22.13+.

```bash
npm install
npm run preview      # http://localhost:3000/AGT-Tinyhost/
```

### Optional copy on tiiny.host (free plan)

`npm run zip` writes `agt-site.zip`, a **brochure-only** copy for tiiny.host. tiiny.host's free-plan scanner rejects uploads with
login pages, data-collecting forms or airline-brand lists (they look like phishing or fake airline support). So this copy has
**no admin, no forms and no airline list**. Its quote buttons link to the full GitHub Pages site, and its canonical URLs point there.
Upload it at https://tiiny.host/manage. It does not update by itself; re-run `npm run zip` and re-upload after new posts.

## Project layout

```
.github/workflows/deploy.yml   Build + deploy to GitHub Pages on every push and daily
site.config.json               Site URL, repo, lead inbox URL
content/                       Posts (blog/, flights/) and uploaded images – written by the admin
google-apps-script/Code.gs     Free lead inbox (paste into Google Apps Script)
admin/                         Live admin (static HTML/CSS/JS; Quill is copied in at build time)
src/config.js                  Config + brand facts (phone, address, social links)
src/content.js                 Reads posts from content/
src/build.js                   Static site generator, sitemap, robots, llms, RSS, manifest
src/templates/                 HTML layout, SEO head, schema, page templates
public/                        CSS, JS, icons copied into every build
scripts/                       build, preview, zip, icon generation
```

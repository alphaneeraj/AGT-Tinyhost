import fs from 'node:fs';
import path from 'node:path';
import { brand, config, ROOT } from './config.js';
import { publishedPosts } from './content.js';
import { abs, esc, stripHtml, truncate } from './templates/layout.js';
import {
  AIRLINES, DESTINATIONS, GROUP_FAQS, HOME_FAQS,
  aboutPage, contactPage, detailPage, formErrorPage, groupTravelPage, homePage, legalPage,
  listingPage, notFoundPage, parseFaqs, thankYouPage,
} from './templates/pages.js';

const PER_PAGE = 12;

// Static pages that appear in the sitemap and llms files: [path, title, summary, priority, changefreq]
const STATIC_PAGES = [
  ['/', 'Home – Group Flights for 10+ Travellers', 'Discounted group airfare for 10+ travellers on 200+ airlines.', '1.0', 'daily'],
  ['/group-travel/', 'Group Travel Booking Services', 'Group air travel for teams, schools, churches, weddings and corporate events.', '0.9', 'monthly'],
  ['/flights/', 'Group Flight Booking Pages', 'Airline and route group flight guides.', '0.8', 'daily'],
  ['/blog/', 'Group Travel Blog', 'Guides and tips for organizing group trips by air.', '0.8', 'daily'],
  ['/about/', 'About Airlines Group Travel', 'Company background and contact details.', '0.5', 'yearly'],
  ['/contact/', 'Contact & Group Quote', 'Request a free group flight quote.', '0.7', 'yearly'],
  ['/privacy-policy/', 'Privacy Policy', 'How enquiry data is handled.', '0.2', 'yearly'],
  ['/disclaimer/', 'Disclaimer', 'Trademark and fare disclaimer.', '0.2', 'yearly'],
];

// Templates use root-relative links ("/blog/"). On GitHub Pages the site lives under a project
// path, so every internal href/src/action gets the base path prefixed here, in one place.
export function withBase(html) {
  if (!config.basePath) return html;
  return html.replace(/(\s(?:href|src|action|poster)=")\/(?!\/)/g, `$1${config.basePath}/`);
}

function write(dist, urlPath, html) {
  const rel = urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath;
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, withBase(html));
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !path.basename(p).startsWith('.') });
}

const xmlEsc = (s) => esc(s);
const day = (iso) => (iso || new Date().toISOString()).slice(0, 10);

function related(list, post, n = 3) {
  const tags = new Set(post.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean));
  return list
    .filter((p) => p.id !== post.id)
    .map((p) => ({
      p,
      score: p.tags.split(',').filter((t) => tags.has(t.trim().toLowerCase())).length
        + (post.airline && p.airline === post.airline ? 2 : 0)
        + (post.destination && p.destination === post.destination ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.p);
}

function sitemapXml(entries) {
  const urls = entries
    .map((e) => `  <url>
    <loc>${xmlEsc(abs(e.path))}</loc>
    <lastmod>${day(e.lastmod)}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>${e.image ? `
    <image:image><image:loc>${xmlEsc(abs(e.image))}</image:loc></image:image>` : ''}
  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="${config.basePath}/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

function robotsTxt() {
  return `# ${brand.name} – ${config.siteUrl}
User-agent: *
Allow: /
Disallow: ${config.basePath}/thank-you/
Disallow: ${config.basePath}/form-error/
Disallow: ${config.basePath}/admin/

# AI / LLM crawlers are welcome – see /llms.txt
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${config.siteUrl}/sitemap.xml
`;
}

function rssXml(blogs) {
  const items = blogs.slice(0, 30).map((p) => `    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${abs(`/blog/${p.slug}/`)}</link>
      <guid isPermaLink="true">${abs(`/blog/${p.slug}/`)}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${xmlEsc(p.excerpt || truncate(stripHtml(p.content_html), 300))}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(brand.name)} Blog</title>
    <link>${config.siteUrl}/blog/</link>
    <atom:link href="${config.siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Group travel guides and airline group booking tips.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function llmsTxt(blogs, flights) {
  const line = (title, urlPath, summary) => `- [${title}](${abs(urlPath)}): ${summary}`;
  return `# ${brand.name}

> ${brand.name} (${brand.mainSite.replace('https://', '')}) is a US travel agency, founded in ${brand.foundingYear}, that books discounted group flights for 10+ passengers on 200+ airlines, plus business class and private jet charter. Phone (24/7): ${brand.phone}. Email: ${brand.email}.

This site (${config.siteUrl}) is the official promotional website and blog for AirlinesGroupTravel.com. Full plain-text content of every page is available at ${config.siteUrl}/llms-full.txt.

Key facts:
- Service: group airline reservations for sports teams, schools, churches, weddings, tours and corporate events
- Offers: locked group fares, "Book Now, Pay Later" deposits, flexible name changes, 24/7 support
- Promo code: AGT40
- Address: ${brand.address.street}, ${brand.address.city}, ${brand.address.region} ${brand.address.postalCode}, USA

## Main pages
${STATIC_PAGES.slice(0, 6).map(([p, t, s]) => line(t, p, s)).join('\n')}

## Group flight pages
${flights.length ? flights.map((p) => line(p.title, `/flights/${p.slug}/`, p.meta_description || truncate(stripHtml(p.content_html), 140))).join('\n') : '- (none published yet)'}

## Blog
${blogs.length ? blogs.map((p) => line(p.title, `/blog/${p.slug}/`, p.meta_description || p.excerpt || truncate(stripHtml(p.content_html), 140))).join('\n') : '- (none published yet)'}

## Official site
- [AirlinesGroupTravel.com](${brand.mainSite}/): main booking website
- [Group travel deals](${brand.mainSite}/deals): current offers
- [Private jet charter](${brand.mainSite}/private-jet-charter): charter service

## Optional
- [Sitemap](${config.siteUrl}/sitemap.xml)
- [RSS feed](${config.siteUrl}/feed.xml)
- [Privacy policy](${abs('/privacy-policy/')})
`;
}

function llmsFullTxt(blogs, flights) {
  const faqText = (faqs) => faqs.map((f) => `Q: ${f.q}\nA: ${stripHtml(f.a)}`).join('\n\n');
  const section = (title, url, text) => `\n\n---\n\n## ${title}\nURL: ${url}\n\n${text.trim()}`;
  let out = `# ${brand.name} – full site content

> Official promotional website and blog for ${brand.mainSite}. Group flight bookings for 10+ travellers on 200+ airlines. Call ${brand.phone} (24/7) or email ${brand.email}.
Generated: ${new Date().toISOString()}`;

  out += section('Home – Group Flights for 10+ Travellers', abs('/'), `
${brand.name} negotiates discounted group airfares for teams, schools, weddings, churches, tours and corporate events. One specialist, one contract, one price for everyone.

Benefits: discounted group fares; book now, pay later with staged deposits; one point of contact; 200+ airlines worldwide; business class and private jet charter.

How it works: 1) share your trip by phone (${brand.phone}) or the quote form; 2) compare group fare offers from several airlines; 3) hold seats with a deposit; 4) submit names and receive e-tickets.

Popular airlines for group booking: ${AIRLINES.map(([n]) => n).join(', ')}.
Popular group destinations: ${DESTINATIONS.map(([n]) => n).join(', ')}.

${faqText(HOME_FAQS)}`);

  out += section('Group Travel Booking Services', abs('/group-travel/'), `
Groups served: sports teams and tournaments; schools and universities; churches and mission trips; weddings and family reunions; corporate meetings, incentives, conferences and exhibitions; tour operators.
A group contract usually includes a locked fare for all seats, a deposit schedule, a names deadline and an attrition allowance. Some airlines add free bags or a complimentary ticket for large groups.
Code AGT40 gives an additional discount on eligible bookings.

${faqText(GROUP_FAQS)}`);

  out += section('About', abs('/about/'), `
Founded in ${brand.foundingYear}. US-based travel company focused on group air travel with 200+ partner airlines. Transparent quotes, flexible payment, immediate email/SMS confirmation, 24/7 human support.
Address: ${brand.address.street}, ${brand.address.city}, ${brand.address.region} ${brand.address.postalCode}. Phone: ${brand.phone}. Email: ${brand.email}.`);

  for (const p of flights) {
    const facts = [
      p.airline && `Airline: ${p.airline}`,
      p.origin && `From: ${p.origin}`,
      p.destination && `To: ${p.destination}`,
      p.price_from && `Group fares from: ${p.price_from}`,
    ].filter(Boolean).join('\n');
    const faqs = parseFaqs(p);
    out += section(`Flight page: ${p.title}`, abs(`/flights/${p.slug}/`), `${facts}\n\n${stripHtml(p.content_html)}${faqs.length ? '\n\n' + faqText(faqs) : ''}`);
  }
  for (const p of blogs) {
    const faqs = parseFaqs(p);
    out += section(`Blog: ${p.title}`, abs(`/blog/${p.slug}/`), `Published: ${day(p.published_at)} · Author: ${p.author}\n\n${stripHtml(p.content_html)}${faqs.length ? '\n\n' + faqText(faqs) : ''}`);
  }
  return out + '\n';
}

function manifest() {
  return JSON.stringify({
    name: brand.name,
    short_name: brand.shortName,
    description: `${brand.tagline} – discounted group flights. Call ${brand.phone}.`,
    start_url: `${config.basePath}/`,
    scope: `${config.basePath}/`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: brand.themeColor,
    icons: [
      { src: `${config.basePath}/assets/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${config.basePath}/assets/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${config.basePath}/assets/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${config.basePath}/favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
  }, null, 2);
}

// The live admin is a static page too: copy it, its Quill editor and a generated settings file.
function buildAdmin(dist) {
  const out = path.join(dist, 'admin');
  copyDir(config.paths.admin, out);
  const quill = path.join(ROOT, 'node_modules', 'quill', 'dist');
  fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
  for (const f of ['quill.js', 'quill.snow.css']) fs.copyFileSync(path.join(quill, f), path.join(out, 'vendor', f));
  const settings = {
    siteUrl: config.siteUrl,
    basePath: config.basePath,
    repo: config.repo,
    branch: config.branch,
    leadsWebAppUrl: config.leadsWebAppUrl,
  };
  fs.writeFileSync(path.join(out, 'settings.js'), `window.AGT_SETTINGS = ${JSON.stringify(settings, null, 2)};\n`);
}

/** Regenerates the entire static site into dist/. Returns a summary. */
export function buildSite() {
  const started = Date.now();
  const dist = config.paths.dist;
  const tmp = dist + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const blogs = publishedPosts('blog');
  const flights = publishedPosts('flight');
  const sitemap = [];
  const addUrl = (p, lastmod, priority, changefreq, image) => sitemap.push({ path: p, lastmod, priority, changefreq, image });
  const newest = (list) => list.reduce((m, p) => (p.updated_at > m ? p.updated_at : m), '') || new Date().toISOString();
  const siteLastmod = [newest(blogs), newest(flights)].sort().pop();

  copyDir(config.paths.public, tmp);
  copyDir(config.paths.uploads, path.join(tmp, 'uploads'));
  if (!config.brochure) buildAdmin(tmp);
  // Tell GitHub Pages not to run Jekyll over the output.
  fs.writeFileSync(path.join(tmp, '.nojekyll'), '');

  write(tmp, '/', homePage({ blogs, flights }));
  write(tmp, '/group-travel/', groupTravelPage());
  write(tmp, '/about/', aboutPage());
  write(tmp, '/contact/', contactPage());
  write(tmp, '/privacy-policy/', legalPage('privacy'));
  write(tmp, '/disclaimer/', legalPage('disclaimer'));
  if (!config.brochure) {
    write(tmp, '/thank-you/', thankYouPage());
    write(tmp, '/form-error/', formErrorPage());
  }
  write(tmp, '/404.html', notFoundPage());

  for (const [p, , , priority, changefreq] of STATIC_PAGES) {
    const dynamic = p === '/' || p === '/blog/' || p === '/flights/';
    addUrl(p, dynamic ? siteLastmod : null, priority, changefreq);
  }

  for (const [type, list, base] of [['blog', blogs, '/blog/'], ['flight', flights, '/flights/']]) {
    const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    for (let n = 1; n <= totalPages; n++) {
      const items = list.slice((n - 1) * PER_PAGE, n * PER_PAGE);
      write(tmp, n === 1 ? base : `${base}page/${n}/`, listingPage({ type, items, pageNum: n, totalPages }));
      if (n > 1) addUrl(`${base}page/${n}/`, newest(items), '0.4', 'weekly');
    }
    for (const post of list) {
      const urlPath = `${base}${post.slug}/`;
      write(tmp, urlPath, detailPage(post, related(list, post)));
      addUrl(urlPath, post.updated_at, type === 'flight' ? '0.8' : '0.7', 'weekly', post.cover_image || null);
    }
  }

  fs.writeFileSync(path.join(tmp, 'sitemap.xml'), sitemapXml(sitemap));
  fs.writeFileSync(path.join(tmp, 'robots.txt'), robotsTxt());
  fs.writeFileSync(path.join(tmp, 'feed.xml'), rssXml(blogs));
  fs.writeFileSync(path.join(tmp, 'llms.txt'), llmsTxt(blogs, flights));
  fs.writeFileSync(path.join(tmp, 'llms-full.txt'), llmsFullTxt(blogs, flights));
  fs.writeFileSync(path.join(tmp, 'site.webmanifest'), manifest());

  // Swap in the new build atomically so the preview never serves a half-written site.
  fs.rmSync(dist, { recursive: true, force: true });
  fs.renameSync(tmp, dist);

  return {
    builtAt: new Date().toISOString(),
    ms: Date.now() - started,
    blogPosts: blogs.length,
    flightPages: flights.length,
    sitemapUrls: sitemap.length,
  };
}

import { brand, config } from '../config.js';

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const abs = (urlPath) => (/^https?:/.test(urlPath) ? urlPath : config.siteUrl + urlPath);

export const stripHtml = (html) =>
  String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

export const truncate = (text, max = 158) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
};

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

export const readingMinutes = (html) => Math.max(1, Math.round(stripHtml(html).split(/\s+/).length / 220));

// Escapes "</" so JSON-LD can never close its own <script> tag.
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

export const phoneLink = (label = brand.phone, cls = '') =>
  `<a href="tel:${brand.phoneTel}" class="${cls}" data-track="call">${esc(label)}</a>`;

// ---- shared schema ---------------------------------------------------------

export const orgId = `${config.siteUrl}/#organization`;
export const websiteId = `${config.siteUrl}/#website`;

export function organizationSchema() {
  return {
    '@type': ['TravelAgency', 'Organization'],
    '@id': orgId,
    name: brand.name,
    alternateName: ['AirlinesGroupTravel', 'AGT'],
    slogan: brand.tagline,
    url: brand.mainSite,
    logo: { '@type': 'ImageObject', url: abs('/assets/icon-512.png'), width: 512, height: 512 },
    image: abs('/assets/og-image.png'),
    telephone: brand.phone,
    email: brand.email,
    foundingDate: brand.foundingYear,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: brand.address.street,
      addressLocality: brand.address.city,
      addressRegion: brand.address.region,
      postalCode: brand.address.postalCode,
      addressCountry: brand.address.country,
    },
    contactPoint: [{
      '@type': 'ContactPoint',
      telephone: brand.phone,
      contactType: 'reservations',
      areaServed: ['US', 'CA'],
      availableLanguage: ['English'],
      hoursAvailable: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    }],
    sameAs: [brand.mainSite, ...brand.social],
  };
}

function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': websiteId,
    url: config.siteUrl + '/',
    name: `${brand.name} – Group Flight Deals`,
    description: 'Group flight booking guides, airline group fare pages and travel tips from Airlines Group Travel.',
    publisher: { '@id': orgId },
    inLanguage: 'en-US',
  };
}

export function breadcrumbSchema(crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export function faqSchema(faqs) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.a) },
    })),
  };
}

// ---- components ------------------------------------------------------------

export const NAV = [
  { name: 'Home', path: '/' },
  { name: 'Group Travel', path: '/group-travel/' },
  { name: 'Flights', path: '/flights/' },
  { name: 'Blog', path: '/blog/' },
  { name: 'About', path: '/about/' },
  { name: 'Contact', path: '/contact/' },
];

function header(currentPath) {
  const links = NAV.map((n) => {
    const active = n.path === '/' ? currentPath === '/' : currentPath.startsWith(n.path);
    return `<li><a href="${n.path}"${active ? ' aria-current="page"' : ''}>${n.name}</a></li>`;
  }).join('');
  return `
<a class="skip" href="#main">Skip to content</a>
<div class="topbar">
  <div class="wrap topbar__inner">
    <span>24/7 group reservations desk · Use code <strong>AGT40</strong> for extra savings</span>
    ${phoneLink(`Call ${brand.phone}`, 'topbar__phone')}
  </div>
</div>
<header class="header">
  <div class="wrap header__inner">
    <a class="logo" href="/" aria-label="${esc(brand.name)} home">
      <img src="/favicon.svg" width="36" height="36" alt="" />
      <span><strong>Airlines</strong> Group Travel</span>
    </a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
    <nav id="site-nav" class="nav" aria-label="Main">
      <ul>${links}</ul>
      ${phoneLink(brand.phone, 'btn btn--call')}
    </nav>
  </div>
</header>`;
}

function footer() {
  const year = new Date().getUTCFullYear();
  return `
<section class="cta-band">
  <div class="wrap cta-band__inner">
    <div>
      <h2>Travelling with 10 or more people?</h2>
      <p>Speak with a group fare specialist now. Quotes in minutes, 24 hours a day.</p>
    </div>
    ${phoneLink(`Call ${brand.phone}`, 'btn btn--light btn--lg')}
  </div>
</section>
<footer class="footer">
  <div class="wrap footer__grid">
    <div>
      <p class="footer__brand">${esc(brand.name)}</p>
      <p>${esc(brand.tagline)}. Group flight bookings for teams, schools, churches, weddings, tours and corporate events.</p>
      <p>${phoneLink(brand.phone)}<br /><a href="mailto:${brand.email}">${brand.email}</a></p>
      <address>${esc(brand.address.street)}, ${esc(brand.address.city)}, ${esc(brand.address.region)} ${esc(brand.address.postalCode)}</address>
    </div>
    <div>
      <p class="footer__head">Explore</p>
      <ul>
        <li><a href="/group-travel/">Group Travel</a></li>
        <li><a href="/flights/">Group Flight Pages</a></li>
        <li><a href="/blog/">Travel Blog</a></li>
        <li><a href="/about/">About Us</a></li>
        <li><a href="/contact/">Request a Quote</a></li>
      </ul>
    </div>
    <div>
      <p class="footer__head">Official Site</p>
      <ul>
        <li><a href="${brand.mainSite}/" rel="noopener">AirlinesGroupTravel.com</a></li>
        <li><a href="${brand.mainSite}/deals" rel="noopener">Group Travel Deals</a></li>
        <li><a href="${brand.mainSite}/private-jet-charter" rel="noopener">Private Jet Charter</a></li>
        <li><a href="${brand.mainSite}/blogs" rel="noopener">Main Blog</a></li>
      </ul>
    </div>
    <div>
      <p class="footer__head">Resources</p>
      <ul>
        <li><a href="/sitemap.xml">XML Sitemap</a></li>
        <li><a href="/feed.xml">RSS Feed</a></li>
        <li><a href="/llms.txt">llms.txt</a></li>
        <li><a href="/privacy-policy/">Privacy Policy</a></li>
        <li><a href="/disclaimer/">Disclaimer</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer__legal">
    <p>© ${year} ${esc(brand.name)}. This is the official promotional micro-site of <a href="${brand.mainSite}/">AirlinesGroupTravel.com</a>. Airline names and logos are trademarks of their respective owners.</p>
  </div>
</footer>
<a class="float-call" href="tel:${brand.phoneTel}" aria-label="Call ${brand.phone}" data-track="call">
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>
  <span>${brand.phone}</span>
</a>`;
}

export function breadcrumbs(crumbs) {
  if (!crumbs || crumbs.length < 2) return '';
  const items = crumbs
    .map((c, i) =>
      i === crumbs.length - 1
        ? `<li aria-current="page">${esc(c.name)}</li>`
        : `<li><a href="${c.path}">${esc(c.name)}</a></li>`)
    .join('');
  return `<nav class="crumbs wrap" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

export function leadForm({ heading = 'Get a free group fare quote', compact = false, source = '/' } = {}) {
  if (config.brochure) {
    // Brochure build: no data collection on this host – send visitors to the phone line or the full site's form.
    return `
<div class="lead-form${compact ? ' lead-form--compact' : ''}">
  <h2 class="lead-form__title">${esc(heading)}</h2>
  <p class="lead-form__sub">Travelling with 10 or more people? Speak with a group travel specialist, 24/7.</p>
  <p>${phoneLink(`Call ${brand.phone}`, 'btn btn--primary btn--lg')}</p>
  <p><a class="btn btn--ghost btn--lg" href="${esc(config.siteUrl)}/contact/">Request a quote online</a></p>
  <p class="lead-form__sub">Or email <a href="mailto:${brand.email}">${brand.email}</a></p>
</div>`;
  }
  return `
<form class="lead-form${compact ? ' lead-form--compact' : ''}" method="POST" action="${esc(config.leadEndpoint || '/contact/')}" data-lead-form data-endpoint="${esc(config.leadEndpoint)}" data-thanks="${config.basePath}/thank-you/">
  <h2 class="lead-form__title">${esc(heading)}</h2>
  <p class="lead-form__sub">10+ travellers? Tell us your trip and a specialist will call you back. Prefer to talk now? ${phoneLink()}</p>
  <div class="lead-form__grid">
    <label>Full name<input name="name" required maxlength="120" autocomplete="name" /></label>
    <label>Phone<input name="phone" type="tel" required maxlength="40" autocomplete="tel" inputmode="tel" /></label>
    <label>Email<input name="email" type="email" required maxlength="160" autocomplete="email" /></label>
    <label>Group size
      <select name="passengers" required>
        <option value="">Select</option>
        <option>10–19</option><option>20–49</option><option>50–99</option><option>100+</option><option>Under 10</option>
      </select>
    </label>
    <label>Flying from<input name="from_city" required maxlength="120" placeholder="City or airport" /></label>
    <label>Flying to<input name="to_city" required maxlength="120" placeholder="City or airport" /></label>
    <label>Departure date<input name="depart_date" type="date" required /></label>
    <label>Return date<input name="return_date" type="date" /></label>
    <label>Trip type
      <select name="trip_type">
        <option>Round trip</option><option>One way</option><option>Multi-city</option>
      </select>
    </label>
    <label>Cabin
      <select name="cabin">
        <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
      </select>
    </label>
    <label class="lead-form__full">Trip details (optional)<textarea name="message" rows="3" maxlength="2000" placeholder="Event, flexible dates, preferred airline…"></textarea></label>
  </div>
  <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
  <input type="hidden" name="source_page" value="${esc(source)}" />
  <input type="hidden" name="utm" value="" />
  <input type="hidden" name="ts" value="" />
  <label class="lead-form__consent"><input type="checkbox" name="consent" value="yes" required /> I agree to be contacted about my trip by phone, SMS or email.</label>
  <button class="btn btn--primary btn--lg" type="submit">Get my group quote</button>
</form>`;
}

export function faqBlock(faqs, heading = 'Frequently asked questions') {
  if (!faqs?.length) return '';
  return `
<section class="faq">
  <h2>${esc(heading)}</h2>
  ${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><div>${f.aHtml ?? `<p>${esc(f.a)}</p>`}</div></details>`).join('')}
</section>`;
}

// ---- document ----------------------------------------------------------------

/**
 * Wraps page content in the full HTML document with every SEO tag.
 * @param {object} p
 * @param {string} p.path       Root-relative URL of the page, e.g. "/blog/my-post/"
 * @param {string} p.title      <title> text
 * @param {string} p.description Meta description
 * @param {Array}  p.crumbs     [{name, path}] for breadcrumbs (first is Home)
 * @param {Array}  p.schema     Extra JSON-LD nodes for the @graph
 */
export function page({
  path,
  title,
  description,
  body,
  crumbs = [],
  schema = [],
  ogType = 'website',
  image = '/assets/og-image.png',
  imageAlt = `${brand.name} – ${brand.tagline}`,
  noindex = false,
  article = null,
}) {
  const url = abs(path);
  const img = abs(image);
  const graph = [organizationSchema(), websiteSchema()];
  graph.push({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: { '@id': websiteId },
    about: { '@id': orgId },
    primaryImageOfPage: { '@type': 'ImageObject', url: img },
    inLanguage: 'en-US',
    ...(crumbs.length > 1 ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
  });
  if (crumbs.length > 1) graph.push({ ...breadcrumbSchema(crumbs), '@id': `${url}#breadcrumb` });
  graph.push(...schema);

  const articleMeta = article
    ? `
<meta property="article:published_time" content="${esc(article.published)}" />
<meta property="article:modified_time" content="${esc(article.modified)}" />
<meta property="article:author" content="${esc(article.author)}" />
${(article.tags || []).map((t) => `<meta property="article:tag" content="${esc(t)}" />`).join('\n')}`
    : '';

  return `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}" />
<link rel="canonical" href="${esc(url)}" />
<link rel="alternate" hreflang="en-us" href="${esc(url)}" />
<link rel="alternate" hreflang="x-default" href="${esc(url)}" />
<meta name="author" content="${esc(article?.author || brand.name)}" />
<meta name="theme-color" content="${brand.themeColor}" />
<meta name="format-detection" content="telephone=yes" />
<meta property="og:locale" content="en_US" />
<meta property="og:site_name" content="${esc(brand.name)}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(img)}" />
<meta property="og:image:alt" content="${esc(imageAlt)}" />${image === '/assets/og-image.png' ? `
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />` : ''}${articleMeta}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="${brand.twitter}" />
<meta name="twitter:creator" content="${brand.twitter}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(img)}" />
<meta name="twitter:image:alt" content="${esc(imageAlt)}" />
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="alternate" type="application/rss+xml" title="${esc(brand.name)} Blog" href="/feed.xml" />
<link rel="sitemap" type="application/xml" href="/sitemap.xml" />
<link rel="preload" href="/assets/site.css" as="style" />
<link rel="stylesheet" href="/assets/site.css" />
${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}
</head>
<body>
${header(path)}
${breadcrumbs(crumbs)}
<main id="main">
${body}
</main>
${footer()}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

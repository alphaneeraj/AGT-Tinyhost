import { brand } from '../config.js';
import {
  abs, esc, faqBlock, faqSchema, formatDate, leadForm, page, phoneLink, readingMinutes, stripHtml, truncate, orgId,
} from './layout.js';

const HOME = { name: 'Home', path: '/' };

const AIRLINES = [
  ['American Airlines', 'flights/american-airlines-group-booking'],
  ['Delta Air Lines', 'flights/delta-airlines-group-booking'],
  ['United Airlines', 'flights/united-airlines-group-booking'],
  ['Southwest Airlines', 'flights/southwest-airlines-group-travel-booking'],
  ['JetBlue', 'flights/jetblue-group-travel-flight-booking'],
  ['Alaska Airlines', 'flights/alaska-airlines-group-travel'],
  ['Lufthansa', 'flights/lufthansa-group-booking'],
  ['British Airways', 'flights/british-airways-group-travel-booking'],
  ['Emirates', 'flights/emirates-group-travel-flight-booking'],
  ['Qatar Airways', 'flights/qatar-airways-group-travel'],
  ['Air France', 'flights/air-france-group-booking'],
  ['Turkish Airlines', 'flights/turkish-airlines-group-booking'],
];

const DESTINATIONS = [
  ['Paris', 'paris'], ['London', 'london'], ['Las Vegas', 'las-vegas'], ['Dubai', 'dubai'],
  ['Tokyo', 'tokyo'], ['Singapore', 'singapore'], ['Miami', 'miami'], ['Tel Aviv', 'tel-aviv'],
];

const HOME_FAQS = [
  {
    q: 'How many passengers count as a group booking?',
    a: 'Most airlines treat 10 or more passengers travelling together on the same itinerary as a group. Airlines Group Travel can also help smaller parties of 6–9 find the best combined fares.',
  },
  {
    q: 'Are group flights cheaper than booking individual tickets?',
    a: 'Often, yes. Group fares are negotiated directly with the airline, so the price is usually lower than the published fare and is locked for the whole party, even as seats sell out.',
  },
  {
    q: 'Can I hold seats now and add names later?',
    a: 'Yes. Most group contracts let you reserve seats with a deposit and submit passenger names closer to departure, which is ideal for teams, tours and events with changing rosters.',
  },
  {
    q: 'Do you offer “Book Now, Pay Later” for groups?',
    a: 'Airlines Group Travel offers flexible deposit and staged payment options on many group fares, plus multiple payment methods including debit, credit and bank transfer.',
  },
  {
    q: 'How do I get a group flight quote?',
    a: `Call ${brand.phone} any time, 24/7, or fill in the quote form on this page. A group travel specialist will compare fares across 200+ airlines and send you options.`,
  },
];

const GROUP_FAQS = [
  {
    q: 'Which types of groups do you book?',
    a: 'Sports teams, schools and universities, church and mission groups, wedding parties, family reunions, corporate meetings and incentive trips, tour operators and conference delegations.',
  },
  {
    q: 'How early should I book group flights?',
    a: 'For the best fares and availability, request a quote 3–11 months before departure. Peak-season and holiday groups should book as early as possible.',
  },
  {
    q: 'Can group members fly from different cities?',
    a: 'Yes. We can build split itineraries so that travellers departing from different airports meet at the same destination on coordinated arrival times.',
  },
  {
    q: 'What happens if someone in my group cancels?',
    a: 'Group contracts typically allow name changes and a limited attrition allowance before ticketing. Your specialist will explain the exact rules for your airline before you pay a deposit.',
  },
];

// ---- cards -------------------------------------------------------------------

export function postCard(p) {
  const href = p.type === 'blog' ? `/blog/${p.slug}/` : `/flights/${p.slug}/`;
  const summary = p.excerpt || truncate(stripHtml(p.content_html), 150);
  const img = p.cover_image
    ? `<img src="${esc(p.cover_image)}" alt="${esc(p.cover_alt || p.title)}" loading="lazy" width="640" height="360" />`
    : `<div class="card__ph" aria-hidden="true"><span>${esc(p.type === 'flight' ? (p.airline || 'Group Flights') : 'Travel Blog')}</span></div>`;
  const meta = p.type === 'blog'
    ? `<time datetime="${esc(p.published_at)}">${formatDate(p.published_at)}</time> · ${readingMinutes(p.content_html)} min read`
    : [p.origin && p.destination ? `${esc(p.origin)} → ${esc(p.destination)}` : esc(p.airline), p.price_from ? `from ${esc(p.price_from)}` : '']
      .filter(Boolean).join(' · ');
  return `
<article class="card">
  <a href="${href}" class="card__img">${img}</a>
  <div class="card__body">
    <p class="card__meta">${meta}</p>
    <h3><a href="${href}">${esc(p.title)}</a></h3>
    <p>${esc(summary)}</p>
  </div>
</article>`;
}

const cards = (list) => `<div class="cards">${list.map(postCard).join('')}</div>`;

// ---- home ----------------------------------------------------------------------

export function homePage({ blogs, flights }) {
  const body = `
<section class="hero">
  <div class="wrap hero__inner">
    <div class="hero__copy">
      <p class="eyebrow">${esc(brand.tagline)}</p>
      <h1>Cheap Group Flights for 10+ Travellers on 200+ Airlines</h1>
      <p class="hero__lead">Airlines Group Travel negotiates discounted group airfares for teams, schools, weddings, churches, tours and corporate events. One specialist, one contract, one great price for everyone.</p>
      <ul class="ticks">
        <li>Locked group fares and flexible name changes</li>
        <li>Book now, pay later with staged deposits</li>
        <li>24/7 support from real group travel experts</li>
      </ul>
      <div class="hero__ctas">
        ${phoneLink(`Call ${brand.phone}`, 'btn btn--primary btn--lg')}
        <a class="btn btn--ghost btn--lg" href="#quote">Get a free quote</a>
      </div>
    </div>
    <div class="hero__form" id="quote">${leadForm({ compact: true, source: '/' })}</div>
  </div>
</section>

<section class="wrap section">
  <h2 class="section__title">Why groups book with Airlines Group Travel</h2>
  <div class="features">
    <div class="feature"><h3>Discounted group fares</h3><p>Special negotiated rates for 10+ passengers that are frequently lower than public fares on the same flight.</p></div>
    <div class="feature"><h3>Book now, pay later</h3><p>Secure seats with a small deposit and pay the balance closer to departure. Names can be added later.</p></div>
    <div class="feature"><h3>One point of contact</h3><p>A dedicated specialist manages seating, baggage, special requests and changes for the whole party.</p></div>
    <div class="feature"><h3>200+ airlines worldwide</h3><p>Domestic and international carriers, plus business class and private jet charter for premium groups.</p></div>
  </div>
</section>

<section class="section section--alt">
  <div class="wrap">
    <h2 class="section__title">Group bookings on popular airlines</h2>
    <ul class="pills">
      ${AIRLINES.map(([n, p]) => `<li><a href="${brand.mainSite}/${p}" rel="noopener">${esc(n)} group booking</a></li>`).join('')}
    </ul>
    <h2 class="section__title">Top group destinations</h2>
    <ul class="pills">
      ${DESTINATIONS.map(([n, s]) => `<li><a href="${brand.mainSite}/cheap-group-flights-to/${s}" rel="noopener">Group flights to ${esc(n)}</a></li>`).join('')}
    </ul>
  </div>
</section>

${flights.length ? `
<section class="wrap section">
  <div class="section__head"><h2 class="section__title">Featured group flight pages</h2><a href="/flights/">All flight pages →</a></div>
  ${cards(flights.slice(0, 6))}
</section>` : ''}

<section class="wrap section">
  <div class="section__head"><h2 class="section__title">From the travel blog</h2><a href="/blog/">All articles →</a></div>
  ${blogs.length ? cards(blogs.slice(0, 6)) : '<p class="empty">New group travel guides are coming soon. Follow our <a href="/feed.xml">RSS feed</a>.</p>'}
</section>

<section class="wrap section">
  <h2 class="section__title">How group booking works</h2>
  <ol class="steps">
    <li><strong>Share your trip.</strong> Call ${phoneLink()} or send the quote form with dates, cities and group size.</li>
    <li><strong>Compare offers.</strong> We request group fares from multiple airlines and send you the best options.</li>
    <li><strong>Hold your seats.</strong> Confirm with a deposit; fares are locked for the whole group.</li>
    <li><strong>Add names &amp; fly.</strong> Submit the passenger list before the deadline and receive e-tickets.</li>
  </ol>
</section>

<div class="wrap">${faqBlock(HOME_FAQS)}</div>`;

  return page({
    path: '/',
    title: `Cheap Group Flights & Airline Group Booking | ${brand.name}`,
    description: `Book discounted group flights for 10+ travellers on 200+ airlines. Locked fares, pay-later deposits and 24/7 experts. Call ${brand.phone} for a free group quote.`,
    body,
    schema: [faqSchema(HOME_FAQS)],
  });
}

// ---- static pages --------------------------------------------------------------

export function groupTravelPage() {
  const crumbs = [HOME, { name: 'Group Travel', path: '/group-travel/' }];
  const body = `
<div class="wrap content-grid">
  <article class="prose">
    <h1>Group Travel Booking Services</h1>
    <p class="lead">Moving a team, a class or a wedding party across the country or around the world takes more than a stack of individual tickets. Airlines Group Travel books one coordinated group contract so everyone flies together at a single negotiated price.</p>
    <h2>Who we help</h2>
    <ul>
      <li><strong>Sports teams &amp; tournaments</strong> – travel for players, coaches, equipment and supporters.</li>
      <li><strong>Schools &amp; universities</strong> – educational tours, band and choir trips, study abroad.</li>
      <li><strong>Churches &amp; mission trips</strong> – pilgrimages and service trips with flexible name lists.</li>
      <li><strong>Weddings &amp; family reunions</strong> – destination celebrations with guests from many cities.</li>
      <li><strong>Corporate &amp; MICE</strong> – meetings, incentives, conferences and exhibitions.</li>
      <li><strong>Tour operators</strong> – series group fares for scheduled departures.</li>
    </ul>
    <h2>What’s included in a group fare</h2>
    <p>Group contracts usually include a locked fare for all seats, a deposit schedule instead of full payment upfront, a deadline for submitting names, and a small allowance for travellers who drop out. Some airlines also add free checked bags or a complimentary ticket for large groups.</p>
    <h2>Premium and private options</h2>
    <p>Need more comfort? We also arrange <a href="${brand.mainSite}/deal/business-class-deals" rel="noopener">business class group deals</a> and <a href="${brand.mainSite}/private-jet-charter" rel="noopener">private jet charter</a> for executive teams and VIP groups.</p>
    <h2>Talk to a group specialist</h2>
    <p>Our reservations desk is open 24/7. Call ${phoneLink()} and mention code <strong>AGT40</strong> for an additional discount on eligible bookings.</p>
    ${faqBlock(GROUP_FAQS)}
  </article>
  <aside class="sidebar">${leadForm({ compact: true, source: '/group-travel/' })}</aside>
</div>`;
  return page({
    path: '/group-travel/',
    title: `Group Travel Booking for Teams, Schools & Events | ${brand.name}`,
    description: `Group air travel for sports teams, schools, churches, weddings and corporate events. Locked fares, flexible names and 24/7 support. Call ${brand.phone}.`,
    body,
    crumbs,
    schema: [
      {
        '@type': 'Service',
        name: 'Group flight booking',
        serviceType: 'Group airline reservations',
        provider: { '@id': orgId },
        areaServed: { '@type': 'Place', name: 'Worldwide' },
        url: abs('/group-travel/'),
      },
      faqSchema(GROUP_FAQS),
    ],
  });
}

export function aboutPage() {
  const crumbs = [HOME, { name: 'About', path: '/about/' }];
  const body = `
<div class="wrap prose prose--narrow">
  <h1>About Airlines Group Travel</h1>
  <p class="lead">Founded in ${brand.foundingYear}, Airlines Group Travel is a US-based travel company focused on one thing: getting groups in the air together for less.</p>
  <p>Our team of group travel specialists works with more than 200 domestic and international airlines to source discounted group fares, business class seats and private jet charters. We handle the details that make group travel complicated — deposits, name lists, seat blocks, special assistance and schedule changes — so organizers can focus on the trip itself.</p>
  <h2>Our promise</h2>
  <ul>
    <li>Transparent quotes with the fare rules explained up front.</li>
    <li>Flexible payment, including “Book Now, Pay Later” deposits on many fares.</li>
    <li>Immediate confirmation by email and SMS once your booking is ticketed.</li>
    <li>Real people available 24 hours a day, 7 days a week.</li>
  </ul>
  <h2>About this website</h2>
  <p>This site is the official promotional hub and travel blog for <a href="${brand.mainSite}/">AirlinesGroupTravel.com</a>. It publishes group travel guides and airline group booking information. For bookings, call ${phoneLink()} or <a href="/contact/">request a quote</a>.</p>
  <h2>Contact details</h2>
  <p>${esc(brand.name)}<br />${esc(brand.address.street)}, ${esc(brand.address.city)}, ${esc(brand.address.region)} ${esc(brand.address.postalCode)}<br />Phone: ${phoneLink()}<br />Email: <a href="mailto:${brand.email}">${brand.email}</a></p>
</div>`;
  return page({
    path: '/about/',
    title: `About Us | ${brand.name}`,
    description: `Airlines Group Travel books discounted group flights on 200+ airlines for teams, schools, churches and companies. Learn about our team and call ${brand.phone}.`,
    body,
    crumbs,
    schema: [{ '@type': 'AboutPage', '@id': abs('/about/') + '#about', url: abs('/about/'), about: { '@id': orgId } }],
  });
}

export function contactPage() {
  const crumbs = [HOME, { name: 'Contact', path: '/contact/' }];
  const body = `
<div class="wrap content-grid">
  <div class="prose">
    <h1>Contact Airlines Group Travel</h1>
    <p class="lead">Get a free, no-obligation group airfare quote. Our specialists reply quickly — or call us now for an instant answer.</p>
    <div class="contact-cards">
      <div class="contact-card"><h2>Call 24/7</h2><p>${phoneLink(brand.phone, 'big-phone')}</p></div>
      <div class="contact-card"><h2>Email</h2><p><a href="mailto:${brand.email}">${brand.email}</a></p></div>
      <div class="contact-card"><h2>Office</h2><address>${esc(brand.address.street)}<br />${esc(brand.address.city)}, ${esc(brand.address.region)} ${esc(brand.address.postalCode)}</address></div>
    </div>
  </div>
  <aside class="sidebar">${leadForm({ heading: 'Request a group quote', source: '/contact/' })}</aside>
</div>`;
  return page({
    path: '/contact/',
    title: `Contact Us – Group Flight Quote | ${brand.name}`,
    description: `Request a free group flight quote or call ${brand.phone} (24/7). Airlines Group Travel – discounted airfare for groups of 10 or more.`,
    body,
    crumbs,
    schema: [{ '@type': 'ContactPage', '@id': abs('/contact/') + '#contact', url: abs('/contact/'), about: { '@id': orgId } }],
  });
}

export function thankYouPage() {
  const body = `
<div class="wrap prose prose--narrow center">
  <h1>Thank you – we’ve received your request</h1>
  <p class="lead">A group travel specialist will contact you shortly with fare options.</p>
  <p>Need an answer right now? Call us 24/7:</p>
  <p>${phoneLink(`Call ${brand.phone}`, 'btn btn--primary btn--lg')}</p>
  <p><a href="/blog/">Read our group travel guides</a> while you wait.</p>
</div>`;
  return page({
    path: '/thank-you/',
    title: `Thank You | ${brand.name}`,
    description: 'Your group flight quote request has been received.',
    body,
    crumbs: [HOME, { name: 'Thank you', path: '/thank-you/' }],
    noindex: true,
  });
}

export function formErrorPage() {
  const body = `
<div class="wrap prose prose--narrow center">
  <h1>We couldn’t submit your request</h1>
  <p class="lead">Some details were missing or invalid. Please go back and check the form, or call us — we’re available 24/7.</p>
  <p>${phoneLink(`Call ${brand.phone}`, 'btn btn--primary btn--lg')}</p>
  <p><a href="/contact/">Back to the quote form</a></p>
</div>`;
  return page({
    path: '/form-error/',
    title: `Request Not Sent | ${brand.name}`,
    description: 'There was a problem submitting your request.',
    body,
    crumbs: [HOME, { name: 'Form error', path: '/form-error/' }],
    noindex: true,
  });
}

export function legalPage(kind) {
  const isPrivacy = kind === 'privacy';
  const path = isPrivacy ? '/privacy-policy/' : '/disclaimer/';
  const name = isPrivacy ? 'Privacy Policy' : 'Disclaimer';
  const content = isPrivacy
    ? `
  <p>This policy explains how ${esc(brand.name)} handles information submitted through this website.</p>
  <h2>Information we collect</h2>
  <p>When you request a quote we collect the details you enter — name, phone, email, travel dates, cities, group size and any message — together with the page you submitted from, campaign (UTM) parameters, your IP address and browser user agent for fraud prevention.</p>
  <h2>How we use it</h2>
  <p>We use your information only to respond to your enquiry, prepare quotes and service your booking. We do not sell your personal information.</p>
  <h2>Cookies and tracking</h2>
  <p>This site does not use advertising or third-party tracking cookies.</p>
  <h2>Your choices</h2>
  <p>To access, correct or delete your information, email <a href="mailto:${brand.email}">${brand.email}</a> or call ${phoneLink()}.</p>
  <p>The full privacy policy of the main site is available at <a href="${brand.mainSite}/privacy-policy" rel="noopener">AirlinesGroupTravel.com/privacy-policy</a>.</p>`
    : `
  <p>${esc(brand.name)} is an independent travel agency and is not an airline. Airline names, logos and trademarks shown or mentioned on this site belong to their respective owners and are used for identification only; their use does not imply endorsement.</p>
  <p>Fares, schedules and availability are subject to change until ticketed. Group fares are governed by the airline’s group contract and fare rules, which your specialist will share before payment.</p>
  <p>Articles on this blog are for general information. Always confirm baggage, documentation and visa requirements with the airline and relevant authorities before travel.</p>
  <p>See the <a href="${brand.mainSite}/terms-and-conditions" rel="noopener">terms and conditions</a> and <a href="${brand.mainSite}/refund-policy" rel="noopener">refund policy</a> on the main site.</p>`;
  return page({
    path,
    title: `${name} | ${brand.name}`,
    description: `${name} for the ${brand.name} promotional website and blog.`,
    body: `<div class="wrap prose prose--narrow"><h1>${name}</h1>${content}</div>`,
    crumbs: [HOME, { name, path }],
  });
}

export function notFoundPage() {
  const body = `
<div class="wrap prose prose--narrow center">
  <h1>Page not found</h1>
  <p class="lead">The page you were looking for has moved or no longer exists.</p>
  <p><a class="btn btn--primary" href="/">Go to the homepage</a> <a class="btn btn--ghost" href="/blog/">Browse the blog</a></p>
  <p>Need help booking a group flight? Call ${phoneLink()}.</p>
</div>`;
  return page({
    path: '/404.html',
    title: `Page Not Found | ${brand.name}`,
    description: 'The page you requested could not be found.',
    body,
    noindex: true,
  });
}

// ---- listings ------------------------------------------------------------------

export function listingPage({ type, items, pageNum, totalPages }) {
  const isBlog = type === 'blog';
  const base = isBlog ? '/blog/' : '/flights/';
  const label = isBlog ? 'Blog' : 'Flights';
  const path = pageNum === 1 ? base : `${base}page/${pageNum}/`;
  const crumbs = [HOME, { name: label, path: base }];
  if (pageNum > 1) crumbs.push({ name: `Page ${pageNum}`, path });
  const h1 = isBlog ? 'Group Travel Blog' : 'Group Flight Booking Pages';
  const intro = isBlog
    ? 'Guides, airline policies and money-saving tips for organizing group trips by air.'
    : 'Airline-by-airline and route-by-route guides to booking discounted group flights.';
  const pager = totalPages > 1
    ? `<nav class="pager" aria-label="Pagination">
        ${pageNum > 1 ? `<a rel="prev" href="${pageNum === 2 ? base : `${base}page/${pageNum - 1}/`}">← Newer</a>` : '<span></span>'}
        <span>Page ${pageNum} of ${totalPages}</span>
        ${pageNum < totalPages ? `<a rel="next" href="${base}page/${pageNum + 1}/">Older →</a>` : '<span></span>'}
      </nav>`
    : '';
  const body = `
<div class="wrap section">
  <header class="page-head"><h1>${h1}${pageNum > 1 ? ` – Page ${pageNum}` : ''}</h1><p class="lead">${intro}</p></header>
  ${items.length ? cards(items) : `<p class="empty">No ${isBlog ? 'articles' : 'flight pages'} published yet. Call ${phoneLink()} for a group quote today.</p>`}
  ${pager}
</div>`;
  return page({
    path,
    title: `${h1}${pageNum > 1 ? ` – Page ${pageNum}` : ''} | ${brand.name}`,
    description: `${intro} Call ${brand.phone} for a free group quote.`,
    body,
    crumbs,
    schema: [{
      '@type': isBlog ? 'Blog' : 'CollectionPage',
      '@id': abs(path) + '#list',
      name: h1,
      url: abs(path),
      publisher: { '@id': orgId },
      ...(isBlog
        ? { blogPost: items.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: abs(`/blog/${p.slug}/`), datePublished: p.published_at })) }
        : { hasPart: items.map((p) => ({ '@type': 'WebPage', name: p.title, url: abs(`/flights/${p.slug}/`) })) }),
    }],
  });
}

// ---- detail pages ----------------------------------------------------------------

export function parseFaqs(post) {
  try {
    const list = JSON.parse(post.faqs || '[]');
    return Array.isArray(list) ? list.filter((f) => f && f.q && f.a) : [];
  } catch {
    return [];
  }
}

export function detailPage(post, related) {
  const isBlog = post.type === 'blog';
  const base = isBlog ? '/blog/' : '/flights/';
  const path = `${base}${post.slug}/`;
  const crumbs = [HOME, { name: isBlog ? 'Blog' : 'Flights', path: base }, { name: post.title, path }];
  const description = post.meta_description || post.excerpt || truncate(stripHtml(post.content_html));
  const title = post.meta_title || `${post.title} | ${brand.name}`;
  const faqs = parseFaqs(post);
  const tags = post.tags.split(',').map((t) => t.trim()).filter(Boolean);
  const image = post.cover_image || '/assets/og-image.png';
  const modified = post.updated_at;

  const metaLine = isBlog
    ? `<p class="post__meta">By ${esc(post.author)} · <time datetime="${esc(post.published_at)}">${formatDate(post.published_at)}</time>${modified && modified.slice(0, 10) !== (post.published_at || '').slice(0, 10) ? ` · Updated <time datetime="${esc(modified)}">${formatDate(modified)}</time>` : ''} · ${readingMinutes(post.content_html)} min read</p>`
    : `<dl class="flight-facts">
        ${post.airline ? `<div><dt>Airline</dt><dd>${esc(post.airline)}</dd></div>` : ''}
        ${post.origin ? `<div><dt>From</dt><dd>${esc(post.origin)}</dd></div>` : ''}
        ${post.destination ? `<div><dt>To</dt><dd>${esc(post.destination)}</dd></div>` : ''}
        ${post.price_from ? `<div><dt>Group fares from</dt><dd>${esc(post.price_from)}</dd></div>` : ''}
        <div><dt>Call 24/7</dt><dd>${phoneLink()}</dd></div>
      </dl>`;

  const schema = [];
  if (isBlog) {
    schema.push({
      '@type': 'BlogPosting',
      '@id': abs(path) + '#article',
      headline: post.title,
      description,
      image: [abs(image)],
      datePublished: post.published_at,
      dateModified: modified,
      author: { '@type': post.author === brand.name ? 'Organization' : 'Person', name: post.author, url: abs('/about/') },
      publisher: { '@id': orgId },
      mainEntityOfPage: { '@id': abs(path) + '#webpage' },
      keywords: tags.join(', '),
      wordCount: stripHtml(post.content_html).split(/\s+/).length,
      articleSection: 'Group Travel',
      inLanguage: 'en-US',
    });
  } else {
    schema.push({
      '@type': 'Service',
      '@id': abs(path) + '#service',
      name: post.title,
      description,
      serviceType: 'Group flight booking',
      provider: { '@id': orgId },
      ...(post.airline ? { brand: { '@type': 'Airline', name: post.airline } } : {}),
      ...(post.destination ? { areaServed: { '@type': 'Place', name: post.destination } } : {}),
      url: abs(path),
    });
  }
  if (faqs.length) schema.push(faqSchema(faqs));

  const relatedHtml = related.length
    ? `<section class="related"><h2>${isBlog ? 'Related articles' : 'More group flight pages'}</h2>${cards(related)}</section>`
    : '';

  const body = `
<div class="wrap content-grid">
  <article class="post prose">
    <header>
      <h1>${esc(post.title)}</h1>
      ${metaLine}
      ${post.cover_image ? `<img class="post__cover" src="${esc(post.cover_image)}" alt="${esc(post.cover_alt || post.title)}" width="1200" height="630" fetchpriority="high" />` : ''}
    </header>
    <div class="post__body">${post.content_html}</div>
    ${faqBlock(faqs.map((f) => ({ ...f, aHtml: `<p>${esc(f.a)}</p>` })))}
    ${tags.length ? `<p class="tags">${tags.map((t) => `<span>#${esc(t)}</span>`).join(' ')}</p>` : ''}
    <div class="post__cta">
      <p><strong>Planning a group trip?</strong> Get a discounted group fare from a specialist in minutes.</p>
      ${phoneLink(`Call ${brand.phone}`, 'btn btn--primary')}
    </div>
  </article>
  <aside class="sidebar">${leadForm({ compact: true, source: path })}</aside>
</div>
<div class="wrap">${relatedHtml}</div>`;

  return page({
    path,
    title,
    description,
    body,
    crumbs,
    schema,
    ogType: isBlog ? 'article' : 'website',
    image,
    imageAlt: post.cover_alt || post.title,
    article: isBlog ? { published: post.published_at, modified, author: post.author, tags } : null,
  });
}

export { HOME_FAQS, GROUP_FAQS, AIRLINES, DESTINATIONS };

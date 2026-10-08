// Renders favicon.svg into PNG icons, favicon.ico and the 1200x630 social card.
// Run once after changing the logo or phone number: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { brand, ROOT } from '../src/config.js';

const pub = path.join(ROOT, 'public');
const logo = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
const render = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng();

const out = (rel, buf) => {
  fs.mkdirSync(path.dirname(path.join(pub, rel)), { recursive: true });
  fs.writeFileSync(path.join(pub, rel), buf);
  console.log('wrote', rel, buf.length, 'bytes');
};

out('apple-touch-icon.png', render(logo, 180));
out('assets/icon-192.png', render(logo, 192));
out('assets/icon-512.png', render(logo, 512));

// favicon.ico containing PNG-encoded 16, 32 and 48px images.
const sizes = [16, 32, 48];
const pngs = sizes.map((s) => render(logo, s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
out('favicon.ico', Buffer.concat([header, ...pngs]));

const plane = logo.replace(/<svg[^>]*>|<\/svg>/g, '');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#072a66"/><stop offset="1" stop-color="#1d56b8"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1080" cy="80" r="260" fill="#ffffff" opacity="0.05"/>
  <circle cx="1130" cy="600" r="180" fill="#e63946" opacity="0.12"/>
  <g transform="translate(80 80) scale(1.6)">${plane}</g>
  <text x="200" y="138" font-family="Helvetica Neue, Helvetica, Arial" font-size="40" font-weight="700" fill="#ffffff">${brand.name}</text>
  <text x="80" y="300" font-family="Helvetica Neue, Helvetica, Arial" font-size="72" font-weight="800" fill="#ffffff">Cheap Group Flights</text>
  <text x="80" y="384" font-family="Helvetica Neue, Helvetica, Arial" font-size="40" fill="#dbe6fb">10+ travellers · 200+ airlines · Book now, pay later</text>
  <rect x="80" y="450" width="560" height="96" rx="48" fill="#e63946"/>
  <text x="360" y="512" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="42" font-weight="800" fill="#ffffff">Call ${brand.phone}</text>
  <text x="1120" y="580" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial" font-size="28" fill="#dbe6fb">${brand.tagline}</text>
</svg>`;
out('assets/og-image.png', render(og, 1200));

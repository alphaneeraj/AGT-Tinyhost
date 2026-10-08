import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = (key, fallback) => (process.env[key] ?? '').trim() || fallback;
const stripSlash = (url) => url.replace(/\/+$/, '');

export const config = {
  port: Number(env('PORT', '3000')),
  // Public URL of the static site on tiiny.host (used for canonical URLs, sitemap, OG tags).
  siteUrl: stripSlash(env('SITE_URL', 'https://airlinesgrouptravel.tiiny.site')),
  // tiiny.host site domain to update via the API (usually the host part of SITE_URL).
  tiinyDomain: env('TIINY_DOMAIN', ''),
  // API key from tiiny.host → Manage Account (API access needs the Solo plan or higher).
  tiinyApiKey: env('TIINY_API_KEY', ''),
  autoPublish: env('AUTO_PUBLISH', 'false') === 'true',
  // Public HTTPS URL of THIS server's lead endpoint. The static form posts here.
  leadEndpoint: env('LEAD_ENDPOINT', 'http://localhost:3000/api/leads'),
  adminUser: env('ADMIN_USER', 'admin'),
  adminPassword: env('ADMIN_PASSWORD', ''),
  sessionSecret: env('SESSION_SECRET', ''),
  // Comma-separated list of origins allowed to post leads (defaults to SITE_URL origin).
  allowedOrigins: env('ALLOWED_ORIGINS', ''),
  paths: {
    db: path.join(ROOT, 'data', 'agt.sqlite'),
    dist: path.join(ROOT, 'dist'),
    public: path.join(ROOT, 'public'),
    uploads: path.join(ROOT, 'uploads'),
    admin: path.join(ROOT, 'admin'),
  },
};

if (!config.tiinyDomain) config.tiinyDomain = new URL(config.siteUrl).host;

// Brand facts used across every generated page. Change the phone number here only.
export const brand = {
  name: 'Airlines Group Travel',
  shortName: 'AGT',
  tagline: 'Fly Together, Save Together',
  mainSite: 'https://www.airlinesgrouptravel.com',
  phone: '+1-888-609-1015',
  phoneTel: '+18886091015',
  email: 'info@airlinesgrouptravel.com',
  address: {
    street: '8 The Green, Suite A',
    city: 'Dover',
    region: 'DE',
    postalCode: '19901',
    country: 'US',
  },
  foundingYear: '2022',
  twitter: '@airgrouptravel',
  social: [
    'https://www.facebook.com/airgrouptravel',
    'https://www.instagram.com/airgrouptravel/',
    'https://x.com/airgrouptravel',
    'https://www.linkedin.com/company/airlines-group-travel',
    'https://www.youtube.com/@airlinesgrouptravel',
    'https://www.pinterest.com/airlinesgrouptravel/',
  ],
  themeColor: '#0b3d91',
};

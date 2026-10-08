import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Non-secret site settings live in site.config.json (committed, so GitHub Actions can build).
const file = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const env = (key, fallback) => (process.env[key] ?? '').trim() || fallback;
const stripSlash = (url) => url.replace(/\/+$/, '');

const siteUrl = stripSlash(env('SITE_URL', file.siteUrl));

export const config = {
  // Public URL of the site, including the project path on GitHub Pages.
  siteUrl,
  // Path prefix for every internal link, e.g. "/AGT-Tinyhost" ("" when the site is at a domain root).
  // BASE_PATH overrides it for mirrors served from a domain root (e.g. the tiiny.host copy).
  basePath: process.env.BASE_PATH !== undefined ? stripSlash(process.env.BASE_PATH) : stripSlash(new URL(siteUrl).pathname),
  // Brochure-only build (no admin, no forms, no data collection) for hosts with strict free-plan scanning.
  brochure: env('BROCHURE', 'false') === 'true',
  // GitHub repo the live admin saves posts into.
  repo: env('GITHUB_REPOSITORY', file.repo),
  branch: file.branch || 'main',
  // Free lead inbox: Google Apps Script web app URL (…/exec) from google-apps-script/Code.gs.
  leadsWebAppUrl: env('LEADS_WEBAPP_URL', file.leadsWebAppUrl || ''),
  // Google Search Console HTML-tag verification code (content="…" value only).
  googleSiteVerification: file.googleSiteVerification || '',
  port: Number(env('PORT', '3000')),
  paths: {
    content: path.join(ROOT, 'content'),
    uploads: path.join(ROOT, 'content', 'uploads'),
    dist: path.join(ROOT, 'dist'),
    public: path.join(ROOT, 'public'),
    admin: path.join(ROOT, 'admin'),
  },
};

// Where the quote form submits. Without a Google web app the form has nowhere to go,
// so it falls back to the contact page (visitors can still call).
config.leadEndpoint = config.leadsWebAppUrl;

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

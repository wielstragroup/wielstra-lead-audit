# Wielstra Lead Audit

A Next.js (TypeScript) web app that helps the owner (single user) find local small-business leads around Dokkum (Friesland) using free data sources, audit each company website for common issues, and generate copy-paste outreach text — **no API keys required**.

## Features

- 🔍 **Lead Finder** — Search for local businesses via [OpenStreetMap Overpass API](https://overpass-api.de/). Geocodes any location string (default: Dokkum) via Nominatim.
- 🌐 **Website Audit** — For each lead with a website, fetches the homepage and runs 13 checks:
  - HTTPS / HTTP→HTTPS redirect
  - Page title & meta description
  - H1 heading count
  - Mobile viewport tag
  - Image alt text coverage
  - Page load time (< 3 s)
  - Copyright year freshness
  - Contact info visible (phone / email)
  - Social media links
  - JSON-LD structured data
  - Cookie / GDPR notice
- ✉ **Outreach Text Generator** — Copy-paste Dutch email template, customised per lead with detected audit issues.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build for Production

```bash
npm run build
npm start
```

## Technology

- [Next.js 15](https://nextjs.org/) · TypeScript · Tailwind CSS
- [Cheerio](https://cheerio.js.org/) for server-side HTML parsing
- Data: [OpenStreetMap](https://www.openstreetmap.org/) contributors (Nominatim + Overpass API)

## Privacy

All searches are performed server-side. No personal data is stored. Uses only free, open data sources.

import type { NextApiRequest, NextApiResponse } from "next";
import * as cheerio from "cheerio";
import type { AuditCheck, AuditResult } from "@/types";

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; WielstraLeadAudit/1.0; +https://wielstragroup.nl)";

/**
 * Validates that a URL is safe to fetch server-side:
 * - Must be http or https scheme only
 * - Must have a resolvable public hostname (no bare IPs, no localhost, no internal addresses)
 * Returns the parsed URL object on success, or null on failure.
 */
function validateAndParseUrl(raw: string): { parsed: URL; reason?: undefined } | { parsed?: undefined; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { reason: "Invalid URL format" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { reason: "Only http and https URLs are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and loopback
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return { reason: "Internal hostnames are not allowed" };
  }

  // Block bare IPv4 addresses (to avoid SSRF to internal networks)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { reason: "Raw IP addresses are not allowed" };
  }

  // Block IPv6 literals
  if (hostname.startsWith("[")) {
    return { reason: "IPv6 addresses are not allowed" };
  }

  // Block common internal TLDs / hostnames
  if (
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { reason: "Internal hostnames are not allowed" };
  }

  return { parsed };
}

function normaliseUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

async function fetchPage(
  // `validatedUrl` has already passed validateAndParseUrl() which blocks
  // loopback, bare IPs, IPv6 literals and internal hostnames.
  // Fetching an external URL provided by the user is the intentional
  // core function of this website-audit tool.
  validatedUrl: URL
): Promise<{ html: string; finalUrl: string; loadTimeMs: number }> {
  const start = Date.now();
  const res = await fetch(validatedUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const loadTimeMs = Date.now() - start;
  const html = await res.text();
  return { html, finalUrl: res.url, loadTimeMs };
}

function runChecks(
  originalUrl: string,
  finalUrl: string,
  html: string,
  loadTimeMs: number
): AuditCheck[] {
  const $ = cheerio.load(html);
  const checks: AuditCheck[] = [];

  // 1. HTTPS
  const isHttps = originalUrl.toLowerCase().startsWith("https://");
  checks.push({
    id: "https",
    label: "HTTPS",
    passed: isHttps,
    info: isHttps
      ? "Site uses HTTPS"
      : "Site uses HTTP – visitors see a 'Not Secure' warning",
  });

  // 2. Redirect to HTTPS
  if (!isHttps) {
    const redirectedToHttps = finalUrl.toLowerCase().startsWith("https://");
    checks.push({
      id: "https_redirect",
      label: "HTTP → HTTPS redirect",
      passed: redirectedToHttps,
      info: redirectedToHttps
        ? "HTTP redirects to HTTPS"
        : "No redirect from HTTP to HTTPS detected",
    });
  }

  // 3. Title tag
  const title = $("title").first().text().trim();
  checks.push({
    id: "title",
    label: "Page title",
    passed: title.length > 0,
    info: title.length > 0 ? `Title: "${title}"` : "No <title> tag found",
  });

  // 4. Meta description
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ?? "";
  checks.push({
    id: "meta_description",
    label: "Meta description",
    passed: metaDesc.length > 0,
    info:
      metaDesc.length > 0
        ? `Meta description present (${metaDesc.length} chars)`
        : "No meta description – search engines may show random text",
  });

  // 5. H1 tag
  const h1s = $("h1");
  const h1Count = h1s.length;
  const h1Text = h1s.first().text().trim();
  checks.push({
    id: "h1",
    label: "H1 heading",
    passed: h1Count === 1,
    info:
      h1Count === 0
        ? "No H1 found – important for SEO"
        : h1Count > 1
          ? `${h1Count} H1 tags found (best practice: exactly 1) – "${h1Text}"`
          : `H1: "${h1Text}"`,
  });

  // 6. Viewport meta (mobile-friendly)
  const viewport = $('meta[name="viewport"]').attr("content") ?? "";
  checks.push({
    id: "viewport",
    label: "Mobile viewport",
    passed: viewport.length > 0,
    info:
      viewport.length > 0
        ? `Viewport: "${viewport}"`
        : "No viewport meta tag – site may not be mobile-friendly",
  });

  // 7. Images with missing alt text
  const imgs = $("img");
  let missingAlt = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === null) missingAlt++;
  });
  checks.push({
    id: "img_alt",
    label: "Image alt text",
    passed: missingAlt === 0,
    info:
      missingAlt === 0
        ? `All ${imgs.length} image(s) have alt attributes`
        : `${missingAlt} of ${imgs.length} image(s) missing alt attribute – accessibility & SEO issue`,
  });

  // 8. Load time
  const loadPassed = loadTimeMs < 3000;
  checks.push({
    id: "load_time",
    label: "Page load time",
    passed: loadPassed,
    info: `${loadTimeMs} ms (${loadPassed ? "good" : "slow – aim for < 3 s"})`,
  });

  // 9. Copyright year (check if stale)
  const bodyText = $("body").text();
  const currentYear = new Date().getFullYear();
  const yearMatches = bodyText.match(/©\s*(\d{4})/g) ?? [];
  const years = yearMatches
    .map((m) => parseInt(m.replace(/[^\d]/g, ""), 10))
    .filter((y) => y >= 2000 && y <= currentYear + 1);
  const maxYear = years.length ? Math.max(...years) : null;
  const freshCopyright = maxYear !== null && maxYear >= currentYear - 1;
  checks.push({
    id: "copyright_year",
    label: "Copyright year",
    passed: freshCopyright,
    info:
      maxYear !== null
        ? freshCopyright
          ? `Copyright year: ${maxYear}`
          : `Copyright year ${maxYear} appears outdated (current: ${currentYear})`
        : "No copyright year found in page",
  });

  // 10. Contact info on page (phone/email)
  const hasPhone =
    /(\+31|0031|0\d{1,3})[\s\-]?\d{2,4}[\s\-]?\d{3,8}/.test(bodyText) ||
    /<a[^>]+href="tel:/i.test(html);
  const hasEmail =
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(bodyText) ||
    /<a[^>]+href="mailto:/i.test(html);
  checks.push({
    id: "contact_info",
    label: "Contact info on page",
    passed: hasPhone || hasEmail,
    info:
      hasPhone && hasEmail
        ? "Phone and email found on page"
        : hasPhone
          ? "Phone found on page (email not visible)"
          : hasEmail
            ? "Email found on page (phone not visible)"
            : "No visible phone or email on page – hard for customers to reach you",
  });

  // 11. Social media links
  const socialDomains = [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "tiktok.com",
  ];
  const links = $("a[href]")
    .map((_, el) => $(el).attr("href") ?? "")
    .get();
  const hasSocial = links.some((href) =>
    socialDomains.some((d) => href.includes(d))
  );
  checks.push({
    id: "social_links",
    label: "Social media links",
    passed: hasSocial,
    info: hasSocial
      ? "Social media link(s) found"
      : "No social media links detected",
  });

  // 12. Structured data (JSON-LD)
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  checks.push({
    id: "structured_data",
    label: "Structured data (JSON-LD)",
    passed: hasJsonLd,
    info: hasJsonLd
      ? "JSON-LD structured data present – good for rich search results"
      : "No JSON-LD structured data – missing opportunity for rich search results",
  });

  // 13. Cookie/GDPR notice
  const cookieKeywords = ["cookie", "gdpr", "privacy", "toestemming"];
  const hasCookieBanner = cookieKeywords.some((kw) =>
    html.toLowerCase().includes(kw)
  );
  checks.push({
    id: "cookie_notice",
    label: "Cookie / privacy notice",
    passed: hasCookieBanner,
    info: hasCookieBanner
      ? "Cookie or privacy notice text found"
      : "No cookie/privacy notice detected – may be required under GDPR",
  });

  return checks;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuditResult>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      leadId: "",
      url: "",
      finalUrl: "",
      loadTimeMs: 0,
      checks: [],
      error: "Method not allowed",
    });
  }

  const leadId =
    typeof req.query.leadId === "string" ? req.query.leadId : "unknown";
  const rawUrl = typeof req.query.url === "string" ? req.query.url : "";

  if (!rawUrl) {
    return res.status(400).json({
      leadId,
      url: "",
      finalUrl: "",
      loadTimeMs: 0,
      checks: [],
      error: "Missing url parameter",
    });
  }

  const url = normaliseUrl(rawUrl);

  // Validate URL to prevent SSRF
  const validation = validateAndParseUrl(url);
  if (!validation.parsed) {
    return res.status(400).json({
      leadId,
      url,
      finalUrl: url,
      loadTimeMs: 0,
      checks: [],
      error: `Invalid URL: ${validation.reason}`,
    });
  }

  try {
    const { html, finalUrl, loadTimeMs } = await fetchPage(validation.parsed);
    const checks = runChecks(url, finalUrl, html, loadTimeMs);
    return res.status(200).json({ leadId, url, finalUrl, loadTimeMs, checks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(200).json({
      leadId,
      url,
      finalUrl: url,
      loadTimeMs: 0,
      checks: [],
      error: `Could not fetch website: ${message}`,
    });
  }
}

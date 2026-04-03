import type { NextApiRequest, NextApiResponse } from "next";
import type { Lead, SearchResult } from "@/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const USER_AGENT = "WielstraLeadAudit/1.0 (contact@wielstragroup.nl)";

async function geocode(
  place: string
): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({
    q: place,
    format: "json",
    limit: "1",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function buildOverpassQuery(
  lat: number,
  lon: number,
  radiusM: number,
  category?: string
): string {
  const around = `(around:${radiusM},${lat},${lon})`;

  // Business-relevant OSM tags — use nwr shorthand (node/way/relation) to
  // keep the query compact and avoid timeouts.
  const businessTags = category
    ? [`[shop="${category}"]`, `[amenity="${category}"]`]
    : [
        "[shop]",
        "[amenity~'restaurant|cafe|bar|hotel|guest_house|doctors|dentist|veterinary|pharmacy|optician|hairdresser|beauty|bank|bureau_de_change|car_wash|car_rental|car_repair|fuel|cinema|theatre|gym|sports_centre|swimming_pool|spa|massage']",
        "[office]",
        "[craft]",
        "[tourism~'hotel|guest_house|motel|hostel|bed_and_breakfast|attraction|museum|gallery']",
        "[leisure~'fitness_centre|sports_centre|swimming_pool']",
      ];

  const parts = businessTags
    .map((tag) => `  nwr${tag}${around};`)
    .join("\n");

  return `[out:json][timeout:25][maxsize:16777216];\n(\n${parts}\n);\nout center tags;`;
}

async function fetchOverpass(query: string): Promise<Response> {
  let lastError: unknown;
  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(27000),
      });
      if (res.ok) return res;
      // 429/503/504 → try next mirror
      if ([429, 503, 504].includes(res.status)) {
        lastError = new Error(`HTTP ${res.status} from ${server}`);
        continue;
      }
      return res; // return other errors as-is
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("All Overpass servers failed");
}

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function extractLead(el: OverpassElement): Lead | null {
  const tags = el.tags ?? {};
  const name = tags["name"];
  if (!name || name.trim() === "") return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;

  const website =
    tags["website"] ||
    tags["contact:website"] ||
    tags["url"] ||
    tags["contact:url"] ||
    undefined;

  const phone =
    tags["phone"] || tags["contact:phone"] || tags["telephone"] || undefined;

  const email = tags["email"] || tags["contact:email"] || undefined;

  const street = tags["addr:street"] ?? "";
  const housenumber = tags["addr:housenumber"] ?? "";
  const city = tags["addr:city"] ?? tags["addr:place"] ?? "";
  const addressParts = [
    [street, housenumber].filter(Boolean).join(" "),
    city,
  ].filter(Boolean);
  const address = addressParts.length ? addressParts.join(", ") : undefined;

  const type =
    tags["shop"] ??
    tags["amenity"] ??
    tags["office"] ??
    tags["craft"] ??
    tags["tourism"] ??
    tags["leisure"] ??
    "business";

  return {
    id: `${el.type}-${el.id}`,
    name: name.trim(),
    type,
    address,
    phone,
    email,
    website,
    lat,
    lon,
    tags,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResult>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      leads: [],
      centerLat: 0,
      centerLon: 0,
      error: "Method not allowed",
    });
  }

  const center =
    typeof req.query.center === "string" ? req.query.center : "Dokkum";
  const radiusKm = Math.min(
    50,
    Math.max(0.5, parseFloat((req.query.radiusKm as string) ?? "5"))
  );
  const category =
    typeof req.query.category === "string" && req.query.category.trim()
      ? req.query.category.trim()
      : undefined;

  try {
    const coords = await geocode(center);
    if (!coords) {
      return res.status(400).json({
        leads: [],
        centerLat: 0,
        centerLon: 0,
        error: `Could not geocode "${center}". Please try a different location.`,
      });
    }

    const { lat, lon } = coords;
    const radiusM = radiusKm * 1000;
    const query = buildOverpassQuery(lat, lon, radiusM, category);

    const overpassRes = await fetchOverpass(query);

    if (!overpassRes.ok) {
      return res.status(502).json({
        leads: [],
        centerLat: lat,
        centerLon: lon,
        error: `Overpass API error: ${overpassRes.status}`,
      });
    }

    const overpassData = (await overpassRes.json()) as OverpassResponse;
    const seen = new Set<string>();
    const leads: Lead[] = [];

    for (const el of overpassData.elements) {
      const lead = extractLead(el);
      if (!lead) continue;
      const key = lead.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push(lead);
    }

    // Sort: leads with websites first
    leads.sort((a, b) => {
      const aw = a.website ? 1 : 0;
      const bw = b.website ? 1 : 0;
      return bw - aw || a.name.localeCompare(b.name);
    });

    return res.status(200).json({ leads, centerLat: lat, centerLon: lon });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({
      leads: [],
      centerLat: 0,
      centerLon: 0,
      error: `Search failed: ${message}`,
    });
  }
}

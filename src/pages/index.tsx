import { useState, useCallback } from "react";
import Head from "next/head";
import type { Lead, SearchResult } from "@/types";
import LeadList from "@/components/LeadList";

const DEFAULT_CENTER = "Dokkum";
const DEFAULT_RADIUS = 5;

export default function Home() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<{
    count: number;
    center: string;
    radiusKm: number;
  } | null>(null);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setLeads(null);
      setSearchMeta(null);
      try {
        const params = new URLSearchParams({
          center: center.trim() || DEFAULT_CENTER,
          radiusKm: String(radiusKm),
        });
        if (category.trim()) params.set("category", category.trim());

        const res = await fetch(`/api/search?${params}`);
        const data: SearchResult = await res.json();

        if (data.error) {
          setError(data.error);
        } else {
          setLeads(data.leads);
          setSearchMeta({
            count: data.leads.length,
            center: center.trim() || DEFAULT_CENTER,
            radiusKm,
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Search failed. Please retry."
        );
      } finally {
        setLoading(false);
      }
    },
    [center, radiusKm, category]
  );

  return (
    <>
      <Head>
        <title>Wielstra Lead Audit</title>
        <meta
          name="description"
          content="Find local business leads and audit their websites"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-indigo-700 text-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-5">
            <h1 className="text-2xl font-bold tracking-tight">
              🔍 Wielstra Lead Audit
            </h1>
            <p className="text-indigo-200 text-sm mt-1">
              Vind lokale bedrijven via OpenStreetMap en audit hun websites
            </p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Search form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Zoekparameters
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Locatie / centrum
                  </label>
                  <input
                    type="text"
                    value={center}
                    onChange={(e) => setCenter(e.target.value)}
                    placeholder="bijv. Dokkum"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Straal (km): {radiusKm}
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={25}
                    step={0.5}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>0.5</span>
                    <span>25 km</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categorie (optioneel)
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="bijv. restaurant, shop…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Zoeken…" : "Zoek bedrijven"}
              </button>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              ⚠ {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Results */}
          {leads !== null && !loading && (
            <section>
              {searchMeta && (
                <h2 className="text-lg font-semibold text-gray-700 mb-4">
                  Resultaten rondom{" "}
                  <span className="text-indigo-700">{searchMeta.center}</span>{" "}
                  binnen {searchMeta.radiusKm} km
                </h2>
              )}
              <LeadList leads={leads} />
            </section>
          )}

          {/* Empty state */}
          {leads === null && !loading && !error && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">🗺</div>
              <p className="text-lg font-medium text-gray-500">
                Voer een locatie in en klik op &ldquo;Zoek bedrijven&rdquo;
              </p>
              <p className="text-sm mt-2 text-gray-400">
                Gegevens via OpenStreetMap · Gratis · Geen API-sleutel nodig
              </p>
            </div>
          )}
        </main>

        <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
          Wielstra Lead Audit · Data: OpenStreetMap contributors · GDPR-vriendelijk
        </footer>
      </div>
    </>
  );
}

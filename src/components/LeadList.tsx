import { useState, useCallback } from "react";
import type { Lead, AuditResult } from "@/types";
import AuditPanel from "./AuditPanel";
import OutreachText from "./OutreachText";

interface Props {
  leads: Lead[];
}

type AuditState = "idle" | "loading" | "done" | "error";

interface LeadAudit {
  state: AuditState;
  result?: AuditResult;
}

export default function LeadList({ leads }: Props) {
  const [audits, setAudits] = useState<Record<string, LeadAudit>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showOutreach, setShowOutreach] = useState<Record<string, boolean>>({});

  const runAudit = useCallback(async (lead: Lead) => {
    if (!lead.website) return;
    setAudits((prev) => ({
      ...prev,
      [lead.id]: { state: "loading" },
    }));
    try {
      const params = new URLSearchParams({
        leadId: lead.id,
        url: lead.website,
      });
      const res = await fetch(`/api/audit?${params}`);
      const data: AuditResult = await res.json();
      setAudits((prev) => ({
        ...prev,
        [lead.id]: { state: "done", result: data },
      }));
    } catch {
      setAudits((prev) => ({
        ...prev,
        [lead.id]: { state: "error" },
      }));
    }
  }, []);

  const auditAll = useCallback(async () => {
    const withSites = leads.filter((l) => l.website);
    for (const lead of withSites) {
      await runAudit(lead);
    }
  }, [leads, runAudit]);

  const withWebsites = leads.filter((l) => l.website).length;

  if (leads.length === 0) {
    return (
      <p className="text-gray-500 text-sm mt-4">
        No leads found. Try a larger radius or different category.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-600">
          <strong>{leads.length}</strong> leads found &bull;{" "}
          <strong>{withWebsites}</strong> with website
        </p>
        {withWebsites > 0 && (
          <button
            onClick={auditAll}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors"
          >
            Audit all websites
          </button>
        )}
      </div>
      <div className="space-y-3">
        {leads.map((lead) => {
          const audit = audits[lead.id];
          const isExpanded = expanded[lead.id] ?? false;
          const isOutreachOpen = showOutreach[lead.id] ?? false;

          return (
            <div
              key={lead.id}
              className="border border-gray-200 rounded-lg bg-white shadow-sm"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {lead.name}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
                        {lead.type}
                      </span>
                      {lead.address && (
                        <span className="text-xs text-gray-500">
                          📍 {lead.address}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                      {lead.phone && <span>📞 {lead.phone}</span>}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          ✉ {lead.email}
                        </a>
                      )}
                      {lead.website && (
                        <a
                          href={
                            /^https?:\/\//i.test(lead.website)
                              ? lead.website
                              : `https://${lead.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          🌐 {lead.website}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {lead.website && (
                      <button
                        onClick={() => {
                          if (!audit || audit.state === "idle") {
                            void runAudit(lead);
                          }
                          setExpanded((prev) => ({
                            ...prev,
                            [lead.id]: !isExpanded,
                          }));
                        }}
                        disabled={audit?.state === "loading"}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                          audit?.state === "done"
                            ? "border-indigo-400 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                            : audit?.state === "loading"
                              ? "border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed"
                              : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                        }`}
                      >
                        {audit?.state === "loading"
                          ? "Auditing…"
                          : audit?.state === "done"
                            ? isExpanded
                              ? "Hide audit"
                              : "Show audit"
                            : "Audit site"}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setShowOutreach((prev) => ({
                          ...prev,
                          [lead.id]: !isOutreachOpen,
                        }))
                      }
                      className="text-xs px-2.5 py-1 rounded border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                    >
                      {isOutreachOpen ? "Hide outreach" : "Outreach text"}
                    </button>
                  </div>
                </div>

                {isExpanded && audit?.result && (
                  <AuditPanel result={audit.result} />
                )}
                {isExpanded && audit?.state === "error" && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    Failed to load audit results.
                  </div>
                )}

                {isOutreachOpen && (
                  <OutreachText
                    lead={lead}
                    auditResult={audit?.result}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

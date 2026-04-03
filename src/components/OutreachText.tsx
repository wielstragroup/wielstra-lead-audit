import { useState, useMemo } from "react";
import type { Lead, AuditResult } from "@/types";

interface Props {
  lead: Lead;
  auditResult?: AuditResult;
}

function buildOutreachText(lead: Lead, audit?: AuditResult): string {
  const issues: string[] = [];

  if (audit && audit.checks.length > 0) {
    const failed = audit.checks.filter((c) => !c.passed);
    for (const check of failed) {
      switch (check.id) {
        case "https":
          issues.push("de website nog op HTTP staat (niet beveiligd)");
          break;
        case "https_redirect":
          issues.push("er geen automatische doorverwijzing van HTTP naar HTTPS is");
          break;
        case "meta_description":
          issues.push("er geen meta-omschrijving aanwezig is voor zoekmachines");
          break;
        case "h1":
          issues.push("de pagina-opbouw voor SEO verbeterd kan worden (H1-koppen)");
          break;
        case "viewport":
          issues.push("de website mogelijk niet goed werkt op smartphones");
          break;
        case "img_alt":
          issues.push("afbeeldingen ontbrekende alt-teksten hebben (toegankelijkheid & SEO)");
          break;
        case "load_time":
          issues.push("de laadtijd van de website trager is dan gewenst");
          break;
        case "copyright_year":
          issues.push("het copyright-jaar niet meer actueel is");
          break;
        case "contact_info":
          issues.push("contactgegevens niet direct zichtbaar zijn op de pagina");
          break;
        case "social_links":
          issues.push("er geen links naar sociale media aanwezig zijn");
          break;
        case "structured_data":
          issues.push("er geen gestructureerde data (JSON-LD) aanwezig is voor rijke zoekresultaten");
          break;
        case "cookie_notice":
          issues.push("er geen cookiemelding/privacyverklaring gevonden is (AVG/GDPR)");
          break;
      }
    }
  } else if (lead.website) {
    issues.push("de website mogelijk verbeterd kan worden voor meer online zichtbaarheid");
  }

  const noWebsite = !lead.website;
  const greeting = `Goedemiddag,\n\nMijn naam is [Uw Naam] van Wielstra Group.`;

  if (noWebsite) {
    return `${greeting}

Ik zag dat ${lead.name} ${lead.address ? `(${lead.address}) ` : ""}momenteel geen website heeft.

Een professionele website kan uw bedrijf helpen om meer klanten online te bereiken. Wij verzorgen betaalbare websites speciaal voor lokale bedrijven in Friesland.

Zou u het op prijs stellen als ik u vrijblijvend meer informatie stuur over wat wij voor ${lead.name} kunnen betekenen?

Met vriendelijke groet,
[Uw Naam]
Wielstra Group
[Telefoon]
[E-mail]`;
  }

  const issueList =
    issues.length > 0
      ? `\nBij een snelle blik op uw website zag ik een aantal verbeterpunten:\n${issues.map((i, idx) => `${idx + 1}. Ik viel op dat ${i}.`).join("\n")}\n`
      : "\nIk heb een aantal ideeën voor verdere verbetering van uw online aanwezigheid.\n";

  return `${greeting}

Ik ben gespecialiseerd in weboptimalisatie voor lokale bedrijven in Friesland en ben bij toeval op de website van ${lead.name} terechtgekomen.
${issueList}
Kleine verbeteringen op deze punten kunnen al een merkbaar verschil maken in vindbaarheid en klantencontact.

Ik maak graag eens een kwartier vrij voor een vrijblijvend telefoongesprek om te bespreken hoe wij ${lead.name} kunnen helpen groeien online.

Met vriendelijke groet,
[Uw Naam]
Wielstra Group
[Telefoon]
[E-mail]`;
}

export default function OutreachText({ lead, auditResult }: Props) {
  const text = useMemo(
    () => buildOutreachText(lead, auditResult),
    [lead, auditResult]
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select textarea
    }
  };

  return (
    <div className="mt-3 border border-green-200 rounded bg-green-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-green-800">
          📧 Outreach e-mail (NL)
        </h4>
        <button
          onClick={handleCopy}
          className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          {copied ? "Gekopieerd!" : "Kopieer tekst"}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={12}
        className="w-full text-xs font-mono bg-white border border-green-200 rounded p-2 resize-y text-gray-800 focus:outline-none"
      />
    </div>
  );
}

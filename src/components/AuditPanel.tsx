import type { AuditCheck, AuditResult } from "@/types";

interface Props {
  result: AuditResult;
}

function CheckRow({ check }: { check: AuditCheck }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold ${
          check.passed ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}
      >
        {check.passed ? "✓" : "✗"}
      </span>
      <div className="text-sm">
        <span className="font-medium text-gray-800">{check.label}: </span>
        <span className={check.passed ? "text-gray-600" : "text-red-700"}>
          {check.info}
        </span>
      </div>
    </div>
  );
}

export default function AuditPanel({ result }: Props) {
  if (result.error) {
    return (
      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
        ⚠ Audit failed: {result.error}
      </div>
    );
  }

  const passed = result.checks.filter((c) => c.passed).length;
  const total = result.checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  const scoreColor =
    score >= 70 ? "text-green-700" : score >= 40 ? "text-yellow-700" : "text-red-700";
  const scoreBg =
    score >= 70 ? "bg-green-50 border-green-200" : score >= 40 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <div className={`mt-2 p-3 rounded border ${scoreBg}`}>
      <div className="flex items-center justify-between mb-2">
        <a
          href={result.finalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline truncate max-w-xs"
        >
          {result.finalUrl}
        </a>
        <span className={`text-sm font-semibold ${scoreColor}`}>
          {passed}/{total} checks passed ({score}%)
        </span>
      </div>
      <div>
        {result.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

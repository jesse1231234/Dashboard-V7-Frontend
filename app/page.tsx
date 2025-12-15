"use client";

import React, { useMemo, useState } from "react";
import EchoComboChart from "./components/charts/EchoComboChart";
import GradebookComboChart from "./components/charts/GradebookComboChart";

type AnyRow = Record<string, any>;

type AnalyzeResponse = {
  kpis?: Record<string, any>;
  echo?: {
    summary?: AnyRow[];
    modules?: AnyRow[];
    students?: AnyRow[];
  };
  grades?: {
    gradebook?: AnyRow[];
    summary?: AnyRow[];
    module_metrics?: AnyRow[];
  };
  analysis?: {
    text?: string;
    error?: string;
  };
};

// ---- Column sets to match Streamlit v6 ----
// From Dashboard-V6-main/ui/helptext.py defaults
const ECHO_SUMMARY_COLS = [
  "Media Title",
  "Video Duration",
  "# of Unique Viewers",
  "Average View %",
  "% of Students Viewing",
  "% of Video Viewed Overall",
];

const ECHO_MODULE_COLS = [
  "Module",
  "Average View %",
  "# of Students Viewing",
  "Overall View %",
  "# of Students",
];

const GRADEBOOK_MODULE_COLS = [
  "Module",
  "Avg % Turned In",
  "Avg Average Excluding Zeros",
  "n_assignments",
];

// Percent columns Streamlit scales *100 for display
const ECHO_SUMMARY_PERCENT_COLS = [
  "Average View %",
  "% of Students Viewing",
  "% of Video Viewed Overall",
];
const ECHO_MODULE_PERCENT_COLS = ["Average View %", "Overall View %"];
const GRADEBOOK_MODULE_PERCENT_COLS = ["Avg % Turned In", "Avg Average Excluding Zeros"];

// ---------- Formatting helpers ----------
function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/%/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatPercentCell(v: any) {
  const n = toNumber(v);
  if (n === null) return "";
  // If backend sends 0..1 -> 0..100, else assume already percent-like
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

function formatNumberCell(v: any) {
  const n = toNumber(v);
  if (n === null) return "";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatCell(key: string, value: any, percentCols?: string[]) {
  if (value === null || value === undefined) return "";
  if (percentCols?.includes(key)) return formatPercentCell(value);
  if (typeof value === "number") return formatNumberCell(value);

  // If a numeric-looking string, format it nicely (but keep plain text for other strings)
  const n = toNumber(value);
  if (n !== null && String(value).match(/^[\d,\.\-]+%?$/)) return formatNumberCell(n);

  return String(value);
}

// ---------- Table component with explicit column order ----------
function Table({
  title,
  rows,
  columns, // if provided, display these columns in this order
  percentCols,
  maxRows = 50,
}: {
  title: string;
  rows: AnyRow[];
  columns?: string[];
  percentCols?: string[];
  maxRows?: number;
}) {
  const cols = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    if (columns && columns.length > 0) {
      // Only show columns that actually exist in the data
      const available = new Set(Object.keys(rows[0]));
      return columns.filter((c) => available.has(c));
    }

    // Fallback: show whatever exists
    return Object.keys(rows[0]);
  }, [rows, columns]);

  const slice = rows?.slice(0, maxRows) ?? [];

  return (
    <div className="rounded-2xl bg-white shadow p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">
          Showing {slice.length.toLocaleString()}
          {rows.length > slice.length ? ` of ${rows.length.toLocaleString()}` : ""} rows
        </div>
      </div>

      {slice.length === 0 ? (
        <div className="text-sm text-slate-600">No data.</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((r, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-2 text-slate-800 whitespace-nowrap">
                      {formatCell(c, r[c], percentCols)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState<"tables" | "charts" | "exports" | "ai">("tables");

  const [courseCode, setCourseCode] = useState("");
  const [canvasCsv, setCanvasCsv] = useState<File | null>(null);
  const [echoCsv, setEchoCsv] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const echoSummary = result?.echo?.summary ?? [];
  const echoModules = result?.echo?.modules ?? [];
  const echoStudents = result?.echo?.students ?? [];

  const gradeSummary = result?.grades?.summary ?? [];
  const gradeModuleMetrics = result?.grades?.module_metrics ?? [];
  const gradebook = result?.grades?.gradebook ?? [];

  const studentsTotal = useMemo(() => {
    // Prefer explicit total if present in echo summary
    if (echoSummary?.[0]) {
      const row = echoSummary[0];
      for (const k of ["# Students", "# of Students", "Students Total", "Total Students", "students_total"]) {
        if (row[k] !== undefined) {
          const n = toNumber(row[k]);
          if (n !== null && n > 0) return Math.round(n);
        }
      }
    }
    // fallback: one row per student
    if (echoStudents.length > 0) return echoStudents.length;
    return null;
  }, [echoSummary, echoStudents]);

  async function runAnalysis() {
    setError(null);

    if (!apiBase) {
      setError("Missing NEXT_PUBLIC_API_BASE_URL in Vercel environment variables.");
      return;
    }
    if (!courseCode.trim()) {
      setError("Please enter a course code.");
      return;
    }
    if (!canvasCsv || !echoCsv) {
      setError("Please upload both CSV files.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      // IMPORTANT: match your backend’s required field names (per your 422)
      form.append("course_id", courseCode.trim());
      form.append("canvas_gradebook_csv", canvasCsv);
      form.append("echo_analytics_csv", echoCsv);

      const res = await fetch(`${apiBase.replace(/\/+$/, "")}/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend error (${res.status}): ${text || res.statusText}`);
      }

      const json = (await res.json()) as AnalyzeResponse;
      setResult(json);
      setStep(3);
      setActiveTab("tables");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="text-2xl font-bold text-slate-900">Course Load / Engagement Dashboard</div>
          <div className="text-sm text-slate-600">Step {step} of 3</div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {step === 1 && (
          <div className="rounded-2xl bg-white shadow p-6">
            <div className="text-lg font-semibold text-slate-900 mb-2">Step 1: Course</div>
            <label className="block text-sm text-slate-700 mb-1">Course Code</label>
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g., ABCD-101-801"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl bg-white shadow p-6">
            <div className="text-lg font-semibold text-slate-900 mb-2">Step 2: Upload CSVs</div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Canvas Gradebook CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCanvasCsv(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {canvasCsv ? canvasCsv.name : "No file selected"}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">Echo360 CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setEchoCsv(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {echoCsv ? echoCsv.name : "No file selected"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {loading ? "Running..." : "Run Analysis"}
              </button>
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["tables", "Tables"],
                ["charts", "Charts"],
                ["exports", "Exports"],
                ["ai", "AI Analysis"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={
                    "rounded-xl px-4 py-2 text-sm border " +
                    (activeTab === key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-900 border-slate-200")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "tables" && (
              <div className="grid gap-4">
                {/* Match Streamlit table column sets + order */}
                <Table
                  title="Echo Summary (per media)"
                  rows={echoSummary}
                  columns={ECHO_SUMMARY_COLS}
                  percentCols={ECHO_SUMMARY_PERCENT_COLS}
                  maxRows={50}
                />
                <Table
                  title="Echo Module Table"
                  rows={echoModules}
                  columns={ECHO_MODULE_COLS}
                  percentCols={ECHO_MODULE_PERCENT_COLS}
                  maxRows={200}
                />

                {/* Streamlit shows these too, but they’re not curated via HELP column maps */}
                <Table title="Echo Students" rows={echoStudents} maxRows={200} />

                <Table title="Gradebook Summary Rows" rows={gradeSummary} maxRows={50} />

                <Table
                  title="Gradebook Module Metrics"
                  rows={gradeModuleMetrics}
                  columns={GRADEBOOK_MODULE_COLS}
                  percentCols={GRADEBOOK_MODULE_PERCENT_COLS}
                  maxRows={200}
                />

                <Table title="Gradebook (raw)" rows={gradebook} maxRows={200} />
              </div>
            )}

            {activeTab === "charts" && (
              <div className="grid gap-4">
                <EchoComboChart moduleRows={echoModules} studentsTotal={studentsTotal} title="Echo Data" />
                <GradebookComboChart rows={gradeModuleMetrics} title="Canvas Data" />
              </div>
            )}

            {activeTab === "exports" && (
              <div className="rounded-2xl bg-white shadow p-6">
                <div className="text-lg font-semibold text-slate-900 mb-2">Exports</div>
                <div className="text-sm text-slate-600">Add your CSV export buttons here.</div>
              </div>
            )}

            {activeTab === "ai" && (
              <div className="rounded-2xl bg-white shadow p-6">
                <div className="text-lg font-semibold text-slate-900 mb-2">AI Analysis</div>
                {result?.analysis?.error ? (
                  <div className="text-sm text-red-700">{result.analysis.error}</div>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap text-slate-800">
                    {result?.analysis?.text ?? "No AI analysis returned."}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

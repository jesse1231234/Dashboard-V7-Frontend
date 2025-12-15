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
  };
  grades?: {
    summary?: AnyRow[]; // includes "Metric"
    module_metrics?: AnyRow[];
  };
  analysis?: {
    text?: string | null;
    error?: string | null;
  };
};

// ---------- Column presets (match Streamlit intent) ----------
const ECHO_SUMMARY_COLS = [
  "Media Title",
  "Video Duration",
  "# of Unique Views",
  "Total Views",
  "Total Watch Time (Min)",
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

const ECHO_SUMMARY_PERCENT_COLS = ["Average View %", "% of Students Viewing", "% of Video Viewed Overall"];
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

function formatNumberCell(n: number) {
  if (!Number.isFinite(n)) return "";
  // Avoid over-formatting integers
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercentCell(v: any) {
  const n = toNumber(v);
  if (n === null) return "";
  // Streamlit logic: most of these are 0-1 proportions -> show as percent
  const pct = n * 100;
  return `${pct.toFixed(1)}%`;
}

function formatCell(key: string, value: any, percentCols?: string[]) {
  if (value === null || value === undefined) return "";
  if (percentCols?.includes(key)) return formatPercentCell(value);
  if (typeof value === "number") return formatNumberCell(value);

  const n = toNumber(value);
  if (n !== null && String(value).match(/^[\d,\.\-]+%?$/)) return formatNumberCell(n);

  return String(value);
}

// ---------- Table component ----------
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
    const keys = Object.keys(rows[0] ?? {});
    if (!columns || columns.length === 0) return keys;
    const set = new Set(keys);
    // keep only columns that exist
    return columns.filter((c) => set.has(c));
  }, [rows, columns]);

  const slice = useMemo(() => rows.slice(0, maxRows), [rows, maxRows]);

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

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState<"tables" | "charts" | "exports" | "ai">("tables");

  const [courseId, setCourseId] = useState("");
  const [canvasCsv, setCanvasCsv] = useState<File | null>(null);
  const [echoCsv, setEchoCsv] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const echoSummary = result?.echo?.summary ?? [];
  const echoModules = result?.echo?.modules ?? [];

  const gradeSummary = result?.grades?.summary ?? [];
  const gradeModuleMetrics = result?.grades?.module_metrics ?? [];

  // Gradebook Summary Rows: in Streamlit, everything in this table is a percent (except the row label).
  const gradeSummaryPercentCols = useMemo(() => {
    if (!gradeSummary?.[0]) return [];
    return Object.keys(gradeSummary[0]).filter((k) => k !== "Metric");
  }, [gradeSummary]);

  async function runAnalysis() {
    setError(null);

    if (!apiBase) {
      setError("Missing NEXT_PUBLIC_API_BASE_URL environment variable in Vercel.");
      return;
    }
    if (!courseId.trim()) {
      setError("Please enter a Canvas Course ID (number).");
      return;
    }
    if (!canvasCsv || !echoCsv) {
      setError("Please upload both CSV files.");
      return;
    }

    try {
      setLoading(true);

      const form = new FormData();
      form.append("course_id", courseId.trim());
      form.append("canvas_gradebook_csv", canvasCsv);
      form.append("echo_analytics_csv", echoCsv);

      const res = await fetch(`${apiBase.replace(/\/$/, "")}/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend error (${res.status}): ${txt}`);
      }

      const json = (await res.json()) as AnalyzeResponse;
      setResult(json);
      setStep(3);
      setActiveTab("tables");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl p-6">
        <div className="text-2xl font-bold text-slate-900 mb-1">CLE Analytics Dashboard</div>
        <div className="text-sm text-slate-600 mb-6">Vercel (Frontend) + Render (Backend)</div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="rounded-2xl bg-white shadow p-6">
            <div className="text-lg font-semibold text-slate-900 mb-2">Step 1: Enter Course</div>
            <div className="text-sm text-slate-600 mb-3">
              Use the numeric Canvas Course ID (the number in the course URL).
            </div>

            <label className="block text-sm text-slate-700 mb-1">Canvas Course ID</label>
            <input
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g., 123456"
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
                <label className="block text-sm text-slate-700 mb-1">Echo360 Analytics CSV</label>
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

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800"
              >
                Back
              </button>

              <button
                onClick={runAnalysis}
                disabled={loading}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {loading ? "Running..." : "Run Analysis"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["tables", "charts", "exports", "ai"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`rounded-xl px-4 py-2 text-sm ${
                    activeTab === t
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  {t === "tables" ? "Tables" : t === "charts" ? "Charts" : t === "exports" ? "Exports" : "AI Analysis"}
                </button>
              ))}
            </div>

            {activeTab === "tables" && (
              <div className="grid gap-4">
                <Table
                  title="Echo Summary"
                  rows={echoSummary}
                  columns={ECHO_SUMMARY_COLS}
                  percentCols={ECHO_SUMMARY_PERCENT_COLS}
                  maxRows={200}
                />

                <Table
                  title="Echo Module Table"
                  rows={echoModules}
                  columns={ECHO_MODULE_COLS}
                  percentCols={ECHO_MODULE_PERCENT_COLS}
                  maxRows={200}
                />

                <Table
                  title="Gradebook Summary Rows"
                  rows={gradeSummary}
                  // Let it show whatever assignment columns are present, but keep Metric first if provided
                  columns={gradeSummary?.[0]?.Metric ? ["Metric", ...Object.keys(gradeSummary[0]).filter((k) => k !== "Metric")] : undefined}
                  percentCols={gradeSummaryPercentCols}
                  maxRows={50}
                />

                <Table
                  title="Gradebook Module Metrics"
                  rows={gradeModuleMetrics}
                  columns={GRADEBOOK_MODULE_COLS}
                  percentCols={GRADEBOOK_MODULE_PERCENT_COLS}
                  maxRows={200}
                />
              </div>
            )}

            {activeTab === "charts" && (
              <div className="grid gap-4">
                <div className="rounded-2xl bg-white shadow p-6">
                  <div className="text-lg font-semibold text-slate-900 mb-2">Echo Chart</div>
                  <EchoComboChart rows={echoModules} />
                </div>

                <div className="rounded-2xl bg-white shadow p-6">
                  <div className="text-lg font-semibold text-slate-900 mb-2">Gradebook Chart</div>
                  <GradebookComboChart rows={gradeModuleMetrics} />
                </div>
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

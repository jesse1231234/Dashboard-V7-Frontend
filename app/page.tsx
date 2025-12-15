"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

type Kpi = {
  key: string;
  label: string;
  value: string | number;
  description?: string;
};

type AnalyzeResponse = {
  course_id: number;
  student_count: number | null;
  kpis: Record<string, any>;
  echo: {
    summary: any[];
    modules: any[];
    students: any[];
  };
  grades: {
    gradebook: any[];
    summary: any[];
    module_metrics: any[];
  };
  analysis: {
    text: string | null;
    error: string | null;
  };
};

// Normalize base URL (strip trailing slashes)
const rawBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_BASE_URL = rawBase.replace(/\/+$/, "");

type TabKey = "overview" | "echo" | "grades" | "exports";

function normalizeKpis(raw: Record<string, any> | null | undefined): Kpi[] {
  if (!raw) return [];
  return Object.entries(raw).map(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      "label" in value &&
      "value" in value
    ) {
      return {
        key,
        label: String((value as any).label),
        value: (value as any).value as string | number,
        description:
          "description" in value ? String((value as any).description) : undefined
      };
    }
    return {
      key,
      label: key,
      value: value as string | number,
      description: undefined
    };
  });
}

function downloadCsv(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: any) => {
    if (value == null) return "";
    const str = String(value);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => escape((row as any)[h])).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DataTable({ title, rows }: { title: string; rows: any[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-400">No data returned.</p>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700"
          onClick={() => downloadCsv(title.replace(/\s+/g, "_"), rows)}
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-[11px] font-semibold text-slate-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
              >
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-[11px] text-slate-700">
                    {String((row as any)[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [courseId, setCourseId] = useState("");
  const [canvasFile, setCanvasFile] = useState<File | null>(null);
  const [echoFile, setEchoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [echoSummary, setEchoSummary] = useState<any[]>([]);
  const [echoModules, setEchoModules] = useState<any[]>([]);
  const [echoStudents, setEchoStudents] = useState<any[]>([]);

  const [gradebook, setGradebook] = useState<any[]>([]);
  const [gradeSummary, setGradeSummary] = useState<any[]>([]);
  const [gradeModuleMetrics, setGradeModuleMetrics] = useState<any[]>([]);

  const canContinueStep1 = !!courseId;
  const canContinueStep2 = !!canvasFile && !!echoFile;

  const moduleChartData = useMemo(() => {
    if (!echoModules || echoModules.length === 0) return [];

    return echoModules.map((row, idx) => {
      const r = row as any;
      const moduleName =
        r["Module"] ??
        r["module"] ??
        r["Module Name"] ??
        r["module_name"] ??
        `Module ${idx + 1}`;

      // Pick first numeric field as "value" if a specific metric isn't obvious
      const numericKeys = Object.keys(r).filter((k) => {
        const v = r[k];
        return typeof v === "number";
      });

      const metricKey = numericKeys[0];
      const value = metricKey ? Number(r[metricKey]) : 0;

      return { module: String(moduleName), value, metricKey };
    });
  }, [echoModules]);

  async function handleRunAnalysis() {
    if (!canvasFile || !echoFile || !courseId) return;

    setLoading(true);
    setAnalysis("");
    setAnalysisError(null);
    setKpis([]);
    setEchoSummary([]);
    setEchoModules([]);
    setEchoStudents([]);
    setGradebook([]);
    setGradeSummary([]);
    setGradeModuleMetrics([]);
    setActiveTab("overview");

    try {
      const formData = new FormData();
      formData.append("course_id", courseId);
      formData.append("canvas_gradebook_csv", canvasFile);
      formData.append("echo_analytics_csv", echoFile);

      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} – ${text}`);
      }

      const data = (await res.json()) as AnalyzeResponse;

      setKpis(normalizeKpis(data.kpis));
      setAnalysis(data.analysis?.text ?? "");
      setAnalysisError(data.analysis?.error ?? null);

      setEchoSummary(data.echo?.summary ?? []);
      setEchoModules(data.echo?.modules ?? []);
      setEchoStudents(data.echo?.students ?? []);

      setGradebook(data.grades?.gradebook ?? []);
      setGradeSummary(data.grades?.summary ?? []);
      setGradeModuleMetrics(data.grades?.module_metrics ?? []);

      setStep(3);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(
        err?.message ?? "Something went wrong calling the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-csuGreen flex items-center justify-center text-xs font-semibold text-white">
              CLE
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Course Analytics Dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Canvas + Echo360 · Instructor-facing insights
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-8 mb-16 max-w-6xl px-6 space-y-6">
        {/* Step indicator */}
        <ol className="flex items-center justify-between gap-4 text-sm">
          {["Course selection", "Upload data", "Review insights"].map(
            (label, idx) => {
              const index = idx + 1;
              const active = step === index;
              const done = step > index;
              return (
                <li key={label} className="flex-1 flex items-center gap-3">
                  <div
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                      done
                        ? "bg-csuGreen text-white border-csuGreen"
                        : active
                        ? "bg-emerald-50 text-csuGreen border-csuGreen"
                        : "bg-white text-slate-400 border-slate-300"
                    ].join(" ")}
                  >
                    {index}
                  </div>
                  <span
                    className={
                      done || active ? "text-slate-900" : "text-slate-400"
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            }
          )}
        </ol>

        {/* Step 1: Course ID */}
        {step === 1 && (
          <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Select course
            </h2>
            <p className="text-sm text-slate-500">
              Enter the Canvas course ID. The backend uses a pre-configured
              Canvas base URL and API token from its environment.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Course ID
                </label>
                <input
                  type="text"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-csuGreen"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  placeholder="e.g. 12345"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
                disabled
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-xl bg-csuGreen px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!canContinueStep1}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {/* Step 2: Uploads */}
        {step === 2 && (
          <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Upload Canvas &amp; Echo360 data
            </h2>
            <p className="text-sm text-slate-500">
              Use the same CSV exports you currently use in the Streamlit
              version.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-700">
                  Canvas gradebook CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    setCanvasFile(e.target.files?.[0] ?? null)
                  }
                  className="block text-sm text-slate-600"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-700">
                  Echo360 analytics CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setEchoFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-xl bg-csuGreen px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!canContinueStep2 || loading}
                onClick={handleRunAnalysis}
              >
                {loading ? "Analyzing…" : "Run analysis"}
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Tabbed insights */}
        {step === 3 && (
          <section className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
              {(
                [
                  ["overview", "Overview"],
                  ["echo", "Echo & Modules"],
                  ["grades", "Grades"],
                  ["exports", "Exports"]
                ] as [TabKey, string][]
              ).map(([key, label]) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "px-3 py-2 text-xs font-medium border-b-2",
                      active
                        ? "border-csuGreen text-csuGreen"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    ].join(" ")}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-4">
                    Key performance indicators
                  </h2>
                  {kpis.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No KPIs returned from backend.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      {kpis.map((kpi) => (
                        <div
                          key={kpi.key}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-1"
                        >
                          <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                            {kpi.label}
                          </span>
                          <span className="text-xl font-semibold text-slate-900">
                            {kpi.value}
                          </span>
                          {kpi.description && (
                            <span className="text-xs text-slate-500">
                              {kpi.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    AI summary
                  </h2>
                  {analysisError && (
                    <p className="text-xs text-red-500">
                      AI analysis error: {analysisError}
                    </p>
                  )}
                  {analysis ? (
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                      {analysis}
                    </p>
                  ) : !analysisError ? (
                    <p className="text-sm text-slate-400">
                      No AI summary returned.
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === "echo" && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Module-level Echo overview
                  </h2>
                  {moduleChartData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={moduleChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="module" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Not enough numeric data to render a chart.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Showing the first numeric metric from the module-level Echo
                    data. You can refine which metric is charted later.
                  </p>
                </div>

                <DataTable title="Echo modules" rows={echoModules} />
                <DataTable title="Echo summary" rows={echoSummary} />
                <DataTable title="Echo students" rows={echoStudents} />
              </div>
            )}

            {activeTab === "grades" && (
              <div className="space-y-6">
                <DataTable title="Gradebook (detailed)" rows={gradebook} />
                <DataTable title="Gradebook summary" rows={gradeSummary} />
                <DataTable
                  title="Module assignment metrics"
                  rows={gradeModuleMetrics}
                />
              </div>
            )}

            {activeTab === "exports" && (
              <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Export data
                </h2>
                <p className="text-sm text-slate-500">
                  Download any of the tables as CSV files for further analysis
                  or sharing.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 text-left"
                    onClick={() =>
                      downloadCsv("echo_modules", echoModules)
                    }
                  >
                    Export Echo modules CSV
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 text-left"
                    onClick={() => downloadCsv("echo_summary", echoSummary)}
                  >
                    Export Echo summary CSV
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 text-left"
                    onClick={() =>
                      downloadCsv("echo_students", echoStudents)
                    }
                  >
                    Export Echo students CSV
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 text-left"
                    onClick={() => downloadCsv("gradebook", gradebook)}
                  >
                    Export gradebook CSV
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 text-left"
                    onClick={() =>
                      downloadCsv("grade_summary", gradeSummary)
                    }
                  >
                    Export grade summary CSV
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 text-left"
                    onClick={() =>
                      downloadCsv("grade_module_metrics", gradeModuleMetrics)
                    }
                  >
                    Export module metrics CSV
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

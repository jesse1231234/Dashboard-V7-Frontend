"use client";

import { useState } from "react";

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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function HomePage() {
  const [step, setStep] = useState(1);

  // ✅ Only course ID now
  const [courseId, setCourseId] = useState("");

  const [canvasFile, setCanvasFile] = useState<File | null>(null);
  const [echoFile, setEchoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [echoSummary, setEchoSummary] = useState<any[]>([]);
  const [gradeSummary, setGradeSummary] = useState<any[]>([]);

  const canContinueStep1 = !!courseId;
  const canContinueStep2 = !!canvasFile && !!echoFile;

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
          label: String(value.label),
          value: value.value as string | number,
          description:
            "description" in value ? String(value.description) : undefined
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

  async function handleRunAnalysis() {
    if (!canvasFile || !echoFile || !courseId) return;

    setLoading(true);
    setAnalysis("");
    setAnalysisError(null);
    setKpis([]);
    setEchoSummary([]);
    setGradeSummary([]);

    try {
      const formData = new FormData();
      // ✅ only send course_id + files now
      formData.append("course_id", courseId);
      formData.append("canvas_gradebook_csv", canvasFile);
      formData.append("echo_analytics_csv", echoFile);

      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = (await res.json()) as AnalyzeResponse;

      setKpis(normalizeKpis(data.kpis));
      setAnalysis(data.analysis?.text ?? "");
      setAnalysisError(data.analysis?.error ?? null);
      setEchoSummary(data.echo?.modules ?? []);
      setGradeSummary(data.grades?.summary ?? []);

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

        {/* Step 1: Course ID only */}
        {step === 1 && (
          <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Select course
            </h2>
            <p className="text-sm text-slate-500">
              Enter the Canvas course ID. The backend will use a pre-configured
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

        {/* Step 3: Results */}
        {step === 3 && (
          <section className="space-y-6">
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

            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-900">
                Module overview (Echo + grades)
              </h2>
              {echoSummary.length === 0 && gradeSummary.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No module-level data returned.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {Object.keys(
                          (echoSummary[0] ?? gradeSummary[0]) ?? {}
                        ).map((key) => (
                          <th
                            key={key}
                            className="px-3 py-2 text-xs font-medium text-slate-600"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(echoSummary.length ? echoSummary : gradeSummary).map(
                        (row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-100 last:border-0"
                          >
                            {Object.entries(row).map(([key, value]) => (
                              <td
                                key={key}
                                className="px-3 py-2 text-xs text-slate-700"
                              >
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              onClick={() => setStep(2)}
            >
              Back to uploads
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

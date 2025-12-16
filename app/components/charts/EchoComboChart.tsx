"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

type Row = Record<string, any>;

const CSU_GREEN = "#1E4D2B";
const CSU_ORANGE = "#D9782D";

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/%/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickKey(keys: string[], candidates: string[]) {
  for (const c of candidates) if (keys.includes(c)) return c;
  return null;
}

export default function EchoComboChart({
  moduleRows,
  studentsTotal,
  title,
}: {
  moduleRows: Row[];
  studentsTotal?: number;
  title?: string;
}) {
  const { data, moduleKey, viewersKey, overallKey, avgKey } = useMemo(() => {
    const rows = Array.isArray(moduleRows) ? moduleRows : [];
    const keys = Object.keys(rows[0] ?? {});

    const moduleKey =
      pickKey(keys, ["Module", "module", "Module Name", "module_name"]) ?? "Module";

    // In your module table you typically have some measure of viewers / students viewing
    const viewersKey =
      pickKey(keys, [
        "# of Students Viewing",
        "# of Students Viewing Video",
        "# Students Viewing",
        "Students Viewing",
        "# of Unique Viewers",
        "# of Unique Viewers (Module)",
      ]) ?? null;

    // Percent-like fields commonly present
    const overallKey =
      pickKey(keys, ["Overall View %", "% of Video Viewed Overall", "Overall % Viewed"]) ?? null;

    const avgKey =
      pickKey(keys, ["Average View %", "Avg View %", "Average % Viewed"]) ?? null;

    // Normalize + compute a “not viewing” bar so we can stack
    const data = rows.map((r) => {
      const viewers = viewersKey ? toNumber(r[viewersKey]) : null;

      const total =
        toNumber(r["# of Students"]) ??
        toNumber(r["# Students"]) ??
        (typeof studentsTotal === "number" ? studentsTotal : null);

      const notViewing =
        viewers !== null && total !== null ? Math.max(0, total - viewers) : null;

      return {
        ...r,
        __module: String(r[moduleKey] ?? ""),
        __viewers: viewers,
        __notViewing: notViewing,
        __overallPct: overallKey ? toNumber(r[overallKey]) : null,
        __avgPct: avgKey ? toNumber(r[avgKey]) : null,
      };
    });

    return { data, moduleKey, viewersKey, overallKey, avgKey };
  }, [moduleRows, studentsTotal]);

  const hasStack = data.some((d) => d.__viewers !== null && d.__notViewing !== null);
  const hasOverall = data.some((d) => d.__overallPct !== null);
  const hasAvg = data.some((d) => d.__avgPct !== null);

  return (
    <div>
      {title ? <div className="text-sm font-semibold text-slate-900 mb-2">{title}</div> : null}

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="__module" interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis />
            <Tooltip />
            <Legend />

            {/* Stacked bars: viewers vs not-viewing */}
            {hasStack && (
              <>
                <Bar
                  dataKey="__viewers"
                  name={viewersKey ?? "Students Viewing"}
                  stackId="a"
                  fill={CSU_GREEN}
                />
                <Bar
                  dataKey="__notViewing"
                  name="Students Not Viewing"
                  stackId="a"
                  fill={CSU_ORANGE}
                />
              </>
            )}

            {/* Lines: percent metrics (if present). Keep them readable. */}
            {hasOverall && (
              <Line
                type="monotone"
                dataKey="__overallPct"
                name={overallKey ?? "Overall View %"}
                stroke={CSU_ORANGE}
                dot={false}
                yAxisId={0}
              />
            )}

            {hasAvg && (
              <Line
                type="monotone"
                dataKey="__avgPct"
                name={avgKey ?? "Average View %"}
                stroke={CSU_GREEN}
                dot={false}
                yAxisId={0}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {!hasStack && (
        <div className="text-xs text-slate-500 mt-2">
          Note: stacked bars require both “# of Students Viewing” and “# of Students” (or studentsTotal).
        </div>
      )}
    </div>
  );
}

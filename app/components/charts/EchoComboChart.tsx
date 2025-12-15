"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

type Row = Record<string, any>;

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v).trim();
  if (!s) return null;

  const cleaned = s.replace(/%/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Streamlit parity: 0..1 -> 0..100 */
function toPct0to100(v: any): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  return n * 100.0;
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Streamlit parity:
 * - Bars: Viewed + Not Viewed = Total students per module (constant if studentsTotal provided)
 * - Lines (right axis): Avg View % and Overall View % (0..100)
 * - Optional dotted reference at studentsTotal
 */
export default function EchoComboChart({
  moduleRows,
  studentsTotal,
  title = "Echo Data",
}: {
  moduleRows: Row[];
  studentsTotal?: number | null;
  title?: string;
}) {
  const { data, leftMax } = useMemo(() => {
    if (!moduleRows || moduleRows.length === 0) return { data: [], leftMax: 0 };

    const viewersCol = moduleRows.some((r) => r["# of Students Viewing"] !== undefined)
      ? "# of Students Viewing"
      : "# of Unique Viewers";

    const computed = moduleRows.map((r) => {
      const Module = String(r["Module"] ?? "");

      const rawViewers = toNumber(r[viewersCol]) ?? 0;

      let total: number;
      let viewed: number;
      let notViewed: number;

      if (studentsTotal && studentsTotal > 0) {
        total = studentsTotal;
        viewed = clampInt(rawViewers, 0, studentsTotal);
        notViewed = clampInt(total - viewed, 0, total);
      } else {
        const nStudents = toNumber(r["# of Students"]) ?? 0;
        total = Math.round(Math.max(rawViewers, nStudents));
        viewed = Math.round(rawViewers);
        notViewed = Math.max(0, total - viewed);
      }

      const avgViewPct = toPct0to100(r["Average View %"]);
      const overallViewPct = toPct0to100(r["Overall View %"]);

      return {
        Module,
        viewed,
        notViewed,
        total,
        avgViewPct,
        overallViewPct,
      };
    });

    const lm = computed.reduce((m, r) => Math.max(m, r.total || 0), 0);
    return { data: computed, leftMax: lm };
  }, [moduleRows, studentsTotal]);

  // Headroom like your Plotly version (12% or at least 5)
  const headroom = Math.max(5, Math.round(leftMax * 0.12));
  const yLeftMax = leftMax > 0 ? leftMax + headroom : undefined;

  return (
    <div className="rounded-2xl bg-white shadow p-4">
      <div className="mb-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">Students (bars) + Percent (lines)</div>
      </div>

      <div style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Module" tick={{ fontSize: 12 }} />

            {/* Left axis for students */}
            <YAxis
              yAxisId="left"
              domain={yLeftMax ? [0, yLeftMax] : ["auto", "auto"]}
              tick={{ fontSize: 12 }}
            />

            {/* Right axis for percent */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              formatter={(value: any, name: any) => {
                if (value === null || value === undefined || Number.isNaN(value)) return ["", name];

                // Percent series
                if (name === "Avg View %" || name === "Avg Overall View %") {
                  return [`${Number(value).toFixed(1)}%`, name];
                }

                // Student counts
                return [Number(value).toLocaleString(), name];
              }}
              labelFormatter={(label) => `Module: ${label}`}
            />

            <Legend verticalAlign="top" align="left" />

            {/* Optional dotted reference line at studentsTotal */}
            {studentsTotal && studentsTotal > 0 ? (
              <ReferenceLine
                yAxisId="left"
                y={studentsTotal}
                strokeDasharray="4 4"
              />
            ) : null}

            {/* Stacked bars: viewed + notViewed */}
            <Bar
              yAxisId="left"
              dataKey="viewed"
              name="# of Unique Viewers"
              stackId="students"
              isAnimationActive={false}
            />
            <Bar
              yAxisId="left"
              dataKey="notViewed"
              name="Not Viewed"
              stackId="students"
              isAnimationActive={false}
            />

            {/* Lines on secondary axis */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgViewPct"
              name="Avg View %"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="overallViewPct"
              name="Avg Overall View %"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

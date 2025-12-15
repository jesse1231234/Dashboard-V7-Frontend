"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

type Row = Record<string, any>;

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v).trim();
  if (!s) return null;

  // Strip percent sign & commas if present
  const cleaned = s.replace(/%/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Streamlit parity:
 * - Input columns are 0..1, convert to 0..100
 * - Two straight lines on one 0..100 y-axis
 */
function toPct0to100(v: any): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  return n * 100.0;
}

export default function GradebookComboChart({
  rows,
  title = "Canvas Data",
}: {
  rows: Row[];
  title?: string;
}) {
  const data = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    return rows.map((r) => {
      const module = String(r["Module"] ?? "");
      const turnedIn = toPct0to100(r["Avg % Turned In"]);
      const excl0 = toPct0to100(r["Avg Average Excluding Zeros"]);

      return {
        Module: module,
        turnedIn,
        excl0,
      };
    });
  }, [rows]);

  return (
    <div className="rounded-2xl bg-white shadow p-4">
      <div className="mb-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">Percent (0–100)</div>
      </div>

      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Module" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                if (value === null || value === undefined || Number.isNaN(value)) return ["", name];
                return [`${Number(value).toFixed(1)}%`, name];
              }}
              labelFormatter={(label) => `Module: ${label}`}
            />
            <Legend verticalAlign="top" align="left" />

            <Line
              type="monotone"
              dataKey="turnedIn"
              name="% Turned In"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="excl0"
              name="Avg Excl Zeros"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

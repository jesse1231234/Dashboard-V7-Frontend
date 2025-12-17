"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";

export function GradebookComboChart({ data }: { data: any[] }) {
  return (
    <ChartCard
      title="Gradebook Performance"
      subtitle="Average scores and submission rates by module"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 48, right: 24, bottom: 48, left: 12 }}
        >
          <CartesianGrid
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />

          <XAxis
            dataKey="Module"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
          />

          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#020617",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#e5e7eb" }}
          />

          <Legend
            verticalAlign="top"
            align="left"
            iconType="circle"
            wrapperStyle={{
              fontSize: 12,
              color: "#9ca3af",
              paddingBottom: 12,
            }}
          />

          <Line
            type="monotone"
            dataKey="Avg Average Excluding Zeros"
            stroke="var(--accent)"
            strokeWidth={3}
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="Avg % Turned In"
            stroke="var(--accent-2)"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

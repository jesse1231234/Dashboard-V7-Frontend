"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";

export function EchoComboChart({ data }: { data: any[] }) {
  return (
    <ChartCard
      title="Echo Video Engagement"
      subtitle="Watch time and average view percentage by module"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
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
            yAxisId="left"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
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

          <Bar
            yAxisId="left"
            dataKey="Total Watch Time (min)"
            fill="var(--accent)"
            radius={[6, 6, 0, 0]}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Avg View %"
            stroke="var(--accent-2)"
            strokeWidth={3}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

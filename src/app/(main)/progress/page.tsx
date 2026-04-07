"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MUSCLE_GROUPS } from "@/lib/constants";
import type {
  Exercise,
  WorkoutSet,
  WorkoutSession,
  MuscleGroup,
  BodyMeasurement,
} from "@/types/database";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
  Trophy,
  TrendingUp,
  Dumbbell,
  BarChart3,
  Calendar,
  Flame,
  Award,
  Activity,
  Weight,
  Ruler,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface SetWithDate extends WorkoutSet {
  session_date: string;
}

interface PR {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  bestWeight: number;
  bestWeightReps: number;
  bestWeightDate: string;
  bestEstimated1RM: number;
  best1RMWeight: number;
  best1RMReps: number;
  best1RMDate: string;
}

interface ChartPoint {
  date: string;
  maxWeight: number;
  maxWeightReps: number;
  best1RM: number;
  best1RMWeight: number;
  best1RMReps: number;
  totalVolume: number;
}

interface VolumeByMuscle {
  muscleGroup: MuscleGroup;
  volume: number;
  sets: number;
}

type TabId = "ejercicios" | "records" | "volumen" | "cuerpo";

const TABS: { id: TabId; label: string }[] = [
  { id: "ejercicios", label: "Ejercicios" },
  { id: "records", label: "Records" },
  { id: "volumen", label: "Volumen" },
  { id: "cuerpo", label: "Cuerpo" },
];

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = Object.fromEntries(
  MUSCLE_GROUPS.map((mg) => [mg.value, mg.label])
) as Record<MuscleGroup, string>;

const MUSCLE_COLORS: string[] = [
  "var(--primary)",
  "var(--info)",
  "var(--accent)",
  "var(--warning)",
  "var(--success)",
  "var(--danger)",
  "var(--secondary)",
];

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatVolume(vol: number): string {
  if (vol >= 10000) return `${(vol / 1000).toFixed(1)}t`;
  return `${Math.round(vol).toLocaleString("es-ES")}kg`;
}

function getMonthRange(offset: number = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    startStr: start.toISOString().split("T")[0],
    endStr: end.toISOString().split("T")[0],
  };
}

function getWeekRange(offset: number = 0) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startStr: monday.toISOString().split("T")[0],
    endStr: sunday.toISOString().split("T")[0],
  };
}

/* ═══════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════ */

function StatCard({
  icon,
  iconBg,
  value,
  label,
  comparison,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
  comparison?: { value: number; suffix: string } | null;
}) {
  return (
    <Card padding="compact">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${iconBg} 15%, transparent)` }}
        >
          <div style={{ color: iconBg }}>{icon}</div>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-foreground tabular-nums">
            {value}
          </p>
          <p className="text-xs text-muted leading-tight mt-0.5">{label}</p>
          {comparison && comparison.value !== 0 && (
            <p
              className="mt-1 flex items-center gap-0.5 text-[11px] font-medium"
              style={{
                color:
                  comparison.value > 0
                    ? "var(--success)"
                    : comparison.value < 0
                      ? "var(--danger)"
                      : "var(--muted)",
              }}
            >
              {comparison.value > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : comparison.value < 0 ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {comparison.value > 0 ? "+" : ""}
              {comparison.value} {comparison.suffix}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Weight Progression Bar Chart (SVG) ── */

function WeightChart({
  data,
  color,
  title,
}: {
  data: ChartPoint[];
  color: string;
  title: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayData = data.slice(-15);
  if (displayData.length === 0) return null;

  const values = displayData.map((d) => d.maxWeight);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || maxVal * 0.1 || 1;
  const paddedMin = Math.max(0, minVal - range * 0.1);
  const paddedMax = maxVal + range * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const barWidth = Math.max(24, Math.min(44, 500 / displayData.length));
  const gap = 8;
  const chartHeight = 160;
  const paddingLeft = 45;
  const paddingTop = 10;
  const paddingBottom = 40;
  const svgWidth = displayData.length * (barWidth + gap) + paddingLeft + 20;
  const svgHeight = chartHeight + paddingTop + paddingBottom;

  return (
    <div className="flex-1 min-w-0">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {title}
      </h3>
      <div
        ref={containerRef}
        className="relative overflow-x-auto rounded-lg bg-background p-2"
        onMouseLeave={() => setActiveIdx(null)}
      >
        <svg
          width={Math.max(svgWidth, 280)}
          height={svgHeight}
          viewBox={`0 0 ${Math.max(svgWidth, 280)} ${svgHeight}`}
          preserveAspectRatio="xMinYMid meet"
          className="w-full"
        >
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = paddingTop + chartHeight - pct * chartHeight;
            const val = Math.round(paddedMin + pct * paddedRange);
            return (
              <g key={pct}>
                <line
                  x1={paddingLeft - 5}
                  y1={y}
                  x2={Math.max(svgWidth, 280)}
                  y2={y}
                  stroke="var(--card-border)"
                  strokeDasharray="3,3"
                  strokeOpacity={0.6}
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize={10}
                  fontFamily="inherit"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayData.map((d, i) => {
            const val = d.maxWeight;
            const barH = Math.max(4, ((val - paddedMin) / paddedRange) * chartHeight);
            const x = paddingLeft + i * (barWidth + gap);
            const y = paddingTop + chartHeight - barH;
            const isActive = activeIdx === i;

            return (
              <g
                key={d.date + i}
                onMouseEnter={() => setActiveIdx(i)}
                onTouchStart={() => setActiveIdx(activeIdx === i ? null : i)}
                className="cursor-pointer"
              >
                {/* Hit area */}
                <rect
                  x={x - 2}
                  y={paddingTop}
                  width={barWidth + 4}
                  height={chartHeight + paddingBottom}
                  fill="transparent"
                />
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={4}
                  fill={color}
                  opacity={isActive ? 1 : 0.7}
                  className="transition-opacity duration-150"
                />
                {/* Value on hover */}
                {isActive && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={11}
                    fontWeight="700"
                    fontFamily="inherit"
                  >
                    {Math.round(val)}kg
                  </text>
                )}
                {/* Date label */}
                <text
                  x={x + barWidth / 2}
                  y={paddingTop + chartHeight + 20}
                  textAnchor="middle"
                  fill={isActive ? "var(--foreground)" : "var(--muted)"}
                  fontSize={9}
                  fontFamily="inherit"
                  fontWeight={isActive ? 600 : 400}
                >
                  {formatShortDate(d.date)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {activeIdx !== null && displayData[activeIdx] && (
          <ChartTooltip
            data={displayData[activeIdx]}
            containerRef={containerRef}
            index={activeIdx}
            totalBars={displayData.length}
          />
        )}
      </div>
    </div>
  );
}

/* ── Estimated 1RM Line Chart (SVG) ── */

function LineChart({
  data,
  color,
  title,
  valueKey,
}: {
  data: ChartPoint[];
  color: string;
  title: string;
  valueKey: "best1RM" | "maxWeight";
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayData = data.slice(-15);
  if (displayData.length < 2) return null;

  const values = displayData.map((d) => d[valueKey]);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || maxVal * 0.1 || 1;
  const paddedMin = Math.max(0, minVal - range * 0.15);
  const paddedMax = maxVal + range * 0.15;
  const paddedRange = paddedMax - paddedMin;

  const chartWidth = 500;
  const chartHeight = 160;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 10;
  const paddingBottom = 40;
  const svgWidth = chartWidth + paddingLeft + paddingRight;
  const svgHeight = chartHeight + paddingTop + paddingBottom;

  const points = displayData.map((d, i) => {
    const x = paddingLeft + (i / (displayData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d[valueKey] - paddedMin) / paddedRange) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <div className="flex-1 min-w-0">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {title}
      </h3>
      <div
        ref={containerRef}
        className="relative overflow-x-auto rounded-lg bg-background p-2"
        onMouseLeave={() => setActiveIdx(null)}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMinYMid meet"
          className="w-full"
        >
          {/* Y-axis */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = paddingTop + chartHeight - pct * chartHeight;
            const val = Math.round(paddedMin + pct * paddedRange);
            return (
              <g key={pct}>
                <line
                  x1={paddingLeft - 5}
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="var(--card-border)"
                  strokeDasharray="3,3"
                  strokeOpacity={0.6}
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize={10}
                  fontFamily="inherit"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill={color} opacity={0.1} />

          {/* Line */}
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => {
            const isActive = activeIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setActiveIdx(i)}
                onTouchStart={() => setActiveIdx(activeIdx === i ? null : i)}
                className="cursor-pointer"
              >
                <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5 : 3.5}
                  fill={isActive ? color : "var(--card-bg)"}
                  stroke={color}
                  strokeWidth={2}
                  className="transition-all duration-150"
                />
                {isActive && (
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={11}
                    fontWeight="700"
                    fontFamily="inherit"
                  >
                    {Math.round(displayData[i][valueKey])}kg
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis labels */}
          {displayData.map((d, i) => {
            const showLabel = displayData.length <= 8 || i % Math.ceil(displayData.length / 7) === 0 || i === displayData.length - 1;
            if (!showLabel) return null;
            return (
              <text
                key={d.date}
                x={points[i].x}
                y={paddingTop + chartHeight + 20}
                textAnchor="middle"
                fill={activeIdx === i ? "var(--foreground)" : "var(--muted)"}
                fontSize={9}
                fontFamily="inherit"
                fontWeight={activeIdx === i ? 600 : 400}
              >
                {formatShortDate(d.date)}
              </text>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {activeIdx !== null && displayData[activeIdx] && (
          <ChartTooltip
            data={displayData[activeIdx]}
            containerRef={containerRef}
            index={activeIdx}
            totalBars={displayData.length}
          />
        )}
      </div>
    </div>
  );
}

/* ── Chart Tooltip ── */

function ChartTooltip({
  data,
  containerRef,
  index,
  totalBars,
}: {
  data: ChartPoint;
  containerRef: React.RefObject<HTMLDivElement | null>;
  index: number;
  totalBars: number;
}) {
  const isRight = index > totalBars / 2;

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-card-border bg-card-bg px-3 py-2 shadow-lg"
      style={{
        top: 8,
        ...(isRight ? { right: 8 } : { left: 8 }),
      }}
    >
      <p className="text-xs font-semibold text-foreground mb-1">
        {formatDate(data.date)}
      </p>
      <div className="space-y-0.5 text-[11px]">
        <p className="text-muted">
          Peso:{" "}
          <span className="font-semibold" style={{ color: "var(--primary)" }}>
            {data.maxWeight}kg
          </span>
          {data.maxWeightReps > 0 && (
            <span className="text-muted"> x {data.maxWeightReps} reps</span>
          )}
        </p>
        <p className="text-muted">
          1RM est:{" "}
          <span className="font-semibold" style={{ color: "var(--info)" }}>
            {Math.round(data.best1RM * 10) / 10}kg
          </span>
        </p>
      </div>
    </div>
  );
}

/* ── Volume Bar ── */

function VolumeBar({
  label,
  volume,
  sets,
  maxVolume,
  color,
}: {
  label: string;
  volume: number;
  sets: number;
  maxVolume: number;
  color: string;
}) {
  const pct = Math.max(2, (volume / maxVolume) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted tabular-nums">
          {Math.round(volume).toLocaleString("es-ES")} kg
          <span className="mx-1 opacity-30">|</span>
          {sets} series
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── Body Line Chart (generic for weight/fat) ── */

function BodyLineChart({
  dataPoints,
  color,
  title,
  unit,
}: {
  dataPoints: { date: string; value: number }[];
  color: string;
  title: string;
  unit: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (dataPoints.length < 2) return null;

  const values = dataPoints.map((d) => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || maxVal * 0.1 || 1;
  const paddedMin = Math.max(0, minVal - range * 0.15);
  const paddedMax = maxVal + range * 0.15;
  const paddedRange = paddedMax - paddedMin;

  const chartWidth = 460;
  const chartHeight = 140;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 10;
  const paddingBottom = 40;
  const svgWidth = chartWidth + paddingLeft + paddingRight;
  const svgHeight = chartHeight + paddingTop + paddingBottom;

  const points = dataPoints.map((d, i) => {
    const x = paddingLeft + (i / (dataPoints.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - paddedMin) / paddedRange) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h3>
      <div
        className="relative overflow-x-auto rounded-lg bg-background p-2"
        onMouseLeave={() => setActiveIdx(null)}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMinYMid meet"
          className="w-full"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = paddingTop + chartHeight - pct * chartHeight;
            const val = (paddedMin + pct * paddedRange).toFixed(1);
            return (
              <g key={pct}>
                <line
                  x1={paddingLeft - 5}
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="var(--card-border)"
                  strokeDasharray="3,3"
                  strokeOpacity={0.6}
                />
                <text x={paddingLeft - 10} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize={10} fontFamily="inherit">
                  {val}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={color} opacity={0.1} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => {
            const isActive = activeIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setActiveIdx(i)}
                onTouchStart={() => setActiveIdx(activeIdx === i ? null : i)}
                className="cursor-pointer"
              >
                <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5 : 3.5}
                  fill={isActive ? color : "var(--card-bg)"}
                  stroke={color}
                  strokeWidth={2}
                  className="transition-all duration-150"
                />
                {isActive && (
                  <>
                    <text x={p.x} y={p.y - 12} textAnchor="middle" fill="var(--foreground)" fontSize={11} fontWeight="700" fontFamily="inherit">
                      {dataPoints[i].value}{unit}
                    </text>
                    <text x={p.x} y={paddingTop + chartHeight + 20} textAnchor="middle" fill="var(--foreground)" fontSize={9} fontWeight={600} fontFamily="inherit">
                      {formatShortDate(dataPoints[i].date)}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* X-axis labels (only a few) */}
          {dataPoints.map((d, i) => {
            if (activeIdx === i) return null;
            const showLabel = dataPoints.length <= 8 || i % Math.ceil(dataPoints.length / 6) === 0 || i === dataPoints.length - 1;
            if (!showLabel) return null;
            return (
              <text key={d.date} x={points[i].x} y={paddingTop + chartHeight + 20} textAnchor="middle" fill="var(--muted)" fontSize={9} fontFamily="inherit">
                {formatShortDate(d.date)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Weekly Volume Comparison Chart ── */

function WeekComparisonChart({
  thisWeek,
  lastWeek,
}: {
  thisWeek: number;
  lastWeek: number;
}) {
  const maxVal = Math.max(thisWeek, lastWeek, 1);
  const pctChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

  const barHeight = 32;
  const gap = 12;
  const svgHeight = barHeight * 2 + gap + 20;
  const svgWidth = 400;
  const labelWidth = 130;
  const maxBarWidth = svgWidth - labelWidth - 80;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <TrendingUp className="h-4 w-4 text-muted" />
        Comparativa semanal
        {lastWeek > 0 && (
          <span
            className="text-xs font-medium"
            style={{ color: pctChange >= 0 ? "var(--success)" : "var(--danger)" }}
          >
            {pctChange >= 0 ? "+" : ""}{pctChange}%
          </span>
        )}
      </h3>
      <div className="overflow-x-auto rounded-lg bg-background p-3">
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
          {/* This week */}
          <text x={0} y={barHeight / 2 + 5} fill="var(--foreground)" fontSize={12} fontWeight={500} fontFamily="inherit">
            Semana actual
          </text>
          <rect x={labelWidth} y={0} width={Math.max(4, (thisWeek / maxVal) * maxBarWidth)} height={barHeight} rx={6} fill="var(--primary)" opacity={0.85} />
          <text x={labelWidth + Math.max(4, (thisWeek / maxVal) * maxBarWidth) + 8} y={barHeight / 2 + 5} fill="var(--foreground)" fontSize={12} fontWeight={700} fontFamily="inherit">
            {formatVolume(thisWeek)}
          </text>

          {/* Last week */}
          <text x={0} y={barHeight + gap + barHeight / 2 + 5} fill="var(--muted)" fontSize={12} fontWeight={500} fontFamily="inherit">
            Semana anterior
          </text>
          <rect x={labelWidth} y={barHeight + gap} width={Math.max(4, (lastWeek / maxVal) * maxBarWidth)} height={barHeight} rx={6} fill="var(--muted)" opacity={0.3} />
          <text x={labelWidth + Math.max(4, (lastWeek / maxVal) * maxBarWidth) + 8} y={barHeight + gap + barHeight / 2 + 5} fill="var(--muted)" fontSize={12} fontWeight={700} fontFamily="inherit">
            {formatVolume(lastWeek)}
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════ */

function ProgressSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="h-7 w-32 rounded bg-card-border animate-pulse" />
        <div className="mt-1 h-4 w-48 rounded bg-card-border animate-pulse" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} padding="compact">
            <div className="animate-pulse flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-card-border" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-12 rounded bg-card-border" />
                <div className="h-3 w-20 rounded bg-card-border" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-1 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-24 rounded-lg bg-card-border" />
        ))}
      </div>

      {/* Content skeleton */}
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-card-border" />
          <div className="h-48 rounded-lg bg-card-border/50" />
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Progress Page
   ═══════════════════════════════════════════════════════ */

export default function ProgressPage() {
  const supabase = createClient();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [allSets, setAllSets] = useState<SetWithDate[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("ejercicios");
  const [prFilter, setPrFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [sessionsRes, bodyRes] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", true)
        .order("date", { ascending: false }),
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true }),
    ]);

    const typedSessions = (sessionsRes.data as WorkoutSession[]) ?? [];
    setSessions(typedSessions);
    setBodyMeasurements((bodyRes.data as BodyMeasurement[]) ?? []);

    if (typedSessions.length === 0) {
      setLoading(false);
      return;
    }

    const sessionIds = typedSessions.map((s) => s.id);

    const { data: setsData } = await supabase
      .from("workout_sets")
      .select("*, exercise:exercises(*)")
      .in("session_id", sessionIds)
      .eq("completed", true);

    const sessionMap = new Map(typedSessions.map((s) => [s.id, s]));
    const setsWithDate: SetWithDate[] = ((setsData as WorkoutSet[]) ?? []).map((s) => ({
      ...s,
      session_date: sessionMap.get(s.session_id)?.date ?? "",
    }));
    setAllSets(setsWithDate);

    const exerciseMap = new Map<string, Exercise>();
    for (const s of setsWithDate) {
      if (s.exercise) exerciseMap.set(s.exercise_id, s.exercise);
    }
    const exList = Array.from(exerciseMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setExercises(exList);
    if (exList.length > 0) setSelectedExerciseId(exList[0].id);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─── Computed: Quick Stats ─── */

  const quickStats = useMemo(() => {
    const thisMonth = getMonthRange(0);
    const lastMonth = getMonthRange(-1);
    const thisWeek = getWeekRange(0);

    // Sessions this month
    const sessionsThisMonth = sessions.filter(
      (s) => s.date >= thisMonth.startStr && s.date <= thisMonth.endStr
    ).length;
    const sessionsLastMonth = sessions.filter(
      (s) => s.date >= lastMonth.startStr && s.date <= lastMonth.endStr
    ).length;

    // Weekly volume
    const weeklyVolume = allSets
      .filter((s) => s.session_date >= thisWeek.startStr && s.session_date <= thisWeek.endStr)
      .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);

    // Streak
    let streak = 0;
    if (sessions.length > 0) {
      const sortedDates = [...new Set(sessions.map((s) => s.date))].sort().reverse();
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      if (sortedDates[0] === today || sortedDates[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const curr = new Date(sortedDates[i - 1] + "T12:00:00");
          const prev = new Date(sortedDates[i] + "T12:00:00");
          const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
          if (diffDays <= 1) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    // PRs this month: count exercises where max weight this month > max weight before this month
    let prsThisMonth = 0;
    const exerciseMaxBefore = new Map<string, number>();
    const exerciseMaxThisMonth = new Map<string, number>();

    for (const s of allSets) {
      if (s.session_date < thisMonth.startStr) {
        const prev = exerciseMaxBefore.get(s.exercise_id) ?? 0;
        exerciseMaxBefore.set(s.exercise_id, Math.max(prev, s.weight_kg));
      } else if (s.session_date >= thisMonth.startStr && s.session_date <= thisMonth.endStr) {
        const prev = exerciseMaxThisMonth.get(s.exercise_id) ?? 0;
        exerciseMaxThisMonth.set(s.exercise_id, Math.max(prev, s.weight_kg));
      }
    }

    for (const [exId, maxThisMonth] of exerciseMaxThisMonth) {
      const maxBefore = exerciseMaxBefore.get(exId) ?? 0;
      if (maxThisMonth > maxBefore) prsThisMonth++;
    }

    return {
      sessionsThisMonth,
      sessionsDiff: sessionsThisMonth - sessionsLastMonth,
      weeklyVolume,
      streak,
      prsThisMonth,
    };
  }, [sessions, allSets]);

  /* ─── Computed: Chart data for selected exercise ─── */

  const exerciseSets = useMemo(
    () =>
      allSets
        .filter((s) => s.exercise_id === selectedExerciseId)
        .sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [allSets, selectedExerciseId]
  );

  const chartData = useMemo((): ChartPoint[] => {
    const byDate = new Map<string, ChartPoint>();

    for (const s of exerciseSets) {
      const existing = byDate.get(s.session_date) ?? {
        date: s.session_date,
        maxWeight: 0,
        maxWeightReps: 0,
        best1RM: 0,
        best1RMWeight: 0,
        best1RMReps: 0,
        totalVolume: 0,
      };

      if (s.weight_kg > existing.maxWeight) {
        existing.maxWeight = s.weight_kg;
        existing.maxWeightReps = s.reps;
      }

      const e1rm = estimated1RM(s.weight_kg, s.reps);
      if (e1rm > existing.best1RM) {
        existing.best1RM = e1rm;
        existing.best1RMWeight = s.weight_kg;
        existing.best1RMReps = s.reps;
      }

      existing.totalVolume += s.weight_kg * s.reps;
      byDate.set(s.session_date, existing);
    }

    return Array.from(byDate.values());
  }, [exerciseSets]);

  /* ─── Computed: PRs ─── */

  const prs = useMemo((): PR[] => {
    const prMap = new Map<
      string,
      {
        exercise: Exercise;
        bestWeight: number;
        bestWeightReps: number;
        bestWeightDate: string;
        bestEstimated1RM: number;
        best1RMWeight: number;
        best1RMReps: number;
        best1RMDate: string;
      }
    >();

    for (const s of allSets) {
      if (!s.exercise) continue;
      const existing = prMap.get(s.exercise_id) ?? {
        exercise: s.exercise,
        bestWeight: 0,
        bestWeightReps: 0,
        bestWeightDate: "",
        bestEstimated1RM: 0,
        best1RMWeight: 0,
        best1RMReps: 0,
        best1RMDate: "",
      };

      if (s.weight_kg > existing.bestWeight) {
        existing.bestWeight = s.weight_kg;
        existing.bestWeightReps = s.reps;
        existing.bestWeightDate = s.session_date;
      }

      const e1rm = estimated1RM(s.weight_kg, s.reps);
      if (e1rm > existing.bestEstimated1RM) {
        existing.bestEstimated1RM = e1rm;
        existing.best1RMWeight = s.weight_kg;
        existing.best1RMReps = s.reps;
        existing.best1RMDate = s.session_date;
      }

      prMap.set(s.exercise_id, existing);
    }

    return Array.from(prMap.values())
      .map((v) => ({
        exerciseId: v.exercise.id,
        exerciseName: v.exercise.name,
        muscleGroup: v.exercise.muscle_group,
        bestWeight: v.bestWeight,
        bestWeightReps: v.bestWeightReps,
        bestWeightDate: v.bestWeightDate,
        bestEstimated1RM: Math.round(v.bestEstimated1RM * 10) / 10,
        best1RMWeight: v.best1RMWeight,
        best1RMReps: v.best1RMReps,
        best1RMDate: v.best1RMDate,
      }))
      .sort((a, b) => b.best1RMDate.localeCompare(a.best1RMDate));
  }, [allSets]);

  const filteredPrs = useMemo(
    () => (prFilter === "all" ? prs : prs.filter((pr) => pr.muscleGroup === prFilter)),
    [prs, prFilter]
  );

  /* ─── Computed: Volume by muscle (this week) ─── */

  const thisWeekRange = useMemo(() => getWeekRange(0), []);
  const lastWeekRange = useMemo(() => getWeekRange(-1), []);

  const volumeByMuscle = useMemo((): VolumeByMuscle[] => {
    const map = new Map<MuscleGroup, { volume: number; sets: number }>();
    for (const s of allSets) {
      if (!s.exercise || s.session_date < thisWeekRange.startStr || s.session_date > thisWeekRange.endStr) continue;
      const mg = s.exercise.muscle_group;
      const existing = map.get(mg) ?? { volume: 0, sets: 0 };
      existing.volume += s.weight_kg * s.reps;
      existing.sets += 1;
      map.set(mg, existing);
    }
    return Array.from(map.entries())
      .map(([muscleGroup, data]) => ({ muscleGroup, ...data }))
      .sort((a, b) => b.volume - a.volume);
  }, [allSets, thisWeekRange]);

  const maxVolume = useMemo(
    () => (volumeByMuscle.length > 0 ? Math.max(...volumeByMuscle.map((v) => v.volume)) : 1),
    [volumeByMuscle]
  );

  /* ─── Computed: Weekly volume comparison ─── */

  const weeklyComparison = useMemo(() => {
    const thisWeekVol = allSets
      .filter((s) => s.session_date >= thisWeekRange.startStr && s.session_date <= thisWeekRange.endStr)
      .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);

    const lastWeekVol = allSets
      .filter((s) => s.session_date >= lastWeekRange.startStr && s.session_date <= lastWeekRange.endStr)
      .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);

    return { thisWeek: thisWeekVol, lastWeek: lastWeekVol };
  }, [allSets, thisWeekRange, lastWeekRange]);

  /* ─── Computed: Body data ─── */

  const weightData = useMemo(
    () =>
      bodyMeasurements
        .filter((m) => m.weight_kg !== null)
        .map((m) => ({ date: m.date, value: m.weight_kg! })),
    [bodyMeasurements]
  );

  const bodyFatData = useMemo(
    () =>
      bodyMeasurements
        .filter((m) => m.body_fat_pct !== null)
        .map((m) => ({ date: m.date, value: m.body_fat_pct! })),
    [bodyMeasurements]
  );

  const latestMeasurement = useMemo(
    () => (bodyMeasurements.length > 0 ? bodyMeasurements[bodyMeasurements.length - 1] : null),
    [bodyMeasurements]
  );

  /* ─── Render ─── */

  if (loading) {
    return <ProgressSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Progreso</h1>
        <p className="text-sm text-muted">Analiza tu rendimiento y evoluciona</p>
      </div>

      {allSets.length === 0 ? (
        /* ─── Empty State ─── */
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
          >
            <BarChart3 className="h-10 w-10" style={{ color: "var(--primary)" }} />
          </div>
          <p className="mt-5 text-lg font-semibold text-foreground">
            Todavia no hay datos de progreso
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Completa tu primera sesion de entrenamiento para comenzar a ver tus estadisticas, records y graficos de progresion.
          </p>
          <Link href="/sessions">
            <Button variant="primary" size="md" className="mt-5">
              Ir a sesiones
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* ─── Quick Stats Cards ─── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Calendar className="h-5 w-5" />}
              iconBg="var(--success)"
              value={quickStats.sessionsThisMonth}
              label="Sesiones este mes"
              comparison={
                quickStats.sessionsDiff !== 0
                  ? { value: quickStats.sessionsDiff, suffix: "vs mes anterior" }
                  : null
              }
            />
            <StatCard
              icon={<Activity className="h-5 w-5" />}
              iconBg="var(--info)"
              value={formatVolume(quickStats.weeklyVolume)}
              label="Volumen semanal"
            />
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              iconBg="var(--warning)"
              value={quickStats.streak}
              label="Racha actual"
              comparison={quickStats.streak > 0 ? { value: quickStats.streak, suffix: "dias consecutivos" } : null}
            />
            <StatCard
              icon={<Award className="h-5 w-5" />}
              iconBg="var(--accent)"
              value={quickStats.prsThisMonth}
              label="PRs este mes"
            />
          </div>

          {/* ─── Tab Navigation ─── */}
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-1 min-w-max rounded-xl bg-card-bg border border-card-border p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium rounded-lg
                    transition-all duration-200 min-h-[44px] cursor-pointer
                    ${
                      activeTab === tab.id
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground hover:bg-background"
                    }
                  `.trim()}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Tab Content ─── */}

          {/* === EJERCICIOS TAB === */}
          {activeTab === "ejercicios" && (
            <Card>
              <div className="mb-5 max-w-xs">
                <Select
                  label="Ejercicio"
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </Select>
              </div>

              {chartData.length > 0 ? (
                <div className="flex flex-col gap-6 lg:flex-row">
                  <WeightChart
                    data={chartData}
                    color="var(--primary)"
                    title="Progresion de Peso"
                  />
                  <LineChart
                    data={chartData}
                    color="var(--info)"
                    title="1RM Estimado"
                    valueKey="best1RM"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-center">
                  <Dumbbell className="h-8 w-8 text-muted mb-2" />
                  <p className="text-sm text-muted">
                    No hay datos para este ejercicio
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* === RECORDS TAB === */}
          {activeTab === "records" && (
            <Card>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Trophy className="h-5 w-5" style={{ color: "var(--warning)" }} />
                  Records Personales
                </h2>
                <div className="w-full sm:w-48">
                  <Select
                    value={prFilter}
                    onChange={(e) => setPrFilter(e.target.value)}
                  >
                    <option value="all">Todos los grupos</option>
                    {MUSCLE_GROUPS.map((mg) => (
                      <option key={mg.value} value={mg.value}>
                        {mg.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {filteredPrs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  No hay records para este grupo muscular
                </p>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-card-border text-left">
                          <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-widest text-muted">
                            Ejercicio
                          </th>
                          <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-widest text-muted text-right">
                            Mejor Peso
                          </th>
                          <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-widest text-muted text-right">
                            1RM Est.
                          </th>
                          <th className="pb-2 text-xs font-semibold uppercase tracking-widest text-muted text-right">
                            Fecha PR
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPrs.map((pr) => (
                          <tr
                            key={pr.exerciseId}
                            className="border-b border-card-border/50 last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground">
                                {pr.exerciseName}
                              </div>
                              <div className="text-xs text-muted">
                                {MUSCLE_GROUP_LABELS[pr.muscleGroup]}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <span className="font-bold" style={{ color: "var(--primary)" }}>
                                {pr.bestWeight} kg
                              </span>
                              <div className="text-xs text-muted">
                                {pr.bestWeightReps} reps
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <span className="font-bold" style={{ color: "var(--info)" }}>
                                {pr.bestEstimated1RM} kg
                              </span>
                              <div className="text-xs text-muted">
                                {pr.best1RMWeight}kg x {pr.best1RMReps}
                              </div>
                            </td>
                            <td className="py-3 text-right text-xs text-muted">
                              {formatDate(pr.best1RMDate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-2 sm:hidden">
                    {filteredPrs.map((pr) => (
                      <div
                        key={pr.exerciseId}
                        className="rounded-xl bg-background p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground text-sm truncate">
                              {pr.exerciseName}
                            </div>
                            <div className="text-[11px] text-muted">
                              {MUSCLE_GROUP_LABELS[pr.muscleGroup]}
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <div className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                              {pr.bestWeight} kg
                            </div>
                            <div className="text-xs font-medium" style={{ color: "var(--info)" }}>
                              1RM: {pr.bestEstimated1RM} kg
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-muted text-right">
                          {formatDate(pr.best1RMDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* === VOLUMEN TAB === */}
          {activeTab === "volumen" && (
            <div className="space-y-5">
              <Card>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Dumbbell className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  Volumen por Grupo Muscular
                  <Badge color="purple" size="sm">
                    Esta semana
                  </Badge>
                </h2>

                {volumeByMuscle.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    Sin datos esta semana
                  </p>
                ) : (
                  <div className="space-y-3">
                    {volumeByMuscle.map((v, i) => (
                      <VolumeBar
                        key={v.muscleGroup}
                        label={MUSCLE_GROUP_LABELS[v.muscleGroup]}
                        volume={v.volume}
                        sets={v.sets}
                        maxVolume={maxVolume}
                        color={MUSCLE_COLORS[i % MUSCLE_COLORS.length]}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <WeekComparisonChart
                  thisWeek={weeklyComparison.thisWeek}
                  lastWeek={weeklyComparison.lastWeek}
                />
              </Card>
            </div>
          )}

          {/* === CUERPO TAB === */}
          {activeTab === "cuerpo" && (
            <div className="space-y-5">
              {bodyMeasurements.length === 0 ? (
                /* Empty state for body data */
                <Card className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
                  >
                    <Ruler className="h-8 w-8" style={{ color: "var(--accent)" }} />
                  </div>
                  <p className="mt-4 text-base font-semibold text-foreground">
                    No hay medidas corporales
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted">
                    Registra tus medidas para ver tu evolucion de peso, grasa corporal y mas.
                  </p>
                  <Link href="/profile">
                    <Button variant="primary" size="md" className="mt-4">
                      Registrar medidas
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </Card>
              ) : (
                <>
                  {/* Weight evolution chart */}
                  {weightData.length >= 2 && (
                    <Card>
                      <BodyLineChart
                        dataPoints={weightData}
                        color="var(--primary)"
                        title="Evolucion de Peso"
                        unit="kg"
                      />
                    </Card>
                  )}

                  {/* Body fat chart */}
                  {bodyFatData.length >= 2 && (
                    <Card>
                      <BodyLineChart
                        dataPoints={bodyFatData}
                        color="var(--accent)"
                        title="Grasa Corporal"
                        unit="%"
                      />
                    </Card>
                  )}

                  {/* Latest measurement card */}
                  {latestMeasurement && (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Weight className="h-4 w-4 text-muted" />
                          Ultima medicion
                        </h3>
                        <span className="text-xs text-muted">
                          {formatDate(latestMeasurement.date)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {latestMeasurement.weight_kg !== null && (
                          <MeasurementItem label="Peso" value={`${latestMeasurement.weight_kg} kg`} />
                        )}
                        {latestMeasurement.body_fat_pct !== null && (
                          <MeasurementItem label="Grasa corporal" value={`${latestMeasurement.body_fat_pct}%`} />
                        )}
                        {latestMeasurement.chest_cm !== null && (
                          <MeasurementItem label="Pecho" value={`${latestMeasurement.chest_cm} cm`} />
                        )}
                        {latestMeasurement.waist_cm !== null && (
                          <MeasurementItem label="Cintura" value={`${latestMeasurement.waist_cm} cm`} />
                        )}
                        {latestMeasurement.arm_cm !== null && (
                          <MeasurementItem label="Brazo" value={`${latestMeasurement.arm_cm} cm`} />
                        )}
                        {latestMeasurement.leg_cm !== null && (
                          <MeasurementItem label="Pierna" value={`${latestMeasurement.leg_cm} cm`} />
                        )}
                      </div>

                      {latestMeasurement.notes && (
                        <p className="mt-3 text-xs text-muted italic">
                          {latestMeasurement.notes}
                        </p>
                      )}

                      <div className="mt-4 pt-3 border-t border-card-border">
                        <Link href="/profile">
                          <Button variant="secondary" size="sm" fullWidth>
                            Registrar nueva medida
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  )}

                  {/* If we only have 1 weight data point */}
                  {weightData.length === 1 && (
                    <Card>
                      <div className="flex flex-col items-center py-6 text-center">
                        <TrendingUp className="h-6 w-6 text-muted mb-2" />
                        <p className="text-sm text-muted">
                          Registra al menos 2 medidas de peso para ver el grafico de evolucion.
                        </p>
                        <Link href="/profile">
                          <Button variant="secondary" size="sm" className="mt-3">
                            Registrar medida
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Small helper component for body measurements ── */

function MeasurementItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

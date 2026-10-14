"use client";

// グラフ(Recharts)。色はライト/ダークそれぞれの面で検証済みの値を使う
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMd, type DateStr } from "@/lib/dates";
import { minutesToTime } from "@/lib/scoring";

const LIGHT = { s1: "#2a78d6", s2: "#eb6834", grid: "#e7e5e4", axis: "#71717a", surface: "#ffffff", text: "#18181b" };
const DARK = { s1: "#3987e5", s2: "#d95926", grid: "#3f3f46", axis: "#a1a1aa", surface: "#18181b", text: "#f4f4f5" };

function useColors() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setDark(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return dark ? DARK : LIGHT;
}

function tooltipStyle(c: typeof LIGHT) {
  return {
    contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12, color: c.text },
    labelStyle: { color: c.axis },
    itemStyle: { color: c.text },
  };
}

const axis = (c: typeof LIGHT) => ({ stroke: c.grid, tick: { fill: c.axis, fontSize: 11 }, tickLine: false });

/** 日別達成率の折れ線 */
export function RateLineChart({ data }: { data: { date: DateStr; rate: number }[] }) {
  const c = useColors();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data.map((d) => ({ ...d, pct: Math.round(d.rate * 100) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => formatMd(d, false)} {...axis(c)} minTickGap={24} />
        <YAxis domain={[0, 100]} ticks={[0, 60, 80, 100]} unit="%" {...axis(c)} />
        <ReferenceLine y={80} stroke={c.axis} strokeDasharray="4 4" />
        <Tooltip {...tooltipStyle(c)} labelFormatter={(d) => formatMd(String(d))} formatter={(v) => [`${v}%`, "達成率"]} />
        <Line type="monotone" dataKey="pct" stroke={c.s1} strokeWidth={2} dot={data.length <= 31 ? { r: 3, fill: c.s1 } : false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 起床・就寝時刻の推移。目盛りが大きく違うので、同じ形の小さなグラフを2つ並べる(就寝は0時以降を+24時間) */
export function SleepChart({ data }: { data: { date: DateStr; wake: number | null; sleep: number | null }[] }) {
  return (
    <div className="space-y-2">
      <TimeLine data={data} field="wake" name="起床" color="s1" />
      <TimeLine data={data} field="sleep" name="就寝" color="s2" />
    </div>
  );
}

function TimeLine({ data, field, name, color }: { data: { date: DateStr; wake: number | null; sleep: number | null }[]; field: "wake" | "sleep"; name: string; color: "s1" | "s2" }) {
  const c = useColors();
  const xs = data.map((d) => d[field]).filter((x): x is number => x != null);
  if (!xs.length) return null;
  const lo = Math.floor((Math.min(...xs) - 15) / 60) * 60;
  const hi = Math.ceil((Math.max(...xs) + 15) / 60) * 60;
  return (
    <div>
      <div className="text-xs text-zinc-500">{name}</div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => formatMd(d, false)} {...axis(c)} minTickGap={24} />
          <YAxis domain={[lo, hi]} ticks={range(lo, hi, hi - lo > 180 ? 120 : 60)} tickFormatter={(m) => minutesToTime(m)} {...axis(c)} />
          <Tooltip {...tooltipStyle(c)} labelFormatter={(d) => formatMd(String(d))} formatter={(v) => [minutesToTime(Number(v)), name]} />
          <Line name={name} type="monotone" dataKey={field} stroke={c[color]} strokeWidth={2} dot={{ r: 3, fill: c[color] }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function range(lo: number, hi: number, step: number) {
  const out = [];
  for (let x = Math.ceil(lo / step) * step; x <= hi; x += step) out.push(x);
  return out;
}

/** 横棒(習慣別・柱別の達成率)。低い順に並べて渡す */
export function RateBars({ data }: { data: { label: string; rate: number }[] }) {
  const c = useColors();
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 30 + 30)}>
      <BarChart data={data.map((d) => ({ ...d, pct: Math.round(d.rate * 100) }))} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={4}>
        <CartesianGrid stroke={c.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} unit="%" {...axis(c)} />
        <YAxis
          type="category"
          dataKey="label"
          width={128}
          {...axis(c)}
          tick={{ fill: c.text, fontSize: 11 }}
          interval={0}
          tickFormatter={(s: string) => (s.length > 10 ? s.slice(0, 10) + "…" : s)}
        />
        <Tooltip {...tooltipStyle(c)} cursor={{ fill: c.grid, opacity: 0.4 }} formatter={(v) => [`${v}%`, "達成率"]} />
        <Bar dataKey="pct" fill={c.s1} radius={[0, 4, 4, 0]} label={{ position: "right", fill: c.axis, fontSize: 11, formatter: (v: unknown) => `${v}%` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 月次売上:実績の棒と目標の線 */
export function SalesChart({ data }: { data: { month: DateStr; target: number; actual: number | null }[] }) {
  const c = useColors();
  const man = (v: number) => `${Math.round(v / 10000)}万`;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => `${Number(String(m).slice(5, 7))}月`} {...axis(c)} />
        <YAxis tickFormatter={man} {...axis(c)} />
        <Tooltip
          {...tooltipStyle(c)}
          cursor={{ fill: c.grid, opacity: 0.4 }}
          labelFormatter={(m) => `${String(m).slice(0, 4)}年${Number(String(m).slice(5, 7))}月`}
          formatter={(v, name) => [v == null ? "未入力" : `${Number(v).toLocaleString("ja-JP")}円`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: c.text }} />
        <Bar name="実績" dataKey="actual" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell key={d.month} fill={c.s1} />
          ))}
        </Bar>
        <Line name="目標" type="stepAfter" dataKey="target" stroke={c.s2} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

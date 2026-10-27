"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { compact, times } from "@/lib/format";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const w = 220;
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(width - w, 0));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left, top: Math.max(y - 8, 0), width: w, transform: "translateY(-100%)" }}
    >
      {children}
    </div>
  );
}

/** Rounded top, square bottom — the data-end is rounded, the baseline isn't. */
function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// ---------------------------------------------------------------------------------------

export type ColumnDatum = { key: string; value: number; faded?: boolean; tip: ReactNode };

export function ColumnChart({ data, reference, referenceLabel }: { data: ColumnDatum[]; reference?: number; referenceLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 220;
  const m = { top: 12, right: 8, bottom: 8, left: 40 };
  const innerW = Math.max(width - m.left - m.right, 0);
  const innerH = height - m.top - m.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), reference ?? 0));
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.min(24, Math.max(slot - 2, 1));
  const y = (v: number) => m.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Views per video">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * innerH;
            const x = m.left + i * slot + (slot - barW) / 2;
            return (
              <g key={d.key} onMouseEnter={() => setHover(i)}>
                <rect x={m.left + i * slot} y={m.top} width={slot} height={innerH} fill="transparent" />
                {h > 0 && (
                  <path
                    d={columnPath(x, y(d.value), barW, h, barW < 8 ? 1 : 4)}
                    fill="var(--series-1)"
                    opacity={d.faded ? 0.35 : hover === null || hover === i ? 1 : 0.55}
                  />
                )}
              </g>
            );
          })}
          {reference !== undefined && (
            <g className="pointer-events-none">
              <line x1={m.left} x2={width - m.right} y1={y(reference)} y2={y(reference)} stroke="var(--text-secondary)" strokeDasharray="0" strokeWidth={1} opacity={0.6} />
              <text x={width - m.right} y={y(reference) - 4} textAnchor="end" className="fill-ink-2 text-[11px]">
                {referenceLabel}
              </text>
            </g>
          )}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={m.left + hover * slot + slot / 2} y={y(data[hover].value)} width={width}>
          {data[hover].tip}
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------

export type LineDatum = { label: string; value: number };

export function LineChart({ data, name }: { data: LineDatum[]; name: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 200;
  const m = { top: 12, right: 12, bottom: 22, left: 44 };
  const innerW = Math.max(width - m.left - m.right, 0);
  const innerH = height - m.top - m.bottom;
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || hi * 0.05 || 1;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const x = (i: number) => m.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => m.top + innerH - ((v - min) / (max - min)) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${m.top + innerH} L${x(0)},${m.top + innerH} Z`;
  const ticks = [min, (min + max) / 2, max];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = Math.round(((px - m.left) / innerW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };
  const last = data.length - 1;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={name} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={i === 0 ? "var(--axis)" : "var(--grid)"} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
                {compact(t)}
              </text>
            </g>
          ))}
          <text x={m.left} y={height - 4} className="fill-muted text-[11px]">{data[0]?.label}</text>
          <text x={width - m.right} y={height - 4} textAnchor="end" className="fill-muted text-[11px]">{data[last]?.label}</text>
          <path d={area} fill="var(--series-1-wash)" />
          <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + innerH} stroke="var(--axis)" />
          )}
          {[hover ?? last].map((i) => (
            <circle key={i} cx={x(i)} cy={y(data[i].value)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          ))}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width}>
          <div className="text-muted">{data[hover].label}</div>
          <div className="tabular font-medium">{data[hover].value.toLocaleString("en")} {name.toLowerCase()}</div>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------

export type BarRow = { label: string; count: number; medianIndex: number; medianViews: number };

/** Horizontal bars of "× your usual views", with a 1× reference line. */
export function IndexBars({ rows, minCount = 3 }: { rows: BarRow[]; minCount?: number }) {
  const max = Math.max(2, ...rows.map((r) => r.medianIndex));
  if (!rows.length) return <p className="text-sm text-muted">Not enough data yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const weak = r.count < minCount;
        return (
          <div key={r.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_5.5rem] items-center gap-3 text-sm" title={`${r.count} videos · median ${compact(r.medianViews)} views`}>
            <span className="truncate text-ink-2">{r.label}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-0 w-px bg-[var(--axis)]" style={{ left: `${(1 / max) * 100}%` }} />
              {r.count > 0 && (
                <div
                  className="absolute inset-y-0.5 rounded-r bg-series"
                  style={{ width: `${(r.medianIndex / max) * 100}%`, maxWidth: "100%", opacity: weak ? 0.35 : 1 }}
                />
              )}
            </div>
            <span className="tabular text-right text-ink">
              {r.count ? times(r.medianIndex) : "–"}
              <span className="ml-1 text-xs text-muted">n={r.count}</span>
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-muted">
        Line = your usual (1×). Faded = fewer than {minCount} videos, don&apos;t trust it yet.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------

type Cell = { count: number; medianIndex: number | null };

// Diverging: below-usual → warm, usual → gray, above-usual → blue.
const BINS = [
  { max: 0.7, bg: "#d03b3b", fg: "#fff" },
  { max: 0.9, bg: "#ec9a92", fg: "#0b0b0b" },
  { max: 1.1, bg: "var(--seq-empty)", fg: "var(--text-primary)" },
  { max: 1.4, bg: "#86b6ef", fg: "#0b0b0b" },
  { max: 1.8, bg: "#3987e5", fg: "#fff" },
  { max: Infinity, bg: "#184f95", fg: "#fff" },
];

export function Heatmap({ rows, cols, cells, minCount = 2 }: { rows: string[]; cols: string[]; cells: Cell[][]; minCount?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="pb-1 font-normal text-muted">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-left font-normal text-muted">{r}</th>
              {cells[ri].map((cell, ci) => {
                const ok = cell.count >= minCount && cell.medianIndex !== null;
                const bin = ok ? BINS.find((b) => cell.medianIndex! < b.max)! : null;
                return (
                  <td
                    key={ci}
                    className="tabular h-9 rounded text-center"
                    style={{ background: bin?.bg ?? "transparent", color: bin?.fg ?? "var(--text-muted)", outline: ok ? undefined : "1px solid var(--grid)", outlineOffset: -1 }}
                    title={`${r} ${cols[ci]} · ${cell.count} video${cell.count === 1 ? "" : "s"}${cell.medianIndex !== null ? ` · ${times(cell.medianIndex)} usual views` : ""}`}
                  >
                    {ok ? `${cell.medianIndex!.toFixed(1)}×` : cell.count ? "·" : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Worse</span>
        {BINS.map((b, i) => (
          <span key={i} className="h-3 w-6 rounded-sm" style={{ background: b.bg }} />
        ))}
        <span>Better than usual</span>
        <span className="ml-auto">Empty = fewer than {minCount} videos · “·” = 1 video</span>
      </div>
    </div>
  );
}

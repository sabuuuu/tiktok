"use client";

import { useMemo, useState } from "react";
import type { EnrichedVideo } from "@/lib/analytics";
import { caption, compact, pct, shortDate, times } from "@/lib/format";

type Key = "createdAt" | "views" | "index" | "engagementRate" | "shareRate" | "commentRate" | "duration";

const COLUMNS: { key: Key; label: string; render: (v: EnrichedVideo, tz: string) => string }[] = [
  { key: "createdAt", label: "Posted", render: (v, tz) => shortDate(v.createdAt, tz) },
  { key: "duration", label: "Length", render: (v) => (v.duration ? `${v.duration}s` : "photo") },
  { key: "views", label: "Views", render: (v) => compact(v.views) },
  { key: "index", label: "vs usual", render: (v) => (v.index === null ? "too new" : times(v.index)) },
  { key: "engagementRate", label: "Engagement", render: (v) => pct(v.engagementRate) },
  { key: "shareRate", label: "Share rate", render: (v) => pct(v.shareRate, 2) },
  { key: "commentRate", label: "Comment rate", render: (v) => pct(v.commentRate, 2) },
];

export function VideoTable({ videos, timeZone }: { videos: EnrichedVideo[]; timeZone: string }) {
  const [sort, setSort] = useState<Key>("index");
  const [desc, setDesc] = useState(true);
  const [all, setAll] = useState(false);

  const rows = useMemo(() => {
    const val = (v: EnrichedVideo) => v[sort] ?? -Infinity;
    return [...videos].sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
  }, [videos, sort, desc]);
  const shown = all ? rows : rows.slice(0, 15);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 pr-3 font-normal">Video</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-right font-normal">
                  <button
                    className={`hover:text-ink ${sort === c.key ? "font-semibold text-ink" : ""}`}
                    onClick={() => (sort === c.key ? setDesc(!desc) : (setSort(c.key), setDesc(true)))}
                  >
                    {c.label} {sort === c.key ? (desc ? "↓" : "↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id} className="border-b border-line last:border-0">
                <td className="max-w-[320px] py-2 pr-3">
                  {v.shareUrl ? (
                    <a href={v.shareUrl} target="_blank" rel="noreferrer" className="line-clamp-2 hover:underline">
                      {caption(v)}
                    </a>
                  ) : (
                    <span className="line-clamp-2">{caption(v)}</span>
                  )}
                  {v.topics.length > 0 && <div className="mt-0.5 text-xs text-muted">{v.topics.join(" · ")}</div>}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`tabular px-2 py-2 text-right ${c.key === "index" && v.index !== null ? (v.index >= 1.2 ? "text-good" : v.index <= 0.8 ? "text-bad" : "") : ""} ${c.key === "index" && v.index === null ? "text-muted" : ""}`}>
                    {c.render(v, timeZone)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && (
        <button onClick={() => setAll(!all)} className="mt-3 text-sm text-series hover:underline">
          {all ? "Show top 15" : `Show all ${rows.length} videos`}
        </button>
      )}
    </div>
  );
}

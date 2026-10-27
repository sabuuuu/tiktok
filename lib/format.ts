export const compact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export const times = (n: number) => `${n.toFixed(2)}×`;

export const shortDate = (unix: number, timeZone: string) =>
  new Date(unix * 1000).toLocaleDateString("en", { month: "short", day: "numeric", timeZone });

export const caption = (v: { title: string; description: string }) =>
  (v.title || v.description || "(no caption)").replace(/\s+/g, " ").trim();

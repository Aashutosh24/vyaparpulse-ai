/** Indian-format currency helpers. Merchants read ₹1,20,450, not ₹120,450. */
export function formatRupees(value: number, opts?: {decimals?: boolean;}): string {
  const decimals = opts?.decimals ?? false;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0
  })}`;
}

/** Compact figures for charts and ranges: ₹18K, ₹1.2L. Never used for exact money owed. */
export function formatCompactRupees(value: number): string {
  if (value >= 10000000) return `₹${round(value / 10000000)}Cr`;
  if (value >= 100000) return `₹${round(value / 100000)}L`;
  if (value >= 1000) return `₹${round(value / 1000)}K`;
  return `₹${Math.round(value)}`;
}

function round(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatSigned(value: number): string {
  const sign = value > 0 ? '↑' : value < 0 ? '↓' : '–';
  return `${sign} ${Math.abs(Math.round(value))}%`;
}

export function itemSummary(items: {name: string;qty: number;}[]): string {
  return items.map((i) => `${i.qty} × ${i.name}`).join(' + ');
}

export function initialsOf(name: string): string {
  return name.
  split(' ').
  filter(Boolean).
  slice(0, 2).
  map((p) => p[0]?.toUpperCase() ?? '').
  join('');
}
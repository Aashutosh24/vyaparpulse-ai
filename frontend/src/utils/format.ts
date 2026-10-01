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

/**
 * Partial and fuzzy name matching helper.
 * Allows matching even half/partial names, e.g.:
 * - "Rahul" matches "Rahul Sharma" (and vice versa)
 * - "Rahul Sharma" matches "Rahul"
 * - "Anita" matches "Anita Stores"
 */
export function isPartialNameMatch(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const a = nameA.trim().toLowerCase();
  const b = nameB.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const tokensA = a.split(/[\s,.-]+/).filter((w) => w.length > 1);
  const tokensB = b.split(/[\s,.-]+/).filter((w) => w.length > 1);
  const stopWords = new Set(['mr', 'mrs', 'shri', 'smt', 'dr', 'ji', 'store', 'stores', 'traders', 'kirana']);

  const mA = tokensA.filter((t) => !stopWords.has(t));
  const mB = tokensB.filter((t) => !stopWords.has(t));

  const setB = new Set(mB.length > 0 ? mB : tokensB);
  const listA = mA.length > 0 ? mA : tokensA;

  return listA.some((t) => setB.has(t));
}
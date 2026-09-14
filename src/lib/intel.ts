/**
 * HP-OI pure intelligence helpers.
 * These functions are deliberately side-effect free so they can be unit
 * tested in isolation (no DB, no network, no auth).
 */

export type ConfidenceLabel = 'VERY LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH';

/** Map a 0–100 confidence score to the five-level HP-OI scale. */
export function confidenceLabel(score: number | null | undefined): ConfidenceLabel {
  if (score == null || Number.isNaN(score)) return 'VERY LOW';
  if (score >= 90) return 'VERY HIGH';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'VERY LOW';
}

/** Severity ranking used for sorting modern threat intelligence. */
export function severityRank(severity: string | null | undefined): number {
  switch (String(severity ?? '').toUpperCase()) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    case 'LOW': return 1;
    default: return 0;
  }
}

/**
 * Normalize an identifier for entity-resolution comparisons only.
 * Entity resolution MUST never auto-merge identities permanently; this
 * only produces a comparison key (case + whitespace folded).
 */
export function normalizeComparison(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_\-+().,']/g, '')
    .trim();
}

/** Extract the domain portion of an email address (lawful, syntactically only). */
export function extractDomain(email: string | null | undefined): string {
  const at = String(email ?? '').trim().lastIndexOf('@');
  if (at < 0 || at === String(email ?? '').trim().length - 1) return '';
  return String(email ?? '').trim().slice(at + 1).toLowerCase();
}

/**
 * Suggest a confidence when two identifiers look alike.
 * Returns 0 when either side is empty, 100 when the comparison keys are
 * identical, and tiered scores otherwise:
 *   80 — username-style containment of 5+ characters ("rahul" ⊂ "rahulk123")
 *   79 — full token overlap, capped below the confirmatory band
 *   55 — cross-kind hint, a name token inside a username token ("rahul_k")
 *    0 — no defensible similarity
 * This is a "Possible Match" hint — never a confirmed identity link; the
 * investigator must confirm any identity merge.
 */
export function matchSimilarityScore(left: string | null | undefined, right: string | null | undefined): number {
  const a = normalizeComparison(left);
  const b = normalizeComparison(right);
  if (!a || !b) return 0;
  if (a === b) return 100;

  // Tokenize WITHOUT splitting on underscores: a username such as
  // "rahul_demo_01" is one identifier, so two different usernames sharing
  // only a generic fragment ("sandeep_demo" vs "amit_demo") must not score.
  const tokensOf = (value: string | null | undefined): string[] =>
    String(value ?? '')
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(Boolean);

  const tokensA = tokensOf(left);
  const tokensB = tokensOf(right);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const singleA = tokensA.length === 1 ? tokensA[0] : '';
  const singleB = tokensB.length === 1 ? tokensB[0] : '';

  // Username-style containment: strong Possible Match, but only when the
  // shared part is meaningful (5+ chars) — short fragments score nothing.
  if (singleA && singleB) {
    const [shorter, longer] =
      singleA.length <= singleB.length ? [singleA, singleB] : [singleB, singleA];
    return shorter.length >= 5 && longer.includes(shorter) ? 80 : 0;
  }

  // Cross-kind hint (single identifier vs multi-token name): weak lead only.
  if (singleA || singleB) {
    const single = singleA || singleB;
    const multi = singleA ? tokensB : tokensA;
    if (!multi.some((token) => token === single)) {
      const partial = multi.some(
        (token) => token.length >= 4 && (single.includes(token) || token.includes(single)),
      );
      return partial ? 55 : 0;
    }
    // Exact token hit falls through to the general overlap rule below.
  }

  // General token overlap, capped at 79 (below the substring-strength band).
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const token of setA) if (setB.has(token)) overlap += 1;
  if (overlap === 0) return 0;
  return Math.min(79, Math.round((overlap / Math.min(setA.size, setB.size)) * 79));
}

/** Lightweight Haryana vehicle registration format check (positive prefix only). */
export function isValidHaryanaVehicleReg(value: string | null | undefined): boolean {
  const v = String(value ?? '').trim().toUpperCase();
  return /^HR-\d{2}-[A-Z]{1,2}-\d{4}$/.test(v);
}

/** Stable, locale-safe short timestamp for logs and exports. */
export function formatTimestamp(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

/** Sort edges/nodes by confidence then by date (most valuable first). */
export function sortByConfidenceThenNewest<T>(
  items: T[],
  getConfidence: (item: T) => number,
  getDate: (item: T) => string | number | Date | undefined,
): T[] {
  return [...items].sort((a, b) => {
    const dc = (getConfidence(b) ?? 0) - (getConfidence(a) ?? 0);
    if (dc !== 0) return dc;
    const da = new Date(getDate(a) ?? 0).getTime();
    const db = new Date(getDate(b) ?? 0).getTime();
    return db - da;
  });
}
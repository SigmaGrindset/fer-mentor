/** Calibrated relevance display.
 *
 * The embedding model (bge-m3) produces cosine similarities in a narrow, high
 * band — even a near-exact course match tops out ~0.66 and genuinely related
 * topics sit ~0.48–0.59, while anything below ~0.45 is effectively noise.
 * Mapping that raw band linearly onto 0–100% wastes most of the scale and
 * squashes real differences into a single bucket (e.g. "design patterns" 0.56
 * and "network programming" 0.49 both reading as one middling level for an
 * object-oriented-programming query). We rescale the *usable* band onto the
 * full 0–100% so the meter actually discriminates.
 *
 * Display-only: ranking is untouched — the API still ranks on the raw score and
 * the per-thesis evidence still shows its honest cosine.
 *
 * Two bands because two different scales feed the meter:
 *  - course relevance is a cosine + small title bonus (~0.45 floor … ~0.72 strong)
 *  - mentor score is an aggregate (mean similarity × sublinear volume factor),
 *    observed across sample queries ~0.55 (single weak match) … ~1.2 (top
 *    specialist); we anchor the top a touch below the max so genuine
 *    specialists reach "Vrlo visoko" without everything clustering there.
 */
export type ScoreBand = readonly [lo: number, hi: number]

export const COURSE_BAND: ScoreBand = [0.45, 0.72]
export const MENTOR_BAND: ScoreBand = [0.55, 1.1]

/** Map a raw score onto a calibrated 0..1 within its band (clamped). */
export function calibrateScore(raw: number, [lo, hi]: ScoreBand): number {
  if (hi <= lo) return 0
  return Math.max(0, Math.min(1, (raw - lo) / (hi - lo)))
}

/** Small Croatian-language display helpers. */

/** Capitalize a thesis type for display (e.g. "diplomski" -> "Diplomski rad"). */
export function formatThesisType(type?: string | null): string | null {
  if (!type) return null
  const t = type.toLowerCase()
  if (t.includes('diplom')) return 'Diplomski rad'
  if (t.includes('zavr')) return 'Završni rad'
  if (t.includes('doktor')) return 'Doktorski rad'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/** "3 rada" / "1 rad" / "5 radova" — Croatian plural for theses count. */
export function pluralRadovi(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} rad`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} rada`
  return `${n} radova`
}

export function formatSimilarity(sim: number): string {
  return `${Math.round(sim * 100)}%`
}

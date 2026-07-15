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

/**
 * Croatian numeral agreement: 1/21/101 take `one`, 2-4/22-24 take `few`,
 * everything else (incl. 11-14) takes `many`.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

/** "1 rad" / "3 rada" / "5 radova" */
export const pluralRadovi = (n: number) => plural(n, 'rad', 'rada', 'radova')

/** "1 rezultat" / "3 rezultata" / "5 rezultata" */
export const pluralRezultati = (n: number) => plural(n, 'rezultat', 'rezultata', 'rezultata')

/** "1 mentor" / "3 mentora" / "5 mentora" */
export const pluralMentori = (n: number) => plural(n, 'mentor', 'mentora', 'mentora')

export function formatSimilarity(sim: number): string {
  return `${Math.round(sim * 100)}%`
}

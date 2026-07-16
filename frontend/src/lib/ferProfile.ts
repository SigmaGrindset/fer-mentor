/**
 * FER staff pages live at predictable URLs: https://www.fer.unizg.hr/ime.prezime
 * — lowercase ASCII name parts joined by dots ("Ana Sović Kržić" →
 * /ana.sovic.krzic). The slug is a best-effort guess from the mentor's name
 * (staff who left FER or use a different name form 404 on the FER site), so
 * it's rendered as an outbound link, never fetched or validated here.
 */
export function ferProfileUrl(fullName: string): string {
  const slug = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // č/ć/š/ž decompose to letter + combining mark
    .replace(/đ/g, 'd') // đ is a single code point; NFD leaves it intact
    .replace(/[^a-z\s-]/g, '')
    .trim()
    .split(/\s+/)
    .join('.')
  return `https://www.fer.unizg.hr/${slug}`
}

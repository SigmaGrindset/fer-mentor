/**
 * Mock layer for the elective-course recommender (feature #2). Mirrors the
 * backend contract so the /izborni page works with no backend running.
 * All course data here is illustrative.
 */
import type {
  CourseRecommendation,
  CourseRecommendRequest,
  CourseRecommendResponse,
  ProgrammeCatalog,
  ProgrammeOut,
} from './types'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The real FER programme structure (mirrors the ingested catalogue). */
export const MOCK_PROGRAMMES: ProgrammeOut[] = [
  { id: 1, level: 'preddiplomski', area: 'Računarstvo', code: 'fer3/racunarstvo', name: 'Računarstvo' },
  { id: 2, level: 'preddiplomski', area: 'EIT', code: 'fer3/eit', name: 'Elektrotehnika i informacijska tehnologija' },
  { id: 3, level: 'diplomski', area: 'Računarstvo', code: 'dipl/rac/piis', name: 'Programsko inženjerstvo i informacijski sustavi' },
  { id: 4, level: 'diplomski', area: 'Računarstvo', code: 'dipl/rac/ri', name: 'Računalno inženjerstvo' },
  { id: 5, level: 'diplomski', area: 'Računarstvo', code: 'dipl/rac/rmi', name: 'Računalno modeliranje u inženjerstvu' },
  { id: 6, level: 'diplomski', area: 'Računarstvo', code: 'dipl/rac/rz', name: 'Računarska znanost' },
  { id: 7, level: 'diplomski', area: 'Računarstvo', code: 'dipl/rac/zom', name: 'Znanost o mrežama' },
  { id: 8, level: 'diplomski', area: 'Računarstvo', code: 'dipl/rac/zop', name: 'Znanost o podacima' },
  { id: 9, level: 'diplomski', area: 'EIT', code: 'dipl/eit/aie', name: 'Audiotehnologije i elektroakustika' },
  { id: 10, level: 'diplomski', area: 'EIT', code: 'dipl/eit/eia', name: 'Elektrostrojarstvo i automatizacija' },
  { id: 11, level: 'diplomski', area: 'EIT', code: 'dipl/eit/ele', name: 'Elektronika' },
  { id: 12, level: 'diplomski', area: 'EIT', code: 'dipl/eit/ene', name: 'Elektroenergetika' },
  { id: 13, level: 'diplomski', area: 'EIT', code: 'dipl/eit/eri', name: 'Elektroničko i računalno inženjerstvo' },
  { id: 14, level: 'diplomski', area: 'IKT', code: 'dipl/ikt/air', name: 'Automatika i robotika' },
  { id: 15, level: 'diplomski', area: 'IKT', code: 'dipl/ikt/iiki', name: 'Informacijsko i komunikacijsko inženjerstvo' },
  { id: 16, level: 'diplomski', area: 'IKT', code: 'dipl/ikt/kist', name: 'Komunikacijske i svemirske tehnologije' },
]

interface MockCourse {
  code: string
  name: string
  ects: number
  semester: number
  keywords: string
  outcomes: string
}

const MOCK_COURSES: MockCourse[] = [
  { code: 'dubuce', name: 'Duboko učenje', ects: 5, semester: 1, keywords: 'strojno učenje neuronske mreže duboko učenje ai umjetna inteligencija', outcomes: 'objasniti arhitekture dubokih neuronskih mreža; primijeniti konvolucijske i rekurentne mreže; trenirati modele nad velikim skupovima podataka.' },
  { code: 'racvid', name: 'Računalni vid', ects: 5, semester: 2, keywords: 'računalni vid obrada slike prepoznavanje objekata kamere', outcomes: 'analizirati slike i videozapise; implementirati detekciju i segmentaciju objekata; primijeniti konvolucijske mreže u vidu.' },
  { code: 'oprj', name: 'Obrada prirodnog jezika', ects: 5, semester: 2, keywords: 'obrada jezika nlp tekst jezični modeli transformeri', outcomes: 'obraditi i analizirati tekst; izgraditi modele za klasifikaciju i generiranje teksta; primijeniti velike jezične modele.' },
  { code: 'napsus', name: 'Napredne web aplikacije', ects: 5, semester: 1, keywords: 'web aplikacije react frontend backend rest api', outcomes: 'projektirati moderne web aplikacije; implementirati REST i GraphQL sučelja; primijeniti komponentne okvire.' },
  { code: 'dissus', name: 'Raspodijeljeni sustavi', ects: 5, semester: 3, keywords: 'distribuirani raspodijeljeni sustavi oblak skalabilnost', outcomes: 'objasniti modele konzistentnosti; projektirati skalabilne raspodijeljene sustave; primijeniti tehnike replikacije.' },
  { code: 'kibsig', name: 'Kibernetička sigurnost', ects: 5, semester: 2, keywords: 'sigurnost kriptografija mreže napadi zaštita', outcomes: 'analizirati ranjivosti sustava; primijeniti kriptografske mehanizme; projektirati sigurne mrežne arhitekture.' },
  { code: 'racgraf', name: 'Napredna računalna grafika', ects: 5, semester: 3, keywords: 'grafika 3d rendering vizualizacija igre', outcomes: 'implementirati tehnike sjenčanja; razviti 3D prikaze u stvarnom vremenu; primijeniti algoritme rasvjete.' },
  { code: 'ugrsus', name: 'Ugradbeni računalni sustavi', ects: 5, semester: 1, keywords: 'ugradbeni sustavi mikrokontroleri iot senzori hardver', outcomes: 'projektirati ugradbene sustave; programirati mikrokontrolere; integrirati senzore i aktuatore.' },
  { code: 'anpod', name: 'Analiza velikih skupova podataka', ects: 5, semester: 2, keywords: 'podaci analiza big data baze strojno učenje statistika', outcomes: 'obraditi velike skupove podataka; primijeniti metode strojnog učenja; vizualizirati rezultate analize.' },
  { code: 'roboti', name: 'Autonomni roboti', ects: 5, semester: 3, keywords: 'robotika autonomni navigacija upravljanje senzori', outcomes: 'projektirati upravljanje robotom; implementirati algoritme navigacije; integrirati percepciju i planiranje.' },
]

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function score(queryTokens: string[], c: MockCourse): number {
  if (queryTokens.length === 0) return 0.55
  const hay = new Set(tokenize(`${c.name} ${c.keywords} ${c.outcomes}`))
  let hits = 0
  for (const q of queryTokens) if (hay.has(q)) hits += 1
  return Math.min(0.96, 0.4 + (hits / queryTokens.length) * 0.55)
}

export async function mockGetProgrammes(): Promise<ProgrammeCatalog> {
  await delay(120)
  return { programmes: MOCK_PROGRAMMES }
}

export async function mockRecommendCourses(
  req: CourseRecommendRequest,
): Promise<CourseRecommendResponse> {
  await delay(420)
  const prog =
    MOCK_PROGRAMMES.find((p) => p.code === req.programme_code) ??
    MOCK_PROGRAMMES.find((p) => p.id === req.programme_id) ??
    null

  const level = prog?.level ?? 'diplomski'
  // Preddiplomski electives live in sem 5-6; diplomski in sem 1-3.
  const semBase = level === 'preddiplomski' ? 4 : 0
  const tokens = tokenize(req.query)
  const peers = MOCK_PROGRAMMES.filter((p) => p.level === level).map((p) => p.name)

  const results: CourseRecommendation[] = MOCK_COURSES.map((c) => {
    const semester = semBase + c.semester
    return {
      course_id: MOCK_COURSES.indexOf(c) + 1,
      code: c.code,
      name: c.name,
      ects: c.ects,
      semester,
      score: Number(score(tokens, c).toFixed(3)),
      profiles: level === 'preddiplomski' ? [prog?.name ?? 'Računarstvo'] : peers.slice(0, 6),
      outcomes_snippet: c.outcomes.charAt(0).toUpperCase() + c.outcomes.slice(1),
      explanation: `Predloženo jer se ishodi i sadržaj predmeta poklapaju s tvojim opisom interesa (${c.ects} ECTS, ${semester}. semestar).`,
      url: `https://www.fer.unizg.hr/predmet/${c.code}`,
    }
  })
    .filter((r) => (req.semester == null ? true : r.semester === req.semester))
    .sort((a, b) => b.score - a.score)
    .slice(0, req.top_k ?? 12)

  return { query: req.query, programme: prog, results }
}

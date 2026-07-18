/**
 * TypeScript mirror of the Pydantic API contract in `core/schemas.py`.
 * Keep these field names in sync with the backend.
 */

/** A single thesis shown as evidence for why a mentor was recommended. */
export interface EvidenceThesis {
  id: number
  title: string
  year?: number | null
  thesis_type?: string | null
  /** cosine similarity to the query, 0..1 */
  similarity: number
  /** public repository landing page (repo source only); null when unavailable */
  url?: string | null
}

export interface MentorRecommendation {
  mentor_id: number
  full_name: string
  zavod_code?: string | null
  /** aggregated, recency-weighted relevance */
  score: number
  n_theses: number
  evidence: EvidenceThesis[]
  /** this year's titles (source: schedule) */
  current_topics: string[]
  /** query↔thesis keyword overlap, for chips/highlighting */
  matched_keywords?: string[]
  /** templated explanation, no LLM */
  explanation: string
}

/** Thesis-type hard filter for the mentor search; omit/null = all types. */
export type ThesisTypeFilter = 'zavrsni' | 'diplomski'

export interface RecommendRequest {
  query: string
  top_k?: number
  zavod?: string | null
  field?: string | null
  /** only theses of this type are searched and shown as evidence */
  thesis_type?: ThesisTypeFilter | null
}

export interface RecommendResponse {
  query: string
  results: MentorRecommendation[]
}

export interface ThesisOut {
  id: number
  title: string
  year?: number | null
  thesis_type?: string | null
  scientific_field?: string | null
  keywords: string[]
  /** 'repo' | 'schedule' */
  source: string
  /** public repository landing page (repo source only); null when unavailable */
  url?: string | null
}

export interface MentorDetail {
  id: number
  full_name: string
  zavod_code?: string | null
  scientific_fields: string[]
  n_theses: number
  theses: ThesisOut[]
}

export interface MentorSummary {
  id: number
  full_name: string
  zavod_code?: string | null
  n_theses: number
}

/** A mentor whose thesis corpus is similar (centroid cosine, 0..1). */
export interface SimilarMentor extends MentorSummary {
  similarity: number
}

export interface MentorListResponse {
  total: number
  mentors: MentorSummary[]
}

/**
 * Mentor list ordering. Omitted/null means the server default: best match
 * while searching by name, otherwise most theses first.
 */
export type MentorSort = 'name' | 'theses'

/** A department with its mentor count, for the filter dropdown. */
export interface ZavodOut {
  code: string
  count: number
}

export interface HealthResponse {
  status: string
}

/** Last successful ingest run for one data source. */
export interface IngestSourceMeta {
  /** 'schedule' | 'repo' | 'courses' | 'thesis_embeddings' | 'course_embeddings' */
  source: string
  /** ISO 8601 with offset; null while a run is in progress */
  finished_at?: string | null
  records_parsed: number
  records_upserted: number
  records_rejected: number
  n_warnings: number
}

export interface MetaResponse {
  sources: IngestSourceMeta[]
}

/* ------------------------------------------------------------------ *
 * Feature #2 — elective course recommender
 * ------------------------------------------------------------------ */

/** A study programme/profile, used to populate the context selector. */
export interface ProgrammeOut {
  id: number
  /** 'preddiplomski' | 'diplomski' */
  level: string
  /** grouping for the UI, e.g. 'Računarstvo' | 'EIT' | 'IKT' */
  area?: string | null
  code: string
  /** display name (Croatian) */
  name: string
}

export interface ProgrammeCatalog {
  programmes: ProgrammeOut[]
}

export interface CourseRecommendation {
  course_id: number
  code: string
  /** display title (Croatian, English fallback) */
  name: string
  ects?: number | null
  /** semester within the requested programme */
  semester?: number | null
  /** cosine similarity to the query, 0..1 */
  score: number
  /** programme names (within the selected level) that offer this as an elective */
  profiles: string[]
  outcomes_snippet?: string | null
  /** query↔outcomes term overlap, for chips/highlighting */
  matched_keywords?: string[]
  /** templated explanation, no LLM */
  explanation: string
  /** link to the FER course page */
  url?: string | null
}

export interface CourseRecommendRequest {
  query: string
  /** exactly one of programme_code / programme_id is required */
  programme_code?: string | null
  programme_id?: number | null
  /** optional filter; null = all eligible semesters */
  semester?: number | null
  top_k?: number
}

export interface CourseRecommendResponse {
  query: string
  programme?: ProgrammeOut | null
  results: CourseRecommendation[]
}

export interface CourseDetail {
  id: number
  code: string
  name_hr?: string | null
  name_en?: string | null
  ects?: number | null
  nositelj?: string | null
  outcomes?: string | null
  syllabus?: string | null
  url?: string | null
  programmes: ProgrammeOut[]
}

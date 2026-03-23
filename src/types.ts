// ── Client Configuration ─────────────────────────────────────────────

export interface TownshipClientOptions {
  /** Your Township Canada API key */
  apiKey: string
  /** Base URL for the API (defaults to https://developer.townshipcanada.com) */
  baseUrl?: string
  /** Request timeout in milliseconds (defaults to 30000) */
  timeout?: number
  /** Custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch
}

// ── GeoJSON Types ────────────────────────────────────────────────────

export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [longitude: number, latitude: number]
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONPolygon | GeoJSONMultiPolygon

export interface GeoJSONFeature<
  G extends GeoJSONGeometry = GeoJSONGeometry,
  P = Record<string, unknown>,
> {
  type: 'Feature'
  geometry: G
  properties: P
}

export interface GeoJSONFeatureCollection<F = GeoJSONFeature> {
  type: 'FeatureCollection'
  features: F[]
}

// ── Survey Systems ───────────────────────────────────────────────────

export type SurveySystem = 'DLS' | 'NTS' | 'GTS'

export type DLSUnit = 'Quarter Section' | 'LSD' | 'Section' | 'Township'
export type NTSUnit = 'Quarter Unit' | 'Block' | 'Map Sheet' | 'Map Area'
export type GTSUnit = 'Lot' | 'Concession'
export type Unit = DLSUnit | NTSUnit | GTSUnit

// ── Feature Properties ───────────────────────────────────────────────

export interface GridFeatureProperties {
  shape: 'grid'
  legal_location: string
  search_term: string
  province: string
  survey_system: SurveySystem
  unit: Unit
}

export interface CentroidFeatureProperties {
  shape: 'centroid'
  legal_location: string
  search_term: string
  province: string
  survey_system: SurveySystem
  unit: Unit
}

export interface AutocompleteFeatureProperties {
  legal_location: string
  search_term: string
  survey_system: SurveySystem
  unit: Unit
}

export type GridFeature = GeoJSONFeature<
  GeoJSONPolygon | GeoJSONMultiPolygon,
  GridFeatureProperties
>

export type CentroidFeature = GeoJSONFeature<
  GeoJSONPoint,
  CentroidFeatureProperties
>

export type AutocompleteFeature = GeoJSONFeature<
  GeoJSONPoint,
  AutocompleteFeatureProperties
>

export type LocationFeature = GridFeature | CentroidFeature

// ── API Response Types ───────────────────────────────────────────────

export type SearchResponse = GeoJSONFeatureCollection<LocationFeature>

export type BatchResponse = GeoJSONFeatureCollection<LocationFeature>

export type AutocompleteResponse = GeoJSONFeatureCollection<AutocompleteFeature>

// ── Parsed Result Types (convenience wrappers) ───────────────────────

export interface SearchResult {
  /** The legal land description */
  legalLocation: string
  /** Latitude of the centroid */
  latitude: number
  /** Longitude of the centroid */
  longitude: number
  /** Province name */
  province: string
  /** Survey system used */
  surveySystem: SurveySystem
  /** Resolution unit */
  unit: Unit
  /** The grid boundary as GeoJSON geometry */
  boundary: GeoJSONPolygon | GeoJSONMultiPolygon | null
  /** Raw GeoJSON features from the API */
  raw: LocationFeature[]
}

export interface BatchResult {
  /** Successfully converted items */
  results: SearchResult[]
  /** Total number of items processed */
  total: number
  /** Number of successful conversions */
  success: number
  /** Number of failed conversions */
  failed: number
}

export interface AutocompleteSuggestion {
  /** The full legal land description */
  legalLocation: string
  /** Latitude of the centroid */
  latitude: number
  /** Longitude of the centroid */
  longitude: number
  /** Survey system used */
  surveySystem: SurveySystem
  /** Resolution unit */
  unit: Unit
}

// ── Method Options ───────────────────────────────────────────────────

export interface ReverseOptions {
  /** Survey system to search within */
  surveySystem?: SurveySystem
  /** Resolution unit */
  unit?: Unit
}

export interface BatchOptions {
  /** Maximum records per API request (max 100, defaults to 100) */
  chunkSize?: number
}

export interface BatchReverseOptions extends BatchOptions {
  /** Survey system to search within */
  surveySystem?: SurveySystem
  /** Resolution unit */
  unit?: Unit
}

export interface AutocompleteOptions {
  /** Number of results to return (1-10, default 3) */
  limit?: number
  /** Bias results toward a point: [longitude, latitude] */
  proximity?: [longitude: number, latitude: number]
}

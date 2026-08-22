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

// ── Report Types (Ag & Energy APIs) ──────────────────────────────────

/** Options for report endpoints (`agReport`, `energyReport`). */
export interface ReportOptions {
  /** Include the parcel boundary as GeoJSON in the response (default false) */
  geometry?: boolean
}

/** Per-item status in a batch report response. */
export type ReportBatchStatus = 'ok' | 'not_found' | 'error'

/**
 * Envelope for one item of a batch report response.
 * Items are returned in input order.
 */
export interface ReportBatchItem<R> {
  /** The legal location as submitted */
  legal_location: string
  /** "ok" (report in data), "not_found" (no coverage), or "error" (invalid/failed) */
  status: ReportBatchStatus
  /** The full report when status is "ok", otherwise null */
  data: R | null
  /** Explanation when status is "error" */
  error?: string
}

// ── Ag API Types ─────────────────────────────────────────────────────

export interface AgProductivity {
  lsrs_score: number | null
  lsrs_class: string | null
  lsrs_limiter: string | null
  cli_class: string | null
  cli_score: number | null
  cli_limiter: string | null
  [key: string]: unknown
}

export interface AgCropping {
  dominant_crop: string | null
  dominant_crop_name: string | null
  dominant_category: string | null
  rotation_pattern: string | null
  diversity_index: number | null
  years_covered: number | null
  [key: string]: unknown
}

export interface AgSoil {
  order: string | null
  group: string | null
  subgroup: string | null
  drainage_class: string | null
  slope_class: string | null
  parent_material: string | null
  is_solonetzic: boolean | null
  source: string | null
  [key: string]: unknown
}

export interface AgLandUseBreakdown {
  class: string
  label: string
  pct: number
  [key: string]: unknown
}

export interface AgLandUse {
  class: string | null
  class_label: string | null
  ipcc_class: string | null
  breakdown: AgLandUseBreakdown[]
  [key: string]: unknown
}

export interface AgDrought {
  drought_class: string | null
  severity_label: string | null
  valid_date: string | null
  [key: string]: unknown
}

export interface AgWetlands {
  source: string | null
  count: number | null
  area_ha: number | null
  area_pct: number | null
  dominant_type: string | null
  on_parcel_water: boolean | null
  nearby_watercourse: boolean | null
  watercourse_name: string | null
  watercourse_dist_m: number | null
  [key: string]: unknown
}

export interface AgParcelContext {
  municipality: string | null
  municipality_type: string | null
  nearest_railway: Record<string, unknown> | null
  nearest_road: Record<string, unknown> | null
  nearest_park: Record<string, unknown> | null
  [key: string]: unknown
}

/**
 * Agriculture parcel report, keyed at quarter-section grain.
 * Sections degrade independently: an unavailable data layer is null
 * rather than failing the report.
 */
export interface AgReport {
  /** The legal location as submitted */
  legal_location: string
  /** The containing quarter section, present when the input was an LSD */
  qs_legal_location?: string
  province: string
  area_ha: number | null
  productivity: AgProductivity | null
  cropping: AgCropping | null
  soil: AgSoil | null
  land_use: AgLandUse | null
  drought: AgDrought | null
  wetlands: AgWetlands | null
  parcel_context: AgParcelContext | null
  /** Saskatchewan extras (crown land, soils, pastures), only for SK parcels */
  sk?: Record<string, unknown>
  /** Manitoba extras (soil survey components), only for MB parcels */
  mb?: Record<string, unknown>
  /** Quarter-section boundary, only when requested with geometry: true */
  geometry?: GeoJSONPolygon | GeoJSONMultiPolygon
  [key: string]: unknown
}

export type AgBatchItem = ReportBatchItem<AgReport>

// ── Energy API Types ─────────────────────────────────────────────────

export interface EnergyActivity {
  total_wells: number
  active_wells: number
  suspended_wells: number
  abandoned_wells: number
  orphan_wells: number
  recl_certified_wells: number
  petrinex: Record<string, unknown> | null
  pipeline_segments: number
  pipeline_length_km: number | null
  facility_count: number
  facility_categories: string[]
  dominant_operator: string | null
  [key: string]: unknown
}

export interface EnergyProduction {
  oil_m3_12mo: number | null
  gas_e3m3_12mo: number | null
  water_m3_12mo: number | null
  condensate_m3_12mo: number | null
  has_oil: boolean
  has_gas: boolean
  has_water: boolean
  dominant_product: string | null
  producing_wells: number | null
  last_producing_month: string | null
  [key: string]: unknown
}

export interface EnergyTenure {
  tenure_kind: string
  province: string
  disposition_number: string | null
  disposition_type: string | null
  holder_name: string | null
  status: string | null
  expiry_date: string | null
  days_to_expiry: number | null
  is_expiring_soon: boolean | null
  is_perpetual: boolean | null
  area_ha: number | null
  [key: string]: unknown
}

export interface EnergyWell {
  uwi: string | null
  well_name: string | null
  licence_number: string | null
  licence_status: string | null
  operator_name: string | null
  fluid: string | null
  mode: string | null
  type: string | null
  total_depth_m: number | null
  is_orphan: boolean | null
  is_abandoned: boolean | null
  is_suspended: boolean | null
  [key: string]: unknown
}

export interface EnergyPipeline {
  licence_line_number: string | null
  licence_number: string | null
  operator_name: string | null
  segment_status: string | null
  substance: string | null
  length_m_on_parcel: number | null
  total_length_km: number | null
  [key: string]: unknown
}

export interface EnergyFacility {
  [key: string]: unknown
}

/**
 * Per-parcel energy report, keyed at LSD grain.
 * A null section or empty array means no data at that location
 * (or one source degraded); the rest of the report is still trustworthy.
 */
export interface EnergyReport {
  legal_location: string
  province: string
  activity: EnergyActivity
  production: EnergyProduction | null
  tenure: EnergyTenure[]
  wells: EnergyWell[]
  pipelines: EnergyPipeline[]
  facilities: EnergyFacility[]
  alternative_energy: Record<string, unknown> | null
  /** LSD boundary, only when requested with geometry: true */
  geometry?: GeoJSONPolygon | GeoJSONMultiPolygon
  [key: string]: unknown
}

export type EnergyBatchItem = ReportBatchItem<EnergyReport>

/** An AER licensee returned by operator autocomplete. */
export interface EnergyOperator {
  ba_code: string | null
  name: string
  active_wells: number | null
  abandoned_wells: number | null
  orphan_wells: number | null
}

export interface EnergyOperatorsResponse {
  operators: EnergyOperator[]
}

export interface OperatorAutocompleteOptions {
  /** Number of results to return (1-20, default 10) */
  limit?: number
}

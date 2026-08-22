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

/** A point as `{lat, lng}` (report/collection payloads use this, not GeoJSON). */
export interface LatLng {
  lat: number
  lng: number
}

/** A company reference: `{name, ba_code, slug}`. `slug` routes to `/operators/{name}`. */
export interface OperatorRef {
  name: string | null
  ba_code: string | null
  slug: string | null
  [key: string]: unknown
}

/**
 * Envelope every embedded array section of a report uses.
 * `total` is the true count, `truncated` is `returned < total`, and `more`
 * is the unbounded collection URL (or null where none exists).
 */
export interface SectionEnvelope<Row> {
  total: number
  returned: number
  truncated: boolean
  more: string | null
  rows: Row[]
  [key: string]: unknown
}

/** A section that could not be served, listed under `meta.unavailable`. */
export interface UnavailableSection {
  section: string
  reason: 'source_error' | 'not_published_in_province' | 'timeout' | (string & {})
  [key: string]: unknown
}

/** Upstream source of one report section. `as_of` is null until vintage metadata ships. */
export interface SectionSource {
  name: string | null
  as_of: string | null
  [key: string]: unknown
}

/** The `meta` block every report and section response carries. */
export interface ReportMeta {
  unavailable: UnavailableSection[]
  sources: Record<string, SectionSource>
  [key: string]: unknown
}

/** Expiry model shared by every tenure row. `days_to_expiry` is signed. */
export type ExpiryState =
  | 'expired'
  | 'expires_today'
  | 'expiring_soon'
  | 'active'
  | 'perpetual'

/** Per-item status in a batch report response. */
export type ReportBatchStatus = 'ok' | 'not_found' | 'error'

/** Per-item error in a batch report response. */
export interface ReportBatchError {
  code: 'invalid_legal_location' | 'batch_deadline_exceeded' | 'report_failed' | (string & {})
  message: string
}

/**
 * Envelope for one item of a batch report response.
 * Items are returned in input order and always carry all four keys.
 */
export interface ReportBatchItem<R> {
  /** The legal location as submitted */
  legal_location: string
  /** "ok" (report in data), "not_found" (no coverage), or "error" (invalid/failed) */
  status: ReportBatchStatus
  /** `{code, message}` when status is "error", otherwise null */
  error: ReportBatchError | null
  /** The full report when status is "ok", otherwise null */
  data: R | null
}

/** Counters over a batch response, summed across chunks by the SDK. */
export interface ReportBatchMeta {
  total: number
  ok: number
  not_found: number
  error: number
}

/** The `{results, meta}` envelope both batch endpoints return. */
export interface ReportBatchResponse<R> {
  results: ReportBatchItem<R>[]
  meta: ReportBatchMeta
}

// ── Ag API Types ─────────────────────────────────────────────────────

/** Sections of the agriculture report addressable through `include=`. */
export type AgReportSection =
  | 'productivity'
  | 'cropping'
  | 'soil'
  | 'land_use'
  | 'drought'
  | 'wetlands'
  | 'hydrology'
  | 'parcel_context'
  | 'provincial_detail'
  | 'geometry'

/** Options for `agReport`. */
export interface AgReportOptions {
  /**
   * Return only these sections (the omitted sections are never queried).
   * `geometry` is a section name: include it to attach the parcel boundary
   * under `parcel.geometry`. Omitted returns the full report (no geometry).
   */
  include?: AgReportSection[]
}

export interface AgParcel {
  area_ha: number | null
  /** Present on full reports (not on section-route responses) */
  centroid?: LatLng | null
  /** GeoJSON when requested with `include: ["geometry", ...]`, otherwise null */
  geometry?: GeoJSONPolygon | GeoJSONMultiPolygon | null
  [key: string]: unknown
}

export interface AgProductivityRating {
  score: number | null
  class: string | null
  limiter: string | null
  [key: string]: unknown
}

export interface AgProductivity {
  lsrs: AgProductivityRating | null
  cli: AgProductivityRating | null
  [key: string]: unknown
}

export interface AgDominantCrop {
  code: string | null
  name: string | null
  category: string | null
  [key: string]: unknown
}

export interface AgCropping {
  dominant: AgDominantCrop | null
  rotation: string | null
  diversity_index: number | null
  years_covered: number | null
  [key: string]: unknown
}

export interface AgSoilClassification {
  order: string | null
  great_group: string | null
  subgroup_code: string | null
  [key: string]: unknown
}

export interface AgSoil {
  classification: AgSoilClassification | null
  drainage_class: string | null
  slope_class: string | null
  parent_material: string | null
  is_solonetzic: boolean | null
  source: string | null
  [key: string]: unknown
}

export interface AgLandUseClass {
  /** Land-use code as a string (e.g. "51") */
  code: string | null
  label: string | null
  ipcc_class: string | null
  [key: string]: unknown
}

export interface AgLandUseBreakdown extends AgLandUseClass {
  pct: number | null
}

export interface AgLandUse {
  dominant: AgLandUseClass | null
  breakdown: AgLandUseBreakdown[]
  [key: string]: unknown
}

export interface AgDrought {
  /** Drought monitor class, e.g. "D1" */
  class: string | null
  severity_label: string | null
  /** Month fact, "YYYY-MM" */
  as_of: string | null
  [key: string]: unknown
}

export interface AgWetlands {
  source: string | null
  count: number | null
  area_ha: number | null
  area_pct: number | null
  water_pct: number | null
  dominant_type: string | null
  on_parcel_water: boolean | null
  classes: Record<string, number> | null
  hydro_period: string | null
  [key: string]: unknown
}

export interface AgHydrologyFeature {
  name: string | null
  distance_m: number | null
  is_on_parcel: boolean
  [key: string]: unknown
}

export interface AgHydrologyWaterBody extends AgHydrologyFeature {
  /** Share of the parcel an intersecting water body covers */
  on_parcel_pct: number | null
}

export interface AgHydrology {
  watercourse: AgHydrologyFeature | null
  water_body: AgHydrologyWaterBody | null
  search_radius_m: number
  [key: string]: unknown
}

export interface AgMunicipality {
  name: string | null
  type: string | null
  [key: string]: unknown
}

export interface AgNearestFeature {
  name: string | null
  distance_m: number | null
  [key: string]: unknown
}

export interface AgParcelContext {
  municipality: AgMunicipality | null
  nearest_railway: AgNearestFeature | null
  nearest_road: AgNearestFeature | null
  nearest_park: AgNearestFeature | null
  [key: string]: unknown
}

export interface AgCrownLandRow {
  legal_location: string | null
  lessee: string | null
  land_status: string | null
  land_use: string | null
  area_acres: number | null
  area_ha: number | null
  [key: string]: unknown
}

export interface AgPastureRow {
  pasture_name: string | null
  area_acres: number | null
  area_ha: number | null
  source: string | null
  divest_year: number | null
  [key: string]: unknown
}

/**
 * Province-specific extras. Saskatchewan supplies `crown_land`, `soils`, and
 * `pastures`; Manitoba supplies `soils` only. Alberta parcels get null.
 */
export interface AgProvincialDetail {
  crown_land?: AgCrownLandRow[]
  soils?: Record<string, unknown>[]
  pastures?: AgPastureRow[]
  [key: string]: unknown
}

/**
 * Agriculture parcel report, keyed at quarter-section grain.
 * Sections degrade independently: an unavailable data layer is null
 * rather than failing the report (see `meta.unavailable`). Sections are
 * optional because `include=` projections omit the sections not requested.
 */
export interface AgReport {
  /** The legal location as submitted (canonicalized) */
  legal_location: string
  /** The quarter section the report describes — always present */
  resolved_legal_location: string
  /** The grain of your input */
  grain: 'quarter_section' | 'lsd'
  /** Uppercase province code: "AB" | "SK" | "MB" */
  province: string
  parcel: AgParcel
  productivity?: AgProductivity | null
  cropping?: AgCropping | null
  soil?: AgSoil | null
  land_use?: AgLandUse | null
  drought?: AgDrought | null
  wetlands?: AgWetlands | null
  hydrology?: AgHydrology | null
  parcel_context?: AgParcelContext | null
  provincial_detail?: AgProvincialDetail | null
  units?: { area: string; distance: string; [key: string]: unknown }
  meta?: ReportMeta
  [key: string]: unknown
}

export type AgBatchItem = ReportBatchItem<AgReport>

// ── Energy API Types ─────────────────────────────────────────────────

/** Sections of the energy report addressable through `include=`. */
export type EnergyReportSection =
  | 'summary'
  | 'production'
  | 'tenure'
  | 'wells'
  | 'pipelines'
  | 'facilities'
  | 'alternative_energy'
  | 'geometry'

/** Options for `energyReport`. */
export interface EnergyReportOptions {
  /**
   * Return only these sections (the omitted sections are never queried).
   * `geometry` is a section name: include it to attach the LSD boundary
   * under `parcel.geometry`. Omitted returns the full report (no geometry).
   */
  include?: EnergyReportSection[]
}

export interface EnergyParcel {
  area_ha: number | null
  centroid: LatLng | null
  /** GeoJSON when requested with `include: ["geometry", ...]`, otherwise null */
  geometry: GeoJSONPolygon | GeoJSONMultiPolygon | null
  [key: string]: unknown
}

export interface EnergyWellCounts {
  total: number
  active: number
  suspended: number
  abandoned: number
  orphan?: number
  reclamation_certified?: number
  [key: string]: unknown
}

export interface EnergySummaryWells extends EnergyWellCounts {
  orphan: number
  reclamation_certified: number
  primary_source: 'regulator' | 'petrinex' | (string & {})
  by_source: {
    regulator?: EnergyWellCounts
    petrinex?: EnergyWellCounts & { oil?: number; gas?: number; water?: number }
    [key: string]: unknown
  }
}

export interface EnergyDominantOperator extends OperatorRef {
  well_count: number
  well_share_pct: number
  share_basis: 'regulator_total_wells' | 'petrinex_total_wells' | (string & {})
}

export interface EnergySummary {
  wells: EnergySummaryWells
  pipelines: { segment_count: number; length_m_on_parcel: number | null; [key: string]: unknown }
  facilities: { count: number; categories: string[]; [key: string]: unknown }
  operators: { dominant: EnergyDominantOperator | null; [key: string]: unknown }
  /** Date-only fact, "YYYY-MM-DD" */
  last_activity_date: string | null
  [key: string]: unknown
}

export interface EnergyProductionVolumes {
  oil_m3: number | null
  gas_e3m3: number | null
  condensate_m3: number | null
  water_m3: number | null
  [key: string]: unknown
}

export interface EnergyProduction {
  window_months: number
  /** Month fact, "YYYY-MM" */
  last_producing_month: string | null
  volumes: EnergyProductionVolumes
  has_oil: boolean
  has_gas: boolean
  has_condensate: boolean
  has_water: boolean
  dominant_product: 'oil' | 'gas' | 'condensate' | null
  producing_well_count: number | null
  [key: string]: unknown
}

/** Uniform tenure row shape, shared by reports, collections, and cross-parcel views. */
export interface EnergyTenureRow {
  /** Disposition slug: plain number for PNG, "category:number" for mineral */
  id: string
  /** `/energy/dispositions/{id}` */
  href: string
  tenure_kind: 'png' | 'mineral' | (string & {})
  province: string
  disposition_number: string | null
  mineral_category: string | null
  disposition_type: string | null
  disposition_type_raw: string | null
  target_substance: string | null
  coal_category: string | null
  holder: OperatorRef
  status: string | null
  /** Present on cross-parcel rows (disposition detail, operator views, /tenure/expiring) */
  issue_date?: string | null
  expiry_date: string | null
  /** Signed: negative means expired, null means perpetual/no expiry */
  days_to_expiry: number | null
  expiry_state: ExpiryState
  area_ha: number | null
  lsd_coverage_pct: number | null
  is_transfer_pending: boolean | null
  /** Point inside the parcel overlap (parcel-scoped rows) */
  overlap_point?: LatLng | null
  /** Point of the whole feature (cross-parcel rows) */
  centroid?: LatLng | null
  [key: string]: unknown
}

export interface EnergyWellRow {
  /** UWI (MB: licence number) */
  id: string
  uwi: string | null
  well_name: string | null
  licence_number: string | null
  /** Normalized status the `?status=` filter accepts */
  status: string | null
  licence_status_raw: string | null
  operator: OperatorRef
  fluid: string | null
  mode: string | null
  type: string | null
  total_depth_m: number | null
  is_orphan: boolean | null
  is_abandoned: boolean | null
  is_suspended: boolean | null
  location: LatLng | null
  [key: string]: unknown
}

export interface EnergyPipelineRow {
  /** Segment id */
  id: string
  /** `/energy/pipelines/{licence_number}` */
  href?: string
  licence_number: string | null
  segment_id: string | null
  operator: OperatorRef
  status: string | null
  segment_status_raw: string | null
  substance: string | null
  outside_diameter_mm: number | null
  max_operating_pressure_kpa: number | null
  h2s_pct: number | null
  h2s_release_level: string | null
  class_location: string | null
  pipeline_environment: string | null
  /** Metres of this segment inside the parcel (parcel-scoped rows) */
  length_m_on_parcel?: number | null
  /** The segment's own full length in km */
  segment_length_km: number | null
  overlap_point?: LatLng | null
  centroid?: LatLng | null
  [key: string]: unknown
}

export interface EnergyFacilityRow {
  /** Facility id */
  id: string
  facility_name: string | null
  category: string | null
  sub_type: string | null
  sub_code: string | null
  status: string | null
  facility_status_raw: string | null
  licence_number: string | null
  operator: OperatorRef
  licensee: OperatorRef
  location: LatLng | null
  [key: string]: unknown
}

/** CCS + geothermal tenure and CCS injection wells, each in the standard envelope. */
export interface EnergyAlternativeEnergy {
  ccs_tenure: SectionEnvelope<Record<string, unknown>>
  geothermal_tenure: SectionEnvelope<Record<string, unknown>>
  ccs_injection_wells: SectionEnvelope<Record<string, unknown>>
  [key: string]: unknown
}

export interface EnergyUnits {
  length: string
  area: string
  depth: string
  pressure: string
  oil: string
  gas: string
  [key: string]: unknown
}

/**
 * Per-parcel energy report, keyed at LSD grain.
 * A null section means no data at that location (or one source degraded —
 * see `meta.unavailable`); the rest of the report is still trustworthy.
 * Sections are optional because `include=` projections omit the rest.
 */
export interface EnergyReport {
  legal_location: string
  /** Uppercase province code: "AB" | "SK" | "MB" */
  province: string
  /** Ships on full reports and whenever `geometry` is requested */
  parcel?: EnergyParcel
  summary?: EnergySummary
  production?: EnergyProduction | null
  tenure?: SectionEnvelope<EnergyTenureRow>
  wells?: SectionEnvelope<EnergyWellRow>
  pipelines?: SectionEnvelope<EnergyPipelineRow>
  facilities?: SectionEnvelope<EnergyFacilityRow>
  alternative_energy?: EnergyAlternativeEnergy | null
  units?: EnergyUnits
  meta?: ReportMeta
  [key: string]: unknown
}

export type EnergyBatchItem = ReportBatchItem<EnergyReport>

/** An AER licensee returned by operator autocomplete. */
export interface EnergyOperator {
  name: string
  ba_code: string | null
  /** Routes straight to `/operators/{name}` */
  slug: string | null
  active_wells: number | null
  abandoned_wells: number | null
  orphan_wells: number | null
  [key: string]: unknown
}

export interface EnergyOperatorsResponse {
  rows: EnergyOperator[]
  meta: { q: string; limit: number; [key: string]: unknown }
}

export interface OperatorAutocompleteOptions {
  /** Number of results to return (1-20, default 10) */
  limit?: number
}

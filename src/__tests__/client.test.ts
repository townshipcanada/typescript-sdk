// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TownshipClient } from '../client.js'
import {
  TownshipError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  PayloadTooLargeError,
} from '../errors.js'
import type {
  SearchResponse,
  BatchResponse,
  AutocompleteResponse,
  AgReport,
  EnergyReport,
} from '../types.js'

// ── Test Fixtures ────────────────────────────────────────────────────

const CENTROID_FEATURE = {
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [-114.654321, 52.123456] as [number, number] },
  properties: {
    shape: 'centroid' as const,
    legal_location: 'NW-36-42-3-W5',
    search_term: 'NW-36-42-3-W5',
    province: 'Alberta',
    survey_system: 'DLS' as const,
    unit: 'Quarter Section' as const,
  },
}

const GRID_FEATURE = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[[-114.7, 52.1], [-114.6, 52.1], [-114.6, 52.15], [-114.7, 52.15], [-114.7, 52.1]]],
  },
  properties: {
    shape: 'grid' as const,
    legal_location: 'NW-36-42-3-W5',
    search_term: 'NW-36-42-3-W5',
    province: 'Alberta',
    survey_system: 'DLS' as const,
    unit: 'Quarter Section' as const,
  },
}

const SEARCH_RESPONSE: SearchResponse = {
  type: 'FeatureCollection',
  features: [CENTROID_FEATURE, GRID_FEATURE],
}

const AUTOCOMPLETE_RESPONSE: AutocompleteResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point' as const, coordinates: [-114.01924, 51.077932] as [number, number] },
      properties: {
        legal_location: 'NW-25-24-1-W5',
        search_term: 'NW-25-24',
        survey_system: 'DLS' as const,
        unit: 'Quarter Section' as const,
      },
    },
  ],
}

const AG_REPORT: AgReport = {
  legal_location: '10-36-42-3-W5',
  resolved_legal_location: 'NE-36-42-3-W5',
  grain: 'lsd',
  province: 'AB',
  parcel: {
    area_ha: 64.75,
    centroid: { lat: 52.61, lng: -113.82 },
    geometry: null,
  },
  productivity: {
    lsrs: { score: 72, class: '2', limiter: 'M - Moisture' },
    cli: { score: 80, class: '2', limiter: 'M' },
  },
  cropping: {
    dominant: { code: '146', name: 'Canola', category: 'Oilseed' },
    rotation: 'Canola-Wheat',
    diversity_index: 0.6412,
    years_covered: 10,
  },
  soil: {
    classification: {
      order: 'Chernozemic',
      great_group: 'Black Chernozem',
      subgroup_code: 'Orthic Black Chernozem',
    },
    drainage_class: 'Well drained',
    slope_class: '2-5%',
    parent_material: 'Glacial till',
    is_solonetzic: false,
    source: 'AGRASID',
  },
  land_use: {
    dominant: { code: '51', label: 'Annual cropland', ipcc_class: 'Cropland' },
    breakdown: [{ code: '51', label: 'Annual cropland', ipcc_class: 'Cropland', pct: 88.2 }],
  },
  drought: { class: 'D1', severity_label: 'Moderate Drought', as_of: '2026-07' },
  wetlands: null,
  hydrology: {
    watercourse: { name: 'Blindman River', distance_m: 240, is_on_parcel: false },
    water_body: { name: null, distance_m: null, is_on_parcel: false, on_parcel_pct: null },
    search_radius_m: 500,
  },
  parcel_context: {
    municipality: { name: 'Red Deer County', type: 'Municipal District' },
    nearest_railway: null,
    nearest_road: null,
    nearest_park: null,
  },
  provincial_detail: null,
  units: { area: 'ha', distance: 'm' },
  meta: { unavailable: [], sources: {} },
}

const ENERGY_REPORT: EnergyReport = {
  legal_location: '10-36-42-3-W5',
  province: 'AB',
  parcel: { area_ha: 16.19, centroid: { lat: 52.51, lng: -113.71 }, geometry: null },
  summary: {
    wells: {
      total: 4,
      active: 2,
      suspended: 1,
      abandoned: 1,
      orphan: 0,
      reclamation_certified: 0,
      primary_source: 'regulator',
      by_source: {
        regulator: { total: 4, active: 2, suspended: 1, abandoned: 1, orphan: 0, reclamation_certified: 0 },
        petrinex: { total: 4, active: 2, suspended: 1, abandoned: 1, oil: 2, gas: 2, water: 0 },
      },
    },
    pipelines: { segment_count: 3, length_m_on_parcel: 1800 },
    facilities: { count: 1, categories: ['Battery'] },
    operators: {
      dominant: {
        name: 'EXAMPLE ENERGY LTD',
        ba_code: null,
        slug: 'example-energy-ltd',
        well_count: 4,
        well_share_pct: 100,
        share_basis: 'regulator_total_wells',
      },
    },
    last_activity_date: '2024-11-03',
  },
  production: {
    window_months: 12,
    last_producing_month: '2025-06',
    volumes: { oil_m3: 1250.5, gas_e3m3: 890.2, condensate_m3: 0, water_m3: 3100.0 },
    has_oil: true,
    has_gas: true,
    has_condensate: false,
    has_water: true,
    dominant_product: 'oil',
    producing_well_count: 2,
  },
  tenure: {
    total: 1,
    returned: 1,
    truncated: false,
    more: '/energy/tenure?legal_location=10-36-42-3-W5',
    rows: [
      {
        id: '0512345',
        href: '/energy/dispositions/0512345',
        tenure_kind: 'png',
        province: 'AB',
        disposition_number: '0512345',
        mineral_category: null,
        disposition_type: 'licence',
        disposition_type_raw: 'NAT GAS LIC',
        target_substance: null,
        coal_category: null,
        holder: { name: 'EXAMPLE ENERGY LTD', ba_code: null, slug: 'example-energy-ltd' },
        status: 'active',
        expiry_date: '2027-03-01',
        days_to_expiry: 192,
        expiry_state: 'expiring_soon',
        area_ha: 256,
        lsd_coverage_pct: 100,
        is_transfer_pending: false,
        overlap_point: { lat: 52.5, lng: -113.7 },
      },
    ],
  },
  wells: {
    total: 1,
    returned: 1,
    truncated: false,
    more: '/energy/wells?legal_location=10-36-42-3-W5',
    rows: [
      {
        id: '100103604203W500',
        uwi: '100103604203W500',
        well_name: 'EXAMPLE 10-36',
        licence_number: '0400001',
        status: 'active',
        licence_status_raw: 'Issued',
        operator: { name: null, ba_code: '0AB1', slug: null },
        fluid: 'crude_oil',
        mode: 'pumping',
        type: 'development',
        total_depth_m: 1650,
        is_orphan: false,
        is_abandoned: false,
        is_suspended: false,
        location: { lat: 52.51, lng: -113.71 },
      },
    ],
  },
  pipelines: { total: 0, returned: 0, truncated: false, more: null, rows: [] },
  facilities: { total: 0, returned: 0, truncated: false, more: null, rows: [] },
  alternative_energy: null,
  units: { length: 'm', area: 'ha', depth: 'm', pressure: 'kPa', oil: 'm3', gas: 'e3m3' },
  meta: { unavailable: [], sources: {} },
}

// ── Helpers ──────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  })
}

function createClient(fetchFn: ReturnType<typeof vi.fn>) {
  return new TownshipClient({
    apiKey: 'test-key',
    fetch: fetchFn as unknown as typeof globalThis.fetch,
  })
}

// ── Tests ────────────────────────────────────────────────────────────

describe('TownshipClient', () => {
  describe('constructor', () => {
    it('throws if apiKey is missing', () => {
      expect(() => new TownshipClient({ apiKey: '' })).toThrow('apiKey is required')
    })

    it('accepts valid options', () => {
      const client = new TownshipClient({ apiKey: 'key' })
      expect(client).toBeInstanceOf(TownshipClient)
    })

    it('trims trailing slashes from baseUrl', () => {
      const fetchFn = mockFetch(SEARCH_RESPONSE)
      const client = new TownshipClient({
        apiKey: 'key',
        baseUrl: 'https://example.com///',
        fetch: fetchFn as unknown as typeof globalThis.fetch,
      })
      client.search('NW-36-42-3-W5')
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/example\.com\/search/),
        expect.anything(),
      )
    })
  })

  describe('search', () => {
    it('sends correct request and parses result', async () => {
      const fetchFn = mockFetch(SEARCH_RESPONSE)
      const client = createClient(fetchFn)

      const result = await client.search('NW-36-42-3-W5')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/search/legal-location?location=NW-36-42-3-W5'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
          }),
        }),
      )

      expect(result.legalLocation).toBe('NW-36-42-3-W5')
      expect(result.latitude).toBe(52.123456)
      expect(result.longitude).toBe(-114.654321)
      expect(result.province).toBe('Alberta')
      expect(result.surveySystem).toBe('DLS')
      expect(result.unit).toBe('Quarter Section')
      expect(result.boundary).toEqual(GRID_FEATURE.geometry)
      expect(result.raw).toHaveLength(2)
    })

    it('encodes special characters in location', async () => {
      const fetchFn = mockFetch(SEARCH_RESPONSE)
      const client = createClient(fetchFn)

      await client.search('Lot 5, Con 3, Admaston')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('location=Lot%205%2C%20Con%203%2C%20Admaston'),
        expect.anything(),
      )
    })

    it('returns null boundary when no grid feature', async () => {
      const response: SearchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE],
      }
      const client = createClient(mockFetch(response))
      const result = await client.search('NW-36-42-3-W5')
      expect(result.boundary).toBeNull()
    })

    it('throws NotFoundError when no centroid in response', async () => {
      const response: SearchResponse = {
        type: 'FeatureCollection',
        features: [GRID_FEATURE],
      }
      const client = createClient(mockFetch(response))
      await expect(client.search('NW-36-42-3-W5')).rejects.toThrow(NotFoundError)
    })
  })

  describe('reverse', () => {
    it('sends correct request', async () => {
      const fetchFn = mockFetch(SEARCH_RESPONSE)
      const client = createClient(fetchFn)

      const result = await client.reverse(-114.654, 52.123)

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/search/coordinates?location=-114.654%2C52.123'),
        expect.anything(),
      )
      expect(result.legalLocation).toBe('NW-36-42-3-W5')
    })

    it('passes surveySystem and unit options', async () => {
      const fetchFn = mockFetch(SEARCH_RESPONSE)
      const client = createClient(fetchFn)

      await client.reverse(-114.654, 52.123, {
        surveySystem: 'DLS',
        unit: 'Quarter Section' as const,
      })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('survey_system=DLS')
      expect(url).toContain('unit=Quarter+Section')
    })
  })

  describe('autocomplete', () => {
    it('sends correct request and parses suggestions', async () => {
      const fetchFn = mockFetch(AUTOCOMPLETE_RESPONSE)
      const client = createClient(fetchFn)

      const suggestions = await client.autocomplete('NW-25-24')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/autocomplete/legal-location?location=NW-25-24'),
        expect.anything(),
      )

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].legalLocation).toBe('NW-25-24-1-W5')
      expect(suggestions[0].latitude).toBe(51.077932)
      expect(suggestions[0].longitude).toBe(-114.01924)
      expect(suggestions[0].surveySystem).toBe('DLS')
    })

    it('passes limit and proximity options', async () => {
      const fetchFn = mockFetch(AUTOCOMPLETE_RESPONSE)
      const client = createClient(fetchFn)

      await client.autocomplete('NW-25', {
        limit: 5,
        proximity: [-114.0, 51.0],
      })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('limit=5')
      expect(url).toContain('proximity=-114%2C51')
    })
  })

  describe('batchSearch', () => {
    it('sends POST request with locations', async () => {
      const batchResponse: BatchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE, GRID_FEATURE],
      }
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      const result = await client.batchSearch(['NW-36-42-3-W5'])

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/batch/legal-location'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['NW-36-42-3-W5']),
        }),
      )

      expect(result.total).toBe(1)
      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.results).toHaveLength(1)
      expect(result.results[0].legalLocation).toBe('NW-36-42-3-W5')
    })

    it('chunks large batches', async () => {
      const batchResponse: BatchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE, GRID_FEATURE],
      }
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      // Create array of 150 locations
      const locations = Array.from({ length: 150 }, (_, i) => `NW-${i}-42-3-W5`)
      await client.batchSearch(locations)

      // Should have made 2 API calls (100 + 50)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('respects custom chunkSize', async () => {
      const batchResponse: BatchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE, GRID_FEATURE],
      }
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      const locations = Array.from({ length: 30 }, (_, i) => `NW-${i}-42-3-W5`)
      await client.batchSearch(locations, { chunkSize: 10 })

      expect(fetchFn).toHaveBeenCalledTimes(3) // 10 + 10 + 10
    })
  })

  describe('batchReverse', () => {
    it('sends POST request with coordinates', async () => {
      const batchResponse: BatchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE, GRID_FEATURE],
      }
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      const coords: [number, number][] = [[-114.654, 52.123]]
      const result = await client.batchReverse(coords)

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/batch/coordinates'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ coordinates: coords }),
        }),
      )

      expect(result.total).toBe(1)
      expect(result.success).toBe(1)
    })

    it('passes surveySystem and unit options', async () => {
      const batchResponse: BatchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE, GRID_FEATURE],
      }
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      await client.batchReverse([[-114.654, 52.123]], {
        surveySystem: 'DLS',
        unit: 'LSD',
      })

      const body = JSON.parse(fetchFn.mock.calls[0][1].body as string)
      expect(body.survey_system).toBe('DLS')
      expect(body.unit).toBe('LSD')
    })
  })

  describe('boundary', () => {
    it('returns boundary geometry from search', async () => {
      const client = createClient(mockFetch(SEARCH_RESPONSE))
      const boundary = await client.boundary('NW-36-42-3-W5')

      expect(boundary).toEqual(GRID_FEATURE.geometry)
      expect(boundary?.type).toBe('Polygon')
    })

    it('returns null when no grid feature', async () => {
      const response: SearchResponse = {
        type: 'FeatureCollection',
        features: [CENTROID_FEATURE],
      }
      const client = createClient(mockFetch(response))
      const boundary = await client.boundary('NW-36-42-3-W5')
      expect(boundary).toBeNull()
    })
  })

  describe('raw', () => {
    it('returns the raw FeatureCollection', async () => {
      const client = createClient(mockFetch(SEARCH_RESPONSE))
      const raw = await client.raw('NW-36-42-3-W5')

      expect(raw.type).toBe('FeatureCollection')
      expect(raw.features).toHaveLength(2)
    })
  })

  describe('agReport', () => {
    it('sends correct request and returns the report', async () => {
      const fetchFn = mockFetch(AG_REPORT)
      const client = createClient(fetchFn)

      const report = await client.agReport('10-36-42-3-W5')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/ag/report?legal_location=10-36-42-3-W5'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
          }),
        }),
      )

      expect(report.legal_location).toBe('10-36-42-3-W5')
      expect(report.resolved_legal_location).toBe('NE-36-42-3-W5')
      expect(report.grain).toBe('lsd')
      expect(report.province).toBe('AB')
      expect(report.parcel.area_ha).toBe(64.75)
      expect(report.productivity?.lsrs?.score).toBe(72)
      expect(report.soil?.classification?.order).toBe('Chernozemic')
      expect(report.drought?.class).toBe('D1')
      expect(report.drought?.as_of).toBe('2026-07')
      expect(report.hydrology?.watercourse?.distance_m).toBe(240)
      expect(report.provincial_detail).toBeNull()
    })

    it('passes include sections as a comma-separated list', async () => {
      const fetchFn = mockFetch(AG_REPORT)
      const client = createClient(fetchFn)

      await client.agReport('NW-36-42-3-W5', { include: ['soil', 'drought', 'geometry'] })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('include=soil%2Cdrought%2Cgeometry')
    })

    it('omits include by default', async () => {
      const fetchFn = mockFetch(AG_REPORT)
      const client = createClient(fetchFn)

      await client.agReport('NW-36-42-3-W5')

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).not.toContain('include')
      expect(url).not.toContain('geometry')
    })

    it('throws ValidationError with code for BC locations (400)', async () => {
      const client = createClient(
        mockFetch(
          { error: { code: 'bc_not_supported', message: 'BC locations are not yet supported' } },
          400,
        ),
      )
      const err = await client.agReport('A-2-F/93-P-8').catch((e) => e)
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.code).toBe('bc_not_supported')
      expect(err.message).toBe('BC locations are not yet supported')
    })

    it('throws NotFoundError when no data (404)', async () => {
      const client = createClient(
        mockFetch({ error: { code: 'not_found', message: 'No agriculture data' } }, 404),
      )
      await expect(client.agReport('NW-1-1-1-W4')).rejects.toThrow(NotFoundError)
    })
  })

  describe('energyReport', () => {
    it('sends correct request and returns the report', async () => {
      const fetchFn = mockFetch(ENERGY_REPORT)
      const client = createClient(fetchFn)

      const report = await client.energyReport('10-36-42-3-W5')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/energy/report?legal_location=10-36-42-3-W5'),
        expect.anything(),
      )

      expect(report.legal_location).toBe('10-36-42-3-W5')
      expect(report.province).toBe('AB')
      expect(report.parcel?.area_ha).toBe(16.19)
      expect(report.summary?.wells.total).toBe(4)
      expect(report.summary?.wells.by_source.petrinex?.oil).toBe(2)
      expect(report.summary?.operators.dominant?.name).toBe('EXAMPLE ENERGY LTD')
      expect(report.summary?.operators.dominant?.slug).toBe('example-energy-ltd')
      expect(report.production?.dominant_product).toBe('oil')
      expect(report.production?.volumes.oil_m3).toBe(1250.5)
      expect(report.tenure?.rows[0]?.expiry_state).toBe('expiring_soon')
      expect(report.tenure?.rows[0]?.holder.slug).toBe('example-energy-ltd')
      expect(report.wells?.total).toBe(1)
      expect(report.wells?.rows[0]?.operator.ba_code).toBe('0AB1')
      expect(report.pipelines?.rows).toEqual([])
      expect(report.alternative_energy).toBeNull()
    })

    it('passes include sections as a comma-separated list', async () => {
      const fetchFn = mockFetch(ENERGY_REPORT)
      const client = createClient(fetchFn)

      await client.energyReport('10-36-42-3-W5', { include: ['summary', 'geometry'] })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('include=summary%2Cgeometry')
    })

    it('throws NotFoundError when no data (404)', async () => {
      const client = createClient(
        mockFetch({ error: { code: 'not_found', message: 'No energy data' } }, 404),
      )
      await expect(client.energyReport('1-1-1-1-W4')).rejects.toThrow(NotFoundError)
    })
  })

  describe('error handling', () => {
    it('throws AuthenticationError on 401', async () => {
      const client = createClient(mockFetch({ message: 'Invalid API key' }, 401))
      await expect(client.search('test')).rejects.toThrow(AuthenticationError)
    })

    it('throws NotFoundError on 404', async () => {
      const client = createClient(mockFetch({ message: 'Not found' }, 404))
      await expect(client.search('test')).rejects.toThrow(NotFoundError)
    })

    it('throws RateLimitError on 429', async () => {
      const client = createClient(mockFetch({ message: 'Rate limited' }, 429))
      await expect(client.search('test')).rejects.toThrow(RateLimitError)
    })

    it('throws ValidationError on 400', async () => {
      const client = createClient(mockFetch({ message: 'Bad request' }, 400))
      await expect(client.search('test')).rejects.toThrow(ValidationError)
    })

    it('throws PayloadTooLargeError on 413', async () => {
      const client = createClient(mockFetch({ message: 'Too large' }, 413))
      await expect(client.search('test')).rejects.toThrow(PayloadTooLargeError)
    })

    it('throws TownshipError on other status codes', async () => {
      const client = createClient(mockFetch({ message: 'Server error' }, 500))
      await expect(client.search('test')).rejects.toThrow(TownshipError)
    })

    it('uses statusText when body has no message', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('invalid json')),
      })
      const client = createClient(fetchFn)
      await expect(client.search('test')).rejects.toThrow('Internal Server Error')
    })

    it('wraps network errors in TownshipError', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network failure'))
      const client = createClient(fetchFn)
      await expect(client.search('test')).rejects.toThrow(TownshipError)
      await expect(client.search('test')).rejects.toThrow('Network failure')
    })

    it('throws on timeout (AbortError)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new DOMException('Aborted', 'AbortError'),
      )
      const client = new TownshipClient({
        apiKey: 'key',
        timeout: 100,
        fetch: fetchFn as unknown as typeof globalThis.fetch,
      })
      await expect(client.search('test')).rejects.toThrow('timed out')
    })
  })

  describe('exports', () => {
    it('exports all expected types and classes from index', async () => {
      const mod = await import('../index.js')

      // Classes
      expect(mod.TownshipClient).toBeDefined()
      expect(mod.TownshipError).toBeDefined()
      expect(mod.AuthenticationError).toBeDefined()
      expect(mod.NotFoundError).toBeDefined()
      expect(mod.RateLimitError).toBeDefined()
      expect(mod.ValidationError).toBeDefined()
      expect(mod.PayloadTooLargeError).toBeDefined()
    })
  })
})

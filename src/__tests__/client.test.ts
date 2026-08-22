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
  AgBatchItem,
  EnergyReport,
  EnergyBatchItem,
  EnergyOperatorsResponse,
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
  legal_location: 'NW-36-42-3-W5',
  province: 'ab',
  area_ha: 64.75,
  productivity: {
    lsrs_score: 72,
    lsrs_class: '2',
    lsrs_limiter: 'M - Moisture',
    cli_class: '2',
    cli_score: 80,
    cli_limiter: 'M',
  },
  cropping: {
    dominant_crop: '146',
    dominant_crop_name: 'Canola',
    dominant_category: 'Oilseed',
    rotation_pattern: 'Canola-Wheat',
    diversity_index: 0.64,
    years_covered: 10,
  },
  soil: {
    order: 'Chernozemic',
    group: 'Black Chernozem',
    subgroup: 'Orthic Black Chernozem',
    drainage_class: 'Well drained',
    slope_class: '2-5%',
    parent_material: 'Glacial till',
    is_solonetzic: false,
    source: 'AGRASID',
  },
  land_use: {
    class: '51',
    class_label: 'Annual cropland',
    ipcc_class: 'Cropland',
    breakdown: [{ class: '51', label: 'Annual cropland', pct: 88.2 }],
  },
  drought: null,
  wetlands: null,
  parcel_context: {
    municipality: 'Red Deer County',
    municipality_type: 'Municipal District',
    nearest_railway: null,
    nearest_road: null,
    nearest_park: null,
  },
}

const ENERGY_REPORT: EnergyReport = {
  legal_location: '10-36-42-3-W5',
  province: 'ab',
  activity: {
    total_wells: 4,
    active_wells: 2,
    suspended_wells: 1,
    abandoned_wells: 1,
    orphan_wells: 0,
    recl_certified_wells: 0,
    petrinex: { total: 4, oil: 2, gas: 2 },
    pipeline_segments: 3,
    pipeline_length_km: 1.8,
    facility_count: 1,
    facility_categories: ['Battery'],
    dominant_operator: 'EXAMPLE ENERGY LTD',
  },
  production: {
    oil_m3_12mo: 1250.5,
    gas_e3m3_12mo: 890.2,
    water_m3_12mo: 3100.0,
    condensate_m3_12mo: 0,
    has_oil: true,
    has_gas: true,
    has_water: true,
    dominant_product: 'OIL',
    producing_wells: 2,
    last_producing_month: '2025-06',
  },
  tenure: [],
  wells: [],
  pipelines: [],
  facilities: [],
  alternative_energy: null,
}

const OPERATORS_RESPONSE: EnergyOperatorsResponse = {
  operators: [
    {
      ba_code: '0AB1',
      name: 'EXAMPLE ENERGY LTD',
      active_wells: 1250,
      abandoned_wells: 320,
      orphan_wells: 0,
    },
  ],
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

      const report = await client.agReport('NW-36-42-3-W5')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/ag/report?legal_location=NW-36-42-3-W5'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
          }),
        }),
      )

      expect(report.legal_location).toBe('NW-36-42-3-W5')
      expect(report.province).toBe('ab')
      expect(report.area_ha).toBe(64.75)
      expect(report.productivity?.lsrs_score).toBe(72)
      expect(report.soil?.order).toBe('Chernozemic')
      expect(report.drought).toBeNull()
    })

    it('passes geometry flag', async () => {
      const fetchFn = mockFetch(AG_REPORT)
      const client = createClient(fetchFn)

      await client.agReport('NW-36-42-3-W5', { geometry: true })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('geometry=true')
    })

    it('omits geometry flag by default', async () => {
      const fetchFn = mockFetch(AG_REPORT)
      const client = createClient(fetchFn)

      await client.agReport('NW-36-42-3-W5')

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).not.toContain('geometry')
    })

    it('throws ValidationError for BC locations (400)', async () => {
      const client = createClient(mockFetch({ message: 'BC locations are not yet supported' }, 400))
      await expect(client.agReport('A-2-F/93-P-8')).rejects.toThrow(ValidationError)
    })

    it('throws NotFoundError when no data (404)', async () => {
      const client = createClient(mockFetch({ message: 'No agriculture data' }, 404))
      await expect(client.agReport('NW-1-1-1-W4')).rejects.toThrow(NotFoundError)
    })
  })

  describe('agBatch', () => {
    it('sends POST request and returns envelopes in order', async () => {
      const batchResponse: AgBatchItem[] = [
        { legal_location: 'NW-36-42-3-W5', status: 'ok', data: AG_REPORT },
        { legal_location: 'not a location', status: 'error', error: 'Invalid legal location format', data: null },
        { legal_location: 'NW-1-1-1-W4', status: 'not_found', data: null },
      ]
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      const items = await client.agBatch(['NW-36-42-3-W5', 'not a location', 'NW-1-1-1-W4'])

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/ag/batch'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['NW-36-42-3-W5', 'not a location', 'NW-1-1-1-W4']),
        }),
      )

      expect(items).toHaveLength(3)
      expect(items[0].status).toBe('ok')
      expect(items[0].data?.area_ha).toBe(64.75)
      expect(items[1].status).toBe('error')
      expect(items[1].error).toBe('Invalid legal location format')
      expect(items[2].status).toBe('not_found')
      expect(items[2].data).toBeNull()
    })

    it('chunks batches larger than 25', async () => {
      const fetchFn = mockFetch([])
      const client = createClient(fetchFn)

      const locations = Array.from({ length: 60 }, (_, i) => `NW-${i}-42-3-W5`)
      await client.agBatch(locations)

      // 60 items with chunk size 25 -> 3 requests (25 + 25 + 10)
      expect(fetchFn).toHaveBeenCalledTimes(3)
      const firstBody = JSON.parse(fetchFn.mock.calls[0][1].body as string)
      expect(firstBody).toHaveLength(25)
    })
  })

  describe('agAutocomplete', () => {
    it('sends correct request and parses suggestions', async () => {
      const fetchFn = mockFetch(AUTOCOMPLETE_RESPONSE)
      const client = createClient(fetchFn)

      const suggestions = await client.agAutocomplete('NW-25-24')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/ag/autocomplete?location=NW-25-24'),
        expect.anything(),
      )

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].legalLocation).toBe('NW-25-24-1-W5')
      expect(suggestions[0].unit).toBe('Quarter Section')
    })

    it('passes limit and proximity options', async () => {
      const fetchFn = mockFetch(AUTOCOMPLETE_RESPONSE)
      const client = createClient(fetchFn)

      await client.agAutocomplete('NW-25', { limit: 5, proximity: [-114.0, 51.0] })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('limit=5')
      expect(url).toContain('proximity=-114%2C51')
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
      expect(report.activity.total_wells).toBe(4)
      expect(report.activity.dominant_operator).toBe('EXAMPLE ENERGY LTD')
      expect(report.production?.dominant_product).toBe('OIL')
      expect(report.wells).toEqual([])
      expect(report.alternative_energy).toBeNull()
    })

    it('passes geometry flag', async () => {
      const fetchFn = mockFetch(ENERGY_REPORT)
      const client = createClient(fetchFn)

      await client.energyReport('10-36-42-3-W5', { geometry: true })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('geometry=true')
    })

    it('throws NotFoundError when no data (404)', async () => {
      const client = createClient(mockFetch({ message: 'No energy data' }, 404))
      await expect(client.energyReport('1-1-1-1-W4')).rejects.toThrow(NotFoundError)
    })
  })

  describe('energyBatch', () => {
    it('sends POST request and returns envelopes in order', async () => {
      const batchResponse: EnergyBatchItem[] = [
        { legal_location: '10-36-42-3-W5', status: 'ok', data: ENERGY_REPORT },
        { legal_location: '1-1-1-1-W4', status: 'not_found', data: null },
      ]
      const fetchFn = mockFetch(batchResponse)
      const client = createClient(fetchFn)

      const items = await client.energyBatch(['10-36-42-3-W5', '1-1-1-1-W4'])

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/energy/batch'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['10-36-42-3-W5', '1-1-1-1-W4']),
        }),
      )

      expect(items).toHaveLength(2)
      expect(items[0].status).toBe('ok')
      expect(items[0].data?.activity.total_wells).toBe(4)
      expect(items[1].status).toBe('not_found')
    })

    it('chunks batches larger than 25', async () => {
      const fetchFn = mockFetch([])
      const client = createClient(fetchFn)

      const locations = Array.from({ length: 30 }, (_, i) => `10-${i}-42-3-W5`)
      await client.energyBatch(locations)

      expect(fetchFn).toHaveBeenCalledTimes(2) // 25 + 5
    })
  })

  describe('energyAutocomplete', () => {
    it('sends correct request and parses suggestions', async () => {
      const fetchFn = mockFetch(AUTOCOMPLETE_RESPONSE)
      const client = createClient(fetchFn)

      const suggestions = await client.energyAutocomplete('10-36-42')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/energy/autocomplete?location=10-36-42'),
        expect.anything(),
      )
      expect(suggestions).toHaveLength(1)
    })

    it('passes limit and proximity options', async () => {
      const fetchFn = mockFetch(AUTOCOMPLETE_RESPONSE)
      const client = createClient(fetchFn)

      await client.energyAutocomplete('10-36', { limit: 5, proximity: [-113.7, 52.5] })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('limit=5')
      expect(url).toContain('proximity=-113.7%2C52.5')
    })
  })

  describe('energyOperatorAutocomplete', () => {
    it('sends correct request and returns operators', async () => {
      const fetchFn = mockFetch(OPERATORS_RESPONSE)
      const client = createClient(fetchFn)

      const operators = await client.energyOperatorAutocomplete('example')

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/energy/operators/autocomplete?q=example'),
        expect.anything(),
      )

      expect(operators).toHaveLength(1)
      expect(operators[0].ba_code).toBe('0AB1')
      expect(operators[0].name).toBe('EXAMPLE ENERGY LTD')
      expect(operators[0].active_wells).toBe(1250)
    })

    it('passes limit option', async () => {
      const fetchFn = mockFetch(OPERATORS_RESPONSE)
      const client = createClient(fetchFn)

      await client.energyOperatorAutocomplete('example', { limit: 20 })

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('limit=20')
    })

    it('encodes special characters in query', async () => {
      const fetchFn = mockFetch(OPERATORS_RESPONSE)
      const client = createClient(fetchFn)

      await client.energyOperatorAutocomplete('smith & sons')

      const url = fetchFn.mock.calls[0][0] as string
      expect(url).toContain('q=smith+%26+sons')
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

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
import type { SearchResponse, BatchResponse, AutocompleteResponse } from '../types.js'

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
    unit: 'Quarter Section',
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
    unit: 'Quarter Section',
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
        unit: 'Quarter Section',
      },
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
        unit: 'Quarter Section',
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

import type {
  TownshipClientOptions,
  SearchResponse,
  BatchResponse,
  AutocompleteResponse,
  SearchResult,
  BatchResult,
  AutocompleteSuggestion,
  ReverseOptions,
  BatchOptions,
  BatchReverseOptions,
  AutocompleteOptions,
  LocationFeature,
  GeoJSONPolygon,
  GeoJSONMultiPolygon
} from "./types.js";
import {
  TownshipError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  PayloadTooLargeError
} from "./errors.js";

const DEFAULT_BASE_URL = "https://developer.townshipcanada.com";
const DEFAULT_TIMEOUT = 30_000;
const MAX_BATCH_SIZE = 100;

/**
 * Township Canada API client.
 *
 * @example
 * ```ts
 * import { TownshipClient } from 'townshipcanada'
 *
 * const client = new TownshipClient({ apiKey: 'your-api-key' })
 * const result = await client.search('NW-36-42-3-W5')
 * console.log(result.latitude, result.longitude)
 * ```
 */
export class TownshipClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: TownshipClientOptions) {
    if (!options.apiKey) {
      throw new TownshipError("apiKey is required");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ── Core Methods ─────────────────────────────────────────────────

  /**
   * Convert a legal land description to GPS coordinates.
   *
   * @param legalLocation - A legal land description (e.g. "NW-36-42-3-W5", "093G/14")
   * @returns The search result with coordinates and boundary
   *
   * @example
   * ```ts
   * const result = await client.search('NW-36-42-3-W5')
   * console.log(result.latitude)   // 52.123456
   * console.log(result.longitude)  // -114.654321
   * console.log(result.province)   // "Alberta"
   * ```
   */
  async search(legalLocation: string): Promise<SearchResult> {
    const response = await this.request<SearchResponse>(
      `/search/legal-location?location=${encodeURIComponent(legalLocation)}`
    );
    return this.parseFeatures(response.features);
  }

  /**
   * Reverse geocode GPS coordinates to a legal land description.
   *
   * @param longitude - Longitude in decimal degrees
   * @param latitude - Latitude in decimal degrees
   * @param options - Optional survey system and unit filters
   * @returns The nearest legal land description
   *
   * @example
   * ```ts
   * const result = await client.reverse(-114.654, 52.123)
   * console.log(result.legalLocation) // "NW-36-42-3-W5"
   * ```
   */
  async reverse(
    longitude: number,
    latitude: number,
    options?: ReverseOptions
  ): Promise<SearchResult> {
    const params = new URLSearchParams({
      location: `${longitude},${latitude}`
    });
    if (options?.surveySystem) params.set("survey_system", options.surveySystem);
    if (options?.unit) params.set("unit", options.unit);

    const response = await this.request<SearchResponse>(`/search/coordinates?${params.toString()}`);
    return this.parseFeatures(response.features);
  }

  /**
   * Get autocomplete suggestions for a partial legal land description.
   *
   * @param query - Partial or full legal land description (min 2 characters)
   * @param options - Optional limit and proximity bias
   * @returns Array of autocomplete suggestions
   *
   * @example
   * ```ts
   * const suggestions = await client.autocomplete('NW-25-24')
   * for (const s of suggestions) {
   *   console.log(s.legalLocation) // "NW-25-24-1-W5"
   * }
   * ```
   */
  async autocomplete(
    query: string,
    options?: AutocompleteOptions
  ): Promise<AutocompleteSuggestion[]> {
    const params = new URLSearchParams({ location: query });
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.proximity) {
      params.set("proximity", `${options.proximity[0]},${options.proximity[1]}`);
    }

    const response = await this.request<AutocompleteResponse>(
      `/autocomplete/legal-location?${params.toString()}`
    );

    return response.features.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return {
        legalLocation: feature.properties.legal_location,
        latitude,
        longitude,
        surveySystem: feature.properties.survey_system,
        unit: feature.properties.unit
      };
    });
  }

  /**
   * Convert multiple legal land descriptions to GPS coordinates in batch.
   * Automatically chunks large batches into requests of 100 (API max).
   *
   * @param locations - Array of legal land descriptions
   * @param options - Optional batch configuration
   * @returns Batch results with success/failure counts
   *
   * @example
   * ```ts
   * const result = await client.batchSearch([
   *   'NW-36-42-3-W5',
   *   'SE-1-50-10-W4',
   *   '093G/14',
   * ])
   * console.log(result.success) // 3
   * ```
   */
  async batchSearch(locations: string[], options?: BatchOptions): Promise<BatchResult> {
    const chunkSize = Math.min(options?.chunkSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
    const chunks = this.chunk(locations, chunkSize);

    const allResults: SearchResult[] = [];
    let totalFailed = 0;

    for (const batch of chunks) {
      const response = await this.request<BatchResponse>("/batch/legal-location", {
        method: "POST",
        body: JSON.stringify(batch)
      });

      const grouped = this.groupFeaturesByLocation(response.features);
      for (const [, features] of grouped) {
        try {
          allResults.push(this.parseFeatures(features));
        } catch {
          totalFailed++;
        }
      }
    }

    return {
      results: allResults,
      total: locations.length,
      success: allResults.length,
      failed: totalFailed
    };
  }

  /**
   * Reverse geocode multiple coordinate pairs in batch.
   * Automatically chunks large batches into requests of 100 (API max).
   *
   * @param coordinates - Array of [longitude, latitude] pairs
   * @param options - Optional survey system, unit, and batch configuration
   * @returns Batch results with success/failure counts
   *
   * @example
   * ```ts
   * const result = await client.batchReverse([
   *   [-114.654, 52.123],
   *   [-114.072, 51.045],
   * ])
   * console.log(result.results[0].legalLocation) // "NW-36-42-3-W5"
   * ```
   */
  async batchReverse(
    coordinates: [longitude: number, latitude: number][],
    options?: BatchReverseOptions
  ): Promise<BatchResult> {
    const chunkSize = Math.min(options?.chunkSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
    const chunks = this.chunk(coordinates, chunkSize);

    const allResults: SearchResult[] = [];
    let totalFailed = 0;

    for (const batch of chunks) {
      const body: Record<string, unknown> = { coordinates: batch };
      if (options?.surveySystem) body.survey_system = options.surveySystem;
      if (options?.unit) body.unit = options.unit;

      const response = await this.request<BatchResponse>("/batch/coordinates", {
        method: "POST",
        body: JSON.stringify(body)
      });

      const grouped = this.groupFeaturesByLocation(response.features);
      for (const [, features] of grouped) {
        try {
          allResults.push(this.parseFeatures(features));
        } catch {
          totalFailed++;
        }
      }
    }

    return {
      results: allResults,
      total: coordinates.length,
      success: allResults.length,
      failed: totalFailed
    };
  }

  /**
   * Look up the boundary polygon for a legal land description.
   * Returns the GeoJSON geometry of the parcel grid.
   *
   * @param legalLocation - A legal land description
   * @returns The boundary as a GeoJSON Polygon or MultiPolygon, or null if not found
   *
   * @example
   * ```ts
   * const boundary = await client.boundary('NW-36-42-3-W5')
   * if (boundary) {
   *   console.log(boundary.type)        // "Polygon"
   *   console.log(boundary.coordinates) // [[[lng, lat], ...]]
   * }
   * ```
   */
  async boundary(legalLocation: string): Promise<GeoJSONPolygon | GeoJSONMultiPolygon | null> {
    const result = await this.search(legalLocation);
    return result.boundary;
  }

  /**
   * Get the raw GeoJSON FeatureCollection for a legal land description.
   * Useful when you need full control over the response data.
   *
   * @param legalLocation - A legal land description
   * @returns Raw GeoJSON FeatureCollection from the API
   */
  async raw(legalLocation: string): Promise<SearchResponse> {
    return this.request<SearchResponse>(
      `/search/legal-location?location=${encodeURIComponent(legalLocation)}`
    );
  }

  // ── Internal Helpers ─────────────────────────────────────────────

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        ...init,
        headers: {
          "X-API-Key": this.apiKey,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers
        },
        signal: controller.signal
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TownshipError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TownshipError(`Request timed out after ${this.timeout}ms`);
      }
      throw new TownshipError(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let message: string;
    try {
      const body = await response.json();
      message =
        (body as { message?: string }).message ??
        (body as { error?: string }).error ??
        response.statusText;
    } catch {
      message = response.statusText;
    }

    switch (response.status) {
      case 400:
        throw new ValidationError(message);
      case 401:
        throw new AuthenticationError(message);
      case 404:
        throw new NotFoundError(message);
      case 413:
        throw new PayloadTooLargeError(message);
      case 429:
        throw new RateLimitError(message);
      default:
        throw new TownshipError(message, response.status);
    }
  }

  private parseFeatures(features: LocationFeature[]): SearchResult {
    const centroid = features.find((f) => f.properties.shape === "centroid");
    const grid = features.find((f) => f.properties.shape === "grid");

    if (!centroid || centroid.geometry.type !== "Point") {
      throw new NotFoundError("No centroid found in response");
    }

    const [longitude, latitude] = centroid.geometry.coordinates;

    return {
      legalLocation: centroid.properties.legal_location,
      latitude,
      longitude,
      province: centroid.properties.province,
      surveySystem: centroid.properties.survey_system,
      unit: centroid.properties.unit,
      boundary: grid ? (grid.geometry as GeoJSONPolygon | GeoJSONMultiPolygon) : null,
      raw: features
    };
  }

  private groupFeaturesByLocation(features: LocationFeature[]): Map<string, LocationFeature[]> {
    const groups = new Map<string, LocationFeature[]>();
    for (const feature of features) {
      const key = feature.properties.legal_location;
      const existing = groups.get(key);
      if (existing) {
        existing.push(feature);
      } else {
        groups.set(key, [feature]);
      }
    }
    return groups;
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

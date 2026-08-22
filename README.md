# townshipcanada

[![npm](https://img.shields.io/npm/v/townshipcanada)](https://www.npmjs.com/package/townshipcanada)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Official TypeScript SDK for the [Township Canada API](https://townshipcanada.com/api) — convert Canadian legal land descriptions (DLS, NTS, Geographic Townships) to GPS coordinates and back.

[Documentation](https://townshipcanada.com/api) · [GitHub](https://github.com/townshipcanada/typescript-sdk) · [npm](https://www.npmjs.com/package/townshipcanada)

## Install

```bash
npm install townshipcanada
# or
pnpm add townshipcanada
# or
yarn add townshipcanada
```

## Quick Start

```typescript
import { TownshipClient } from "townshipcanada";

const client = new TownshipClient({
  apiKey: "your-api-key" // Get yours at https://townshipcanada.com/api
});

// Convert a legal land description to GPS coordinates
const result = await client.search("NW-36-42-3-W5");
console.log(result.latitude); // 52.123456
console.log(result.longitude); // -114.654321
console.log(result.province); // "Alberta"
```

## API Key Setup

1. Sign up at [townshipcanada.com/api](https://townshipcanada.com/api)
2. Create an API key from your dashboard
3. Pass it to the client constructor

```typescript
const client = new TownshipClient({ apiKey: process.env.TOWNSHIP_CANADA_API_KEY! });
```

## API Reference

### `new TownshipClient(options)`

Create a new client instance.

| Option    | Type       | Default                                | Description                  |
| --------- | ---------- | -------------------------------------- | ---------------------------- |
| `apiKey`  | `string`   | _required_                             | Your Township Canada API key |
| `baseUrl` | `string`   | `https://developer.townshipcanada.com` | API base URL                 |
| `timeout` | `number`   | `30000`                                | Request timeout in ms        |
| `fetch`   | `function` | `globalThis.fetch`                     | Custom fetch implementation  |

---

### `client.search(legalLocation)`

Convert a legal land description to GPS coordinates.

```typescript
const result = await client.search("NW-36-42-3-W5");

// DLS (Dominion Land Survey) — Alberta, Saskatchewan, Manitoba
await client.search("NW-36-42-3-W5"); // Quarter section
await client.search("10-36-42-3-W5"); // LSD (Legal Subdivision)
await client.search("36-42-3-W5"); // Section

// NTS (National Topographic System) — British Columbia
await client.search("A-2-F/93-P-8"); // Quarter Unit
await client.search("2-F/93-P-8"); // Unit

// Geographic Townships — Ontario
await client.search("Lot 2 Con 4 Osprey");
```

**Returns:** `SearchResult`

```typescript
{
  legalLocation: string       // "NW-36-42-3-W5"
  latitude: number            // 52.123456
  longitude: number           // -114.654321
  province: string            // "Alberta"
  surveySystem: SurveySystem  // "DLS"
  unit: Unit                  // "Quarter Section"
  boundary: GeoJSONPolygon | GeoJSONMultiPolygon | null
  raw: LocationFeature[]      // Raw GeoJSON features
}
```

---

### `client.reverse(longitude, latitude, options?)`

Find the legal land description for a GPS coordinate.

```typescript
const result = await client.reverse(-114.654, 52.123);
console.log(result.legalLocation); // "NW-36-42-3-W5"

// With options
const result = await client.reverse(-114.654, 52.123, {
  surveySystem: "DLS",
  unit: "Quarter Section"
});
```

**Options:**

| Option         | Type           | Description                                    |
| -------------- | -------------- | ---------------------------------------------- |
| `surveySystem` | `SurveySystem` | Filter by survey system                        |
| `unit`         | `Unit`         | Resolution (e.g. `"LSD"`, `"Quarter Section"`) |

**Returns:** `SearchResult` (same shape as `search`)

---

### `client.autocomplete(query, options?)`

Get autocomplete suggestions for a partial legal land description.

```typescript
const suggestions = await client.autocomplete("NW-25-24");
for (const s of suggestions) {
  console.log(s.legalLocation); // "NW-25-24-1-W5"
  console.log(s.latitude, s.longitude);
}

// With options
const suggestions = await client.autocomplete("NW-25", {
  limit: 5,
  proximity: [-114.0, 51.0] // [longitude, latitude]
});
```

**Options:**

| Option      | Type                    | Default | Description                 |
| ----------- | ----------------------- | ------- | --------------------------- |
| `limit`     | `number`                | `3`     | Number of results (1-10)    |
| `proximity` | `[longitude, latitude]` | —       | Bias results toward a point |

**Returns:** `AutocompleteSuggestion[]`

```typescript
{
  legalLocation: string; // "NW-25-24-1-W5"
  latitude: number; // 51.077932
  longitude: number; // -114.01924
  surveySystem: SurveySystem; // "DLS"
  unit: Unit; // "Quarter Section"
}
```

---

### `client.batchSearch(locations, options?)`

Convert multiple legal land descriptions at once. Automatically handles chunking for large batches (API max: 100 per request).

```typescript
const result = await client.batchSearch([
  "NW-36-42-3-W5",
  "SE-1-50-10-W4",
  "A-2-F/93-P-8",
  "NE-12-25-1-W2"
]);

console.log(result.success); // 4
console.log(result.failed); // 0
console.log(result.results); // SearchResult[]

// Process results
for (const item of result.results) {
  console.log(`${item.legalLocation}: ${item.latitude}, ${item.longitude}`);
}
```

**Options:**

| Option      | Type     | Default | Description             |
| ----------- | -------- | ------- | ----------------------- |
| `chunkSize` | `number` | `100`   | Records per API request |

**Returns:** `BatchResult`

```typescript
{
  results: SearchResult[]  // Successfully converted items
  total: number            // Total items submitted
  success: number          // Successful conversions
  failed: number           // Failed conversions
}
```

---

### `client.batchReverse(coordinates, options?)`

Reverse geocode multiple coordinate pairs at once.

```typescript
const result = await client.batchReverse([
  [-114.654, 52.123], // [longitude, latitude]
  [-114.072, 51.045],
  [-110.456, 50.321]
]);

for (const item of result.results) {
  console.log(`${item.longitude},${item.latitude} => ${item.legalLocation}`);
}
```

**Options:**

| Option         | Type           | Default | Description             |
| -------------- | -------------- | ------- | ----------------------- |
| `chunkSize`    | `number`       | `100`   | Records per API request |
| `surveySystem` | `SurveySystem` | —       | Filter by survey system |
| `unit`         | `Unit`         | —       | Resolution unit         |

---

### `client.boundary(legalLocation)`

Get the boundary polygon for a legal land description.

```typescript
const boundary = await client.boundary("NW-36-42-3-W5");

if (boundary) {
  console.log(boundary.type); // "Polygon"
  console.log(boundary.coordinates); // [[[lng, lat], ...]]
}
```

**Returns:** `GeoJSONPolygon | GeoJSONMultiPolygon | null`

---

### `client.raw(legalLocation)`

Get the raw GeoJSON FeatureCollection from the API. Useful when you need full control over the response.

```typescript
const featureCollection = await client.raw("NW-36-42-3-W5");
console.log(featureCollection.type); // "FeatureCollection"
console.log(featureCollection.features); // LocationFeature[]
```

---

## Ag API (Agriculture Reports)

Agriculture parcel reports for DLS quarter sections: productivity (LSRS/CLI), crop rotation, soils, land use, drought, wetlands, hydrology, parcel context, and provincial detail. Inputs may be a quarter section or an LSD (resolved to its containing quarter section). Coverage: AB, SK, MB — BC (NTS) locations throw `ValidationError` with code `bc_not_supported`.

### `client.agReport(legalLocation, options?)`

Get the agriculture report for one quarter section or LSD.

```typescript
const report = await client.agReport("NW-36-42-3-W5");

console.log(report.parcel.area_ha); // 64.75
console.log(report.productivity?.lsrs?.score); // 72
console.log(report.soil?.classification?.order); // "Chernozemic"
console.log(report.cropping?.rotation); // "Canola-Wheat"
console.log(report.drought?.class); // "D1"
console.log(report.hydrology?.watercourse?.distance_m); // 240

// LSD inputs resolve to their containing quarter section
const fromLsd = await client.agReport("10-36-42-3-W5");
console.log(fromLsd.resolved_legal_location); // "NE-36-42-3-W5"
console.log(fromLsd.grain); // "lsd"

// Only the sections you need — omitted sections are never queried
const slim = await client.agReport("NW-36-42-3-W5", { include: ["soil", "drought"] });

// Attach the parcel boundary as GeoJSON under parcel.geometry
const withGeometry = await client.agReport("NW-36-42-3-W5", { include: ["geometry"] });
console.log(withGeometry.parcel.geometry?.type); // "Polygon"
```

**Options:**

| Option    | Type                 | Default       | Description                                                                                                                                                                                                              |
| --------- | -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `include` | `AgReportSection[]`  | (full report) | Section projection. Valid values: `productivity`, `cropping`, `soil`, `land_use`, `drought`, `wetlands`, `hydrology`, `parcel_context`, `provincial_detail`, `geometry`. `geometry` attaches the boundary under `parcel.geometry`. |

**Returns:** `AgReport` — sections degrade independently to `null` when a data layer is unavailable (`meta.unavailable` says which and why). `provincial_detail` carries the Saskatchewan extras (crown land, soils, pastures) or the Manitoba soil survey components, and is `null` for Alberta parcels.

---

### `client.agBatch(locations)`

Get agriculture reports for multiple locations. Automatically chunks large batches into requests of 25 (API max). Results come back in input order inside a `{results, meta}` envelope; the SDK sums the `meta` counters across chunks.

```typescript
const { results, meta } = await client.agBatch(["NW-36-42-3-W5", "10-2-24-28-W4", "not a location"]);

console.log(meta); // { total: 3, ok: 2, not_found: 0, error: 1 }

for (const item of results) {
  if (item.status === "ok") {
    console.log(item.legal_location, item.data?.parcel.area_ha);
  } else if (item.status === "not_found") {
    console.log(item.legal_location, "no agriculture coverage");
  } else {
    console.log(item.legal_location, item.error?.code); // "invalid_legal_location"
  }
}
```

**Returns:** `ReportBatchResponse<AgReport>` — `{ results, meta }` where each item is `{ legal_location, status: "ok" | "not_found" | "error", error: { code, message } | null, data }` and `meta` is `{ total, ok, not_found, error }`.

---

### `client.agAutocomplete(query, options?)`

Suggest quarter sections with agriculture coverage as you type. Every suggestion is guaranteed to return a report. Same options as `autocomplete` (sent to the API as `q` plus explicit `lat`/`lng`).

```typescript
const suggestions = await client.agAutocomplete("NW-36-42", { limit: 5 });
console.log(suggestions[0].legalLocation); // "NW-36-42-3-W5"
```

**Returns:** `AutocompleteSuggestion[]`

---

## Energy API (Energy Reports)

Per-parcel energy reports for Legal Subdivisions (LSDs): wells, pipelines, facilities, trailing-12-month production, Crown tenure, and alternative energy. Coverage: AB, SK, MB (wells + tenure only) — BC (NTS) locations throw `ValidationError` with code `bc_not_supported`.

### `client.energyReport(legalLocation, options?)`

Get the energy report for one LSD.

```typescript
const report = await client.energyReport("10-36-42-3-W5");

console.log(report.summary?.wells.total); // 4
console.log(report.summary?.wells.active); // 2
console.log(report.summary?.operators.dominant?.name); // "EXAMPLE ENERGY LTD"
console.log(report.production?.volumes.oil_m3); // 1250.5
console.log(report.tenure?.rows[0]?.expiry_state); // "expiring_soon"
console.log(report.wells?.rows[0]?.uwi); // "100103604203W500"

// Array sections are envelopes: total is the true count, `more` links to
// the unbounded collection endpoint when the report caps the rows
console.log(report.wells?.total, report.wells?.truncated); // 4, false

// Only the sections you need — omitted sections are never queried
const slim = await client.energyReport("10-36-42-3-W5", {
  include: ["summary", "production"],
});

// Attach the LSD boundary as GeoJSON under parcel.geometry
const withGeometry = await client.energyReport("10-36-42-3-W5", { include: ["geometry"] });
```

**Options:**

| Option    | Type                    | Default       | Description                                                                                                                                                                    |
| --------- | ----------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `include` | `EnergyReportSection[]` | (full report) | Section projection. Valid values: `summary`, `production`, `tenure`, `wells`, `pipelines`, `facilities`, `alternative_energy`, `geometry`. `geometry` attaches the boundary under `parcel.geometry`. |

**Returns:** `EnergyReport` — a `null` section means no data at that location or that one source degraded (`meta.unavailable` says which); the rest of the report is still trustworthy. Array sections (`tenure`, `wells`, `pipelines`, `facilities`) are `{ total, returned, truncated, more, rows }` envelopes.

---

### `client.energyBatch(locations)`

Get energy reports for multiple LSDs. Automatically chunks large batches into requests of 25 (API max). Results come back in input order inside a `{results, meta}` envelope; the SDK sums the `meta` counters across chunks.

```typescript
const { results, meta } = await client.energyBatch(["10-36-42-3-W5", "4-12-50-24-W4"]);

console.log(meta); // { total: 2, ok: 2, not_found: 0, error: 0 }

for (const item of results) {
  if (item.status === "ok") {
    console.log(item.legal_location, item.data?.summary?.wells.total);
  }
}
```

**Returns:** `ReportBatchResponse<EnergyReport>` — `{ results, meta }` where each item is `{ legal_location, status: "ok" | "not_found" | "error", error: { code, message } | null, data }` and `meta` is `{ total, ok, not_found, error }`.

---

### `client.energyAutocomplete(query, options?)`

Suggest LSDs with energy data for typeahead inputs. Every suggestion is guaranteed to return a report. Same options as `autocomplete` (sent to the API as `q` plus explicit `lat`/`lng`).

```typescript
const suggestions = await client.energyAutocomplete("10-36-42", { limit: 5 });
console.log(suggestions[0].legalLocation); // "10-36-42-3-W5"
console.log(suggestions[0].unit); // "LSD"
```

**Returns:** `AutocompleteSuggestion[]`

---

### `client.energyOperatorAutocomplete(query, options?)`

Search AER licensees by name or BA code for operator search inputs. Prefix matches rank first, then by active well count.

```typescript
const operators = await client.energyOperatorAutocomplete("cenovus");

for (const op of operators) {
  console.log(op.ba_code, op.name, op.slug, op.active_wells);
}
```

**Options:**

| Option  | Type     | Default | Description              |
| ------- | -------- | ------- | ------------------------ |
| `limit` | `number` | `10`    | Number of results (1-20) |

**Returns:** `EnergyOperator[]`

```typescript
{
  name: string; // "EXAMPLE ENERGY LTD"
  ba_code: string | null; // "0AB1"
  slug: string | null; // "example-energy-ltd" — routes to /energy/operators/{name}
  active_wells: number | null; // 1250
  abandoned_wells: number | null; // 320
  orphan_wells: number | null; // 0
}
```

---

## Migrating to v2 (Ag & Energy v1 contract)

v2.0.0 tracks the breaking v1 reshape of the Ag and Energy APIs. The parcel search/reverse/batch/autocomplete surface is unchanged.

**Request changes**

- `agReport`/`energyReport`: `{ geometry: true }` is gone — pass `{ include: ["geometry"] }`. `include` also projects reports down to just the sections you need.
- `agAutocomplete`/`energyAutocomplete` now call the API with `q` and explicit `lat`/`lng` (previously `location` and `proximity`). The SDK options are unchanged (`limit`, `proximity: [lng, lat]`).

**Response changes**

- `agBatch`/`energyBatch` return `{ results, meta }` instead of a bare array; each item's `error` is now `{ code, message } | null` (always present, previously an optional string).
- `AgReport`: `qs_legal_location` → `resolved_legal_location` (always present) plus new `grain`; root `area_ha` → `parcel.area_ha` (plus `parcel.centroid`/`parcel.geometry`); `productivity` is nested `{lsrs: {score, class, limiter}, cli: {...}}`; `cropping.dominant_crop*` → `cropping.dominant {code, name, category}` and `rotation_pattern` → `rotation`; `soil.group`/`soil.subgroup` → `soil.classification {order, great_group, subgroup_code}`; `land_use` is `{dominant {code, label, ipcc_class}, breakdown}` with string codes; `drought` is `{class, severity_label, as_of: "YYYY-MM"}`; new `hydrology` section; `sk`/`mb` → `provincial_detail`; new `units` and `meta` blocks.
- `EnergyReport`: `activity` → `summary` (`{wells: {total, active, by_source, ...}, pipelines, facilities, operators: {dominant}}`); `production` is `{window_months, volumes: {oil_m3, gas_e3m3, condensate_m3, water_m3}, dominant_product, producing_well_count, ...}` (lowercase enums); the array sections are `{total, returned, truncated, more, rows}` envelopes; tenure rows are the uniform shape with signed `days_to_expiry` and `expiry_state` (replacing `is_expiring_soon`/`is_perpetual`); companies are `{name, ba_code, slug}` objects (`operator`, `holder`, `licensee`); pipeline rows rename `mop_kpa` → `max_operating_pressure_kpa` and `total_length_km` → `segment_length_km`; points are `{lat, lng}` under `location`/`overlap_point`/`centroid`; new `parcel`, `units`, and `meta` blocks. Provinces are uppercase (`"AB"`).
- `energyOperatorAutocomplete` rows gain `slug`; the raw response envelope is `{rows, meta}` (previously `{operators}`).
- Errors: the APIs return `{"error": {"code", "message"}}`; SDK errors now expose `error.code` (e.g. `invalid_legal_location`, `bc_not_supported`, `rate_limit_exceeded`).

---

## Error Handling

The SDK throws typed errors that you can catch and handle:

```typescript
import {
  TownshipClient,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  PayloadTooLargeError,
  TownshipError
} from "townshipcanada";

try {
  const result = await client.search("INVALID");
} catch (error) {
  if (error instanceof AuthenticationError) {
    // 401 — invalid or missing API key
  } else if (error instanceof NotFoundError) {
    // 404 — location not found
  } else if (error instanceof RateLimitError) {
    // 429 — too many requests
  } else if (error instanceof ValidationError) {
    // 400 — malformed request
  } else if (error instanceof PayloadTooLargeError) {
    // 413 — batch exceeds 100 records
  } else if (error instanceof TownshipError) {
    // Other API errors
    console.error(error.message, error.statusCode);
  }
}
```

## TypeScript Support

Full type definitions are included and exported. All types are available for import:

```typescript
import type {
  SearchResult,
  BatchResult,
  AutocompleteSuggestion,
  SurveySystem,
  Unit,
  GeoJSONPolygon,
  LocationFeature
} from "townshipcanada";
```

## Supported Survey Systems

| System                                | Provinces  | Format Examples                  |
| ------------------------------------- | ---------- | -------------------------------- |
| **DLS** (Dominion Land Survey)        | AB, SK, MB | `NW-36-42-3-W5`, `10-36-42-3-W5` |
| **NTS** (National Topographic System) | BC         | `A-2-F/93-P-8`, `2-F/93-P-8`     |
| **GTS** (Geographic Townships)        | ON         | `Lot 2 Con 4 Osprey`             |

## Requirements

- Node.js 18+ (uses native `fetch`)
- Works in browsers, Deno, Bun, Cloudflare Workers, and any environment with `fetch`

## License

MIT - Maps & Apps Inc.

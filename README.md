# townshipcanada

Official TypeScript SDK for the [Township Canada API](https://townshipcanada.com/api) — convert Canadian legal land descriptions (DLS, NTS, Geographic Townships) to GPS coordinates and back.

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
const client = new TownshipClient({ apiKey: process.env.TOWNSHIP_API_KEY! });
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

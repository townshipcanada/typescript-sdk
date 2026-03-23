# Township Canada TypeScript SDK

Official TypeScript SDK for the Township Canada API — converts Canadian legal land descriptions (DLS, NTS, Geographic Townships) to GPS coordinates and back.

## Commands

- `npm run build` — build with tsup (dual CJS/ESM output to dist/)
- `npm test` — run tests with vitest
- `npm run typecheck` — type-check with tsc --noEmit

## Architecture

- `src/client.ts` — TownshipClient class (main API surface)
- `src/types.ts` — all TypeScript types and interfaces
- `src/errors.ts` — custom error classes (TownshipError, AuthenticationError, etc.)
- `src/index.ts` — public exports

## Conventions

- Zero runtime dependencies — only devDependencies (tsup, typescript, vitest)
- Dual ESM/CJS output via tsup
- Node >=18 required
- Tests live in `src/__tests__/`

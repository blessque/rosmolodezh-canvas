# Code Style

## Naming

- **Files:** `PascalCase.tsx` for React components, `camelCase.ts` for modules
- **Components:** PascalCase named exports (no default exports except `App.tsx`)
- **Store actions:** camelCase verbs — `setMode`, `addStampStroke`, `pushHistory`
- **Engine functions:** camelCase, descriptive — `generateCompoundShape`, `computeStampPositions`

## File size limit

- Max ~150 lines per file. If a file grows beyond this, split into focused sub-modules.

## Import rules

- Use `@/` path alias for all src imports (e.g. `import { uid } from '@/utils/uid'`)
- Never use relative `../../` imports
- No barrel `index.ts` files — import directly from the source file

## React patterns

- Prefer `useCallback` for event handlers passed to canvas
- Read store values via selectors: `useUIStore((s) => s.mode)` — never read the whole store
- Use `useRef` + `useEffect` for imperative canvas rendering — no state for pixel data
- `console.log` stubs are acceptable for placeholder logic (will be removed when implemented)

## TypeScript

- Strict mode is ON — no `any`, no `@ts-ignore`
- Prefer `interface` over `type` for object shapes
- Use discriminated unions (`type: 'compound' | 'stamp'`) for `SceneObject`

## Tailwind

- Utility classes only — no `@apply`, no custom CSS files beyond `index.css`
- Dark-on-dark palette: background `#111112`, surface `#202226`, active `#33373f`
- Accent: white (`text-white`, `bg-white` for primary buttons); no blue/red accents

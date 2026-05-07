# Module Dependency Rules

## Allowed import directions

```
engine/    → imports ONLY from: types/, utils/
canvas/    → imports from: engine/, types/, utils/, store/
modes/     → imports from: store/, types/, utils/, engine/, canvas/
store/     → imports from: types/ ONLY
export/    → imports from: types/, store/, canvas/
utils/     → imports from: types/ ONLY
types/     → imports NOTHING
components/→ imports from: store/, types/ ONLY
```

## Critical constraints

- `engine/` **never** imports from store/, canvas/, modes/, or components/
- `store/` **never** imports from engine/, canvas/, modes/, or components/
- `types/` is a pure contract layer — no runtime code, no imports

## Rationale

This boundary ensures the engine can be tested independently, and store
mutations are never triggered by rendering code.

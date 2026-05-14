# Generator Engine Tuning Log

**Read this before ANY generator engine work.**
This is the living memory of everything tried, tested, liked, disliked, and decided.

---

## Non-Negotiable Requirements

These are stated explicitly by the user. Never compromise them.

1. **Maximum efficient canvas coverage** — shapes must fill ~95–98% of the canvas. Target margins ~2%.
   No shape should leave 300px blank on either side.

2. **flat topStyle = truly flat in screen space** — `tlo=tro=0` AND `rotation=0` for that rect.
   A flat rect rotated 5° is NOT flat. The user will notice immediately.

3. **Rects in one shape = "brothers and sisters"** — same family of distortion angles.
   Use a shared `baseMag` per compound shape with ±12% per-rect variation max.

4. **Bottom corners should be expressive, especially bottom-right** — brand identity.
   ~38% pushed down, ~27% raised up, ~35% flat. BL has smaller independent variation.

5. **3 rects for wide and portrait canvases** — 2 rects is too sparse for non-square.

6. **`relation` dimension: 'same' vs 'opposite'** — same = all rects share lean direction,
   opposite = alternating lean-right ↔ lean-left per rect.

---

## Algorithm Decisions

### Coverage guarantee (critical)
**Problem:** Naive approach — pick `w0=rand(0.32–0.44)`, cascade with `sr^n` — only covers ~50%
of canvas before scale-to-fit. Scale-to-fit then gets constrained by the OTHER axis, leaving huge margins.

**Solution:** Invert the equation. Given target span `T` and absolute overlap `O`:
```
w0 = (T + 2·O) / (1 + sr + sr·sr2)
```
Then: `x1 = w0 - O`, `x2 = x1 + w1 - O`, `x2 + w2 = T`. Exact coverage.
Same principle applies to Y-cascade (h instead of w).
Do NOT go back to fractional/random sizing without this guarantee.

### Y-cascade (portrait, portrait-4-5, square — 3 rects)
- Rects stack top-to-bottom
- Absolute overlap `yOvlpAbs = rand(0.07, 0.13) * docHeight`
- `h0` solved adaptively, clamped to [0.28, 0.55] * docHeight
- Widths moderate: rand(0.52–0.78, 0.50–0.76, 0.48–0.74) * docWidth
- X-stagger per rect: rand(0.04, 0.16) * docWidth, same direction

### X-cascade (wide — 3 rects)
- Rects spread left-to-right
- Absolute overlap `xOvlpAbs = rand(0.07, 0.13) * docWidth`
- `w0` solved adaptively, clamped to [0.28, 0.58] * docWidth
- Heights moderate: rand(0.44–0.70, 0.42–0.68, 0.40–0.65) * docHeight
- Y-stagger: rand(0.06, 0.15) * docHeight per step, same direction

### 2-rect layout
- `overlapFrac = rand(0.50, 0.72)` — higher = more spread (rect[1] starts later into rect[0])
- `h0 = rand(0.42, 0.62) * docHeight`

### Stagger direction (v4.3)
- lean-right: staggerRight=false → rect[1] lower-left → rect[0]'s right edge exposed
- lean-left:  staggerRight=true  → rect[1] lower-right → rect[0]'s left edge exposed
- right-anchor: staggerRight=false (same as lean-right)
- both-deep: random 50/50
Applies to 2-rect layout and Y-cascade. X-cascade uses staggerDown (unchanged).

### applyTopOffset
- `baseMag = rand(0.22, 0.38)` per shape (shared)
- Per-rect: `mag = baseMag * rand(0.88, 1.12)`
- lean-right: `tlo=0, tro=-mag*h`
- lean-left: `tlo=-mag*h, tro=0`
- both-deep: `tlo=-mag*rand(0.88,1.12)*h, tro=-mag*h`
- flat: `tlo=0, tro=0` (non-negotiable)

### applyBottomOffset
- 38% chance BR pushed down: `rand(0.10, 0.28) * h`
- 27% chance BR raised up: `-rand(0.06, 0.18) * h`
- 35% chance BR flat: `0`
- BL: 45% chance `rand(0.04, 0.14)*h`, else 0

### Rotation
- `flat` topStyle → `rotation = 0` always, for that rect only
- `angled` → `rand(-8, 8)` degrees
- rect[2] in 3-rect layouts always gets random rotation unless its topStyle is flat

---

## Canvas Sizes & Defaults

| Key | Dimensions | Default rectCount |
|-----|-----------|-------------------|
| square | 1080×1080 | 2 |
| wide | 1920×1080 | 3 |
| portrait | 1080×1920 | 3 |
| portrait-4-5 | 1080×1350 | 40% → 3, 60% → 2 |

---

## PerspectiveRect Contract (current)

```ts
{
  id, x, y, w, h, cornerRadius,
  topLeftOffset, topRightOffset,       // top: negative = raised
  bottomRightOffset, bottomLeftOffset, // bottom: positive = pushed down
  rotation,   // 0 when topStyle='flat'
  topStyle,   // 'angled' | 'flat'
}
```
`cornerRadius` is NOT scaled in the scale-to-fit pass (canvas-relative). Everything else is.

---

## Gallery Structure (500 shapes)

- **96 systematic sweep**: 3 modes × 4 canvases × 2 sizeRatios × 2 topStyle combos × 2 relations
  - sizeRatios: [0.65, 0.82]
  - topStyle combos: [angled+angled, flat+flat]
  - relations: [same, opposite]
- **404 random fill**: square 40, wide 128, portrait 128, portrait-4-5 108
- topStyle probability: 40% flat, 60% angled

---

## Rating Session History

### Session 1–2 (v1–v2)
No detailed records. v2 introduced per-rect rotation and sizeRatio.

### Session 3 (v3 → feedback)
- 31 liked / 11 disliked
- Confirmed: v3 data structure works, 2 rects too sparse on wide/portrait
- Requested: 3 rects, fix flat, add relation, add 4:5 canvas

### Session 4 (v4.0 → immediately identified issues before rating)
User spotted 4 problems without starting a session:
1. flat tops still look angled → rotation wasn't zeroed
2. wide canvas ~300px blank margins → coverage algorithm broken
3. Bottom corners all flat and boring → no bottomRightOffset
4. Rects feel unrelated in distortion magnitude → no shared baseMag

All 4 fixed in v4.1.

### Session 6 (v4.2 — shape-ratings (3).json)
- Many angled shapes (depthMag > 0) looked rectangular despite distortion
- Root cause: stagger direction was OPPOSITE to lean direction
  lean-right + staggerRight=true → rect[1] lower-right → covers rect[0]'s BR corner
  → distorted corner inside boolean union → invisible on compound outline
- Fix (v4.3): one-line change in generateCompoundShape — staggerRight direction
  reversed for lean-right and right-anchor

### Session 5 (v4.1 → v4.2)
- User confirmed "I see improvements"
- Issues found (visual inspection, no rating session yet):
  1. Portrait (9:16) had giant left/right holes — Y-cascade widths were 0.52–0.78×docW.
     When height-constrained scale is applied, narrow rects don't fill horizontal space.
     Fix: widths raised to 0.72–0.92×docW.
  2. "Sticks" — rects with drastic aspect ratio (>1:2). Fix: clampAspect(w, h, 1.75) on every rect.
  3. Tiny stagger shifts (<cornerRadius) looked ugly. Fix: stagger = max(2×cornerRadius, rand_amount).
  4. New shape style requested: top+left orthogonal, only BR skewed.
     Implemented as new DistortionMode 'right-anchor':
     tlo=tro=blo=rotation=0, bro=rand(0.20,0.48)×h.
     Has no logical "opposite" — always forces relation='same' to avoid misleading export data.

---

## Correlations to Watch

- **depthMag vs liked rate**: Higher depthMag (deeper lean) historically liked more than subtle ones
- **relation=opposite**: May look chaotic for both-deep mode; seems to work best for lean-right/left
- **sizeRatio < 0.65**: Rects too similar in size → visually boring; < 0.60 rare in liked set
- **flat+flat combo**: Need to verify it's distinct enough — should show no raised corners at all
- **overlapAreaPct**: Very low (< 0.1) suggests shapes barely touch → compound union looks like two separate shapes

---

## DistortionMode Reference (current, v4.2)

| Mode | tlo | tro | blo | bro | rotation |
|------|-----|-----|-----|-----|----------|
| lean-right | 0 | −mag×h | free | free | rand(−8,8) unless flat |
| lean-left | −mag×h | 0 | free | free | rand(−8,8) unless flat |
| both-deep | −mag×h | −mag×h | free | free | rand(−8,8) unless flat |
| right-anchor | 0 | 0 | 0 | +rand(0.20–0.48)×h | always 0 |

`right-anchor` has no logical "opposite" — getModeForRect always returns right-anchor.

## Gallery Structure (500 shapes, v4.2)

- **Sweep A (96)**: lean-right/left/both-deep × 4 canvases × 2 sizeRatios × 2 topStyles × 2 relations
- **Sweep B (16)**: right-anchor × 4 canvases × 2 sizeRatios × 2 relations
- **Random fill (388)**: square 36, wide 118, portrait 118, portrait-4-5 116
  - Mode: 25% each (all 4 modes)
  - topStyle: 40% flat, 60% angled

## v4.3 Patch — GeneratorPanel canvasAspect fix

**Bug:** `GeneratorPanel.tsx` called `generateCompoundShape(w, h)` without the 4th `canvasAspect`
argument. `defaultRectCount(undefined)` always returned 2, so the main canvas Regenerate button
never produced 3-rect shapes regardless of canvas size.

**Fix:** Derive `canvasAspect` from the viewport ratio before calling `generateCompoundShape`:
```ts
const ratio = w / h;
const canvasAspect: CanvasAspect =
  ratio >= 1.5   ? 'wide'
  : ratio <= 0.60 ? 'portrait'
  : ratio <= 0.85 ? 'portrait-4-5'
  : 'square';
```

**Threshold rationale:**
| Canvas | ratio | → CanvasAspect |
|--------|-------|----------------|
| 16:9 wide (1920×1080) | 1.778 | 'wide' |
| 9:16 portrait (1080×1920) | 0.563 | 'portrait' |
| 4:5 portrait (1080×1350) | 0.800 | 'portrait-4-5' |
| 3:4 portrait (1080×1440) | 0.750 | 'portrait-4-5' (closest) |
| 1:1 square (1080×1080) | 1.000 | 'square' |

`GalleryView` was already correct — it passes the canvas key explicitly. Only `GeneratorPanel`
was affected.

---

## Things to NEVER Do Again

- `flat` topStyle with non-zero rotation (looks angled in screen space, user will reject)
- Picking `w0` from a fixed small range and cascading with sr^n (breaks coverage)
- Independent per-rect magnitude rand(0.20–0.40) (makes shape feel incoherent)
- Using narrow rects (< 0.70×docW) for portrait Y-cascade — causes left/right holes
- Y-cascade stagger without minStagger = 2×cornerRadius — creates near-coincident ugly edges
- Aspect ratio > 1.75:1 on individual rects — "sticks" are immediately noticeable and rejected
- Adding `Co-Authored-By: Claude` to git commits (per CLAUDE.md)
- Installing new dependencies without user approval (per CLAUDE.md)
- Stagger rect[n+1] TOWARD the distorted edge of rect[n]
  (buries the distorted corner inside the boolean union)
  Rule: lean-right → staggerLeft, lean-left → staggerRight, right-anchor → staggerLeft
- Calling `generateCompoundShape(w, h)` without `canvasAspect` — `defaultRectCount(undefined)`
  always returns 2, breaking 3-rect layouts on wide/portrait canvases

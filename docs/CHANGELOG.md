# Changelog

| Iteration | Date | Summary |
|-----------|------|---------|
| 0 | 2026-05-07 | Bootstrap: project scaffold, two-mode shell, stores, stub modes, export stubs, .claude/ setup |
| 1–3 | 2026-05-07/08 | Generator mode: GeneratorEngine (Y/X-cascade, adaptive sizing, shared baseMag, flat/angled topStyle), GalleryView (500-shape rating gallery), GeneratorPanel UI, sceneStore/uiStore wiring |
| 4 | 2026-05-08 | Vector inner-corner rounding: replaced gooey pixel-threshold renderer with Paper.js→Path2D pipeline; added `roundConcaveJunctions` (bezier fillet at concave unite() vertices); fixed asymmetric fillet radii (pullback clamp changed from `min(r*1.52, inLen/2, outLen/2)` to `min(r*1.52, (inLen+outLen)/2)`). Remaining visual bugs to fix next session. |
| 5 | 2026-05-10 | Light theme + ColorSlot: full UI flip dark→light (`#F0F2F7` bg, white cards, `#0e0f11` primary). New `ColorSlot` component — native color picker + hex input + 5-slot history swatches; shape slot pre-seeded with `#FE443B`. Default colors: `shapeColor #99ECFF`, `canvasColor #FFFFFF`. Gallery thumbnails render in live `shapeColor` on white bg via `useUIStore.getState()`. Canvas preset defaults to 4:5 (1080×1350); added A3 portrait (1240×1754) and A3 landscape/album (1754×1240); 1:1 moved to end of list. |

# Changelog

| Iteration | Date | Summary |
|-----------|------|---------|
| 0 | 2026-05-07 | Bootstrap: project scaffold, two-mode shell, stores, stub modes, export stubs, .claude/ setup |
| 1–3 | 2026-05-07/08 | Generator mode: GeneratorEngine (Y/X-cascade, adaptive sizing, shared baseMag, flat/angled topStyle), GalleryView (500-shape rating gallery), GeneratorPanel UI, sceneStore/uiStore wiring |
| 4 | 2026-05-08 | Vector inner-corner rounding: replaced gooey pixel-threshold renderer with Paper.js→Path2D pipeline; added `roundConcaveJunctions` (bezier fillet at concave unite() vertices); fixed asymmetric fillet radii (pullback clamp changed from `min(r*1.52, inLen/2, outLen/2)` to `min(r*1.52, (inLen+outLen)/2)`). Remaining visual bugs to fix next session. |

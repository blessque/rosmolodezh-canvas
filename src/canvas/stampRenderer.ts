/**
 * stampRenderer — shared helper for drawing a single stamp instance.
 * Used by StampCanvas (live view) and exportPNG (export).
 */

// ─── Image cache ──────────────────────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

/**
 * Preload an image URL into the module-level cache so drawStampInstance
 * can use it synchronously during canvas render.
 */
export function preloadStampImage(url: string): Promise<void> {
  if (imageCache.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(); };
    img.onerror = () => resolve(); // fail silently; fallback to shape fill
    img.src = url;
  });
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

/**
 * Draw one rounded-square stamp centered at (docX, docY) in document space.
 *
 * @param ctx           Canvas 2D rendering context
 * @param docX          Center X in document units
 * @param docY          Center Y in document units
 * @param docSize       Side length of the stamp in document units
 * @param angleDeg      Rotation angle in degrees
 * @param scale         doc→screen scale factor (1 for export identity transform)
 * @param offsetX       Screen-space X offset (0 for export)
 * @param offsetY       Screen-space Y offset (0 for export)
 * @param color         CSS fill color string (used when no image loaded)
 * @param rotate45      Whether to add an extra 45° rotation (diamond mode)
 * @param stampImageUrl Optional data-URL; when set, clips image to shape instead of filling
 */
export function drawStampInstance(
  ctx: CanvasRenderingContext2D,
  docX: number,
  docY: number,
  docSize: number,
  angleDeg: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  color: string,
  rotate45: boolean,
  stampImageUrl: string | null,
): void {
  const screenX = docX * scale + offsetX;
  const screenY = docY * scale + offsetY;
  const side = docSize * scale;
  const half = side / 2;
  const r = side * 0.15; // cornerRadius = 15% of side

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(((angleDeg + (rotate45 ? 45 : 0)) * Math.PI) / 180);

  // Rounded square centered at (0, 0)
  const path = new Path2D();
  path.moveTo(-half + r, -half);
  path.lineTo(half - r, -half);
  path.arcTo(half, -half, half, -half + r, r);
  path.lineTo(half, half - r);
  path.arcTo(half, half, half - r, half, r);
  path.lineTo(-half + r, half);
  path.arcTo(-half, half, -half, half - r, r);
  path.lineTo(-half, -half + r);
  path.arcTo(-half, -half, -half + r, -half, r);
  path.closePath();

  const img = stampImageUrl ? (imageCache.get(stampImageUrl) ?? null) : null;
  if (img) {
    ctx.save();
    ctx.clip(path);
    // Contain fit: scale longest dimension to `side`, preserve aspect ratio, center
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number;
    if (imgAspect >= 1) {
      drawW = side;
      drawH = side / imgAspect;
    } else {
      drawW = side * imgAspect;
      drawH = side;
    }
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = color;
    ctx.fill(path);
  }

  ctx.restore();
}

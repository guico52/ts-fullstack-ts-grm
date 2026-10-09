/**
 * Dragging rules as plain functions.
 *
 * Two things here are easy to get wrong and only visible once a dialog is
 * halfway off the screen: an axis that stops responding because the *other*
 * axis hit an edge, and a dialog dragged so far that the only part you could
 * grab is gone.
 */

export interface DragOffset {
  x: number
  y: number
}

/** A box's position and size in viewport coordinates. */
export interface DragRect {
  x: number
  y: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

/**
 * Clamp a drag offset so `margin` px of the box always stays inside the
 * viewport on every side.
 *
 * The axes are independent: reaching the bottom edge must not stop
 * horizontal movement. A box larger than the viewport is pinned to its
 * leading margin rather than made immovable.
 *
 * `origin` is the box's rect with **no** drag applied. The caller measures
 * it once per gesture, so repeated calls cannot compound.
 */
export function clampDragOffset(
  offset: DragOffset,
  origin: DragRect,
  viewport: Viewport,
  margin = 8,
): DragOffset {
  return {
    x: clampAxis(offset.x, origin.x, origin.width, viewport.width, margin),
    y: clampAxis(offset.y, origin.y, origin.height, viewport.height, margin),
  }
}

function clampAxis(
  offset: number,
  start: number,
  size: number,
  extent: number,
  margin: number,
): number {
  const min = margin - start
  const max = extent - margin - size - start
  // Box wider than the viewport: `max` would sit left of `min`, which would
  // make the box jump backwards. Pin the leading edge instead.
  if (max < min) return min
  return Math.min(Math.max(offset, min), max)
}

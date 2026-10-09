import { describe, expect, it } from "vitest"

import { clampDragOffset, type DragOffset, type DragRect } from "./drag"

/** A 400x300 dialog centred in a 1000x800 viewport. */
const CENTRED: DragRect = { x: 300, y: 250, width: 400, height: 300 }
const VIEWPORT = { width: 1000, height: 800 }
const MARGIN = 8

const clamp = (offset: DragOffset) => clampDragOffset(offset, CENTRED, VIEWPORT, MARGIN)

describe("clampDragOffset", () => {
  it("leaves an offset that stays inside the viewport alone", () => {
    expect(clamp({ x: 120, y: -80 })).toEqual({ x: 120, y: -80 })
  })

  it("stops the left edge at the margin", () => {
    // The box starts at x=300, so any offset below -(300 - 8) would push it
    // past the left margin.
    expect(clamp({ x: -1000, y: 0 })).toEqual({ x: -(300 - MARGIN), y: 0 })
  })

  it("stops the right edge at the margin", () => {
    // Room to the right is 1000 - 8 - 400 - 300.
    expect(clamp({ x: 1000, y: 0 })).toEqual({ x: 1000 - MARGIN - 400 - 300, y: 0 })
  })

  it("clamps each axis on its own", () => {
    // Vertical is exhausted, horizontal is not: the x part must survive.
    const result = clamp({ x: 100, y: 1000 })
    expect(result.x).toBe(100)
    expect(result.y).toBe(800 - MARGIN - 300 - 250)
  })

  it("pins a box taller and wider than the viewport to its leading margin", () => {
    const huge: DragRect = { x: -50, y: -50, width: 1200, height: 900 }
    // Both ends of the allowed range collapse onto the margin, so the box is
    // pulled back on screen and then simply stays put — rather than locking
    // up the way a naive `left >= min && left + width < viewport` check does.
    expect(clampDragOffset({ x: -200, y: -200 }, huge, VIEWPORT, MARGIN)).toEqual({
      x: MARGIN + 50,
      y: MARGIN + 50,
    })
    expect(clampDragOffset({ x: 0, y: 0 }, huge, VIEWPORT, MARGIN)).toEqual({
      x: MARGIN + 50,
      y: MARGIN + 50,
    })
  })

  it("honours a custom margin", () => {
    expect(clampDragOffset({ x: -1000, y: 0 }, CENTRED, VIEWPORT, 48).x).toBe(-(300 - 48))
  })
})

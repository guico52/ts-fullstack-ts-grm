/**
 * Drag-to-move for a centred dialog.
 *
 * The offset is expressed as the two CSS variables Tailwind v4's
 * `translate-x` / `translate-y` utilities read, **not** as a `transform`.
 * Tailwind v4 compiles `translate-x-[-50%]` to the standalone `translate`
 * property backed by `--tw-translate-x/y`, so overriding those two variables
 * moves the box without touching the enter/exit animation — that one uses
 * `scale` and `opacity`, and an inline `transform` would have clobbered it.
 *
 * The gesture listens on the panel itself (the caller puts `handlers` on it),
 * so `event.currentTarget` is the element to measure and move. No template
 * ref is involved: a ref on a component is the component instance, not its
 * DOM node, and this file should not have to care which is which.
 */
import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from "vue"

import { clampDragOffset, type DragOffset, type DragRect } from "@/lib/drag"

const MARGIN = 8

/** Only this element starts a drag; everywhere else on the panel is content. */
export const DRAG_HANDLE_SELECTOR = '[data-slot="dialog-header"]'

export interface DraggableDialog {
  dragging: Ref<boolean>
  /** Bound to the panel's `style`. */
  style: ComputedRef<Record<string, string>>
  /** Bound to the panel with `v-on`. */
  handlers: {
    pointerdown: (event: PointerEvent) => void
    pointermove: (event: PointerEvent) => void
    pointerup: (event: PointerEvent) => void
    pointercancel: (event: PointerEvent) => void
  }
}

export function useDraggableDialog(enabled: () => boolean): DraggableDialog {
  const offset = ref<DragOffset>({ x: 0, y: 0 })
  const dragging = ref(false)

  /** The panel this gesture belongs to, captured on pointerdown. */
  let panel: HTMLElement | null = null
  /** The panel's rect with no drag applied; measured once per gesture. */
  let origin: DragRect = { x: 0, y: 0, width: 0, height: 0 }
  let pointerStart: DragOffset = { x: 0, y: 0 }
  let offsetStart: DragOffset = { x: 0, y: 0 }

  /** The live offset during a gesture; `offset` is the settled value. */
  let current: DragOffset = { x: 0, y: 0 }

  const style = computed<Record<string, string>>(() => ({
    "--tw-translate-x": `calc(-50% + ${offset.value.x}px)`,
    "--tw-translate-y": `calc(-50% + ${offset.value.y}px)`,
  }))

  function viewport() {
    return { width: window.innerWidth, height: window.innerHeight }
  }

  function measure(): void {
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    origin = {
      x: rect.x - offset.value.x,
      y: rect.y - offset.value.y,
      width: rect.width,
      height: rect.height,
    }
  }

  /**
   * Written straight to the DOM during a gesture.
   *
   * Going through the reactive `offset` would re-render the whole dialog on
   * every `pointermove` — and, worse, the 200ms `transition: all` on the
   * panel would smooth each step, so the box trails the pointer instead of
   * following it. The ref is synced once on release, where a render costs
   * nothing and keeps Vue's `:style` in step with the DOM.
   */
  function paint(next: DragOffset): void {
    if (!panel) return
    panel.style.setProperty("--tw-translate-x", `calc(-50% + ${next.x}px)`)
    panel.style.setProperty("--tw-translate-y", `calc(-50% + ${next.y}px)`)
  }

  function onPointerDown(event: PointerEvent): void {
    if (!enabled() || event.button !== 0) return

    const target = event.target as HTMLElement | null
    if (!target?.closest(DRAG_HANDLE_SELECTOR)) return
    // A control inside the handle keeps its own click.
    if (target.closest("[data-drag-ignore]")) return

    panel = event.currentTarget as HTMLElement
    measure()
    current = { ...offset.value }
    dragging.value = true
    // Turns off the panel's transition for the duration of the gesture, so
    // the box tracks the pointer rather than easing towards it.
    panel.dataset.dragging = ""
    pointerStart = { x: event.clientX, y: event.clientY }
    offsetStart = { ...offset.value }
    // Capture keeps the gesture alive when the pointer leaves the panel —
    // and out of the window entirely.
    panel.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging.value) return
    current = clampDragOffset(
      {
        x: offsetStart.x + (event.clientX - pointerStart.x),
        y: offsetStart.y + (event.clientY - pointerStart.y),
      },
      origin,
      viewport(),
      MARGIN,
    )
    paint(current)
  }

  function onPointerUp(event: PointerEvent): void {
    if (!dragging.value) return
    dragging.value = false
    delete panel?.dataset.dragging
    if (panel?.hasPointerCapture(event.pointerId)) panel.releasePointerCapture(event.pointerId)
    // One render, at rest: the DOM already shows this value, so nothing moves.
    offset.value = current
  }

  function onWindowResize(): void {
    if (offset.value.x === 0 && offset.value.y === 0) return
    measure()
    offset.value = clampDragOffset(offset.value, origin, viewport(), MARGIN)
  }

  // `window` is touched in a lifecycle hook, never in setup: the design-system
  // guards server-render every component, and setup runs there too.
  onMounted(() => window.addEventListener("resize", onWindowResize))
  onBeforeUnmount(() => window.removeEventListener("resize", onWindowResize))

  return { dragging, style, handlers: { pointerdown: onPointerDown, pointermove: onPointerMove, pointerup: onPointerUp, pointercancel: onPointerUp } }
}

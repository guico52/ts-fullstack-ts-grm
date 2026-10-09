import { computed, ref, watch } from "vue"
import { defineStore } from "pinia"

import { type Accent, accentAttribute, parseAccent } from "@/lib/accent"
import { readStorage, writeStorage } from "@/lib/storage"
import { type ResolvedTheme, type Theme, parseTheme, resolveTheme } from "@/lib/theme"

const THEME_KEY = "vat-theme"
const ACCENT_KEY = "vat-accent"

function prefersDark(): boolean {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

export const useThemeStore = defineStore("theme", () => {
  const theme = ref<Theme>(parseTheme(readStorage(THEME_KEY)))
  const accent = ref<Accent>(parseAccent(readStorage(ACCENT_KEY)))

  /**
   * The OS preference as reactive state, not as a function call.
   *
   * `computed(() => resolveTheme(theme.value, prefersDark()))` reads as
   * correct and is not: `computed` re-evaluates only when a **reactive**
   * dependency changes, and `matchMedia` is not one. The value was captured
   * once per re-evaluation of `theme`, so flipping the OS theme left the
   * app on the old one. The listener below is what makes it a dependency.
   */
  const systemPrefersDark = ref(prefersDark())

  const resolvedTheme = computed<ResolvedTheme>(() =>
    resolveTheme(theme.value, systemPrefersDark.value),
  )

  /**
   * Writes the resolved theme and accent onto <html>.
   *
   * Driven by a watcher rather than called from each setter: there are now
   * three ways the resolved theme can change (the stored preference, the
   * accent, the OS), and a setter that forgets to call this is a silent
   * bug. One place that reacts to all of them cannot be forgotten.
   */
  function apply() {
    const root = globalThis.document?.documentElement
    if (!root) return

    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme.value)

    const attribute = accentAttribute(accent.value)
    if (attribute === null) root.removeAttribute("data-accent")
    else root.setAttribute("data-accent", attribute)
  }

  watch([resolvedTheme, accent], apply, { immediate: true })

  function setTheme(next: Theme) {
    theme.value = next
    writeStorage(THEME_KEY, next)
  }

  function setAccent(next: Accent) {
    accent.value = next
    writeStorage(ACCENT_KEY, next)
  }

  /** Boot hook: follows the OS while the preference is "system". */
  function init() {
    const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)")
    if (!query) return
    query.addEventListener("change", (event) => {
      systemPrefersDark.value = event.matches
    })
  }

  return { theme, accent, resolvedTheme, systemPrefersDark, setTheme, setAccent, init }
})

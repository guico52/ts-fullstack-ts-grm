/**
 * The view components this app can route to.
 *
 * `import.meta.glob` is expanded by Vite at build time, so the catalogue is
 * generated from the files on disk and cannot drift from them — a view that
 * exists is listable, and one that was deleted disappears on its own.
 *
 * The three facts a view row needs all come from the module path:
 *
 * - `componentName` — the file name, PascalCase, e.g. `OrganizationsView`
 * - `componentPath` — the file, repo-relative, e.g. `views/OrganizationsView.vue`
 * - `route`         — the file name in kebab-case, e.g. `/organizations-view`
 */

const modules = import.meta.glob("/src/views/**/*.vue")

export interface ViewComponent {
  /** PascalCase file name without the extension, e.g. `OrganizationsView`. */
  name: string
  /** Repo-relative path, e.g. `views/OrganizationsView.vue`. */
  path: string
  /** Route derived from the name, e.g. `/organizations-view`. */
  route: string
}

/**
 * PascalCase → kebab-case.
 *
 * Two replacements, not one: the acronym rule has to run first so `HTTPServer`
 * splits into `HTTP-Server` before the ordinary lower→upper boundary rule
 * would have produced `H-TTPServer`.
 */
export function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
}

/** Derive a catalogue entry from a module path like `/src/views/Foo/Bar.vue`. */
export function describeComponent(modulePath: string): ViewComponent {
  const path = modulePath.replace(/^\//, "").replace(/^src\//, "")
  const file = path.split("/").pop() ?? ""
  const name = file.replace(/\.vue$/, "")
  return { name, path, route: `/${toKebabCase(name)}` }
}

export const VIEW_COMPONENTS: readonly ViewComponent[] = Object.keys(modules)
  .map(describeComponent)
  .sort((a, b) => a.path.localeCompare(b.path))

/**
 * Search the catalogue.
 *
 * Ranks a prefix hit above a hit in the middle, and a hit in the *name*
 * above one in the path — typing `users` should offer `UsersView` before
 * `views/users/Detail.vue`. An empty query returns everything, so the picker
 * opens as a browsable list rather than blank.
 */
export function matchComponents(
  query: string,
  components: readonly ViewComponent[] = VIEW_COMPONENTS,
): ViewComponent[] {
  const needle = query.trim().toLowerCase()
  if (needle === "") return [...components]

  return components
    .map((component) => ({ component, score: rank(component, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.component.path.localeCompare(b.component.path))
    .map((entry) => entry.component)
}

function rank(component: ViewComponent, needle: string): number {
  const name = component.name.toLowerCase()
  const path = component.path.toLowerCase()
  if (name.startsWith(needle)) return 3
  if (name.includes(needle)) return 2
  if (path.includes(needle)) return 1
  return 0
}

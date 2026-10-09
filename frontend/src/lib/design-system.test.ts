/**
 * Guards for the design system.
 *
 * These read source files and server-render components; they do not mount
 * anything, so they run in a plain node environment with no DOM.
 *
 * The point is not coverage — it is that a convention written only in a
 * README decays. Every rule here exists because it is the kind of drift
 * that is invisible in review and obvious three months later.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative, resolve } from "node:path"

import { describe, expect, it } from "vitest"
import { h } from "vue"
import { renderToString } from "@vue/server-renderer"
import { parse } from "@vue/compiler-sfc"

import PageHeader from "@/components/layout/PageHeader.vue"
import SectionHeader from "@/components/layout/SectionHeader.vue"
import StatCard from "@/components/data/StatCard.vue"
import { ACCENTS, DEFAULT_ACCENT, accentAttribute, parseAccent } from "@/lib/accent"
import { DEFAULT_THEME, parseTheme, resolveTheme } from "@/lib/theme"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const repo = dirname(root)

const read = (p: string) => readFileSync(join(root, p), "utf8")

/** Every .vue source under a directory, as { path, text }. */
function vueSources(dir: string): Array<{ path: string; text: string }> {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name)
    if (entry.isDirectory()) return vueSources(child)
    if (!entry.name.endsWith(".vue")) return []
    return [{ path: relative(root, join(root, child)), text: read(child) }]
  })
}

/** Every .vue and .ts source, tests excluded — a guard does not audit the
 *  literals its own assertions are written with. */
function allSources(dir = "."): Array<{ path: string; text: string }> {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name)
    if (entry.isDirectory()) return allSources(child)
    if (!/\.(vue|ts)$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) return []
    return [{ path: relative(root, join(root, child)), text: read(child) }]
  })
}

/**
 * The type scale in pixels.
 *
 * Tokens declared in main.css win; the table mirrors Tailwind v4's own
 * scale so a token this project has not overridden is still measured
 * rather than assumed fine.
 */
const TAILWIND_TEXT_PX: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
}

function typeScale(): Record<string, number> {
  const scale = { ...TAILWIND_TEXT_PX }
  // \w+ deliberately excludes the `--text-xs--line-height` companions.
  for (const match of read("assets/main.css").matchAll(/--text-(\w+):\s*([\d.]+)rem/g)) {
    scale[match[1]!] = parseFloat(match[2]!) * 16
  }
  return scale
}

/** Every font size a source file names, resolved to pixels. */
function fontSizes(
  text: string,
  scale: Record<string, number>,
): Array<{ raw: string; px: number }> {
  const sizes: Array<{ raw: string; px: number }> = []
  for (const match of text.matchAll(/\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g)) {
    sizes.push({ raw: match[0], px: scale[match[1]!]! })
  }
  for (const match of text.matchAll(/text-\[([\d.]+)(px|rem)\]/g)) {
    sizes.push({
      raw: match[0],
      px: match[2] === "rem" ? parseFloat(match[1]!) * 16 : parseFloat(match[1]!),
    })
  }
  return sizes
}

/** The template block of an SFC, parsed rather than regex-matched. */
function templateAst(file: string) {
  const { descriptor, errors } = parse(read(file), { filename: file })
  expect(errors, `SFC parse errors in ${file}`).toEqual([])
  return descriptor.template?.ast
}

/** DOM-level tag names in an SFC template, comments and interpolations
 *  excluded by construction — a `<h2>` inside a comment or a string is not
 *  a heading, and a regex cannot tell the difference. */
function domTags(file: string): string[] {
  const tags: string[] = []
  // The template AST is a deep union of node shapes; walking it generically
  // is the whole point of this helper, and narrowing at every level would
  // be more code than the check it guards.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visit = (node: any) => {
    if (!node) return
    if (node.type === 1) tags.push(node.tag)
    for (const child of node.children ?? []) visit(child)
    if (node.type === 1) {
      for (const branch of node.branches ?? []) visit(branch.children?.[0])
    }
  }
  visit(templateAst(file))
  return tags
}

// ---------------------------------------------------------------------------
describe("page chrome", () => {
  it("every view goes through PageHeader", () => {
    const views = vueSources("views")
    expect(views.length).toBeGreaterThan(0)
    const offenders = views
      .filter((v) => !/from ["']@\/components\/layout\/PageHeader\.vue["']/.test(v.text))
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })

  it("no view declares its own h1 — PageHeader owns the only one", () => {
    for (const view of vueSources("views")) {
      expect(domTags(view.path), view.path).not.toContain("h1")
    }
  })

  it("PageHeader renders exactly one h1", () => {
    expect(domTags("components/layout/PageHeader.vue").filter((t) => t === "h1")).toHaveLength(1)
  })

  it("section headers are h2, never h3", () => {
    expect(domTags("components/layout/SectionHeader.vue")).toContain("h2")
  })
})

// ---------------------------------------------------------------------------
describe("tables are paginated", () => {
  const withTable = () => vueSources("views").filter((v) => /<Table\b|<TableBody\b/.test(v.text))

  it("the rule is actually watching something", () => {
    // A guard that matches no file passes for the wrong reason and then
    // quietly stops protecting anything.
    expect(withTable().length).toBeGreaterThan(0)
  })

  it("every view with a table renders the shared paginator", () => {
    const offenders = withTable()
      .filter((v) => !/DataPagination/.test(v.text))
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })

  it("the paginator is used, not reimplemented", () => {
    // A view that slices rows itself is a view whose page number can
    // outlive its data, which is exactly the bug lib/pagination.ts exists
    // to prevent.
    const offenders = withTable()
      .filter((v) => /\.slice\(\s*\(?\s*(page|currentPage)\b/.test(v.text))
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })

  it("page sizes come from the shared options, never a literal", () => {
    const offenders = vueSources("views")
      .filter((v) => /pageSize\s*=\s*ref\(\s*\d+\s*\)/.test(v.text))
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe("card titles", () => {
  /** The one label every data card title uses. Order-insensitive: the
   *  tokens must all be present, but a caller may add more. */
  const REQUIRED_TOKENS = [
    "text-base",
    "font-semibold",
    "tracking-[0.08em]",
    "uppercase",
    "text-muted-foreground",
  ]

  it("every CardTitle in a view carries the design-system label", () => {
    const offenders: string[] = []
    for (const source of vueSources("views").concat(vueSources("components/data"))) {
      for (const match of source.text.matchAll(/<CardTitle\b[\s\S]*?>/g)) {
        const tag = match[0]
        // Accepted either way: the literal tokens, or a shared constant
        // that already carries them. The rule is about the resulting class
        // list, not about where it is written.
        if (tag.includes("FRAME_LABEL")) continue
        const missing = REQUIRED_TOKENS.filter((token) => !tag.includes(token))
        if (missing.length > 0) {
          offenders.push(`${source.path}: <CardTitle> missing ${missing.join(", ")}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("the card label is 16px or larger", () => {
    // The token and the pixel value are tied together here so a future
    // "shrink the label a little" cannot pass by editing only one of them.
    const token = REQUIRED_TOKENS.find((t) => t.startsWith("text-"))!
    expect(typeScale()[token.slice("text-".length)]).toBeGreaterThanOrEqual(16)
  })

  it("the stock shadcn title style is never shipped on a data card", () => {
    const offenders = vueSources("views")
      .filter((v) => /<CardTitle[^>]*class="text-(sm|base|xl) font-medium"/.test(v.text))
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe("type floor", () => {
  /**
   * Two rules, one mechanism: 14px is the floor, and key text starts at
   * 16px.
   *
   * The floor is a token override in main.css, which is what makes
   * `text-xs` safe everywhere else. These guards cover the two ways it can
   * still be bypassed: a hand-written literal below 14px, and a scale step
   * being redefined downwards.
   */
  const scale = typeScale()

  it("no scale step resolves below 14px", () => {
    for (const [token, px] of Object.entries(scale)) {
      expect(px, `--text-${token}`).toBeGreaterThanOrEqual(14)
    }
  })

  it("main.css declares the floor instead of inheriting Tailwind's 12px", () => {
    // Without the override `text-xs` is 12px and the rule is only a comment.
    // This pins the mechanism, not just today's output.
    expect(read("assets/main.css")).toMatch(/--text-xs:\s*0\.875rem/)
  })

  it("no source ships a literal below 14px", () => {
    const offenders: string[] = []
    for (const source of allSources()) {
      for (const size of fontSizes(source.text, scale)) {
        if (size.px < 14) offenders.push(`${source.path}: ${size.raw} = ${size.px}px`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("key text starts at 16px", () => {
    // Page title, brand, nav items, section and card labels, table headers.
    // Each file has to offer at least one step at or above 16px; a hint or
    // subtitle in the same file may stay at 14px.
    const keyFiles = [
      "components/layout/PageHeader.vue",
      "components/layout/SectionHeader.vue",
      "components/layout/SidebarNav.vue",
      "components/layout/SidebarNavItem.vue",
      "components/layout/SidebarMenuGroup.vue",
      "components/ui/table/TableHead.vue",
    ]
    for (const file of keyFiles) {
      const sizes = fontSizes(read(file), scale).map((size) => size.px)
      expect(Math.max(0, ...sizes), `${file} has no size at or above 16px`).toBeGreaterThanOrEqual(
        16,
      )
    }
  })
})

// ---------------------------------------------------------------------------
describe("tokens", () => {
  const css = read("assets/main.css")

  it("declares a light and a dark block for every accent, the default included", () => {
    for (const accent of ACCENTS) {
      expect(css).toMatch(new RegExp(`^\\[data-accent="${accent}"\\] \\{`, "m"))
      expect(css).toMatch(new RegExp(`^\\.dark\\[data-accent="${accent}"\\]`, "m"))
    }
  })

  it("has no retired token aliases anywhere", () => {
    const offenders = [...vueSources("views"), ...vueSources("components")]
      .filter((s) => /geo-cyan|geo-glow/.test(s.text))
      .map((s) => s.path)
    expect(offenders).toEqual([])
  })

  it("keeps a single radius source and a single card shadow", () => {
    expect(css.match(/^\s*--radius:\s/gm)).toHaveLength(1)
    expect(css.match(/--shadow-card:/g)?.length ?? 0).toBe(2) // light + dark override
  })

  it("shadows are switched off in dark mode", () => {
    // Depth on a dark surface comes from hairlines; a shadow only fogs it.
    expect(css).toMatch(/\.dark\s*\{[\s\S]*?--shadow-card:\s*0 0 #0000/)
  })

  it("declares a foreground for the destructive surface", () => {
    // So a destructive button does not have to say `text-white`, which only
    // works for today's red and only in one theme.
    expect(css).toMatch(/--destructive-foreground:/)
    expect(css).toMatch(/--color-destructive-foreground:/)
  })

  it("no view hard-codes a text colour", () => {
    // Semantic tokens exist for both of these; `text-white` on a destructive
    // button and `text-black` on a chip are the usual ways they leak back in.
    // Ring colours are deliberately out of scope — a swatch outline has to
    // stay visible over an arbitrary accent colour (see tokens.md).
    const offenders: string[] = []
    for (const source of vueSources("views").concat(vueSources("components"))) {
      for (const match of source.text.matchAll(/\btext-(white|black)\b/g)) {
        offenders.push(`${source.path}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe("boot consistency", () => {
  it("the anti-flash script and the store agree on storage keys", () => {
    const html = readFileSync(join(repo, "index.html"), "utf8")
    const store = read("stores/theme.ts")

    const keys = [...store.matchAll(/(?:THEME_KEY|ACCENT_KEY) = "([^"]+)"/g)].map((m) => m[1])
    expect(keys).toHaveLength(2)
    for (const key of keys) {
      expect(html, `index.html does not read ${key}`).toContain(`"${key}"`)
    }
  })

  it("the anti-flash script knows every non-default accent", () => {
    const html = readFileSync(join(repo, "index.html"), "utf8")
    for (const accent of ACCENTS.filter((a) => a !== DEFAULT_ACCENT)) {
      expect(html, `index.html does not apply ${accent}`).toContain(`"${accent}"`)
    }
  })
})

// ---------------------------------------------------------------------------
describe("presentational purity", () => {
  const BANNED = /from ["']@\/(stores|router)/

  it("data primitives never reach for a store or the router", () => {
    const offenders = vueSources("components/data")
      .filter((s) => BANNED.test(s.text))
      .map((s) => s.path)
    expect(offenders).toEqual([])
  })

  it("the chrome components stay presentational", () => {
    // layout/ also holds the interactive toggles, which legitimately own
    // state. Only the chrome pieces are held to the pure rule.
    for (const file of [
      "components/layout/PageHeader.vue",
      "components/layout/SectionHeader.vue",
      "components/data/StatCard.vue",
    ]) {
      expect(read(file), file).not.toMatch(BANNED)
    }
  })
})

// ---------------------------------------------------------------------------
describe("pure rules", () => {
  it("accent parsing falls back instead of throwing", () => {
    expect(parseAccent("green")).toBe("green")
    expect(parseAccent(null)).toBe(DEFAULT_ACCENT)
    expect(parseAccent("chartreuse")).toBe(DEFAULT_ACCENT)
  })

  it("the default accent carries no attribute", () => {
    expect(accentAttribute(DEFAULT_ACCENT)).toBeNull()
    expect(accentAttribute("copper")).toBe("copper")
  })

  it("a missing theme resolves to dark, never a flash of white", () => {
    expect(parseTheme(null)).toBe(DEFAULT_THEME)
    expect(DEFAULT_THEME).toBe("dark")
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
  })
})

// ---------------------------------------------------------------------------
describe("server-rendered structure", () => {
  it("PageHeader renders the title as the page's h1 and keeps the subtitle muted", async () => {
    const html = await renderToString(
      h(PageHeader, { title: "Members", subtitle: "Everyone with access." }),
    )
    expect(html).toMatch(/<h1[^>]*>Members<\/h1>/)
    expect(html).toContain("text-sm")
    expect(html).toContain("text-muted-foreground")
  })

  it("SectionHeader renders an h2 so it cannot compete with the page title", async () => {
    const html = await renderToString(h(SectionHeader, null, { default: () => "Overview" }))
    // Slot content is wrapped in SSR comment markers, so the assertion has
    // to tolerate them rather than assume a clean text node.
    expect(html).toMatch(/<h2[^>]*>[\s\S]*?Overview[\s\S]*?<\/h2>/)
  })

  it("StatCard carries the label, the value and tabular figures", async () => {
    const html = await renderToString(h(StatCard, { label: "Total members", value: "1,284" }))
    expect(html).toContain("Total members")
    expect(html).toContain("1,284")
    expect(html).toContain("tabular-nums")
    expect(html).toContain("text-base")
  })

  it("StatCard shows a skeleton instead of a number while loading", async () => {
    const loading = await renderToString(h(StatCard, { label: "L", value: "9", loading: true }))
    expect(loading).not.toContain(">9<")
  })
})

// ---------------------------------------------------------------------------
describe("documentation", () => {
  /**
   * The docs are part of the code: an agent reads them to decide what to
   * write, so a link to a file that no longer exists is not a cosmetic
   * problem — it is a wrong instruction.
   */
  const markdownFiles = [
    "README.md",
    "AGENTS.md",
    ...readdirSync(join(repo, "docs"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => `docs/${name}`),
  ]

  const readDoc = (file: string) => readFileSync(join(repo, file), "utf8")

  it("the docs directory has the pages the index promises", () => {
    expect(markdownFiles.length).toBeGreaterThan(5)
  })

  it("every relative markdown link resolves", () => {
    const offenders: string[] = []
    for (const file of markdownFiles) {
      for (const match of readDoc(file).matchAll(/\]\((\.{0,2}\/?[^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
        const target = resolve(dirname(join(repo, file)), match[1]!)
        if (!existsSync(target)) offenders.push(`${file} -> ${match[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("every source path quoted in the docs exists", () => {
    const offenders: string[] = []
    for (const file of markdownFiles) {
      // Paths in backticks, e.g. `src/lib/pagination.ts`
      for (const match of readDoc(file).matchAll(/`(src\/[^`\s]+\.(?:ts|vue|css))`/g)) {
        const path = match[1]!
        // Glob patterns (`src/lib/*.test.ts`) and placeholders
        // (`src/views/<Name>View.vue`) describe a shape, not a file.
        if (/[*<>]/.test(path)) continue
        if (!existsSync(join(repo, path))) offenders.push(`${file} -> ${path}`)
      }
    }
    expect(offenders).toEqual([])
  })

  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")

  const headingsOf = (absolutePath: string) =>
    new Set(
      [...readFileSync(absolutePath, "utf8").matchAll(/^#{2,4}\s+(.+)$/gm)].map((m) => slug(m[1]!)),
    )

  it("every anchor used in a same-page link exists as a heading", () => {
    const offenders: string[] = []
    for (const file of markdownFiles) {
      const text = readDoc(file)
      const headings = headingsOf(join(repo, file))
      for (const match of text.matchAll(/\]\((?:#([^)]+))\)/g)) {
        if (!headings.has(match[1]!)) offenders.push(`${file} -> #${match[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("every cross-file anchor points at a real heading", () => {
    // `./workflow.md#adding-a-page` navigates to the top of the file when
    // the anchor is wrong — a quiet failure nobody reports.
    const offenders: string[] = []
    for (const file of markdownFiles) {
      for (const match of readDoc(file).matchAll(/\]\((\.{0,2}\/?[^)#\s]+\.md)#([^)]+)\)/g)) {
        const target = resolve(dirname(join(repo, file)), match[1]!)
        if (!existsSync(target)) {
          offenders.push(`${file} -> ${match[1]}#${match[2]} (file missing)`)
          continue
        }
        if (!headingsOf(target).has(match[2]!)) {
          offenders.push(`${file} -> ${match[1]}#${match[2]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

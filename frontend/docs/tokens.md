# Tokens

The values. All of them live in `src/assets/main.css`; nothing here is
invented in a component.

Two rules before the tables:

- **Never hard-code a colour.** Not `#2a78d6`, not `bg-slate-100`. Every
  surface resolves through a semantic token so both themes keep working.
- **Never add a token to fix one screen.** If an existing token is close,
  use it. A fourteenth grey is how a palette rots.

---

## Semantic colours

Every one of these exists in `:root` (light) and `.dark`, and maps to a
Tailwind utility through the `@theme inline` block.

| Token                  | Utility                      | Used for                       |
| ---------------------- | ---------------------------- | ------------------------------ |
| `--background`         | `bg-background`              | Page surface                   |
| `--foreground`         | `text-foreground`            | Default text                   |
| `--card`               | `bg-card`                    | Panel, table, dialog surface   |
| `--card-foreground`    | `text-card-foreground`       | Text on a card                 |
| `--popover`            | `bg-popover`                 | Menus, popovers, calendar      |
| `--primary`            | `bg-primary`, `text-primary` | Brand accent; one per app      |
| `--primary-foreground` | `text-primary-foreground`    | Text on the accent             |
| `--secondary`          | `bg-secondary`               | Quiet filled control           |
| `--muted`              | `bg-muted`                   | Inactive fill, code background |
| `--muted-foreground`   | `text-muted-foreground`      | Hints, labels, meta            |
| `--accent`             | `bg-accent`                  | Hover fill for menu rows       |
| `--destructive`        | `text-destructive`           | Errors, delete                 |
| `--border`             | `border-border`              | Every hairline                 |
| `--input`              | `border-input`               | Control borders                |
| `--ring`               | `ring-ring`                  | Focus ring                     |
| `--sidebar*`           | `bg-sidebar`, …              | The shell chrome               |

**The two that carry the most weight:**

- `--muted-foreground` — if a piece of text is not primary content, this is
  its colour. Roughly a third of the app's text uses it.
- `--border` — in dark mode this is `oklch(1 0 0 / 8%)`, a translucent white.
  That is deliberate: a page, a card and a popover sit on different surfaces,
  and one opaque grey could not serve all three.

---

## The brand accent

The accent is not a palette. It is three numbers:

```css
:root {
  --brand-l: 0.52;
  --brand-c: 0.115;
  --brand-h: 178;
  --primary: oklch(var(--brand-l) var(--brand-c) var(--brand-h));
}
```

Everything else is derived:

```css
--primary-glow: oklch(var(--brand-l) var(--brand-c) var(--brand-h) / 15%);
--accent: oklch(0.93 calc(var(--brand-c) * 0.2) var(--brand-h));
```

Switching accents rewrites the three numbers via `[data-accent]` on `<html>`:

```css
[data-accent="green"] {
  --brand-h: 155;
  --brand-c: 0.13;
  --brand-l: 0.5;
}
.dark[data-accent="green"] {
  --brand-l: 0.76;
  --brand-c: 0.17;
}
```

Teal is the default and carries **no attribute**, but its CSS rule still
exists — a scoped preview (the picker's swatches) needs something to resolve
against, and without it the swatch inherits whatever accent is active.

### Adding a fourth accent — three edits

1. `ACCENTS` in `src/lib/accent.ts`
2. A light **and** dark CSS block in `src/assets/main.css`
3. The two `index.html` lines in the anti-flash script

A guard fails if you miss the CSS blocks or the inline script. `ACCENT_LABELS`
in `src/lib/accent.ts` is a `Record<Accent, string>`, so a missing label is a
type error.

### Reading the accent outside CSS

Components that need the raw colour (swatches) write it directly, because
`--primary` is composed on `<html>` and would not pick up a scoped override:

```vue
<span
  :data-accent="accent"
  style="background: oklch(var(--brand-l) var(--brand-c) var(--brand-h))"
/>
```

---

## Chart colours

`--chart-1` … `--chart-5`. Categorical, **deliberately separate from the
brand accent** — a chart series must not change colour when the user picks a
different accent.

| Slot | Light     | Dark      |
| ---- | --------- | --------- |
| 1    | `#2a78d6` | `#00a9a6` |
| 2    | `#1baf7a` | `#00a764` |
| 3    | `#eda100` | `#b58800` |
| 4    | `#008300` | `#9e64ee` |
| 5    | `#4a3aa7` | `#e9523f` |

**Assign in order and never cycle.** Adjacent-pair separation is only
validated for slots used in sequence; skipping around is not checked.

`--chart-3` is below 3:1 on a white card. Any multi-series chart must
therefore carry a legend or a table view — **colour is never the only
channel carrying information.**

Charts are ECharts, which paints into a canvas and cannot resolve `var()`.
`components/charts/palette.ts` reads these slots off the live document and
hands the values to the option builders, so changing a slot here still moves
every chart. Multi-series charts take slots in order; where two slots would
sit too close together in one theme (the dark slots 1 and 2), name the slot
explicitly rather than reordering the palette.

---

## Typography

Two families:

- `--font-sans` — Inter Variable. Everything.
- `font-mono` — the system stack. Technical values only (rule 8).

Two rules hold the scale together: **nothing renders below 14px**, and
**key text starts at 16px**.

```css
/* main.css — the floor is a token override, so every `text-xs` inherits it */
--text-xs: 0.875rem; /* 14px, not Tailwind's 12px */
```

| Size        | Used for                                                               |
| ----------- | ---------------------------------------------------------------------- |
| `text-2xl`  | Metric card value, donut total                                         |
| `text-xl`   | The page `<h1>` (via `PageHeader`)                                     |
| `text-lg`   | The topbar's company name (sm and up), dialog titles                   |
| `text-base` | Key text: card and section labels, the brand, nav items, table headers |
| `text-sm`   | Body, table cells, control text, page subtitle                         |
| `text-xs`   | Hints, meta, row actions — the floor, 14px                             |

No literal below the floor is shipped, and the guard rejects one that is
(`text-[11px]` is how this table used to be spelled).

Tracking is not decorative:

- `tracking-[-0.01em]` — headings. Keeps a 20px heading from looking loose
  next to 14px text.
- `tracking-[0.08em]` — uppercase card and section labels.
- `tracking-[0.12em]` — the sidebar tagline.

**Rule of thumb:** if you are reaching for a new size, check whether the
content actually changed rank. New sizes are the main way a type scale
becomes noise.

---

## Shape

```css
--radius: 0.625rem; /* 10px — the one number */
--radius-sm: calc(var(--radius) - 4px);
--radius-md: calc(var(--radius) - 2px);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) + 4px);
```

Convention: **`rounded-md` for controls, `rounded-xl` for surfaces.**
(53 uses of `md` vs 11 of `xl` in the React original.)

---

## Depth

```css
:root {
  --shadow-card: 0 1px 2px oklch(0.3 0.03 250 / 6%);
}
.dark {
  --shadow-card: 0 0 #0000;
}
```

There is **one** shadow. It is switched off in dark mode; hairlines carry
depth there instead (principle 9).

---

## Glass

One recipe, used by map overlays, sticky headers and toasts:

```css
background: color-mix(in oklab, var(--background) 85%, transparent);
backdrop-filter: blur(8px);
border: 1px solid var(--border);
border-radius: var(--radius);
```

Exposed as the `surface-glass` utility in `main.css`.

**Why `color-mix` and not a fixed `rgba`:** it has to follow the theme. Light
mode gets a translucent white, dark mode a translucent deep blue, from one
declaration.

---

## The two sanctioned exceptions

Everything else in this document is a rule. These two are deliberate
departures, and both are here so nobody has to re-litigate them:

**A swatch outline may use `ring-black/10 dark:ring-white/15`.**

The accent swatches render an _arbitrary_ brand colour, and their outline
has to stay visible over any of them. `ring-border` is a token tuned for
the app's own surfaces; against a saturated swatch it disappears. A
translucent black (light) or white (dark) hairline is the only thing that
works for every colour the picker can produce.

**A destructive surface takes `text-destructive-foreground`.**

It is a token, not `text-white`, so a future change to what "destructive"
looks like does not leave a hard-coded foreground behind. It exists
precisely so the token rule can hold without an exception here.

---

## Motion

- `transition-colors duration-200` — hover, navigation states
- `transition-all duration-200` — the sidebar width
- `animate-in fade-in-0 zoom-in-95 duration-500` — entry, always with
  `motion-reduce:animate-none`
- `animate-spin` — loading spinners only

Anything longer than 200ms on a hover starts to feel laggy; anything that
moves must respect `prefers-reduced-motion`.

---

## Scrollbars

Custom, in `main.css`, following the theme:

```css
::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--muted-foreground) 38%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box; /* 10px track, 6px thumb, real grab target */
}
@supports not selector(::-webkit-scrollbar) {
  * {
    scrollbar-width: thin;
  } /* Firefox only */
}
```

The colour is written inline rather than hoisted into a token, because
`var()` in a custom property resolves where it is declared — that way it
always resolves against the scrolling element's own theme.

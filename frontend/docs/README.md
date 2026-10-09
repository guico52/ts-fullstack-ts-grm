# Documentation

Everything an agent or a new contributor needs before touching this codebase.
Short on purpose: a rule that takes ten minutes to read is a rule that gets
skipped.

## Read in this order

| Doc                                      | What it answers                                         |
| ---------------------------------------- | ------------------------------------------------------- |
| [template-usage.md](./template-usage.md) | 私有 Gitea 模板的引用、初始化、版本记录和更新方式。     |
| [api-client.md](./api-client.md)         | 怎么调用后端：Eden Treaty、类型来源、错误处理与约定。   |
| [constraints.md](./constraints.md)       | 项目约束总表：架构、品牌、视觉、交互、测试和交付。      |
| [principles.md](./principles.md)         | The 16 design rules, with reasoning and examples.       |
| [navigation.md](./navigation.md)         | Menu vs View, the sidebar tree, the icon rail.          |
| [tokens.md](./tokens.md)                 | The actual colour, type, radius and shadow values.      |
| [components.md](./components.md)         | Which component to reach for, and what never to do.     |
| [forms.md](./forms.md)                   | Field spacing, errors, validation timing.               |
| [tables.md](./tables.md)                 | Table structure, pagination, filters, empty states.     |
| [architecture.md](./architecture.md)     | Where code goes, and why the layers are split this way. |
| [guards.md](./guards.md)                 | How the rules are enforced, and how to add one.         |
| [workflow.md](./workflow.md)             | Commands, checklists, known traps.                      |

## I want to…

| Task                                           | Start here                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Initialise a project from this template        | [template-usage.md](./template-usage.md)                                      |
| Call the backend from the frontend             | [api-client.md](./api-client.md)                                              |
| Add a page                                     | [principles.md](./principles.md) → [workflow.md](./workflow.md#adding-a-page) |
| Add a chart or a data visualisation            | [components.md](./components.md)                                              |
| Add a map                                      | [architecture.md](./architecture.md)                                          |
| Add a sidebar entry, or a collapsible group    | [navigation.md](./navigation.md#adding-an-entry)                              |
| Add a table                                    | [tables.md](./tables.md)                                                      |
| Add or change a form                           | [forms.md](./forms.md)                                                        |
| Add an accent or a theme value                 | [tokens.md](./tokens.md)                                                      |
| Add a rule that must not be broken             | [guards.md](./guards.md#adding-a-guard)                                       |
| Check a layout for overflow                    | [guards.md](./guards.md#layer-4-the-browser)                                  |
| Understand why something looks the way it does | [principles.md](./principles.md)                                              |

## The one-paragraph version

Start with [项目约束总表](./constraints.md) for the complete checklist and
its enforcement boundaries.

Vue 3 + TypeScript + Tailwind v4 + Pinia + shadcn-vue + ECharts. All styling
goes through semantic tokens; no hard-coded colours. Nothing renders below
14px and key text starts at 16px. Every view renders exactly one `<h1>`
through `PageHeader`. Data-card titles use one exact class list. Form fields
use the `Field` family with a two-level spacing rhythm. Every table is
paginated. Rules that matter are enforced by tests, not by convention — run
`bun run check` before calling a change complete.

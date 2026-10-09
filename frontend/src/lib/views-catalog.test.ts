import { describe, expect, it } from "vitest"

import {
  describeComponent,
  matchComponents,
  toKebabCase,
  type ViewComponent,
} from "./views-catalog"

describe("toKebabCase", () => {
  it("splits a PascalCase name into lower-case words", () => {
    expect(toKebabCase("OrganizationsView")).toBe("organizations-view")
    expect(toKebabCase("MemberFormView")).toBe("member-form-view")
  })

  it("splits an acronym before the next word, not inside it", () => {
    // The naive `([a-z0-9])([A-Z])` rule alone would give `h-ttp-server`.
    expect(toKebabCase("HTTPServer")).toBe("http-server")
    expect(toKebabCase("APIDocs")).toBe("api-docs")
  })

  it("leaves an already-kebab or single-word name alone", () => {
    expect(toKebabCase("already-kebab")).toBe("already-kebab")
    expect(toKebabCase("Dashboard")).toBe("dashboard")
  })
})

describe("describeComponent", () => {
  it("derives name, path and route from a module path", () => {
    expect(describeComponent("/src/views/OrganizationsView.vue")).toEqual({
      name: "OrganizationsView",
      path: "views/OrganizationsView.vue",
      route: "/organizations-view",
    })
  })

  it("keeps nested directories in the path", () => {
    expect(describeComponent("/src/views/system/RoleView.vue")).toEqual({
      name: "RoleView",
      path: "views/system/RoleView.vue",
      route: "/role-view",
    })
  })
})

describe("matchComponents", () => {
  const catalog: ViewComponent[] = [
    { name: "UsersView", path: "views/UsersView.vue", route: "/users-view" },
    { name: "RolesView", path: "views/RolesView.vue", route: "/roles-view" },
    { name: "Detail", path: "views/users/Detail.vue", route: "/detail" },
  ]

  it("returns everything for an empty query", () => {
    // A picker that opens blank is a picker nobody can browse.
    expect(matchComponents("", catalog)).toHaveLength(3)
  })

  it("is case-insensitive and matches substrings", () => {
    expect(matchComponents("users", catalog).map((c) => c.name)).toEqual(["UsersView", "Detail"])
  })

  it("ranks a name match above a path-only match", () => {
    // "users" appears in UsersView's name and in Detail's folder, not its name.
    const [first] = matchComponents("users", catalog)
    expect(first?.name).toBe("UsersView")
  })

  it("returns nothing when nothing matches", () => {
    expect(matchComponents("zzz", catalog)).toEqual([])
  })
})

import { permissionRepository } from "./permission/repository.ts";
import { roleRepository } from "./role/repository.ts";
import { ensureAdminUser, type AdminSeedOptions } from "./user/bootstrap.ts";
import { viewRepository } from "./view/repository.ts";

/**
 * 系统的原始数据：总览、系统管理、图书管理的视图、权限点，以及两个内置角色。
 *
 * **幂等**：视图与角色按名字补齐，权限由插件托管，已有关系不覆盖。每次启动可
 * 在目录同步完成后调用它——和 `ensureAdminUser` 同一套思路。
 *
 * **内置角色只在缺失时创建，不覆盖已有绑定。** 管理员"拥有全部"是**初始化
 * 那一刻**的全部：之后新加一个页面，它不会自动进管理员角色。这是有意的——
 * 角色绑定向来是可以被人编辑的，每次启动都把它推回某个全集，等于把用户的
 * 编辑当成了错误。（改名会让它按新名字重新创建，那条路一直开着。）
 */

/** 内置角色名。别处要用就走这两个常量，不要在字符串里重复。 */
export const ROLE_ADMIN = "管理员";
export const ROLE_VIEWER = "观察者";

/** 图书管理这一组视图：一个菜单 + 三个页面。与服务端动态导航共同使用。 */
const LIBRARY_MENU = { name: "图书管理", icon: "Library", sort: 3 } as const;

const LIBRARY_PAGES = [
  {
    name: "图书",
    icon: "BookOpen",
    path: "/library/books",
    componentPath: "views/library/BooksView.vue",
    componentName: "BooksView",
    sort: 1,
  },
  {
    name: "作者",
    icon: "PenLine",
    path: "/library/authors",
    componentPath: "views/library/AuthorsView.vue",
    componentName: "AuthorsView",
    sort: 2,
  },
  {
    name: "书店",
    icon: "Store",
    path: "/library/stores",
    componentPath: "views/library/StoresView.vue",
    componentName: "StoresView",
    sort: 3,
  },
] as const;

/**
 * 观察者能碰的：**只有图书业务，且只有 read**。
 *
 * "不能删除和修改"就是由这里表达的——集合里没有 update / delete，
 * 而不是靠一句说明。同理，"不可访问系统管理页面"由它绑定的视图里没有
 * 系统管理决定。
 */
const VIEWER_RESOURCES = ["book.book", "book.author", "book.store"] as const;

const permissionCode = (resource: string, action: string) =>
  `${resource}.${action}`;

/** 视图在库里的标识：类型 + 名字。同名不同层是允许的，所以要带上类型。 */
const viewKey = (type: string, name: string) => `${type}:${name}`;

export async function seedSystemData(
  adminOptions: AdminSeedOptions = {},
): Promise<void> {
  await seedManagementViews();
  const libraryViewIds = await seedLibraryViews();
  const permissionIds = await seedPermissions();
  await seedRoles(libraryViewIds, permissionIds);
  await ensureAdminUser(adminOptions);
}

/** Seed checks every page; the HTTP list limit must not become an initialization limit. */
async function listAll<T>(
  list: (
    limit: number,
    offset: number,
  ) => Promise<{ data: T[]; total: number }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await list(100, offset);
    rows.push(...page.data);
    if (rows.length >= page.total || page.data.length === 0) return rows;
  }
}

/** 创建管理端的入口；角色创建之前必须具备全部默认页面。 */
async function seedManagementViews(): Promise<void> {
  const existing = await listAll(viewRepository.list);
  async function ensure(body: Parameters<typeof viewRepository.create>[0]) {
    const found = existing.find(
      (view) => view.type === body.type && view.name === body.name,
    );
    return found?.id ?? (await viewRepository.create(body)).id;
  }
  await ensure({
    name: "总览",
    icon: "LayoutDashboard",
    type: "VIEW",
    path: "/",
    componentPath: "views/DashboardView.vue",
    componentName: "DashboardView",
    sort: 1,
  });
  const parentId = await ensure({
    name: "系统管理",
    icon: "Shield",
    type: "MENU",
    sort: 2,
  });
  const pages = [
    ["组织管理", "Building2", "organizations", "OrganizationsView"],
    ["用户管理", "Users", "users", "UsersView"],
    ["视图管理", "LayoutList", "views", "ViewsView"],
    ["角色管理", "ShieldCheck", "roles", "RolesView"],
    ["权限管理", "KeyRound", "permissions", "PermissionsView"],
  ] as const;
  for (const [
    index,
    [name, icon, resource, componentName],
  ] of pages.entries()) {
    await ensure({
      name,
      icon,
      type: "VIEW",
      parentId,
      sort: index + 1,
      path: `/system/${resource}`,
      componentPath: `views/system/${componentName}.vue`,
      componentName,
    });
  }
}

/* ------------------------------------------------------------------ 视图 */

/**
 * 建出图书管理的菜单与页面，返回这一组（含菜单）的 id。
 *
 * 动态路由与导航都来自角色绑定的视图，初始化必须先创建视图再创建角色。
 */
async function seedLibraryViews(): Promise<string[]> {
  const existing = new Map(
    (await listAll(viewRepository.list)).map((view) => [
      viewKey(String(view.type), String(view.name)),
      String(view.id),
    ]),
  );

  const menuId =
    existing.get(viewKey("MENU", LIBRARY_MENU.name)) ??
    (
      await viewRepository.create({
        name: LIBRARY_MENU.name,
        icon: LIBRARY_MENU.icon,
        type: "MENU",
        sort: LIBRARY_MENU.sort,
        active: true,
      })
    ).id;

  const pageIds: string[] = [];
  for (const page of LIBRARY_PAGES) {
    const id =
      existing.get(viewKey("VIEW", page.name)) ??
      (
        await viewRepository.create({
          name: page.name,
          icon: page.icon,
          path: page.path,
          componentPath: page.componentPath,
          componentName: page.componentName,
          type: "VIEW",
          sort: page.sort,
          active: true,
          parentId: menuId,
        })
      ).id;
    pageIds.push(id);
  }

  return [menuId, ...pageIds];
}

/* ---------------------------------------------------------------- 权限点 */

/** 权限目录由插件托管；seed 只读取它来初始化角色关系。 */
async function seedPermissions(): Promise<Map<string, string>> {
  return new Map((await listAll(permissionRepository.list)).filter((row) => !row.deprecated).map((row) => [String(row.code), String(row.id)]));
}

/* ------------------------------------------------------------------ 角色 */

async function seedRoles(
  libraryViewIds: readonly string[],
  permissions: ReadonlyMap<string, string>,
): Promise<void> {
  const existing = await listAll(roleRepository.list);
  const roleNames = new Set(existing.map((role) => String(role.name)));

  const allViewIds = (await listAll(viewRepository.list)).map((view) =>
    String(view.id),
  );
  const allPermissionIds = [...permissions.values()];

  if (!roleNames.has(ROLE_ADMIN)) {
    await roleRepository.create({
      name: ROLE_ADMIN,
      viewIds: allViewIds,
      permissionIds: allPermissionIds,
    });
    console.log(
      `已创建角色「${ROLE_ADMIN}」：${allViewIds.length} 个视图、${allPermissionIds.length} 个权限。`,
    );
  }

  if (!roleNames.has(ROLE_VIEWER)) {
    const viewerPermissionIds = VIEWER_RESOURCES.flatMap((resource) => {
      const id = permissions.get(permissionCode(resource, "read"));
      // 权限点是本函数刚建出来的，拿不到 id 说明上面出了错，宁可炸掉也不要
      // 建出一个"看起来正常但权限不全"的角色。
      if (!id)
        throw new Error(`缺少权限点：${permissionCode(resource, "read")}`);
      return [id];
    });

    await roleRepository.create({
      name: ROLE_VIEWER,
      viewIds: [...libraryViewIds],
      permissionIds: viewerPermissionIds,
    });
    console.log(
      `已创建角色「${ROLE_VIEWER}」：${libraryViewIds.length} 个视图、${viewerPermissionIds.length} 个权限（只读图书业务）。`,
    );
  }
}

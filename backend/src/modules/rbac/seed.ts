import { permissionRepository } from "./permission/repository.ts";
import { roleRepository } from "./role/repository.ts";
import { BUILT_IN_ADMIN_NAME } from "./user/bootstrap.ts";
import { userRepository } from "./user/repository.ts";
import { viewRepository } from "./view/repository.ts";

/**
 * 系统的原始数据：图书管理的视图、权限点，以及两个内置角色。
 *
 * **幂等**：按名字找，缺什么建什么，已有的一律不动。所以每次启动都能安全地
 * 调用它——和 `ensureAdminUser` 同一套思路。
 *
 * **内置角色只在缺失时创建，不覆盖已有绑定。** 管理员"拥有全部"是**初始化
 * 那一刻**的全部：之后新加一个页面，它不会自动进管理员角色。这是有意的——
 * 角色绑定向来是可以被人编辑的，每次启动都把它推回某个全集，等于把用户的
 * 编辑当成了错误。（改名会让它按新名字重新创建，那条路一直开着。）
 */

/** 内置角色名。别处要用就走这两个常量，不要在字符串里重复。 */
export const ROLE_ADMIN = "管理员";
export const ROLE_VIEWER = "观察者";

/** 图书管理这一组视图：一个菜单 + 三个页面。前端侧栏里一直有它们，数据库里没有。 */
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

/** 权限点的命名空间：`<scope>.<资源>.<动作>`。 */
const RESOURCES = [
  "rbac.organization",
  "rbac.user",
  "rbac.view",
  "rbac.role",
  "rbac.permission",
  "book.book",
  "book.author",
  "book.store",
] as const;

const ACTIONS = ["read", "create", "update", "delete"] as const;

/**
 * 观察者能碰的：**只有图书业务，且只有 read**。
 *
 * "不能删除和修改"就是由这里表达的——集合里没有 update / delete，
 * 而不是靠一句说明。同理，"不可访问系统管理页面"由它绑定的视图里没有
 * 系统管理决定。
 */
const VIEWER_RESOURCES = ["book.book", "book.author", "book.store"] as const;

const permissionName = (resource: string, action: string) =>
  `${resource}.${action}`;

/** 视图在库里的标识：类型 + 名字。同名不同层是允许的，所以要带上类型。 */
const viewKey = (type: string, name: string) => `${type}:${name}`;

export async function seedSystemData(): Promise<void> {
  const libraryViewIds = await seedLibraryViews();
  const permissionIds = await seedPermissions();
  await seedRoles(libraryViewIds, permissionIds);
  await bindBuiltInAdmin();
}

/* ------------------------------------------------------------ 内置管理员 */

/**
 * 把内置的 admin 用户放进「管理员」角色 —— **只加他一个**。
 *
 * 没有这一步，seed 出来的角色是空的：角色建好了、权限也齐了，但没人绑上去，
 * 于是管理员登录后什么都访问不了。这很容易被误读成“鉴权坏了”。
 *
 * 用 `addMember` 而不是 `update({ userIds })`：后者的语义是整体替换，会把
 * 角色里已有的成员全部踢掉。这里要的只是“保证这一行存在”。
 *
 * 没配 `ADMIN_EMAIL`（于是没有内置 admin）或者角色被改名时，静默跳过。
 */
async function bindBuiltInAdmin(): Promise<void> {
  const admin = await userRepository.findByName(BUILT_IN_ADMIN_NAME);
  if (!admin) return;

  const role = await roleRepository.findByName(ROLE_ADMIN);
  if (!role) return;

  await roleRepository.addMember(role.id, admin.id);
}

/* ------------------------------------------------------------------ 视图 */

/**
 * 建出图书管理的菜单与页面，返回这一组（含菜单）的 id。
 *
 * 这一组视图在前端侧栏里一直存在（`src/lib/nav.ts` 里写死的），但数据库里
 * 从来没有——于是"观察者只能看图书业务"这件事无从表达。角色绑的是视图 id，
 * 视图不存在就绑不了。
 */
async function seedLibraryViews(): Promise<string[]> {
  const existing = new Map(
    (await viewRepository.list(100, 0)).data.map((view) => [
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

/** 建出所有权限点，返回 `名字 → id`。 */
async function seedPermissions(): Promise<Map<string, string>> {
  const existing = new Map(
    (await permissionRepository.list(100, 0)).data.map((row) => [
      String(row.name),
      String(row.id),
    ]),
  );

  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const name = permissionName(resource, action);
      if (existing.has(name)) continue;
      const created = await permissionRepository.create({ name });
      existing.set(name, created.id);
    }
  }

  return existing;
}

/* ------------------------------------------------------------------ 角色 */

async function seedRoles(
  libraryViewIds: readonly string[],
  permissions: ReadonlyMap<string, string>,
): Promise<void> {
  const existing = await roleRepository.list(100, 0);
  const roleNames = new Set(existing.data.map((role) => String(role.name)));

  const allViewIds = (await viewRepository.list(100, 0)).data.map((view) =>
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
      const id = permissions.get(permissionName(resource, "read"));
      // 权限点是本函数刚建出来的，拿不到 id 说明上面出了错，宁可炸掉也不要
      // 建出一个"看起来正常但权限不全"的角色。
      if (!id)
        throw new Error(`缺少权限点：${permissionName(resource, "read")}`);
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

import { dto } from "@ts-grm/core";
import { client, run } from "../../model";
import { SysUser } from "../../model/rbac";

/**
 * 一个用户能访问的视图与权限，按角色汇总。
 *
 * 从 **`SysUser` 出发**：`SysUser.roles` 是 `SysRole.users` 的反向关联
 * （复用同一张中间表，没有新增列）。从用户侧一次查出来，比按关联条件去筛角色
 * 简单，也不用把角色表整个拉到内存里过滤。
 *
 * 软删除由全局过滤器挡掉 —— 被停用的角色、视图、权限都不会出现在结果里，
 * 所以「禁用某个角色」是真的会立刻生效的。
 */
const UserAccessView = dto.view(SysUser, (c) => [
  c.roles.with((role) => [
    role.views.with((view) => [
      view.id,
      view.name,
      view.icon,
      view.path,
      view.componentPath,
      view.componentName,
      view.type,
      view.parentId,
      view.sort,
    ]),
    role.permissions.with((permission) => [permission.name]),
  ]),
]);

/** 一个可访问的视图。字段与 `SysView` 的对外形状保持一致。 */
export interface AccessView {
  id: string;
  name: string;
  icon: string;
  path: string | null;
  componentPath: string | null;
  componentName: string | null;
  type: string;
  parentId: string | null;
  sort: number;
}

export interface Access {
  views: AccessView[];
  permissions: string[];
}

export const accessRepository = {
  /**
   * 该用户的全部可达视图与权限点。
   *
   * 同一个视图可能被多个角色同时授予，所以**必须去重**：前端拿它配路由，
   * 重复的 path 会让 `addRoute` 抛错。
   */
  forUser(userId: string) {
    return run(async (): Promise<Access> => {
      const [user] = await client
        .createQuery(SysUser, (q, user) => {
          q.where(user.id.eq(userId));
          return q.select(user.fetch(UserAccessView));
        })
        .fetchList();

      const views = new Map<string, AccessView>();
      const permissions = new Set<string>();

      for (const role of user?.roles ?? []) {
        for (const view of role.views) {
          views.set(String(view.id), {
            id: String(view.id),
            name: String(view.name),
            icon: String(view.icon),
            path: view.path ?? null,
            componentPath: view.componentPath ?? null,
            componentName: view.componentName ?? null,
            type: String(view.type),
            parentId: view.parentId == null ? null : String(view.parentId),
            sort: Number(view.sort) || 0,
          });
        }
        for (const permission of role.permissions) {
          permissions.add(String(permission.name));
        }
      }

      return {
        views: [...views.values()].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)),
        permissions: [...permissions].sort(),
      };
    });
  },
};

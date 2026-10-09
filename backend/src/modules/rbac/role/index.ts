import { Elysia } from "elysia";
import { RoleModel } from "./model.ts";
import { roleService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function roleModule() {
  return new Elysia({ name: "rbac-role", prefix: "/rbac/roles" })
    .get("/", ({ query }) => roleService.list(query.limit ?? 20, query.offset ?? 0), {
      query: RoleModel.listQuery,
      response: { 200: RoleModel.list },
      detail: { summary: "分页查询角色（含关联 id，已排除软删除）", tags: ["rbac"] },
    })
    .get("/:id", ({ params }) => roleService.get(params.id), {
      params: RoleModel.idParam,
      response: { 200: RoleModel.entity },
      detail: { summary: "按 id 查询角色", tags: ["rbac"] },
    })
    .post("/", async ({ body, status }) => status(201, await roleService.create(body)), {
      body: RoleModel.createBody,
      response: { 201: RoleModel.entity },
      detail: { summary: "创建角色并按需绑定用户/视图/权限", tags: ["rbac"] },
    })
    .patch("/:id", ({ params, body }) => roleService.update(params.id, body), {
      params: RoleModel.idParam,
      body: RoleModel.updateBody,
      response: { 200: RoleModel.entity },
      detail: { summary: "局部更新角色；传入的关联数组整体替换，省略则保留", tags: ["rbac"] },
    })
    .delete("/:id", ({ params }) => roleService.remove(params.id), {
      params: RoleModel.idParam,
      response: { 200: RoleModel.deleted },
      detail: { summary: "软删除角色", tags: ["rbac"] },
    });
}

import { Elysia } from "elysia";
import { PermissionModel } from "./model.ts";
import { permissionService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function permissionModule() {
  return new Elysia({ name: "rbac-permission", prefix: "/rbac/permissions" })
    .get("/", ({ query }) => permissionService.list(query.limit ?? 20, query.offset ?? 0), {
      query: PermissionModel.listQuery,
      response: { 200: PermissionModel.list },
      detail: { summary: "分页查询权限（已排除软删除）", tags: ["rbac"] },
    })
    .get("/:id", ({ params }) => permissionService.get(params.id), {
      params: PermissionModel.idParam,
      response: { 200: PermissionModel.entity },
      detail: { summary: "按 id 查询权限", tags: ["rbac"] },
    })
    .post("/", async ({ body, status }) => status(201, await permissionService.create(body)), {
      body: PermissionModel.createBody,
      response: { 201: PermissionModel.entity },
      detail: { summary: "创建权限", tags: ["rbac"] },
    })
    .patch("/:id", ({ params, body }) => permissionService.update(params.id, body), {
      params: PermissionModel.idParam,
      body: PermissionModel.updateBody,
      response: { 200: PermissionModel.entity },
      detail: { summary: "局部更新权限", tags: ["rbac"] },
    })
    .delete("/:id", ({ params }) => permissionService.remove(params.id), {
      params: PermissionModel.idParam,
      response: { 200: PermissionModel.deleted },
      detail: { summary: "软删除权限", tags: ["rbac"] },
    });
}

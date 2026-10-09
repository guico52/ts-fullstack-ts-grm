import { Elysia } from "elysia";
import { UserModel } from "./model.ts";
import { userService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function userModule() {
  return new Elysia({ name: "rbac-user", prefix: "/rbac/users" })
    .get("/", ({ query }) => userService.list(query.limit ?? 20, query.offset ?? 0), {
      query: UserModel.listQuery,
      response: { 200: UserModel.list },
      detail: { summary: "分页查询用户（含所属组织，已排除软删除）", tags: ["rbac"] },
    })
    .get("/:id", ({ params }) => userService.get(params.id), {
      params: UserModel.idParam,
      response: { 200: UserModel.entity },
      detail: { summary: "按 id 查询用户", tags: ["rbac"] },
    })
    .post("/", async ({ body, status }) => status(201, await userService.create(body)), {
      body: UserModel.createBody,
      response: { 201: UserModel.entity },
      detail: { summary: "创建用户（口令只存哈希）", tags: ["rbac"] },
    })
    .patch("/:id", ({ params, body }) => userService.update(params.id, body), {
      params: UserModel.idParam,
      body: UserModel.updateBody,
      response: { 200: UserModel.entity },
      detail: { summary: "局部更新用户，password 省略即不改口令", tags: ["rbac"] },
    })
    .delete("/:id", ({ params }) => userService.remove(params.id), {
      params: UserModel.idParam,
      response: { 200: UserModel.deleted },
      detail: { summary: "软删除用户", tags: ["rbac"] },
    });
}

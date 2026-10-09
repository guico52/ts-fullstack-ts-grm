import { Elysia } from "elysia";
import { ViewModel } from "./model.ts";
import { viewService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function viewModule() {
  return new Elysia({ name: "rbac-view", prefix: "/rbac/views" })
    .get(
      "/",
      ({ query }) => viewService.list(query.limit ?? 20, query.offset ?? 0, query.parentId),
      {
        query: ViewModel.listQuery,
        response: { 200: ViewModel.list },
        detail: { summary: "分页查询视图，可按 parentId 过滤（已排除软删除）", tags: ["rbac"] },
      },
    )
    .get("/:id", ({ params }) => viewService.get(params.id), {
      params: ViewModel.idParam,
      response: { 200: ViewModel.entity },
      detail: { summary: "按 id 查询视图", tags: ["rbac"] },
    })
    .post("/", async ({ body, status }) => status(201, await viewService.create(body)), {
      body: ViewModel.createBody,
      response: { 201: ViewModel.entity },
      detail: { summary: "创建视图", tags: ["rbac"] },
    })
    .patch("/:id", ({ params, body }) => viewService.update(params.id, body), {
      params: ViewModel.idParam,
      body: ViewModel.updateBody,
      response: { 200: ViewModel.entity },
      detail: { summary: "局部更新视图，parentId 显式 null 即移到根", tags: ["rbac"] },
    })
    .delete("/:id", ({ params }) => viewService.remove(params.id), {
      params: ViewModel.idParam,
      response: { 200: ViewModel.deleted },
      detail: { summary: "软删除视图", tags: ["rbac"] },
    });
}

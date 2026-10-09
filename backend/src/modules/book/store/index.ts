import { Elysia } from "elysia";
import { StoreModel } from "./model.ts";
import { storeService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function storeModule() {
  return new Elysia({ name: "book-store", prefix: "/book/stores" })
    .get("/", ({ query }) => storeService.list(query.limit ?? 20, query.offset ?? 0), {
      query: StoreModel.listQuery,
      response: { 200: StoreModel.list },
      detail: { summary: "分页查询书店（已排除软删除）", tags: ["book"] },
    })
    .get("/:id", ({ params }) => storeService.get(params.id), {
      params: StoreModel.idParam,
      response: { 200: StoreModel.entity },
      detail: { summary: "按 id 查询书店", tags: ["book"] },
    })
    .post("/", async ({ body, status }) => status(201, await storeService.create(body)), {
      body: StoreModel.createBody,
      response: { 201: StoreModel.entity },
      detail: { summary: "创建书店", tags: ["book"] },
    })
    .patch("/:id", ({ params, body }) => storeService.update(params.id, body), {
      params: StoreModel.idParam,
      body: StoreModel.updateBody,
      response: { 200: StoreModel.entity },
      detail: { summary: "局部更新书店", tags: ["book"] },
    })
    .delete("/:id", ({ params }) => storeService.remove(params.id), {
      params: StoreModel.idParam,
      response: { 200: StoreModel.deleted },
      detail: { summary: "软删除书店", tags: ["book"] },
    });
}

import { Elysia } from "elysia";
import { AuthorModel } from "./model.ts";
import { authorService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function authorModule() {
  return new Elysia({ name: "book-author", prefix: "/book/authors" })
    .get("/", ({ query }) => authorService.list(query.limit ?? 20, query.offset ?? 0), {
      query: AuthorModel.listQuery,
      response: { 200: AuthorModel.list },
      detail: { summary: "分页查询作者（已排除软删除）", tags: ["book"] },
    })
    .get("/:id", ({ params }) => authorService.get(params.id), {
      params: AuthorModel.idParam,
      response: { 200: AuthorModel.entity },
      detail: { summary: "按 id 查询作者", tags: ["book"] },
    })
    .post("/", async ({ body, status }) => status(201, await authorService.create(body)), {
      body: AuthorModel.createBody,
      response: { 201: AuthorModel.entity },
      detail: { summary: "创建作者", tags: ["book"] },
    })
    .patch("/:id", ({ params, body }) => authorService.update(params.id, body), {
      params: AuthorModel.idParam,
      body: AuthorModel.updateBody,
      response: { 200: AuthorModel.entity },
      detail: { summary: "局部更新作者", tags: ["book"] },
    })
    .delete("/:id", ({ params }) => authorService.remove(params.id), {
      params: AuthorModel.idParam,
      response: { 200: AuthorModel.deleted },
      detail: { summary: "软删除作者", tags: ["book"] },
    });
}

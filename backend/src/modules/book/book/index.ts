import { Elysia } from "elysia";
import { BookModel } from "./model.ts";
import { bookService } from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function bookModule() {
  return new Elysia({ name: "book-book", prefix: "/book/books" })
    .get("/", ({ query }) => bookService.list(query.limit ?? 20, query.offset ?? 0), {
      query: BookModel.listQuery,
      response: { 200: BookModel.list },
      detail: { summary: "分页查询图书（含所属书店与作者，已排除软删除）", tags: ["book"] },
    })
    .get("/:id", ({ params }) => bookService.get(params.id), {
      params: BookModel.idParam,
      response: { 200: BookModel.entity },
      detail: { summary: "按 id 查询图书", tags: ["book"] },
    })
    .post("/", async ({ body, status }) => status(201, await bookService.create(body)), {
      body: BookModel.createBody,
      response: { 201: BookModel.entity },
      detail: { summary: "创建图书（可同时绑定作者）", tags: ["book"] },
    })
    .patch("/:id", ({ params, body }) => bookService.update(params.id, body), {
      params: BookModel.idParam,
      body: BookModel.updateBody,
      response: { 200: BookModel.entity },
      detail: { summary: "局部更新图书；传入 authorIds 则整体替换作者", tags: ["book"] },
    })
    .delete("/:id", ({ params }) => bookService.remove(params.id), {
      params: BookModel.idParam,
      response: { 200: BookModel.deleted },
      detail: { summary: "软删除图书", tags: ["book"] },
    });
}

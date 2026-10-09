import { model, prop } from "@ts-grm/core";
import { applyPatches } from "ts-grm-patches";
import { auditFields } from "../embedded.ts";

// 定义任何 model 之前先应用补丁（幂等）。见 model/embedded.ts。
applyPatches();

/**
 * 这里的字符串列一律 `prop.str(n)`：name 会被用来排序与查找，而 `prop.text()`
 * 的列在 ts-grm 里无法参与查询（为什么、以及为什么改它不产生迁移，见
 * model/rbac/index.ts 顶部的说明）。n 只声明意图，PostgreSQL 方言下不进 DDL。
 */

/**
 * 图书域模型。
 *
 * 三个实体刚好演示三种关联：`Book.store` 是多对一（外键在 book 表），
 * `BookStore.books` 是它的反向一对多，`Book.authors` ↔ `Author.books`
 * 是多对多。
 *
 * **多对多只在拥有中间表的一侧声明 `joinTable`**，另一侧用
 * `mappedBy("...")` 指回来。两侧各写一个 `joinTable` 不会报错，但迁移
 * 工具会照着生成**两张中间表** —— 一张永远为空，而写入只落进其中一张。
 */
export const Book = model("Book", "id", class {
  id = prop.i64().autoIncrement().asString();
  name = prop.str(50);
  edition = prop.i32();
  price = prop.num(10, 2);
  store = prop.m2o(BookStore);
  authors = prop.m2m(Author).joinTable({
    name: "book_author_mapping",
    joinThisColumns: ["book_id"],
    joinTargetColumns: ["author_id"],
  });
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const Author = model("Author", "id", class {
  id = prop.i64().autoIncrement().asString();
  name = prop.str(50);
  books = prop.m2m(Book).mappedBy("authors");
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const BookStore = model("BookStore", "id", class {
  id = prop.i64().autoIncrement().asString();
  name = prop.str(50);
  books = prop.o2m(Book).mappedBy("store");
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

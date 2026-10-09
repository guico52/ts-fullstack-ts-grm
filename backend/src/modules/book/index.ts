import { Elysia } from "elysia";
import { authorModule } from "./author/index.ts";
// 域名与实体名同为 book，导入时把实体侧的工厂改名，避免与外层函数重名。
import { bookModule as bookEntityModule } from "./book/index.ts";
import { storeModule } from "./store/index.ts";

/**
 * 把 book 域的 controller 合成一个插件，交给 `app.ts` 挂载。
 *
 * 每个子模块都是**工厂**，这里必须**逐个调用**。漏掉括号不会报错，但会把
 * 后续模块嵌进前一个模块的 prefix 里 —— 见 `modules/rbac/index.ts` 的说明与
 * docs/constraints.md 的踩坑记录。
 *
 * 挂载顺序决定 Swagger 里的分组顺序，仅此而已。
 */
export function bookModule() {
  return new Elysia({ name: "book" })
    .use(storeModule())
    .use(authorModule())
    .use(bookEntityModule());
}

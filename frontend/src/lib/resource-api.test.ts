import { describe, expect, it } from "vitest"
import { createBook, createUser, updateUser, updateView } from "./resource-api"

describe("typed resource adapters", () => {
  it("拒绝未归一化的数字和错误关联数组，控件值必须符合请求字段类型", () => {
    expect(() => createBook({ name: "书", edition: "1", price: 10, storeId: "2" })).toThrow()
    expect(() =>
      // @ts-expect-error 模拟非法运行时关联数组，同时验证静态契约会拒绝数字 ID。
      createBook({ name: "书", edition: 1, price: 10, storeId: "2", authorIds: [3] }),
    ).toThrow()
    expect(() => createUser({ name: "人", email: "a@example.com", organizationId: "1" })).toThrow()
  })
  it("更新保留省略字段，显式 null 清空可空字段", () => {
    expect(JSON.parse(JSON.stringify(updateUser({ name: "新名字" })))).toEqual({ name: "新名字" })
    expect(JSON.parse(JSON.stringify(updateView({ path: null, componentName: null })))).toEqual({
      path: null,
      componentName: null,
    })
  })
})

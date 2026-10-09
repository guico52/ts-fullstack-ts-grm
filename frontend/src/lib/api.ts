/**
 * 后端客户端。
 *
 * 用 Eden Treaty 从后端的路由类型**直接推导**客户端：没有手写的请求/响应
 * 类型，也没有第二份接口定义。后端改一处 schema，这里立刻编译报错——
 * 这就是不引入任何额外 HTTP 库的原因，多一层封装只会多一处漂移。
 *
 * 后端类型的入口是 `@ts-fullstack-ts-grm/backend`，它指向 `backend/src/app.ts`。
 * 启动逻辑在 `backend/src/index.ts`，导入类型不会连接或监听任何端口。
 */
import { treaty } from "@elysiajs/eden"

import type { App } from "@ts-fullstack-ts-grm/backend"
import { readStorage, SESSION_KEY } from "./storage"

/**
 * 后端地址。开发时用 `frontend/.env` 的 `VITE_API_URL` 覆盖，
 * 默认指向本机后端（`backend` 的默认 `PORT=3000`）。
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

/**
 * 把会话里的 token 放进请求头。
 *
 * 直接读 localStorage 而不是从 pinia 拿：请求层不该依赖 store 实例，它可能
 * 在任何组件之外被调到。Eden 的 `headers` 接受一个**函数**，于是每次请求
 * 现读一次 —— 登录、登出、换账号都不需要重建客户端。
 */
function authHeaders(): Record<string, string> {
  const raw = readStorage(SESSION_KEY)
  if (!raw) return {}
  try {
    const { token } = JSON.parse(raw) as { token?: unknown }
    return typeof token === "string" && token !== "" ? { authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/**
 * 全项目唯一的后端入口。
 *
 * 用法（路径即后端路由，参数与返回值都有类型）：
 *
 * ```ts
 * const { data, error } = await api.health.get()
 * if (error) { ... } else { data.uptime }
 * ```
 *
 * 不要在这个文件之外直接 `fetch` 后端，也不要新建第二个客户端实例。
 */
export const api = treaty<App>(API_BASE_URL, { headers: () => authHeaders() })

/**
 * Turn a Treaty failure into something a person can read.
 *
 * Treaty does not throw on a non-2xx response — it hands back `{ error }` —
 * so every call site has to decide what to say. This is that decision,
 * made once: the backend's unified `{ message }` body when there is one,
 * otherwise the status, otherwise the raw thrown thing.
 */
export function describeApiError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const value = (error as { value?: unknown }).value
    if (typeof value === "object" && value !== null) {
      const code = (value as { code?: unknown }).code
      if (code === "ConnectionRefused" || code === "ECONNREFUSED") return "后端服务无法连接。"
      const message = (value as { message?: unknown }).message
      if (typeof message === "string" && message !== "") return message
    }
    const status = (error as { status?: unknown }).status
    if (typeof status === "number") return `请求失败（HTTP ${status}）。`
  }
  if (error instanceof Error && error.message !== "") return error.message
  return "请求失败，请稍后重试。"
}

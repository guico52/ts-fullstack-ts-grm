import { Elysia, type DocumentDecoration, type HTTPMethod } from "elysia";
import type { PermissionCheck } from "./permission.ts";
import { transaction } from "../model";

/** 只投影目录需要的 Elysia 路由字段，约束框架的宽泛 hook 类型。 */
export interface PermissionRoute {
  method: HTTPMethod;
  path: string;
  hooks: {
    beforeHandle?: readonly { fn: PermissionCheck }[];
    detail?: DocumentDecoration & { "x-permission"?: string | false };
  };
}

export interface PermissionCatalogOptions {
  /** 返回固定业务 code；返回 null 时仍按 method + 路由模板生成。 */
  generateCode?: (method: string, path: string) => string | null;
}

export interface PermissionEndpoint {
  code: string;
  url: string;
  method: string;
}

interface PermissionRow {
  id: string;
  code: string;
  url: string | null;
  method: string | null;
  deprecated: boolean;
  deleted_at: Date | null;
}

export function normalizePermissionPath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** @see https://elysiajs.com/patterns/macro */
export const permissionOptions = new Elysia({ name: "permission-options" })
  .macro({
    permission: (value: string | false) => {
      const detail: DocumentDecoration & { "x-permission": string | false } = { "x-permission": value };
      return { detail };
    },
  });

/** 只读取权限守卫覆盖的路由；登录要求由 authGuard 独立负责。 */
export class PermissionCatalog {
  private permissionCheck?: PermissionCheck;
  private required = new Map<string, string | false>();
  private initialization?: Promise<void>;

  private readonly options: PermissionCatalogOptions;
  constructor(options: PermissionCatalogOptions = {}) {
    this.options = options;
  }

  setPermissionCheck(permissionCheck: PermissionCheck) {
    if (typeof permissionCheck !== "function") throw new Error("权限守卫未正确注册");
    this.permissionCheck = permissionCheck;
  }

  collect(routes: readonly PermissionRoute[]): PermissionEndpoint[] {
    if (!this.permissionCheck) throw new Error("权限守卫未正确注册");
    const required = new Map<string, string | false>();
    const endpoints: PermissionEndpoint[] = [];
    for (const route of routes) {
      if (!route.hooks.beforeHandle?.some((hook) => hook.fn === this.permissionCheck)) continue;
      const url = normalizePermissionPath(route.path);
      const method = route.method.toUpperCase();
      if (method === "ALL") throw new Error(`权限路由 ${url} 必须明确 HTTP method`);
      const override = route.hooks.detail?.["x-permission"];
      const code = override === false ? false : override ?? this.options.generateCode?.(method, url) ?? `${method}:${url}`;
      if (code !== false && (typeof code !== "string" || !/^\S{1,255}$/.test(code))) {
        throw new Error(`权限路由 ${method} ${url} 的 code 必须是 1–255 位无空白字符串`);
      }
      if (url.length > 1024) throw new Error(`权限路由 ${url} 超出 url 长度限制`);
      const key = `${method}:${url}`;
      if (required.has(key)) throw new Error(`重复的权限路由：${key}`);
      required.set(key, code);
      if (code !== false) endpoints.push({ code, url, method });
    }
    this.required = required;
    return endpoints;
  }

  permissionFor(method: string, path: string): string | false | undefined {
    return this.required.get(`${method.toUpperCase()}:${normalizePermissionPath(path)}`);
  }

  /** 自动启动同步与显式初始化共用一个 Promise；失败也保持拒绝，不能当成同步成功。 */
  start(routes: readonly PermissionRoute[]): Promise<void> {
    return this.initialization ??= this.synchronize(routes);
  }

  ready(): Promise<void> {
    if (!this.initialization) throw new Error("权限目录尚未初始化");
    return this.initialization;
  }

  /** 可显式重复同步，便于部署校验；每次都是完整目录快照。 */
  async synchronize(routes: readonly PermissionRoute[]): Promise<void> {
    const previous = this.required;
    const endpoints = this.collect(routes);
    const next = this.required;
    this.required = previous;
    await transaction(async (session) => {
      // 串行化多个进程的目录写入，避免同时插入；部署版本须使用同一套路由快照。
      await session.query("SELECT pg_advisory_xact_lock(731902, 1)");
      const rows = (await session.query<PermissionRow>("SELECT id, code, url, method, deprecated, deleted_at FROM sys_permission FOR UPDATE")).rows;
      const byCode = new Map(rows.map((row) => [row.code, row]));
      const byEndpoint = new Map(rows.filter((row) => row.url !== null && row.method !== null).map((row) => [`${row.method}:${row.url}`, row]));
      const groups = new Map<string, PermissionEndpoint[]>();
      for (const endpoint of endpoints) {
        const group = groups.get(endpoint.code) ?? [];
        group.push(endpoint);
        groups.set(endpoint.code, group);
      }
      const retained = new Set<string>();
      for (const [code, group] of groups) {
        // 显式共享 code（如列表与详情 read）只存一个代表接口；仍在目录时优先保留旧绑定。
        group.sort((a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method));
        const codeHit = byCode.get(code);
        const endpointHits = new Set(group.map((endpoint) => byEndpoint.get(`${endpoint.method}:${endpoint.url}`)).filter((row) => row !== undefined));
        if (endpointHits.size > 1 || (codeHit && [...endpointHits].some((hit) => hit.id !== codeHit.id))) {
          throw new Error(`权限定位冲突：${code} 的 code 与 url + method 指向不同记录，需人工处理`);
        }
        const existing = codeHit ?? [...endpointHits][0];
        const endpoint = group.find((item) => item.url === existing?.url && item.method === existing?.method) ?? group[0]!;
        if (existing) {
          await session.query(
            "UPDATE sys_permission SET code=$2, url=$3, method=$4, deprecated=false, updated_at=now() WHERE id=$1 AND (code IS DISTINCT FROM $2 OR url IS DISTINCT FROM $3 OR method IS DISTINCT FROM $4 OR deprecated)",
            [existing.id, code, endpoint.url, endpoint.method],
          );
          retained.add(existing.id);
        } else {
          const inserted = await session.query<{ id: string }>(
            "INSERT INTO sys_permission (code, url, method) VALUES ($1,$2,$3) RETURNING id",
            [code, endpoint.url, endpoint.method],
          );
          retained.add(String(inserted.rows[0]!.id));
        }
      }
      // 不删除，不改角色映射，也不恢复 deleted_at；过期记录仍可由管理员检查和删除。
      await session.query(
        "UPDATE sys_permission SET deprecated=true, updated_at=now() WHERE NOT (id=ANY($1::bigint[])) AND NOT deprecated",
        [[...retained]],
      );
    });
    // 目录写入全部成功才发布新的请求映射；冲突回滚不会改变正在使用的映射。
    this.required = next;
  }
}

export function permissionCatalogPlugin(catalog: PermissionCatalog) {
  return new Elysia({ name: "permission-catalog" })
    .use(permissionOptions)
    .decorate("permissionCatalog", catalog)
    .onStart((app) => {
      // Elysia 不等待异步 onStart；请求侧也等待 ready，失败时不能放行。
      void catalog.start(app.routes).catch((error) => console.error("权限目录同步失败：", error));
    });
}

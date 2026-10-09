import { EntityManager, type DateExpression, type SqlClient } from "@ts-grm/core";
import { newSqlClient, PostgresDriver } from "@ts-grm/sql";
import { Pool, type PoolClient } from "pg";
import { createGlobalFilterManager } from "ts-grm-patches";
import { classifyDatabaseError } from "../errors.ts";

/**
 * 数据库的唯一入口：模型注册、全局过滤器、连接池与 ts-grm 客户端都在这里。
 *
 * 本目录（含本文件）会被**迁移工具**用 Node 原生 import 加载，因此目录内的
 * 相对导入一律写显式 `.ts` 扩展名。
 */

/**
 * 模型注册表：`of` 会加载 `paths` 指向的模块，并枚举进程内全部已注册模型。
 * baseDir 必须是目录，路径必须是 `./` 或 `../` 开头的相对路径。
 *
 * **新领域要在这里显式列出。** 迁移工具按目录递归扫描 `src/model/`，但运行时
 * 只认这几条路径 —— 漏掉一个文件，表能建出来，查询却报「模型未注册」。
 */
export const entityManager = EntityManager.of(
  import.meta.dirname,
  "./rbac/index.ts",
  "./book/index.ts",
);

/** 全项目唯一的 pg 连接池。进程启动时不连接，首次查询才建连接。 */
export const pool = new Pool({
  host: process.env.PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? "ts_fullstack_ts_grm",
  user: process.env.PG_USER ?? "postgres",
  password: process.env.PG_PASSWORD ?? "",
  max: 5,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

pool.on("error", (error) => {
  console.error("PostgreSQL 空闲连接错误：", error.message);
});

/**
 * 全局过滤器：注册一次，之后所有查询自动带上，不必在每处 where 里重复。
 *
 * 直接传 `entityManager`，模型清单由它汇总，无需手写。
 * 过滤器在 `newSqlClient()` 时被快照，所以必须先注册完。
 */
const filters = await createGlobalFilterManager(entityManager);

// 软删除：默认只读未删除的记录。按列名注册，缺少该列的模型不受影响，
// 关联查询直接读外键的优化也得以保留。
filters.addGlobalFor<DateExpression<Date | null>>("deletedAt", (column) => column.isNull());

/** 应用共享的 ts-grm 客户端。 */
export const client = newSqlClient(new PostgresDriver(pool), {
  entityManager,
  filterManager: filters,
});

/**
 * 事务专用客户端：钉住传入的 pg 会话，使 ts-grm 读到本事务**尚未提交**的写。
 *
 * ```ts
 * transaction(async (session) => {
 *   await session.query("insert ...");
 *   return clientFor(session).createQuery(...).fetchRequired();
 * });
 * ```
 */
export function clientFor(session: PoolClient): SqlClient {
  return newSqlClient(
    new PostgresDriver({
      // 驱动只经 connect() 取会话；这里只暴露该会话，release 由事务自己管。
      connect: async () => ({ query: session.query.bind(session), release() {} }) as PoolClient,
    } as Pool),
    { entityManager, filterManager: filters },
  );
}

/** 执行一段操作，并把 pg 的错误码翻译成领域错误。 */
export async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw classifyDatabaseError(error);
  }
}

/** 在一个 pg 事务里执行操作。回调拿到会话本身；异常会自动 ROLLBACK。 */
export async function transaction<T>(operation: (session: PoolClient) => Promise<T>): Promise<T> {
  return run(async () => {
    const session = await pool.connect();
    let releaseError: Error | undefined;
    try {
      await session.query("BEGIN");
      const value = await operation(session);
      await session.query("COMMIT");
      return value;
    } catch (error) {
      try {
        await session.query("ROLLBACK");
      } catch (rollbackError) {
        releaseError = rollbackError instanceof Error ? rollbackError : new Error("Rollback failed");
      }
      throw error;
    } finally {
      session.release(releaseError);
    }
  });
}

/** 业务表可读性探针：权限不足或未迁移都返回 false，不会伪装成健康。 */
export async function ready(): Promise<boolean> {
  try {
    await pool.query("SELECT id FROM sys_organization LIMIT 0");
    return true;
  } catch {
    return false;
  }
}

export async function close(): Promise<void> {
  await pool.end();
}

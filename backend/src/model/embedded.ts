import { prop, dsl } from "@ts-grm/core";
import { applyPatches } from "ts-grm-patches";

// `default()` 来自 ts-grm-patches：必须在定义任何 prop 之前调用一次（幂等）。
applyPatches();

/**
 * 所有业务表共用的审计字段。
 *
 * 嵌入而不是继承：它是列的组合，不是实体关系。
 */
export const auditFields = prop.embedded({
  createdBy: prop.i64().nullable(),
  updatedBy: prop.i64().nullable(),
  createdAt: prop.dt().nullable().default(dsl.native.date`now()`),
  updatedAt: prop.dt().nullable().default(dsl.native.date`now()`),
});

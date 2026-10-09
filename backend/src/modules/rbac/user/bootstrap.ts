import { organizationRepository } from "../organization/repository.ts";
import { userRepository } from "./repository.ts";

const ADMIN_NAME = "admin";

/** 内置管理员的名字。初始化要用它找人（见 seed.ts 的绑定那一步）。 */
export const BUILT_IN_ADMIN_NAME = ADMIN_NAME;

/**
 * 确保有一个初始管理员。
 *
 * 幂等：已经存在同名账号（未软删除）就直接返回，**绝不覆盖它的邮箱或口令**。
 * 覆盖会让用户改过的密码在下次重启时悄悄变回 `.env` 里的值——那是个查起来
 * 极费劲的问题，而"重置管理员密码"应该是一个显式动作，不是重启的副作用。
 *
 * **判据是名字，不是邮箱**：名字是"初始化过没有"的标记，邮箱只是那个账号的
 * 一个属性。代价是把 admin 改名之后下次启动会再建一个——这是有意的，想让
 * 初始化重跑，改掉名字就够了。
 *
 * 参数可注入是为了测试：单元/集成测试传自己的名字，就不必去碰真实的 admin。
 */
export async function ensureAdminUser(
  options: { name?: string; email?: string; password?: string } = {},
): Promise<void> {
  const name = options.name ?? ADMIN_NAME;
  const email = options.email ?? process.env.ADMIN_EMAIL?.trim();
  const password = options.password ?? process.env.ADMIN_PWD;

  if (!email || !password) {
    console.log("未配置 ADMIN_EMAIL / ADMIN_PWD，跳过管理员初始化。");
    return;
  }

  if (await userRepository.findByName(name)) return;

  // 用户必须属于一个组织（列是 NOT NULL），而全新库里一个组织都没有。
  const organizationId = await resolveOrganizationId();

  await userRepository.create({ name, email, password, organizationId });

  // 只报名字与邮箱，**不报口令**：启动日志常常被收集和转发。
  console.log(`已创建初始管理员：${email}（name=${name}）`);
}

/** 取第一个组织；一个都没有就建一个，让全新库也能直接启动。 */
async function resolveOrganizationId(): Promise<string> {
  const existing = await organizationRepository.list(1, 0);
  const first = existing.data[0];
  if (first) return String(first.id);

  const created = await organizationRepository.create({ name: "默认组织", code: "DEFAULT" });
  console.log("库里没有组织，已创建「默认组织」供管理员归属。");
  return created.id;
}

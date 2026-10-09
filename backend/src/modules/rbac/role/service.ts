import { ResourceNotFoundError } from "../../../errors.ts";
import type { RoleModel } from "./model.ts";
import { roleRepository } from "./repository.ts";

export const roleService = {
  list: (limit: number, offset: number) => roleRepository.list(limit, offset),

  async get(id: string) {
    const role = await roleRepository.find(id);
    if (!role) throw new ResourceNotFoundError("角色不存在");
    return role;
  },

  create(body: RoleModel["createBody"]) {
    return roleRepository.create({ ...body, name: body.name.trim() });
  },

  async update(id: string, body: RoleModel["updateBody"]) {
    const updated = await roleRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("角色不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await roleRepository.remove(id))) {
      throw new ResourceNotFoundError("角色不存在");
    }
    return { id, deleted: true as const };
  },
};

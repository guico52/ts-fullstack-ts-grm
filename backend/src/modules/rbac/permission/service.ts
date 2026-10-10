import { ResourceNotFoundError } from "../../../errors.ts";
import type { PermissionModel } from "./model.ts";
import { permissionRepository } from "./repository.ts";

export const permissionService = {
  list: (limit: number, offset: number) => permissionRepository.list(limit, offset),

  async get(id: string) {
    const permission = await permissionRepository.find(id);
    if (!permission) throw new ResourceNotFoundError("权限不存在");
    return permission;
  },

  create(body: PermissionModel["createBody"]) {
    return permissionRepository.create({ ...body, code: body.code.trim() });
  },

  async update(id: string, body: PermissionModel["updateBody"]) {
    const updated = await permissionRepository.update(id, {
      ...body,
      ...(body.code !== undefined ? { code: body.code.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("权限不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await permissionRepository.remove(id))) {
      throw new ResourceNotFoundError("权限不存在");
    }
    return { id, deleted: true as const };
  },
};

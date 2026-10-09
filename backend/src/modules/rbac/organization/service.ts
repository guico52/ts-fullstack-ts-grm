import { ResourceNotFoundError } from "../../../errors.ts";
import type { OrganizationModel } from "./model.ts";
import { organizationRepository } from "./repository.ts";

export const organizationService = {
  list: (limit: number, offset: number) => organizationRepository.list(limit, offset),

  async get(id: string) {
    const organization = await organizationRepository.find(id);
    if (!organization) throw new ResourceNotFoundError("组织不存在");
    return organization;
  },

  create(body: OrganizationModel["createBody"]) {
    return organizationRepository.create({
      ...body,
      name: body.name.trim(),
      code: body.code.trim(),
    });
  },

  async update(id: string, body: OrganizationModel["updateBody"]) {
    const updated = await organizationRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.code !== undefined ? { code: body.code.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("组织不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await organizationRepository.remove(id))) {
      throw new ResourceNotFoundError("组织不存在");
    }
    return { id, deleted: true as const };
  },
};

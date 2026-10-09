import { ResourceNotFoundError } from "../../../errors.ts";
import type { ViewModel } from "./model.ts";
import { viewRepository } from "./repository.ts";

export const viewService = {
  list: (limit: number, offset: number, parentId?: string) =>
    viewRepository.list(limit, offset, parentId),

  async get(id: string) {
    const view = await viewRepository.find(id);
    if (!view) throw new ResourceNotFoundError("视图不存在");
    return view;
  },

  create(body: ViewModel["createBody"]) {
    return viewRepository.create({ ...body, name: body.name.trim(), path: body.path.trim() });
  },

  async update(id: string, body: ViewModel["updateBody"]) {
    const updated = await viewRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.path !== undefined ? { path: body.path.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("视图不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await viewRepository.remove(id))) {
      throw new ResourceNotFoundError("视图不存在");
    }
    return { id, deleted: true as const };
  },
};

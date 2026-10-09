import { ResourceNotFoundError } from "../../../errors.ts";
import type { StoreModel } from "./model.ts";
import { storeRepository } from "./repository.ts";

export const storeService = {
  list: (limit: number, offset: number) => storeRepository.list(limit, offset),

  async get(id: string) {
    const store = await storeRepository.find(id);
    if (!store) throw new ResourceNotFoundError("书店不存在");
    return store;
  },

  create(body: StoreModel["createBody"]) {
    return storeRepository.create({ name: body.name.trim() });
  },

  async update(id: string, body: StoreModel["updateBody"]) {
    const updated = await storeRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("书店不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await storeRepository.remove(id))) {
      throw new ResourceNotFoundError("书店不存在");
    }
    return { id, deleted: true as const };
  },
};

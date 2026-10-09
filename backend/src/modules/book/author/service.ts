import { ResourceNotFoundError } from "../../../errors.ts";
import type { AuthorModel } from "./model.ts";
import { authorRepository } from "./repository.ts";

export const authorService = {
  list: (limit: number, offset: number) => authorRepository.list(limit, offset),

  async get(id: string) {
    const author = await authorRepository.find(id);
    if (!author) throw new ResourceNotFoundError("作者不存在");
    return author;
  },

  create(body: AuthorModel["createBody"]) {
    return authorRepository.create({ name: body.name.trim() });
  },

  async update(id: string, body: AuthorModel["updateBody"]) {
    const updated = await authorRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("作者不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await authorRepository.remove(id))) {
      throw new ResourceNotFoundError("作者不存在");
    }
    return { id, deleted: true as const };
  },
};

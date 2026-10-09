import { ResourceNotFoundError } from "../../../errors.ts";
import type { BookModel } from "./model.ts";
import { bookRepository } from "./repository.ts";

export const bookService = {
  list: (limit: number, offset: number) => bookRepository.list(limit, offset),

  async get(id: string) {
    const book = await bookRepository.find(id);
    if (!book) throw new ResourceNotFoundError("图书不存在");
    return book;
  },

  create(body: BookModel["createBody"]) {
    return bookRepository.create({ ...body, name: body.name.trim() });
  },

  async update(id: string, body: BookModel["updateBody"]) {
    const updated = await bookRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("图书不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await bookRepository.remove(id))) {
      throw new ResourceNotFoundError("图书不存在");
    }
    return { id, deleted: true as const };
  },
};

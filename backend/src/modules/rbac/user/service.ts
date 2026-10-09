import { ResourceNotFoundError } from "../../../errors.ts";
import type { UserModel } from "./model.ts";
import { userRepository } from "./repository.ts";

export const userService = {
  list: (limit: number, offset: number) => userRepository.list(limit, offset),

  async get(id: string) {
    const user = await userRepository.find(id);
    if (!user) throw new ResourceNotFoundError("用户不存在");
    return user;
  },

  create(body: UserModel["createBody"]) {
    return userRepository.create({
      ...body,
      name: body.name.trim(),
      email: body.email.trim(),
    });
  },

  async update(id: string, body: UserModel["updateBody"]) {
    const updated = await userRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.email !== undefined ? { email: body.email.trim() } : {}),
    });
    if (updated === null) throw new ResourceNotFoundError("用户不存在");
    return updated;
  },

  async remove(id: string) {
    if (!(await userRepository.remove(id))) {
      throw new ResourceNotFoundError("用户不存在");
    }
    return { id, deleted: true as const };
  },
};

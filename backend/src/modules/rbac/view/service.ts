import { InvalidHierarchyError, ResourceNotFoundError } from "../../../errors.ts";
import type { ViewModel } from "./model.ts";
import { viewRepository } from "./repository.ts";

/**
 * The view tree is strictly three levels: 菜单 → 页面 → 按钮.
 *
 * Concretely:
 *
 * - a **菜单** is a grouping node and must sit at the top — no parent;
 * - a **页面** hangs off a menu, or stands on its own (a top-level page is
 *   a legitimate entry point);
 * - a **按钮** belongs to a page, and must have one.
 *
 * Enforced here rather than only in the form, because the rule is about the
 * data, not about one screen: a button hanging off a menu is broken for
 * every reader of the tree, not just for the person who typed it. The form
 * narrows the parent picker to match, which is a convenience on top of this.
 */
const PARENT_RULES: Record<string, { kind: string | null; required: boolean; forbidden?: boolean }> = {
  MENU: { kind: null, required: false, forbidden: true },
  VIEW: { kind: "MENU", required: false },
  BUTTON: { kind: "VIEW", required: true },
};

const KIND_LABEL: Record<string, string> = {
  MENU: "菜单",
  VIEW: "页面",
  BUTTON: "按钮",
};

const isViewKind = (value: string): value is keyof typeof KIND_LABEL =>
  value === "MENU" || value === "VIEW" || value === "BUTTON";

/**
 * Check `type` against `parentId` — the values the record will have once the
 * write lands, not just the ones in the request.
 */
async function assertHierarchy(type: string, parentId: string | null): Promise<void> {
  if (!isViewKind(type)) return; // the schema rejects unknown kinds first
  const rule = PARENT_RULES[type];
  if (!rule) return;
  const label = KIND_LABEL[type];

  if (rule.forbidden) {
    if (parentId !== null) {
      throw new InvalidHierarchyError(`${label}必须是顶层节点，不能有上级`);
    }
    return;
  }

  if (parentId === null) {
    if (rule.required && rule.kind) {
      throw new InvalidHierarchyError(`${label}必须挂在${KIND_LABEL[rule.kind] ?? rule.kind}下面`);
    }
    return;
  }

  const parent = await viewRepository.find(parentId);
  if (!parent) throw new InvalidHierarchyError("所选的上级视图不存在");
  if (parent.type !== rule.kind) {
    throw new InvalidHierarchyError(
      `${label}的上级必须是${KIND_LABEL[rule.kind ?? ""] ?? rule.kind}，而「${parent.name}」是${
        KIND_LABEL[parent.type] ?? parent.type
      }`,
    );
  }
}

export const viewService = {
  list: (limit: number, offset: number, parentId?: string) =>
    viewRepository.list(limit, offset, parentId),

  async get(id: string) {
    const view = await viewRepository.find(id);
    if (!view) throw new ResourceNotFoundError("视图不存在");
    return view;
  },

  async create(body: ViewModel["createBody"]) {
    await assertHierarchy(body.type, body.parentId ?? null);
    return viewRepository.create({
      ...body,
      name: body.name.trim(),
      // Null means "this view kind has no route"; only a string gets trimmed.
      ...(typeof body.path === "string" ? { path: body.path.trim() } : {}),
    });
  },

  async update(id: string, body: ViewModel["updateBody"]) {
    const existing = await viewRepository.find(id);
    if (!existing) throw new ResourceNotFoundError("视图不存在");

    // Validate the record's resulting shape: changing only the type can still
    // leave an invalid pair, and so can changing only the parent.
    const nextType = body.type ?? existing.type;
    const nextParentId = body.parentId !== undefined ? body.parentId : existing.parentId;
    await assertHierarchy(nextType, nextParentId);

    const updated = await viewRepository.update(id, {
      ...body,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(typeof body.path === "string" ? { path: body.path.trim() } : {}),
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

import {Elysia} from "elysia";
import {OrganizationModel} from "./model.ts";
import {organizationService} from "./service.ts";

/** 工厂而非单例：每次组装应用都拿到独立实例，避免测试之间共享状态。 */
export function organizationModule() {
    return new Elysia({name: "rbac-organization", prefix: "/rbac/organizations"})
        .get("/", ({query}) => organizationService.list(query.limit ?? 20, query.offset ?? 0), {
            query: OrganizationModel.listQuery,
            response: {200: OrganizationModel.list},
            detail: {summary: "分页查询组织（已排除软删除）", tags: ["rbac"]},
        })
        .get("/:id", ({params}) => organizationService.get(params.id), {
            params: OrganizationModel.idParam,
            response: {200: OrganizationModel.entity},
            detail: {summary: "按 id 查询组织", tags: ["rbac"]},
        })
        .post("/", async ({body, status}) => status(201, await organizationService.create(body)), {
            body: OrganizationModel.createBody,
            response: {201: OrganizationModel.entity},
            detail: {summary: "创建组织", tags: ["rbac"]},
        })
        .patch("/:id", ({params, body}) => organizationService.update(params.id, body), {
            params: OrganizationModel.idParam,
            body: OrganizationModel.updateBody,
            response: {200: OrganizationModel.entity},
            detail: {summary: "局部更新组织", tags: ["rbac"]},
        })
        .delete("/:id", ({params}) => organizationService.remove(params.id), {
            params: OrganizationModel.idParam,
            response: {200: OrganizationModel.deleted},
            detail: {summary: "软删除组织", tags: ["rbac"]},
        });
}

-- ts-grm-migrate 生成后审核：旧 name 已是权限标识，重命名保留值、ID 与角色关联。
alter table "sys_permission" rename column "name" to "code";

alter table "sys_permission" add column "url" text null;

alter table "sys_permission" add column "method" text null;

alter table "sys_permission" add column "deprecated" boolean not null default false;

alter table "sys_permission" add constraint "sys_permission_uq_code" unique ("code");

alter table "sys_permission" add constraint "sys_permission_uq_url_method" unique ("url", "method");

alter table "sys_view" alter column "path" drop not null;

alter table "sys_view" alter column "component_path" drop not null;

alter table "sys_view" alter column "component_name" drop not null;

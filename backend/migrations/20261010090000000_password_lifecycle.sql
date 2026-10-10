alter table "sys_user" add column "token_version" integer not null default 0;
alter table "sys_user" add column "must_change_password" boolean not null default false;
alter table "sys_user" add column "initial_admin" boolean not null default false;
-- Existing installations retain their initial account without restoring any bindings.
update "sys_user" set "initial_admin" = true
where "id" = (select "id" from "sys_user" where "name" = 'admin' order by "id" limit 1);
create unique index "sys_user_initial_admin_unique" on "sys_user" ("initial_admin") where "initial_admin";

-- One-time upgrade for existing administrators who can already manage users.
-- Startup seed never re-grants revoked permissions or memberships.
INSERT INTO sys_permission (name)
SELECT 'rbac.user.resetPassword'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE name = 'rbac.user.resetPassword' AND deleted_at IS NULL);

INSERT INTO sys_role_permission_mapping (role_id, permission_id)
SELECT DISTINCT r.id, reset.id
FROM sys_role r
JOIN sys_permission reset ON reset.name = 'rbac.user.resetPassword' AND reset.deleted_at IS NULL
WHERE r.name = '管理员' AND r.deleted_at IS NULL
AND EXISTS (
  SELECT 1 FROM sys_role_permission_mapping m
  JOIN sys_permission p ON p.id = m.permission_id
  WHERE m.role_id = r.id AND p.name = 'rbac.user.update' AND p.deleted_at IS NULL
)
ON CONFLICT DO NOTHING;

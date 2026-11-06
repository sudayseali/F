// supabase/functions/_shared/permissions.ts
// Role-Based Access Control (RBAC) permission definitions

export type AdminRole = 'super_admin' | 'finance_admin' | 'moderator';

export type AdminPermission =
  | 'view_dashboard'
  | 'manage_users'
  | 'manage_balances'
  | 'manage_tasks'
  | 'review_submissions'
  | 'manage_withdrawals'
  | 'view_transactions'
  | 'manage_settings'
  | 'view_audit_logs'
  | 'manage_admins';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'view_dashboard',
    'manage_users',
    'manage_balances',
    'manage_tasks',
    'review_submissions',
    'manage_withdrawals',
    'view_transactions',
    'manage_settings',
    'view_audit_logs',
    'manage_admins',
  ],
  finance_admin: [
    'view_dashboard',
    'manage_withdrawals',
    'view_transactions',
    'manage_balances',
    'view_audit_logs',
  ],
  moderator: [
    'view_dashboard',
    'manage_tasks',
    'review_submissions',
    'manage_users',
  ],
};

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

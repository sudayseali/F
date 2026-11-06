// supabase/functions/_shared/permissions.ts
// Strict Role-Based Access Control (RBAC) permission definitions

export type AdminRole = 
  | 'super_admin' 
  | 'admin'
  | 'finance_admin' 
  | 'finance'
  | 'moderator'
  | 'support';

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
  admin: [
    'view_dashboard',
    'manage_users',
    'manage_balances',
    'manage_tasks',
    'review_submissions',
    'manage_withdrawals',
    'view_transactions',
    'manage_settings',
    'view_audit_logs',
  ],
  finance_admin: [
    'view_dashboard',
    'manage_withdrawals',
    'view_transactions',
    'manage_balances',
    'view_audit_logs',
  ],
  finance: [
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
  support: [
    'view_dashboard',
    'manage_users',
    'review_submissions',
    'manage_tasks',
  ],
};

export function hasPermission(role: string, permission: AdminPermission): boolean {
  const normalizedRole = role.toLowerCase() as AdminRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole] || [];
  return permissions.includes(permission);
}

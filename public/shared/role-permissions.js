// /shared/role-permissions.js

export const ROLE_PERMISSIONS = Object.freeze({
  admin: {
    canUpdateStatus: true,
    canSetDelay: true,
    canSendSMS: true,
    canBulkAssign: true
  },
  manager: {
    canUpdateStatus: true,
    canSetDelay: true,
    canSendSMS: true,
    canBulkAssign: true
  },
  checker: {
    canUpdateStatus: true,
    canSetDelay: false,
    canSendSMS: false,
    canBulkAssign: false
  },
  driver: {
    canUpdateStatus: true,
    canSetDelay: false,
    canSendSMS: false,
    canBulkAssign: false
  }
});

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || {};
}

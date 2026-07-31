import { NextRequest } from 'next/server';
import { verifyToken, type JwtPayload } from './jwt';
import { getTokenVersion, findById, type UserInfo } from './db-users';

export interface AuthUser {
  userId: number;
  username: string;
  role: string;
  name: string;
}

export async function authenticateRequest(request: NextRequest): Promise<{
  user: AuthUser | null;
  error: string | null;
  status: number;
}> {
  const token = request.headers.get('x-session');
  if (!token) {
    return { user: null, error: '请先登录', status: 401 };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return { user: null, error: '登录已过期，请重新登录', status: 401 };
  }

  const currentVersion = await getTokenVersion(payload.userId);
  if (payload.version !== currentVersion) {
    return { user: null, error: '登录已失效，请重新登录', status: 401 };
  }

  const userRecord = await findById(payload.userId);
  if (!userRecord || !userRecord.is_active) {
    return { user: null, error: '账号已被禁用', status: 403 };
  }

  return {
    user: {
      userId: userRecord.id,
      username: userRecord.username,
      role: userRecord.role,
      name: userRecord.name,
    },
    error: null,
    status: 0,
  };
}

// 角色常量
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// 检查是否是管理员（super_admin 或 admin）
export function isAdmin(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

// 检查是否是超级管理员
export function isSuperAdmin(role: string): boolean {
  return role === ROLES.SUPER_ADMIN;
}

// 检查是否可以管理目标用户
// super_admin: 可以管理所有人（除了不能删除 super_admin）
// admin: 只能管理 employee
export function canManageUser(operatorRole: string, targetRole: string): boolean {
  if (operatorRole === ROLES.SUPER_ADMIN) {
    return true; // super_admin 可以管理所有角色
  }
  if (operatorRole === ROLES.ADMIN) {
    return targetRole === ROLES.EMPLOYEE; // admin 只能管理 employee
  }
  return false; // employee 不能管理任何人
}

// 检查是否可以删除目标用户
// super_admin 不能被删除
export function canDeleteUser(operatorRole: string, targetRole: string, isTargetSuperAdmin: boolean): boolean {
  if (isTargetSuperAdmin) {
    return false; // super_admin 不能被删除
  }
  return canManageUser(operatorRole, targetRole);
}

export function requireAdmin(user: AuthUser): { error: string | null; status: number } {
  if (!isAdmin(user.role)) {
    return { error: '无权限执行此操作', status: 403 };
  }
  return { error: null, status: 0 };
}

export function requireSuperAdmin(user: AuthUser): { error: string | null; status: number } {
  if (!isSuperAdmin(user.role)) {
    return { error: '无权限执行此操作，仅超级管理员可用', status: 403 };
  }
  return { error: null, status: 0 };
}

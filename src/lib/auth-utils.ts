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

export function requireAdmin(user: AuthUser): { error: string | null; status: number } {
  if (user.role !== 'admin') {
    return { error: '无权限执行此操作', status: 403 };
  }
  return { error: null, status: 0 };
}

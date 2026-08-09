import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin, ROLES, isSuperAdmin, canManageUser } from '@/lib/auth-utils';
import { listUsers, createUser } from '@/lib/db-users';

export async function GET(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  const allUsers = await listUsers();
  
  // 根据角色过滤：admin 只能看到 employee，super_admin 可以看到所有人
  const users = isSuperAdmin(user.role)
    ? allUsers
    : allUsers.filter(u => u.role === ROLES.EMPLOYEE);
  
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  try {
    const body = await request.json();
    const { username, password, name, role } = body as {
      username: string;
      password: string;
      name: string;
      role: string;
    };

    if (!username?.trim() || !password || !name?.trim()) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
    }

    // 角色验证：super_admin 可以创建所有角色，admin 只能创建 employee
    const validRoles = isSuperAdmin(user.role)
      ? [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EMPLOYEE]
      : [ROLES.EMPLOYEE];
    
    if (!validRoles.includes(role as typeof ROLES[keyof typeof ROLES])) {
      return NextResponse.json({ error: '无权限创建该角色的用户' }, { status: 403 });
    }

    const newUser = await createUser({
      username: username.trim(),
      password,
      name: name.trim(),
      role,
    });

    return NextResponse.json({ user: newUser });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '创建失败';
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ error: '账号名已存在' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

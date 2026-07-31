import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/auth-utils';
import { listUsers, createUser } from '@/lib/db-users';

export async function GET(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  const users = await listUsers();
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

    if (!['admin', 'employee'].includes(role)) {
      return NextResponse.json({ error: '角色无效' }, { status: 400 });
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

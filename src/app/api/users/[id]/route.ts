import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/auth-utils';
import { updateUser, deleteUser, findById } from '@/lib/db-users';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  const { id } = await params;
  const target = await findById(Number(id));
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  return NextResponse.json({
    user: {
      id: target.id,
      username: target.username,
      name: target.name,
      role: target.role,
      is_active: target.is_active,
      created_at: target.created_at,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, is_active, password } = body as {
      name?: string;
      role?: string;
      is_active?: boolean;
      password?: string;
    };

    if (password !== undefined && password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
    }

    const targetId = Number(id);

    // 不能禁用自己
    if (is_active === false && user.userId === targetId) {
      return NextResponse.json({ error: '不能禁用自己的账号' }, { status: 400 });
    }

    // 不能删除最后一个管理员的权限
    if (role && role !== 'admin' && user.role === 'admin') {
      const { listUsers } = await import('@/lib/db-users');
      const allUsers = await listUsers();
      const adminCount = allUsers.filter((u: { role: string; is_active: boolean }) => u.role === 'admin' && u.is_active).length;
      const isTargetAdmin = allUsers.find((u: { id: number; role: string }) => u.id === targetId)?.role === 'admin';
      if (isTargetAdmin && adminCount <= 1) {
        return NextResponse.json({ error: '不能移除最后一个管理员的权限' }, { status: 400 });
      }
    }

    const updated = await updateUser(targetId, { name, role, is_active, password });
    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  const { id } = await params;
  const targetId = Number(id);

  if (targetId === user.userId) {
    return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
  }

  try {
    await deleteUser(targetId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '删除失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

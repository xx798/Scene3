import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { findById, hashPassword, verifyPassword } from '@/lib/db-users';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const input = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  current_password: z.string().min(1).optional(),
  new_password: z.string().min(6).max(72).optional(),
}).strict().refine(v => v.name !== undefined || v.new_password !== undefined);

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: '姓名或密码格式不正确' }, { status: 400 });
    const record = await findById(auth.user.userId);
    if (!record) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    const body = parsed.data;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.new_password !== undefined) {
      if (!body.current_password || !await verifyPassword(body.current_password, record.password_hash)) {
        return NextResponse.json({ error: '当前密码错误' }, { status: 400 });
      }
      updates.password_hash = await hashPassword(body.new_password);
      updates.token_version = record.token_version + 1;
    }
    const { data, error } = await getSupabaseClient().from('users').update(updates)
      .eq('id', record.id).eq('token_version', record.token_version).eq('password_hash', record.password_hash)
      .select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: '账号信息已变更，请重新登录' }, { status: 409 });
    return NextResponse.json({ success: true, requireLogin: Boolean(body.new_password) });
  } catch {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

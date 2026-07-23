import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

/**
 * 返回 Supabase 公开配置（URL + anon key），供浏览器端 Realtime 订阅使用。
 * anon key 本身是公开安全的，无需保密。
 */
export async function GET() {
  try {
    // 触发一次客户端初始化以加载环境变量
    getSupabaseClient();

    const url = process.env.COZE_SUPABASE_URL;
    const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase 配置不可用' }, { status: 500 });
    }

    return NextResponse.json({ url, anonKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

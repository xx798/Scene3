import { shanghaiDayRange } from '@/lib/time';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: '缺少日期参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Build date range for the selected date
    const { start, end } = shanghaiDayRange(date);

    const { data, error } = await client
      .from('daily_diagnose_data')
      .select('id, diagnose_time, camera_id, site_name_watermark, camera_status, camera_abnormal_desc, risk_items, capture_time, image_url, status')
      .gte('diagnose_time', start)
      .lt('diagnose_time', end)
      .order('diagnose_time', { ascending: false });

    if (error) throw new Error(`查询失败: ${error.message}`);

    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

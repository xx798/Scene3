import { shanghaiDate, shanghaiDayRange } from '@/lib/time';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error }, { status });

  try {
    const client = getSupabaseClient();

    // Get today's date range in UTC+8
    const { start, end } = shanghaiDayRange(shanghaiDate());

    // Total count for today
    const { count: total, error: totalError } = await client
      .from('daily_diagnose_data')
      .select('*', { count: 'exact', head: true })
      .gte('diagnose_time', start)
      .lt('diagnose_time', end);

    if (totalError) throw new Error(`查询总数失败: ${totalError.message}`);

    // Abnormal count for today
    const { count: abnormal, error: abnormalError } = await client
      .from('daily_diagnose_data')
      .select('*', { count: 'exact', head: true })
      .gte('diagnose_time', start)
      .lt('diagnose_time', end)
      .eq('status', 'abnormal');

    if (abnormalError) throw new Error(`查询异常数失败: ${abnormalError.message}`);

    const normal = (total ?? 0) - (abnormal ?? 0);

    return NextResponse.json({
      total: total ?? 0,
      abnormal: abnormal ?? 0,
      normal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

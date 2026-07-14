import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = getSupabaseClient();

    // Get today's date range in UTC+8
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Total count for today
    const { count: total, error: totalError } = await client
      .from('daily_diagnose_data')
      .select('*', { count: 'exact', head: true })
      .gte('diagnose_time', todayStart.toISOString())
      .lte('diagnose_time', todayEnd.toISOString());

    if (totalError) throw new Error(`查询总数失败: ${totalError.message}`);

    // Abnormal count for today
    const { count: abnormal, error: abnormalError } = await client
      .from('daily_diagnose_data')
      .select('*', { count: 'exact', head: true })
      .gte('diagnose_time', todayStart.toISOString())
      .lte('diagnose_time', todayEnd.toISOString())
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

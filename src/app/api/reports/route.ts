import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

interface ReportRecord {
  id: number;
  diagnose_time: string;
  image_url: string;
  diagnosis_result: string;
  status: string;
  created_at: string;
}

export async function GET() {
  try {
    const client = getSupabaseClient();

    // Get last 7 days' data grouped by date
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data, error } = await client
      .from('daily_diagnose_data')
      .select('id, diagnose_time, image_url, diagnosis_result, status, created_at')
      .gte('diagnose_time', sevenDaysAgo.toISOString())
      .order('diagnose_time', { ascending: false });

    if (error) throw new Error(`查询失败: ${error.message}`);

    const records = (data ?? []) as ReportRecord[];

    // Group by date
    const grouped: Record<string, ReportRecord[]> = {};
    for (const record of records) {
      const dateKey = new Date(record.diagnose_time).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Shanghai',
      });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(record);
    }

    // Build report list
    const reportList = Object.entries(grouped).map(([date, recs]) => {
      const abnormalCount = recs.filter((r) => r.status === 'abnormal').length;
      return {
        date,
        file_name: `诊断报告_${date.replace(/\//g, '-')}.xlsx`,
        total: recs.length,
        abnormal_count: abnormalCount,
        url: '', // URL will be populated when report is generated
      };
    });

    return NextResponse.json(reportList);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

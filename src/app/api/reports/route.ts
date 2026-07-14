import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

interface ReportRecord {
  id: number;
  diagnose_time: string;
  camera_id: string;
  site_name_watermark: string;
  camera_status: string;
  status: string;
  excel_url: string;
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
      .select('id, diagnose_time, camera_id, site_name_watermark, camera_status, status, excel_url, created_at')
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
      const totalCount = recs.length;
      // Use the first non-empty excel_url as the download URL
      const excelUrl = recs.find((r) => r.excel_url && r.excel_url.trim())?.excel_url || '';

      return {
        date,
        file_name: `诊断报告_${date.replace(/\//g, '-')}.xlsx`,
        url: excelUrl,
        abnormal_count: abnormalCount,
        total_count: totalCount,
      };
    });

    return NextResponse.json(reportList);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

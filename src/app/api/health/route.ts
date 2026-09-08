import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { error } = await getSupabaseClient().from('health_check').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json({ status: 'ok', database: 'ok', cozeConfigured: Boolean(process.env.COZE_API_TOKEN || process.env.COZE_WORKLOAD_API_TOKEN) });
  } catch {
    return NextResponse.json({ status: 'unhealthy', database: 'unavailable' }, { status: 503 });
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.COZE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('请配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { timeout: 15000 },
  });
  return client;
}

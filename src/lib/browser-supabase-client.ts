'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * 获取浏览器端 Supabase 客户端（单例，带 Realtime 支持）
 * 通过 API 路由获取 Supabase URL 和 anon key
 */
export function getBrowserSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const res = await fetch('/api/supabase-config');
      if (!res.ok) throw new Error('Failed to fetch Supabase config');
      const { url, anonKey } = await res.json();
      return createClient(url, anonKey, {
        realtime: { params: { eventsPerSecond: 10 } },
      });
    })();
  }
  return clientPromise;
}

/**
 * 订阅 daily_diagnose_data 表的 INSERT 事件
 * 返回取消订阅的清理函数
 */
export async function subscribeDiagnosisInsert(
  onInsert: () => void
): Promise<() => void> {
  const client = await getBrowserSupabaseClient();
  const channelName = `diagnosis-insert-${Date.now()}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'daily_diagnose_data' },
      () => {
        onInsert();
      }
    )
    .subscribe();

  // 返回清理函数
  return () => {
    client.removeChannel(channel);
  };
}

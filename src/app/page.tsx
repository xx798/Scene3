'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeDiagnosisInsert } from '@/lib/browser-supabase-client';
import { authFetch } from '@/lib/auth-fetch';

interface DashboardStats {
  total: number;
  abnormal: number;
  normal: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) {
  const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
    sky: { bg: 'bg-sky-50', icon: 'text-sky-500', ring: 'ring-sky-100' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-500', ring: 'ring-rose-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', ring: 'ring-emerald-100' },
  };

  const c = colorMap[color] || colorMap.sky;

  return (
    <div className="group rounded-xl border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {loading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : (
              value
            )}
          </p>
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl ring-1', c.bg, c.ring)}>
          <Icon className={cn('h-6 w-6', c.icon)} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ total: 0, abnormal: 0, normal: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetchStats();

    // 订阅数据库 INSERT 事件，新诊断记录写入后自动刷新
    let cancelled = false;
    subscribeDiagnosisInsert(() => {
      if (!cancelled) fetchStats();
    }).then((unsubscribe) => {
      if (cancelled) {
        unsubscribe();
      } else {
        cleanupRef.current = unsubscribe;
      }
    }).catch(() => {
      // Realtime 订阅失败时静默处理，页面仍可手动刷新
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [fetchStats]);

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">数据概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">{today}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="今日识别总数"
          value={stats.total}
          icon={Activity}
          color="sky"
          loading={loading}
        />
        <StatCard
          title="异常条目"
          value={stats.abnormal}
          icon={AlertTriangle}
          color="rose"
          loading={loading}
        />
        <StatCard
          title="正常条目"
          value={stats.normal}
          icon={CheckCircle2}
          color="emerald"
          loading={loading}
        />
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-foreground">系统状态</h2>
        <div className="mt-4 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm text-muted-foreground">
            {loading ? <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> : null}
            系统运行正常
          </span>
        </div>
      </div>
    </div>
  );
}

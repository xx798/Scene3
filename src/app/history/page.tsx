'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, Search, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagnoseRecord {
  id: number;
  diagnose_time: string;
  image_url: string;
  diagnosis_result: string;
  status: string;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<DiagnoseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const fetchRecords = useCallback(async (date: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/history?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords(selectedDate);
  }, [selectedDate, fetchRecords]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">诊断记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看历史AI诊断结果</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">选择日期</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          共 {records.length} 条记录
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-slate-50/50">
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                执行时间
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                图片
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                AI 诊断结论
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                状态
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-sky-500" />
                  <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">当日暂无诊断记录</p>
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                    {formatDate(record.diagnose_time)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="group relative inline-block">
                      <img
                        src={record.image_url}
                        alt="诊断图片"
                        className="h-10 w-10 rounded-lg border border-border object-cover transition-transform group-hover:scale-110"
                      />
                      <a
                        href={record.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </td>
                  <td className="max-w-xs px-6 py-4 text-sm text-foreground">
                    <p className="truncate">{record.diagnosis_result}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        record.status === 'abnormal'
                          ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                          : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                      )}
                    >
                      {record.status === 'abnormal' ? '异常' : '正常'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

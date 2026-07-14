'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, Download, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportItem {
  date: string;
  file_name: string;
  url: string;
  abnormal_count: number;
  total_count: number;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const fetchReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setGenerateError('');
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      if (!res.ok) throw new Error('生成失败');
      const data = await res.json();
      if (data.error) {
        setGenerateError(data.error);
        return;
      }
      // Refresh reports list
      await fetchReports();
      // Auto download if URL available
      if (data.url) {
        const link = document.createElement('a');
        link.href = data.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
    } catch {
      setGenerateError('报告生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">报告下载</h1>
        <p className="mt-1 text-sm text-muted-foreground">生成并下载每日诊断汇总报告</p>
      </div>

      {/* Generate Report Section */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-foreground">生成当日汇总报告</h2>
        <p className="mt-1 text-xs text-muted-foreground">选择日期后点击生成，系统将汇总当日诊断数据并生成Excel文件</p>
        <div className="mt-4 flex items-end gap-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              选择日期
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
              generating
                ? 'cursor-not-allowed bg-sky-400'
                : 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700'
            )}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                生成报告
              </>
            )}
          </button>
        </div>
        {generateError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {generateError}
          </div>
        )}
      </div>

      {/* Recent Reports List */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-foreground">近7天报告</h2>
        </div>
        <div className="divide-y divide-border">
          {reportsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">暂无报告记录</p>
              <p className="text-xs text-muted-foreground">请先选择日期生成报告</p>
            </div>
          ) : (
            reports.map((report, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{report.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.date} · 共 {report.total_count} 条 · 异常 {report.abnormal_count} 条
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(report.url, report.file_name)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-slate-50 hover:border-sky-200 hover:text-sky-600"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

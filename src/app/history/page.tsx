'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, Search, Loader2, Image as ImageIcon, ChevronDown, ChevronUp, Video, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeDiagnosisInsert } from '@/lib/browser-supabase-client';
import { authFetch } from '@/lib/auth-fetch';

interface RiskItem {
  item_name: string;
  status: string;
  risk_desc: string;
}

interface DiagnoseRecord {
  id: number;
  diagnose_time: string;
  camera_id: string;
  site_name_watermark: string;
  camera_status: string;
  camera_abnormal_desc: string;
  risk_items: RiskItem[];
  capture_time: string;
  image_url: string;
  status: string;
}

function RiskItemBadge({ item }: { item: RiskItem }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig: Record<string, { bg: string; text: string; label: string; descColor: string }> = {
    '正常': { bg: 'bg-emerald-50', text: 'text-emerald-600', label: '正常', descColor: 'text-emerald-600' },
    '异常': { bg: 'bg-rose-50', text: 'text-rose-600', label: '异常', descColor: 'text-rose-600' },
    '无法识别': { bg: 'bg-amber-50', text: 'text-amber-600', label: '无法识别', descColor: 'text-amber-600' },
  };
  const config = statusConfig[item.status] || statusConfig['无法识别'];
  const hasDesc = item.risk_desc && item.risk_desc.trim() !== '';

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => hasDesc && setExpanded(!expanded)}
        className={cn(
          "flex items-center justify-between gap-2 w-full px-3 py-2 text-xs transition-colors",
          hasDesc && "cursor-pointer hover:bg-muted/50"
        )}
      >
        <span className={cn('font-medium', config.descColor)}>{item.item_name}</span>
        <div className="flex items-center gap-1.5">
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-medium', config.bg, config.text)}>
            {config.label}
          </span>
          {hasDesc && (
            expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && hasDesc && (
        <div className={cn('px-3 pb-2 pt-0.5 text-[11px] leading-tight border-t border-border', config.descColor)}>
          {item.risk_desc}
        </div>
      )}
    </div>
  );
}

function RecordDetail({ record }: { record: DiagnoseRecord }) {
  const [expanded, setExpanded] = useState(false);
  const riskItems = record.risk_items || [];
  const abnormalItems = riskItems.filter((r) => r.status === '异常');
  const unidentifiedItems = riskItems.filter((r) => r.status === '无法识别');

  const cameraStatusConfig: Record<string, { color: string }> = {
    '正常': { color: 'text-emerald-600 bg-emerald-50 ring-emerald-200' },
    '画面遮挡': { color: 'text-amber-600 bg-amber-50 ring-amber-200' },
    '画面黑屏': { color: 'text-slate-600 bg-slate-100 ring-slate-200' },
    '画面偏移': { color: 'text-amber-600 bg-amber-50 ring-amber-200' },
    '信号中断': { color: 'text-rose-600 bg-rose-50 ring-rose-200' },
  };
  const camConfig = cameraStatusConfig[record.camera_status] || cameraStatusConfig['正常'];

  return (
    <div className="border-t border-border bg-slate-50/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-6 py-2 text-xs font-medium text-sky-600 hover:bg-slate-50 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? '收起详情' : '展开详情'}
      </button>
      {expanded && (
        <div className="px-6 pb-4 space-y-4">
          {/* Camera & Site Info */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg bg-white p-3 border border-border">
              <Video className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">摄像头</p>
                <p className="text-xs font-medium text-foreground">{record.camera_id || '未知'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white p-3 border border-border">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">场地名称</p>
                <p className="text-xs font-medium text-foreground">{record.site_name_watermark || '无'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white p-3 border border-border">
              <div className={cn('h-2 w-2 rounded-full shrink-0', camConfig.color.split(' ')[0].replace('text-', 'bg-'))} />
              <div>
                <p className="text-[11px] text-muted-foreground">设备状态</p>
                <p className={cn('text-xs font-medium', camConfig.color.split(' ')[0])}>{record.camera_status}</p>
              </div>
            </div>
          </div>

          {/* Camera abnormal description */}
          {record.camera_status !== '正常' && record.camera_abnormal_desc && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <span className="font-medium">设备异常：</span>{record.camera_abnormal_desc}
            </div>
          )}

          {/* Risk Items Grid */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">
              风险检查项
              {abnormalItems.length > 0 && (
                <span className="ml-2 text-rose-500">({abnormalItems.length} 项异常)</span>
              )}
              {unidentifiedItems.length > 0 && (
                <span className="ml-2 text-amber-500">({unidentifiedItems.length} 项无法识别)</span>
              )}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {riskItems.map((item, idx) => (
                <RiskItemBadge key={idx} item={item} />
              ))}
            </div>
          </div>

          {/* Image Preview */}
          {record.image_url && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">现场图片</p>
              <div className="rounded-lg border border-border overflow-hidden bg-white inline-block">
                <img
                  src={record.image_url}
                  alt={`${record.site_name_watermark || record.camera_id || '诊断'} 现场图片`}
                  className="max-h-64 rounded-lg object-contain transition-transform duration-200 hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
      const res = await authFetch(`/api/history?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetchRecords(selectedDate);

    // 订阅数据库 INSERT 事件，新诊断记录写入后自动刷新当前日期的列表
    let cancelled = false;
    subscribeDiagnosisInsert(() => {
      if (!cancelled) fetchRecords(selectedDate);
    }).then((unsubscribe) => {
      if (cancelled) {
        unsubscribe();
      } else {
        cleanupRef.current = unsubscribe;
      }
    }).catch(() => {
      // Realtime 订阅失败时静默处理
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [selectedDate, fetchRecords]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRiskSummary = (items: RiskItem[]) => {
    if (!items || items.length === 0) return '无检查项';
    const abnormal = items.filter((i) => i.status === '异常').length;
    const unidentified = items.filter((i) => i.status === '无法识别').length;
    if (abnormal > 0) return `${abnormal} 项异常`;
    if (unidentified > 0) return `${unidentified} 项无法识别`;
    return '全部正常';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">诊断记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看历史AI诊断结果与风险明细</p>
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
                诊断时间
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                摄像头 / 场地
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                设备状态
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                风险摘要
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                现场图片
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                综合状态
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-sky-500" />
                  <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">当日暂无诊断记录</p>
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <RecordRow key={record.id} record={record} formatTime={formatTime} getRiskSummary={getRiskSummary} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordRow({
  record,
  formatTime,
  getRiskSummary,
}: {
  record: DiagnoseRecord;
  formatTime: (s: string) => string;
  getRiskSummary: (items: RiskItem[]) => string;
}) {
  const riskItems = record.risk_items || [];
  const riskSummary = getRiskSummary(riskItems);
  const hasAbnormal = riskItems.some((i) => i.status === '异常');

  const cameraStatusConfig: Record<string, string> = {
    '正常': 'bg-emerald-50 text-emerald-600 ring-emerald-200',
    '画面遮挡': 'bg-amber-50 text-amber-600 ring-amber-200',
    '画面黑屏': 'bg-slate-100 text-slate-600 ring-slate-200',
    '画面偏移': 'bg-amber-50 text-amber-600 ring-amber-200',
    '信号中断': 'bg-rose-50 text-rose-600 ring-rose-200',
  };
  const camClass = cameraStatusConfig[record.camera_status] || cameraStatusConfig['正常'];

  return (
    <>
      <tr className="transition-colors hover:bg-slate-50/50">
        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
          {formatTime(record.diagnose_time)}
        </td>
        <td className="px-6 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">{record.camera_id || '-'}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
              {record.site_name_watermark || '无'}
            </p>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1', camClass)}>
            {record.camera_status}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className={cn(
            'text-xs font-medium',
            hasAbnormal ? 'text-rose-500' : riskSummary.includes('无法识别') ? 'text-amber-500' : 'text-emerald-500'
          )}>
            {riskSummary}
          </span>
        </td>
        <td className="px-6 py-4">
          {record.image_url ? (
            <img
              src={record.image_url}
              alt="现场缩略图"
              className="h-10 w-14 rounded object-cover border border-border cursor-pointer transition-transform hover:scale-110"
              loading="lazy"
              onClick={() => window.open(record.image_url, '_blank')}
            />
          ) : (
            <span className="text-xs text-muted-foreground">无图片</span>
          )}
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
      <tr>
        <td colSpan={6} className="p-0">
          <RecordDetail record={record} />
        </td>
      </tr>
    </>
  );
}

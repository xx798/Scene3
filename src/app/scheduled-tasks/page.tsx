'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
  Pause,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface ScheduledTask {
  id: number;
  name: string;
  bot_id: string;
  cron_expression: string;
  prompt_template: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface ExecutionLog {
  id: number;
  task_id: number;
  status: string;
  prompt_sent: string | null;
  response_content: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

/* ─── Cron presets ─── */
const CRON_PRESETS = [
  { label: '每 5 分钟', value: '*/5 * * * *' },
  { label: '每 15 分钟', value: '*/15 * * * *' },
  { label: '每 30 分钟', value: '*/30 * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每 2 小时', value: '0 */2 * * *' },
  { label: '每 6 小时', value: '0 */6 * * *' },
  { label: '每天 08:00', value: '0 8 * * *' },
  { label: '每天 12:00', value: '0 12 * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
  { label: '工作日 09:00', value: '0 9 * * 1-5' },
  { label: '自定义', value: '' },
];

/* ─── Main Page ─── */
export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<number | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [triggering, setTriggering] = useState<number | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled-tasks');
      const json = await res.json();
      if (json.success) setTasks(json.data);
    } catch (err) {
      console.error('获取任务列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const fetchLogs = useCallback(async (taskId: number) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/scheduled-tasks/${taskId}/logs?limit=20`);
      const json = await res.json();
      if (json.success) setLogs(json.data);
    } catch (err) {
      console.error('获取日志失败:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const toggleLogs = (taskId: number) => {
    if (expandedLogs === taskId) {
      setExpandedLogs(null);
    } else {
      setExpandedLogs(taskId);
      fetchLogs(taskId);
    }
  };

  const handleTrigger = async (taskId: number) => {
    setTriggering(taskId);
    try {
      const res = await fetch(`/api/scheduled-tasks/${taskId}/trigger`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) alert(json.error || '触发失败');
    } catch {
      alert('触发请求失败');
    } finally {
      setTriggering(null);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('确定删除此定时任务？删除后不可恢复。')) return;
    try {
      const res = await fetch(`/api/scheduled-tasks/${taskId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch {
      alert('删除失败');
    }
  };

  const handleToggleActive = async (task: ScheduledTask) => {
    try {
      const res = await fetch(`/api/scheduled-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !task.is_active }),
      });
      const json = await res.json();
      if (json.success) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? json.data : t)));
      }
    } catch {
      alert('操作失败');
    }
  };

  const handleSave = async (data: {
    name: string;
    bot_id: string;
    cron_expression: string;
    prompt_template: string;
  }) => {
    try {
      const isEdit = !!editingTask;
      const url = isEdit
        ? `/api/scheduled-tasks/${editingTask.id}`
        : '/api/scheduled-tasks';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditingTask(null);
        fetchTasks();
      } else {
        alert(json.error || '保存失败');
      }
    } catch {
      alert('保存请求失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">定时任务</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            配置定时调用智能体，自动执行诊断并接收返回结果
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          新建任务
        </button>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white py-20">
          <Clock className="h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm text-muted-foreground">暂无定时任务</p>
          <p className="mt-1 text-xs text-muted-foreground">
            点击「新建任务」创建你的第一个定时调用
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              triggering={triggering === task.id}
              expanded={expandedLogs === task.id}
              logs={expandedLogs === task.id ? logs : []}
              logsLoading={expandedLogs === task.id ? logsLoading : false}
              onTrigger={() => handleTrigger(task.id)}
              onDelete={() => handleDelete(task.id)}
              onToggle={() => handleToggleActive(task)}
              onEdit={() => {
                setEditingTask(task);
                setShowForm(true);
              }}
              onToggleLogs={() => toggleLogs(task.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <TaskFormModal
          task={editingTask}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* ─── Task Card ─── */
function TaskCard({
  task,
  triggering,
  expanded,
  logs,
  logsLoading,
  onTrigger,
  onDelete,
  onToggle,
  onEdit,
  onToggleLogs,
}: {
  task: ScheduledTask;
  triggering: boolean;
  expanded: boolean;
  logs: ExecutionLog[];
  logsLoading: boolean;
  onTrigger: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onToggleLogs: () => void;
}) {
  const presetLabel = CRON_PRESETS.find((p) => p.value === task.cron_expression)?.label;

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm transition-all duration-200 hover:shadow-md">
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Status indicator */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            task.is_active ? 'bg-emerald-50' : 'bg-slate-100'
          )}
        >
          {task.is_active ? (
            <Clock className="h-5 w-5 text-emerald-500" />
          ) : (
            <Pause className="h-5 w-5 text-slate-400" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{task.name}</h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                task.is_active
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {task.is_active ? '运行中' : '已暂停'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Bot ID: {task.bot_id}</span>
            <span className="text-border">|</span>
            <span>
              {presetLabel ? `${presetLabel}` : task.cron_expression}
            </span>
            {task.last_run_at && (
              <>
                <span className="text-border">|</span>
                <span>
                  上次: {new Date(task.last_run_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-slate-50 disabled:opacity-50"
            title="手动触发"
          >
            {triggering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            执行
          </button>
          <button
            onClick={onToggle}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-50',
              task.is_active
                ? 'border-amber-200 text-amber-600'
                : 'border-emerald-200 text-emerald-600'
            )}
            title={task.is_active ? '暂停' : '启用'}
          >
            {task.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {task.is_active ? '暂停' : '启用'}
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-slate-50"
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logs toggle */}
      <div className="border-t border-border px-4 py-2">
        <button
          onClick={onToggleLogs}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          执行日志
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Logs panel */}
      {expanded && (
        <div className="border-t border-border bg-slate-50/50 px-4 py-3">
          {logsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">暂无执行记录</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Log Row ─── */
function LogRow({ log }: { log: ExecutionLog }) {
  const [showDetail, setShowDetail] = useState(false);
  const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    success: { icon: CheckCircle2, color: 'text-emerald-500', label: '成功' },
    failed: { icon: XCircle, color: 'text-rose-500', label: '失败' },
    running: { icon: Loader2, color: 'text-sky-500', label: '执行中' },
  };
  const cfg = statusConfig[log.status] || statusConfig.failed;
  const StatusIcon = cfg.icon;

  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-4 w-4', cfg.color, log.status === 'running' && 'animate-spin')} />
          <span className="text-xs font-medium text-foreground">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {new Date(log.started_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
          </span>
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-[11px] text-sky-500 hover:underline"
          >
            {showDetail ? '收起' : '详情'}
          </button>
        </div>
      </div>
      {showDetail && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {log.prompt_sent && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">发送内容</p>
              <p className="mt-0.5 rounded bg-slate-50 p-2 text-xs text-foreground whitespace-pre-wrap">
                {log.prompt_sent}
              </p>
            </div>
          )}
          {log.response_content && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">返回内容</p>
              <p className="mt-0.5 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-foreground whitespace-pre-wrap">
                {log.response_content}
              </p>
            </div>
          )}
          {log.error_message && (
            <div>
              <p className="text-[11px] font-medium text-rose-500">错误信息</p>
              <p className="mt-0.5 rounded bg-rose-50 p-2 text-xs text-rose-600 whitespace-pre-wrap">
                {log.error_message}
              </p>
            </div>
          )}
          {log.completed_at && (
            <p className="text-[11px] text-muted-foreground">
              完成时间: {new Date(log.completed_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Task Form Modal ─── */
function TaskFormModal({
  task,
  onClose,
  onSave,
}: {
  task: ScheduledTask | null;
  onClose: () => void;
  onSave: (data: { name: string; bot_id: string; cron_expression: string; prompt_template: string }) => void;
}) {
  const [name, setName] = useState(task?.name || '');
  const [botId, setBotId] = useState(task?.bot_id || '');
  const [cronPreset, setCronPreset] = useState(
    CRON_PRESETS.find((p) => p.value === task?.cron_expression)?.value !== undefined
      ? task?.cron_expression || ''
      : ''
  );
  const [customCron, setCustomCron] = useState(
    !CRON_PRESETS.find((p) => p.value === task?.cron_expression) ? task?.cron_expression || '' : ''
  );
  const [prompt, setPrompt] = useState(task?.prompt_template || '');
  const [saving, setSaving] = useState(false);

  const isCustomCron = cronPreset === '';
  const finalCron = isCustomCron ? customCron : cronPreset;

  const handleSubmit = async () => {
    if (!name.trim() || !botId.trim() || !finalCron.trim()) {
      alert('请填写任务名称、Bot ID 和调度时间');
      return;
    }
    setSaving(true);
    await onSave({
      name: name.trim(),
      bot_id: botId.trim(),
      cron_expression: finalCron.trim(),
      prompt_template: prompt,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {task ? '编辑定时任务' : '新建定时任务'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Task name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              任务名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：每日巡检诊断"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Bot ID */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Bot ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder="扣子智能体 ID（URL 中的数字）"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              在扣子平台打开智能体，URL 末尾的数字即为 Bot ID
            </p>
          </div>

          {/* Cron schedule */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              执行频率 <span className="text-rose-500">*</span>
            </label>
            <select
              value={cronPreset}
              onChange={(e) => setCronPreset(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label || '自定义'}
                </option>
              ))}
            </select>
            {isCustomCron && (
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="cron 表达式，如 0 9 * * 1-5"
                className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            )}
          </div>

          {/* Prompt template */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Prompt 模板
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="发送给智能体的消息内容。支持变量：&#10;{{now}} - 当前时间&#10;{{date}} - 当前日期&#10;{{timestamp}} - 时间戳"
              rows={4}
              className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <div className="mt-1.5 flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
              <p className="text-[11px] text-muted-foreground">
                留空则发送空消息。支持变量替换：{'{{now}}'} 当前时间、{'{{date}}'} 当前日期、{'{{timestamp}}'} 时间戳
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {task ? '保存修改' : '创建任务'}
          </button>
        </div>
      </div>
    </div>
  );
}

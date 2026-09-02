"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Clock,
  Plus,
  Power,
  Play,
  Trash2,
  Edit,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  ShieldX,
} from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"
import { useAuth } from "@/components/auth-provider"

interface ScheduledTask {
  id: number
  name: string
  task_type: string
  bot_id: string | null
  workflow_id: string | null
  cron_expression: string
  prompt_template: string
  workflow_parameters: string
  is_active: boolean
  last_run_at: string | null
  created_at: string
  updated_at: string
}

interface TaskLog {
  id: number
  task_id: number
  status: string
  prompt_sent: string | null
  response_content: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export default function ScheduledTasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState<ScheduledTask | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsTaskId, setLogsTaskId] = useState<number | null>(null)
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [triggering, setTriggering] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)
  const [runningTaskIds, setRunningTaskIds] = useState<Set<number>>(new Set())

  // 检查权限（只有超级管理员可以访问）
  const hasPermission = user?.role === 'super_admin'

  // 表单状态
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState("bot")
  const [formBotId, setFormBotId] = useState("")
  const [formWorkflowId, setFormWorkflowId] = useState("")
  const [formCron, setFormCron] = useState("")
  const [formPrompt, setFormPrompt] = useState("")
  const [formWorkflowParams, setFormWorkflowParams] = useState("")

  const fetchTasks = useCallback(async () => {
    try {
      const res = await authFetch("/api/scheduled-tasks")
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // 轮询检查任务执行状态（当有触发中的任务时）
  useEffect(() => {
    if (triggering === null) return
    const timer = setInterval(() => {
      fetchTasks()
    }, 3000)
    return () => clearInterval(timer)
  }, [triggering, fetchTasks])

  const fetchLogs = async (taskId: number) => {
    setLogsTaskId(taskId)
    setLogsOpen(true)
    setLogsLoading(true)
    try {
      const res = await authFetch(`/api/scheduled-tasks/${taskId}/logs?limit=20`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  const resetForm = () => {
    setFormName("")
    setFormType("bot")
    setFormBotId("")
    setFormWorkflowId("")
    setFormCron("")
    setFormPrompt("")
    setFormWorkflowParams("")
  }

  const openCreate = () => {
    resetForm()
    setEditTask(null)
    setCreateOpen(true)
  }

  const openEdit = (task: ScheduledTask) => {
    setFormName(task.name)
    setFormType(task.task_type)
    setFormBotId(task.bot_id || "")
    setFormWorkflowId(task.workflow_id || "")
    setFormCron(task.cron_expression)
    setFormPrompt(task.prompt_template || "")
    setFormWorkflowParams(task.workflow_parameters || "")
    setEditTask(task)
    setCreateOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formCron) return

    const payload = {
      name: formName,
      task_type: formType,
      bot_id: formType === "bot" ? formBotId : null,
      workflow_id: formType === "workflow" ? formWorkflowId : null,
      cron_expression: formCron,
      prompt_template: formPrompt,
      workflow_parameters: formWorkflowParams,
      is_active: true,
    }

    try {
      if (editTask) {
        await authFetch(`/api/scheduled-tasks/${editTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await authFetch("/api/scheduled-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      setCreateOpen(false)
      resetForm()
      fetchTasks()
    } catch (error) {
      console.error("保存失败:", error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此任务？")) return
    try {
      await authFetch(`/api/scheduled-tasks/${id}`, { method: "DELETE" })
      fetchTasks()
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  const handleToggle = async (task: ScheduledTask) => {
    setToggling(task.id)
    try {
      await authFetch(`/api/scheduled-tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !task.is_active }),
      })
      fetchTasks()
    } catch (error) {
      console.error("切换失败:", error)
    } finally {
      setToggling(null)
    }
  }

  const handleTrigger = async (id: number) => {
    setTriggering(id)
    setRunningTaskIds((prev) => new Set(prev).add(id))
    try {
      await authFetch(`/api/scheduled-tasks/${id}/trigger`, { method: "POST" })
      // 轮询刷新会在 useEffect 中处理，5 秒后清除执行状态
      setTimeout(() => {
        fetchTasks()
        setTriggering(null)
        setRunningTaskIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 5000)
    } catch {
      setTriggering(null)
      setRunningTaskIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
  }

  const cronPresets = [
    { label: "每10分钟", value: "*/10 * * * *" },
    { label: "每30分钟", value: "*/30 * * * *" },
    { label: "每小时", value: "0 * * * *" },
    { label: "每2小时", value: "0 */2 * * *" },
    { label: "每天早上8点", value: "0 8 * * *" },
    { label: "每天早晚各一次", value: "0 8,18 * * *" },
  ]

  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldX className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-600 mb-2">无访问权限</h2>
        <p className="text-sm text-gray-500">定时任务管理仅管理员可访问</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">定时任务管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            配置定时调用诊断智能体，系统每天 18:00 自动合并当日报告
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建任务
        </Button>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            任务列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              暂无定时任务，点击"新建任务"创建
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>Cron 表达式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>上次执行</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {task.task_type === "bot" ? "智能体" : "工作流"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{task.cron_expression}</TableCell>
                    <TableCell>
                      {runningTaskIds.has(task.id) || triggering === task.id ? (
                        <Badge className="bg-sky-500 animate-pulse">执行中</Badge>
                      ) : task.is_active ? (
                        <Badge className="bg-emerald-500">运行中</Badge>
                      ) : (
                        <Badge variant="secondary">已暂停</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(task.last_run_at)}
                    </TableCell>
                    <TableCell className="flex items-center justify-end gap-1">
                      {/* 启停切换按钮 */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggle(task)}
                        disabled={toggling === task.id}
                        title={task.is_active ? "暂停" : "启动"}
                      >
                        {toggling === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className={`h-4 w-4 transition-colors ${task.is_active ? "hover:text-rose-500" : "hover:text-emerald-500"}`} />
                        )}
                      </Button>
                      {/* 手动触发按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTrigger(task.id)}
                        disabled={triggering === task.id}
                        title="手动触发"
                      >
                        {triggering === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fetchLogs(task.id)}
                        title="执行日志"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(task)}
                        title="编辑"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600"
                        onClick={() => handleDelete(task.id)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTask ? "编辑任务" : "新建任务"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>任务名称</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如：施工现场诊断（每10分钟）"
              />
            </div>

            <div className="space-y-2">
              <Label>任务类型</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">智能体</SelectItem>
                  <SelectItem value="workflow">工作流</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType === "bot" ? (
              <div className="space-y-2">
                <Label>智能体 Bot ID</Label>
                <Input
                  value={formBotId}
                  onChange={(e) => setFormBotId(e.target.value)}
                  placeholder="输入扣子智能体 ID"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>工作流 Workflow ID</Label>
                <Input
                  value={formWorkflowId}
                  onChange={(e) => setFormWorkflowId(e.target.value)}
                  placeholder="输入扣子工作流 ID"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Cron 表达式</Label>
              <Input
                value={formCron}
                onChange={(e) => setFormCron(e.target.value)}
                placeholder="*/10 * * * *"
                className="font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {cronPresets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => setFormCron(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {formType === "bot" ? (
              <div className="space-y-2">
                <Label>消息模板</Label>
                <textarea
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="发送给智能体的消息，支持 {{now}} {{date}} {{timestamp}} 变量"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>工作流参数 (JSON)</Label>
                <textarea
                  value={formWorkflowParams}
                  onChange={(e) => setFormWorkflowParams(e.target.value)}
                  placeholder='{"input": "value"} 支持 {{now}} {{date}} {{timestamp}} 变量'
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!formName || !formCron}>
                {editTask ? "保存" : "创建"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 执行日志对话框 */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>执行日志</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无执行记录</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <Card key={log.id} className="border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : log.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                          )}
                          <span className="text-sm font-medium">
                            {log.status === "success" ? "成功" : log.status === "failed" ? "失败" : "运行中"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(log.started_at)}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="mt-2 text-xs text-rose-500">{log.error_message}</p>
                      )}
                      {log.response_content && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            查看响应内容
                          </summary>
                          <pre className="mt-1 max-h-[200px] overflow-auto rounded bg-muted p-2 text-xs">
                            {log.response_content.substring(0, 2000)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

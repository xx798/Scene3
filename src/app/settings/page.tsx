"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, RefreshCw, CheckCircle2 } from "lucide-react"

interface WorkflowItem {
  id: string
  name: string
  description: string
  type: string
}

export default function SettingsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // 获取工作流列表
      const wfRes = await fetch("/api/workflows")
      const wfList = await wfRes.json()
      setWorkflows(wfList || [])

      // 获取已选中的设置
      const setRes = await fetch("/api/settings")
      const setData = await setRes.json()
      if (setData?.selected_workflow_ids) {
        setSelectedIds(setData.selected_workflow_ids)
      }
    } catch (e) {
      console.error("加载失败", e)
    }
    setLoading(false)
  }

  function toggleWorkflow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
    setSaved(false)
  }

  async function saveSettings() {
    setSaving(true)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_workflow_ids: selectedIds }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error("保存失败", e)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">系统设置</h1>
          <p className="text-sm text-[#64748B] mt-1">
            勾选需要自动调用的工作流，系统将定期执行并自动保存诊断结果
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
          <Button size="sm" onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg">
          <CheckCircle2 className="h-4 w-4" />
          设置已保存，调度引擎将自动执行选中的工作流
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">工作流调度配置</CardTitle>
          <CardDescription>
            选中后系统将自动定期调用这些工作流，诊断结果自动入库，每天18:00自动合并生成总报告
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-[#64748B]">
              暂无可用工作流
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((wf) => {
                const checked = selectedIds.includes(wf.id)
                return (
                  <label
                    key={wf.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? "border-sky-300 bg-sky-50/50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWorkflow(wf.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[#0F172A]">{wf.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {wf.type}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1 line-clamp-2">
                        {wf.description || "暂无描述"}
                      </p>
                    </div>
                    {checked && (
                      <span className="text-xs text-sky-500 font-medium whitespace-nowrap">已选中</span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">自动调度说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#64748B] space-y-2">
          <p>• 系统每 <strong>10 分钟</strong> 自动执行一次所有选中的诊断工作流</p>
          <p>• 每次执行结果自动解析并存入 <code>daily_diagnose_data</code> 数据库</p>
          <p>• 每天 <strong>18:00 (北京时间)</strong> 自动合并当日所有诊断记录，生成汇总 Excel 报告</p>
          <p>• 生成的报告可在"报告下载"页面查看和下载</p>
          <p className="text-xs text-gray-400 mt-2">
            {selectedIds.length > 0
              ? `当前已选中 ${selectedIds.length} 个工作流`
              : "暂未选中任何工作流，需至少选中一个才能自动调度"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
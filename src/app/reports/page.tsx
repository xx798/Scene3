"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Download, FileSpreadsheet, CalendarIcon, Loader2, AlertCircle, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface DiagnoseImage {
  image_url: string
  camera_id: string
  site_name_watermark: string
  status: string
}

interface DailyReport {
  id: number
  report_date: string
  excel_url: string
  file_name: string
  total_count: number
  abnormal_count: number
  normal_count: number
  created_at: string
  diagnose_images: DiagnoseImage[]
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [generating, setGenerating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [lightbox, setLightbox] = useState<{ images: DiagnoseImage[]; index: number } | null>(null)

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports")
      const data = await res.json()
      setReports(data)
    } catch (error) {
      console.error("获取报告列表失败:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleGenerate = async () => {
    if (!selectedDate) return

    setGenerating(true)
    setMessage(null)

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      })
      const data = await res.json()

      if (data.success) {
        setMessage({ type: "success", text: data.message || `报告生成成功` })
        fetchReports()
      } else {
        setMessage({ type: "error", text: data.message || data.error || "生成失败" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "生成报告失败" })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (report: DailyReport) => {
    try {
      // 调用下载接口，后端会自动处理文件生成
      const response = await fetch(`/api/reports/download?id=${report.id}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `下载失败: HTTP ${response.status}`)
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = report.file_name
      link.click()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("下载报告失败:", error)
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "下载失败，请重试",
      })
    }
  }

  const handleDelete = async (report: DailyReport) => {
    if (!confirm(`确定删除 ${report.report_date} 的报告吗？`)) return

    setDeletingId(report.id)
    setMessage(null)

    try {
      const res = await fetch(`/api/reports?id=${report.id}`, { method: "DELETE" })
      const data = await res.json()

      if (data.success) {
        setMessage({ type: "success", text: `${report.report_date} 报告已删除` })
        fetchReports()
      } else {
        setMessage({ type: "error", text: data.error || "删除失败" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "删除失败，请重试" })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">报告下载</h1>
        <p className="text-muted-foreground mt-1">生成并下载每日诊断汇总报告</p>
      </div>

      {/* 生成报告 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            生成每日汇总报告
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">选择日期</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "yyyy-MM-dd") : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedDate}
              className="gap-2"
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
            </Button>
          </div>

          {message && (
            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded-lg p-3 text-sm",
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              )}
            >
              {message.type === "error" && <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报告列表 */}
      <Card>
        <CardHeader>
          <CardTitle>历史报告</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">暂无报告</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                选择日期并点击"生成报告"来创建每日汇总报告
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{report.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.report_date} · 共 {report.total_count} 条 · 异常{" "}
                          <span className="text-rose-500 font-medium">{report.abnormal_count}</span> 条
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleDownload(report)}
                        disabled={!report.excel_url}
                      >
                        <Download className="h-4 w-4" />
                        下载
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDelete(report)}
                        disabled={deletingId === report.id}
                      >
                        {deletingId === report.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        删除
                      </Button>
                    </div>
                  </div>

                  {/* 诊断图片缩略图 */}
                  {report.diagnose_images && report.diagnose_images.length > 0 && (
                    <div className="border-t border-border px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        诊断图片 ({report.diagnose_images.length} 张)
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {report.diagnose_images.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightbox({ images: report.diagnose_images, index: idx })}
                            className="group relative shrink-0 rounded-md border border-border overflow-hidden transition-transform hover:scale-105"
                          >
                            <img
                              src={img.image_url}
                              alt={`${img.camera_id || img.site_name_watermark || '诊断'} 现场图片`}
                              className="h-16 w-22 object-cover"
                              loading="lazy"
                            />
                            {img.status === "abnormal" && (
                              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-white" />
                            )}
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white px-1 py-0.5 truncate">
                              {img.camera_id || img.site_name_watermark || `#${idx + 1}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 图片预览 Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* 左右切换 */}
          {lightbox.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({
                    ...lightbox,
                    index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length,
                  })
                }}
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({
                    ...lightbox,
                    index: (lightbox.index + 1) % lightbox.images.length,
                  })
                }}
                className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="flex flex-col items-center gap-3 max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.images[lightbox.index].image_url}
              alt={`${lightbox.images[lightbox.index].camera_id || '诊断'} 现场图片`}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
            />
            <div className="text-center text-sm text-white/80">
              <span className="font-medium text-white">
                {lightbox.images[lightbox.index].camera_id || lightbox.images[lightbox.index].site_name_watermark || `#${lightbox.index + 1}`}
              </span>
              <span className="mx-2">·</span>
              <span>{lightbox.index + 1} / {lightbox.images.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { CronJob } from "cron"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { mergeAndSaveDailyReport } from "./report-generator"
import { parseDiagnosisJSON, saveDiagnosisResult } from "./diagnosis-processor"

interface DiagnosisData {
  camera_id?: string
  site_name_watermark?: string
  camera_status?: string
  camera_abnormal_desc?: string
  risk_items?: Array<{ item_name: string; status: string; risk_desc: string }>
  capture_time?: string
  image_url?: string
  excel_url?: string
}

/**
 * 调用扣子工作流 API
 */
async function callCozeWorkflow(
  workflowId: string
): Promise<Record<string, unknown>> {
  const token = process.env.COZE_WORKLOAD_API_TOKEN
  const baseUrl = process.env.COZE_API_BASE_URL || "https://api.coze.cn"

  const response = await fetch(`${baseUrl}/v1/workflow/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      parameters: {},
    }),
  })

  const result = await response.json()

  if (result.data) {
    try {
      return JSON.parse(result.data)
    } catch {
      return { output: result.data }
    }
  }
  throw new Error(result.msg || "工作流调用失败")
}

/**
 * 从工作流输出中提取诊断数据并保存
 */
async function processWorkflowOutput(
  workflowId: string,
  data: Record<string, unknown>
): Promise<string> {
  const fullText = JSON.stringify(data)

  // 尝试从不同字段提取诊断 JSON
  let diagnosisData: DiagnosisData | null = null

  if (data.body && typeof data.body === "string") {
    diagnosisData = parseDiagnosisJSON(data.body)
  } else if (data.inspection_result && typeof data.inspection_result === "string") {
    diagnosisData = parseDiagnosisJSON(data.inspection_result)
  } else {
    diagnosisData = parseDiagnosisJSON(fullText)
  }

  // 补充工作流顶层字段
  if (diagnosisData) {
    if (!diagnosisData.camera_id && data.serial) {
      diagnosisData.camera_id = String(data.serial)
    }
    if (!diagnosisData.image_url && data.image_url) {
      diagnosisData.image_url = String(data.image_url)
    }
    if (!diagnosisData.capture_time && data.capture_time) {
      diagnosisData.capture_time = String(data.capture_time)
    }
    if (!diagnosisData.excel_url && data.URL) {
      diagnosisData.excel_url = String(data.URL)
    }
    await saveDiagnosisResult(diagnosisData)
  }

  return fullText
}

/**
 * 运行所有选中的工作流
 */
async function runSelectedWorkflows(): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "workflow_selection")
      .limit(1)

    if (!settings || settings.length === 0) return

    const selectedIds: string[] = settings[0].setting_value?.selected_workflow_ids || []
    if (selectedIds.length === 0) return

    console.log(`[Scheduler] 开始执行 ${selectedIds.length} 个工作流...`)

    // 获取工作流名称映射
    const { data: workflowNames } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "workflow_names")
      .limit(1)

    const namesMap: Record<string, string> = {}
    if (workflowNames && workflowNames.length > 0) {
      Object.assign(namesMap, workflowNames[0].setting_value)
    }

    for (const workflowId of selectedIds) {
      const name = namesMap[workflowId] || workflowId
      console.log(`[Scheduler] 执行工作流: ${name} (${workflowId})`)
      try {
        const data = await callCozeWorkflow(workflowId)
        await processWorkflowOutput(workflowId, data)
        console.log(`[Scheduler] 工作流 ${name} 执行成功`)
      } catch (err) {
        console.error(`[Scheduler] 工作流 ${name} 执行失败:`, err)
      }
    }

    console.log(`[Scheduler] 本轮工作流执行完毕`)
  } catch (error) {
    console.error("[Scheduler] 运行工作流出错:", error)
  }
}

/**
 * 执行每日报告合并任务（18:00 触发）
 */
async function executeDailyMerge(): Promise<void> {
  const today = new Date()
    .toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-")

  console.log(`[Scheduler] 开始执行每日报告合并: ${today}`)
  const result = await mergeAndSaveDailyReport(today)
  console.log(`[Scheduler] 每日报告合并结果: ${result.message}`)
}

let mainJob: CronJob | null = null
let dailyMergeJob: CronJob | null = null

/**
 * 初始化调度引擎
 * - 每 10 分钟运行一次选中的工作流
 * - 每天 18:00 合并当日报告
 */
export async function initScheduler(): Promise<void> {
  try {
    // 停止已有任务
    if (mainJob) { mainJob.stop() }
    if (dailyMergeJob) { dailyMergeJob.stop() }

    // 主调度：每 10 分钟运行一次选中的工作流
    mainJob = new CronJob(
      "*/10 * * * *",
      () => {
        runSelectedWorkflows().catch(console.error)
      },
      null,
      false,
      "Asia/Shanghai"
    )
    mainJob.start()
    console.log("[Scheduler] 主调度任务已注册 (每 10 分钟)")

    // 每天 18:00 合并当日报告
    dailyMergeJob = new CronJob(
      "0 18 * * *",
      () => {
        executeDailyMerge().catch(console.error)
      },
      null,
      false,
      "Asia/Shanghai"
    )
    dailyMergeJob.start()
    console.log("[Scheduler] 每日报告合并任务已注册 (每天 18:00 CST)")

    // 启动后立即执行一次
    runSelectedWorkflows().catch(console.error)

    console.log("[Scheduler] 调度引擎初始化完成")
  } catch (error) {
    console.error("[Scheduler] 初始化失败:", error)
  }
}
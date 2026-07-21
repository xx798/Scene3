import { CronJob } from "cron"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { mergeAndSaveDailyReport } from "./report-generator"

interface TaskConfig {
  id: number
  name: string
  task_type: string
  bot_id: string | null
  workflow_id: string | null
  cron_expression: string
  prompt_template: string
  workflow_parameters: string
  is_active: boolean
}

const jobs = new Map<number, CronJob>()

/**
 * 从文本中提取所有 markdown 代码块的内容
 */
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = []
  const regex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim()
    if (content) blocks.push(content)
  }
  return blocks
}

/**
 * 用花括号配对法从文本中逐个提取完整的 JSON 对象
 */
function extractBraceObjects(text: string): string[] {
  const objects: string[] = []
  let depth = 0
  let start = -1

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    // 跳过字符串内的花括号
    if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
      // 跳过整个字符串
      i++
      while (i < text.length) {
        if (text[i] === '"' && text[i - 1] !== "\\") break
        i++
      }
      continue
    }
    if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        objects.push(text.substring(start, i + 1))
        start = -1
      }
    }
  }
  return objects
}

/**
 * 尝试解析单个 JSON 字符串，失败返回 null
 */
function tryParseJSON(str: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(str)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/**
 * 从对象中提取诊断数组（检查常见嵌套字段名）
 */
function extractArrayFromObject(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  const arrayKeys = ["results", "devices", "data", "items", "cameras", "diagnoses", "records", "list"]
  for (const key of arrayKeys) {
    const val = obj[key]
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
      return val as Record<string, unknown>[]
    }
  }
  // 遍历所有字段，找到第一个对象数组
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 1 && typeof val[0] === "object" && val[0] !== null) {
      return val as Record<string, unknown>[]
    }
  }
  return null
}

/**
 * 解析智能体/工作流返回的诊断结果，支持单设备和多设备格式
 * 返回诊断对象数组（至少包含 1 个元素，解析失败返回空数组）
 *
 * 支持的格式：
 * 1. 多个 markdown 代码块，每个包含一个 JSON 对象
 * 2. 标准 JSON 数组 [{...}, {...}]
 * 3. 对象内含数组字段 {"results": [{...}, {...}]}
 * 4. 多个 JSON 对象直接拼接 {...} {...}
 * 5. 单个 JSON 对象 {...}
 */
function parseDiagnosisList(text: string): Record<string, unknown>[] {
  if (!text) return []

  // 优先级1：提取所有 markdown 代码块
  const codeBlocks = extractCodeBlocks(text)
  if (codeBlocks.length > 1) {
    // 多个代码块 → 逐个解析
    const results: Record<string, unknown>[] = []
    for (const block of codeBlocks) {
      // 代码块内可能是数组
      try {
        const parsed = JSON.parse(block)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "object" && item !== null) {
              results.push(item as Record<string, unknown>)
            }
          }
        } else if (typeof parsed === "object" && parsed !== null) {
          results.push(parsed as Record<string, unknown>)
        }
      } catch {
        const obj = tryParseJSON(block)
        if (obj) results.push(obj)
      }
    }
    if (results.length > 0) return results
  }

  // 优先级2：尝试直接 JSON.parse（可能是数组或单个对象）
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    }
    if (typeof parsed === "object" && parsed !== null) {
      // 检查对象内是否嵌套数组
      const nested = extractArrayFromObject(parsed as Record<string, unknown>)
      if (nested) return nested
      // 单个对象
      return [parsed as Record<string, unknown>]
    }
  } catch {
    // 不是合法 JSON，继续尝试其他方式
  }

  // 优先级3：单个代码块的情况
  if (codeBlocks.length === 1) {
    const obj = tryParseJSON(codeBlocks[0])
    if (obj) {
      const nested = extractArrayFromObject(obj)
      if (nested) return nested
      return [obj]
    }
  }

  // 优先级4：花括号配对法提取多个对象
  const braceObjects = extractBraceObjects(trimmed)
  if (braceObjects.length > 1) {
    const results: Record<string, unknown>[] = []
    for (const objStr of braceObjects) {
      const obj = tryParseJSON(objStr)
      if (obj) results.push(obj)
    }
    if (results.length > 0) return results
  }

  // 优先级5：降级 — 取第一个 { 到最后一个 } 之间的内容
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const obj = tryParseJSON(trimmed.substring(firstBrace, lastBrace + 1))
    if (obj) {
      const nested = extractArrayFromObject(obj)
      if (nested) return nested
      return [obj]
    }
  }

  return []
}

/**
 * 将诊断结果保存到 daily_diagnose_data 表
 */
async function saveDiagnosisResult(data: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClient()
  const riskItems = Array.isArray(data.risk_items) ? data.risk_items : []

  const hasAbnormal = riskItems.some(
    (item: Record<string, string>) => item.status === "异常"
  )
  const isCameraAbnormal = data.camera_status && data.camera_status !== "正常"
  const status = hasAbnormal || isCameraAbnormal ? "abnormal" : "normal"

  await supabase.from("daily_diagnose_data").insert({
    diagnose_time: new Date().toISOString(),
    camera_id: (data.camera_id as string) || null,
    site_name_watermark: (data.site_name_watermark as string) || null,
    camera_status: (data.camera_status as string) || "正常",
    camera_abnormal_desc: (data.camera_abnormal_desc as string) || "正常",
    risk_items: riskItems,
    capture_time: data.capture_time
      ? new Date(data.capture_time as string).toISOString()
      : new Date().toISOString(),
    status,
  })
}

/**
 * 替换模板变量
 */
function replaceTemplateVars(template: string): string {
  const now = new Date()
  return template
    .replace(/\{\{now\}\}/g, now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }))
    .replace(/\{\{date\}\}/g, now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }))
    .replace(/\{\{timestamp\}\}/g, String(now.getTime()))
}

/**
 * 调用扣子 Bot API
 */
async function callCozeBot(botId: string, message: string): Promise<string> {
  const token = process.env.COZE_WORKLOAD_API_TOKEN
  const baseUrl = process.env.COZE_API_BASE_URL || "https://api.coze.cn"

  const response = await fetch(`${baseUrl}/v3/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bot_id: botId,
      user_id: "scheduler",
      stream: false,
      auto_save_history: true,
      additional_messages: [
        {
          role: "user",
          content: message,
          content_type: "text",
        },
      ],
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`Bot 调用失败: HTTP ${response.status}, ${JSON.stringify(result)}`)
  }

  if (result.data && result.data.length > 0) {
    const chatId = result.data[0].id
    const conversationId = result.data[0].conversation_id

    // 轮询获取结果
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000))

      const retrieveRes = await fetch(`${baseUrl}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const retrieveData = await retrieveRes.json()

      if (retrieveData.data && retrieveData.data.status === "completed") {
        const msgRes = await fetch(
          `${baseUrl}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const msgData = await msgRes.json()
        const botMessage = msgData.data?.find(
          (m: Record<string, string>) => m.role === "assistant" && m.type === "answer"
        )
        return botMessage?.content || ""
      }
    }
  }
  throw new Error("Bot 调用超时或失败")
}

/**
 * 调用扣子工作流 API（带 60 秒超时）
 */
async function callCozeWorkflow(
  workflowId: string,
  parameters: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = process.env.COZE_WORKLOAD_API_TOKEN
  const baseUrl = process.env.COZE_API_BASE_URL || "https://api.coze.cn"

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(`${baseUrl}/v1/workflow/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters,
      }),
      signal: controller.signal,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`工作流调用失败: HTTP ${response.status}, ${JSON.stringify(result)}`)
    }

    // code=0 表示调用成功
    if (result.code === 0) {
      if (result.data) {
        try {
          return JSON.parse(result.data)
        } catch {
          return { output: result.data }
        }
      }
      // 调用成功但 data 为空，返回空对象（工作流可能无输出或当前无施工）
      return {}
    }

    throw new Error(`工作流调用失败: code=${result.code}, msg=${result.msg || "未知错误"}`)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("工作流调用超时（60s）")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 执行单次诊断任务并保存结果
 */
async function executeDiagnosisTask(task: TaskConfig): Promise<{
  success: boolean
  responseText: string
  error?: string
}> {
  try {
    if (task.task_type === "bot" && task.bot_id) {
      const message = replaceTemplateVars(
        task.prompt_template || "请对当前施工图片进行诊断分析"
      )
      const fullText = await callCozeBot(task.bot_id, message)

      // 解析诊断结果（支持单设备和多设备）
      const diagnosisList = parseDiagnosisList(fullText)
      for (const diagnosis of diagnosisList) {
        await saveDiagnosisResult(diagnosis)
      }

      return { success: true, responseText: fullText }
    }

    if (task.task_type === "workflow" && task.workflow_id) {
      let params: Record<string, unknown> = {}
      if (task.workflow_parameters) {
        try {
          params = JSON.parse(replaceTemplateVars(task.workflow_parameters))
        } catch {
          params = {}
        }
      }

      const data = await callCozeWorkflow(task.workflow_id, params)
      const fullText = JSON.stringify(data)

      // 尝试从工作流输出中提取诊断结果（支持多设备）
      let diagnosisList: Record<string, unknown>[] = []

      if (data.body && typeof data.body === "string") {
        diagnosisList = parseDiagnosisList(data.body)
      } else if (data.inspection_result && typeof data.inspection_result === "string") {
        diagnosisList = parseDiagnosisList(data.inspection_result)
      } else {
        diagnosisList = parseDiagnosisList(fullText)
      }

      // 逐条补充工作流字段并入库
      for (const diagnosisData of diagnosisList) {
        if (!diagnosisData.camera_id && data.serial) {
          diagnosisData.camera_id = data.serial
        }
        if (!diagnosisData.capture_time && data.capture_time) {
          diagnosisData.capture_time = data.capture_time
        }
        await saveDiagnosisResult(diagnosisData)
      }

      return { success: true, responseText: fullText }
    }

    return { success: false, responseText: "", error: "任务配置无效" }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, responseText: "", error: errorMsg }
  }
}

/**
 * 执行任务（通用入口）
 */
export async function executeTask(taskId: number): Promise<void> {
  const supabase = getSupabaseClient()

  const { data: tasks, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", taskId)
    .limit(1)

  if (error || !tasks || tasks.length === 0) return
  const task = tasks[0] as TaskConfig
  if (!task.is_active) return

  // 记录执行日志
  const { data: logEntry } = await supabase
    .from("task_execution_logs")
    .insert({
      task_id: taskId,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .limit(1)

  try {
    const result = await executeDiagnosisTask(task)

    if (logEntry && logEntry.length > 0) {
      await supabase
        .from("task_execution_logs")
        .update({
          status: result.success ? "success" : "failed",
          prompt_sent:
            task.task_type === "bot" ? task.prompt_template : task.workflow_parameters,
          response_content: result.responseText.substring(0, 10000),
          error_message: result.error || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logEntry[0].id)
    }

    await supabase
      .from("scheduled_tasks")
      .update({
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
  } catch (error) {
    if (logEntry && logEntry.length > 0) {
      await supabase
        .from("task_execution_logs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq("id", logEntry[0].id)
    }
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

function scheduleTask(task: TaskConfig): void {
  if (jobs.has(task.id)) {
    jobs.get(task.id)?.stop()
    jobs.delete(task.id)
  }

  if (!task.is_active) return

  try {
    const job = new CronJob(task.cron_expression, () => {
      executeTask(task.id).catch(console.error)
    })
    job.start()
    jobs.set(task.id, job)
  } catch (e) {
    console.error(`[Scheduler] cron 表达式无效 "${task.cron_expression}":`, e)
  }
}

let dailyMergeJob: CronJob | null = null

export async function initScheduler(): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const { data: tasks } = await supabase.from("scheduled_tasks").select("*")

    for (const task of tasks || []) {
      scheduleTask(task as TaskConfig)
    }

    // 每天 18:00 (Asia/Shanghai) 自动合并当日报告
    if (!dailyMergeJob) {
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
    }

    console.log(`[Scheduler] 已加载 ${(tasks || []).length} 个定时任务`)
  } catch (error) {
    console.error("[Scheduler] 初始化失败:", error)
  }
}

export async function reloadTask(taskId: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { data: tasks } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", taskId)
    .limit(1)

  if (!tasks || tasks.length === 0) {
    if (jobs.has(taskId)) {
      jobs.get(taskId)?.stop()
      jobs.delete(taskId)
    }
    return
  }

  scheduleTask(tasks[0] as TaskConfig)
}

export async function stopTask(taskId: number): Promise<void> {
  if (jobs.has(taskId)) {
    jobs.get(taskId)?.stop()
    jobs.delete(taskId)
  }
}

export function getLoadedTaskIds(): number[] {
  return Array.from(jobs.keys())
}

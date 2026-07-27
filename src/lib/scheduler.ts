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

// 追踪正在执行的任务的 AbortController，用于暂停时强制中止
const runningControllers = new Map<number, AbortController>()

/**
 * 中止正在执行的任务
 */
export function abortTask(taskId: number): void {
  const controller = runningControllers.get(taskId)
  if (controller) {
    controller.abort()
    runningControllers.delete(taskId)
    console.log(`[Scheduler] 任务 ${taskId} 已被中止`)
  }
}

/**
 * 检查任务是否正在执行中
 */
export function isTaskRunning(taskId: number): boolean {
  return runningControllers.has(taskId)
}

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
 * 只有当数组元素包含诊断特征字段（camera_id / site_name_watermark / camera_status）时才返回，
 * 避免将 risk_items 等非诊断数组误识别为诊断列表
 */
function isDiagnosisObject(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false
  const record = obj as Record<string, unknown>
  return "camera_id" in record || "site_name_watermark" in record || "camera_status" in record
}

function extractArrayFromObject(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  const arrayKeys = ["results", "devices", "data", "items", "cameras", "diagnoses", "records", "list"]
  for (const key of arrayKeys) {
    const val = obj[key]
    if (Array.isArray(val) && val.length > 0 && isDiagnosisObject(val[0])) {
      return val as Record<string, unknown>[]
    }
  }
  // 遍历所有字段，找到第一个诊断对象数组
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 1 && isDiagnosisObject(val[0])) {
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
      // 检查是否是嵌套结构（如 {output: "JSON字符串"}）
      const nested = extractNestedJSON(parsed as Record<string, unknown>)
      if (nested) {
        if (Array.isArray(nested)) return nested
        const arr = extractArrayFromObject(nested)
        if (arr) return arr
        return [nested]
      }
      // 检查对象内是否嵌套数组
      const nestedArr = extractArrayFromObject(parsed as Record<string, unknown>)
      if (nestedArr) return nestedArr
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
 * 清理 JSON 字符串中的模板残留（如 {{}}、{{xxx}}）
 */
function cleanJSONString(str: string): string {
  // 移除 {{}} 和 {{...}} 等模板标记
  return str.replace(/\{\{[^}]*\}\}/g, "").replace(/\{\{\}\}/g, "")
}

/**
 * 尝试从对象的 output/data/result 等字段中提取嵌套的 JSON 字符串并解析
 * 返回单个对象或对象数组（当嵌套内容包含多个拼接的 JSON 对象时）
 */
function extractNestedJSON(
  obj: Record<string, unknown>
): Record<string, unknown> | Record<string, unknown>[] | null {
  const fieldsToCheck = ["output", "data", "result", "content", "response"]
  for (const field of fieldsToCheck) {
    const value = obj[field]
    if (typeof value === "string" && value.trim().startsWith("{")) {
      const cleaned = cleanJSONString(value)
      // 先尝试直接解析为单个 JSON
      try {
        const parsed = JSON.parse(cleaned)
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // 不是单个 JSON，尝试用花括号配对法提取多个对象
        const multiObjects = extractBraceObjects(cleaned)
        if (multiObjects.length > 0) {
          const results: Record<string, unknown>[] = []
          for (const objStr of multiObjects) {
            const parsed = tryParseJSON(objStr)
            if (parsed) results.push(parsed)
          }
          if (results.length > 0) return results
        }
      }
    }
  }
  return null
}

/**
 * 解析 capture_time，处理各种格式（包括无效格式）
 */
function parseCaptureTime(value: unknown): string {
  const now = new Date().toISOString()
  if (!value || typeof value !== "string") return now

  const str = value.trim()
  // 跳过明显无效的值
  if (!str || str === "无" || str === "null" || str === "undefined") return now

  // 尝试解析为时间戳（纯数字）
  if (/^\d{10,13}$/.test(str)) {
    const ts = str.length === 10 ? parseInt(str) * 1000 : parseInt(str)
    const date = new Date(ts)
    if (!isNaN(date.getTime())) return date.toISOString()
  }

  // 尝试标准日期格式
  const date = new Date(str)
  if (!isNaN(date.getTime())) return date.toISOString()

  // 无法解析，返回当前时间
  return now
}

/**
 * 将诊断结果保存到 daily_diagnose_data 表
 */
async function saveDiagnosisResult(data: Record<string, unknown>): Promise<void> {
  // 跳过没有有效诊断数据的空对象
  if (!data.camera_id && !data.camera_status && (!Array.isArray(data.risk_items) || data.risk_items.length === 0)) {
    console.log("[scheduler] 跳过空诊断记录:", JSON.stringify(data).substring(0, 200))
    return
  }

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
    capture_time: parseCaptureTime(data.capture_time),
    image_url: (data.image_url as string) || null,
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
async function callCozeBot(botId: string, message: string, signal?: AbortSignal): Promise<string> {
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
    signal,
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`Bot 调用失败: HTTP ${response.status}, ${JSON.stringify(result)}`)
  }

  // 兼容 data 为数组或对象两种格式
  const chatData = Array.isArray(result.data) ? result.data[0] : result.data
  if (chatData && chatData.id) {
    const chatId = chatData.id
    const conversationId = chatData.conversation_id

    // 轮询获取结果（最多 6 分钟）
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => setTimeout(r, 2000))

      const retrieveRes = await fetch(`${baseUrl}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })
      const retrieveData = await retrieveRes.json()

      if (retrieveData.data && retrieveData.data.status === "completed") {
        const msgRes = await fetch(
          `${baseUrl}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
          { headers: { Authorization: `Bearer ${token}` }, signal }
        )
        const msgData = await msgRes.json()
        // 获取所有 assistant 消息并合并（智能体可能返回多条消息）
        const botMessages = msgData.data?.filter(
          (m: Record<string, string>) => m.role === "assistant" && m.type === "answer"
        ) || []
        return botMessages.map((m: Record<string, string>) => m.content).join("\n")
      }
    }
  }
  throw new Error("Bot 调用超时或失败")
}

/**
 * 调用扣子工作流流式 API（stream_run），收集输出节点的完整内容
 */
async function callCozeWorkflow(
  workflowId: string,
  parameters: Record<string, unknown>,
  externalSignal?: AbortSignal
): Promise<Record<string, unknown>> {
  const token = process.env.COZE_WORKLOAD_API_TOKEN
  const baseUrl = process.env.COZE_API_BASE_URL || "https://api.coze.cn"

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 360000) // 6 分钟超时

  // 如果有外部 signal（暂停中止），监听它并转发到内部 controller
  let onExternalAbort: (() => void) | null = null
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      onExternalAbort = () => controller.abort()
      externalSignal.addEventListener("abort", onExternalAbort)
    }
  }

  try {
    const response = await fetch(`${baseUrl}/v1/workflow/stream_run`, {
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

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`工作流调用失败: HTTP ${response.status}, ${errorText}`)
    }

    if (!response.body) {
      throw new Error("工作流返回无响应体")
    }

    // 解析 SSE 流，收集输出节点的 content
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let outputContent = ""
    let buffer = ""
    let hasError = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || "" // 保留未完成的行

      for (const line of lines) {
        if (!line.startsWith("data:")) continue
        const jsonStr = line.slice(5).trim()
        if (!jsonStr || jsonStr === "[DONE]") continue

        try {
          const event = JSON.parse(jsonStr)

          // 收集错误信息
          if (event.error_code) {
            hasError = `error_code=${event.error_code}, msg=${event.error_message || "未知错误"}`
          }

          // 收集输出节点的内容（node_type=Message 且有 content）
          // 过滤掉空内容 {} 和中间节点的无效输出
          if (event.content && event.node_type === "Message") {
            const content = event.content.trim()
            // 跳过空对象 {} 或纯空白内容
            if (content && content !== "{}" && content.length > 2) {
              outputContent += content
            }
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }

    // 如果有错误且没有输出内容，抛出错误
    if (hasError && !outputContent) {
      throw new Error(`工作流调用失败: ${hasError}`)
    }

    // 尝试解析输出内容为 JSON
    if (outputContent) {
      try {
        return JSON.parse(outputContent)
      } catch {
        // 输出不是合法 JSON，尝试提取多个拼接的 JSON 对象
        const cleaned = cleanJSONString(outputContent)
        const objects = extractBraceObjects(cleaned)
        if (objects.length > 0) {
          const results: Record<string, unknown>[] = []
          for (const objStr of objects) {
            try {
              const parsed = JSON.parse(objStr)
              if (typeof parsed === "object" && parsed !== null) {
                results.push(parsed)
              }
            } catch {
              // 忽略无法解析的对象
            }
          }
          if (results.length > 0) {
            return results.length === 1 ? results[0] : { results }
          }
        }
        // 无法提取有效对象，包装返回
        return { output: outputContent }
      }
    }

    // 无输出内容
    return {}
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // 区分是外部中止还是超时
      if (externalSignal?.aborted) {
        throw new Error("任务已被手动中止")
      }
      throw new Error("工作流调用超时（6分钟）")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    if (onExternalAbort && externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort)
    }
  }
}

/**
 * 执行单次诊断任务并保存结果
 */
async function executeDiagnosisTask(
  task: TaskConfig,
  signal?: AbortSignal
): Promise<{
  success: boolean
  responseText: string
  error?: string
}> {
  try {
    if (task.task_type === "bot" && task.bot_id) {
      const message = replaceTemplateVars(
        task.prompt_template || "请对当前施工图片进行诊断分析"
      )
      const fullText = await callCozeBot(task.bot_id, message, signal)

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

      const data = await callCozeWorkflow(task.workflow_id, params, signal)
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
 * @param taskId 任务 ID
 * @param force 是否强制执行（忽略 is_active 检查，用于手动触发）
 */
export async function executeTask(taskId: number, force = false): Promise<void> {
  const supabase = getSupabaseClient()

  const { data: tasks, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", taskId)
    .limit(1)

  if (error || !tasks || tasks.length === 0) return
  const task = tasks[0] as TaskConfig
  // 定时调度执行时检查 is_active；手动触发（force=true）时跳过检查
  if (!force && !task.is_active) return

  // 创建 AbortController 用于追踪和中止
  const controller = new AbortController()
  runningControllers.set(taskId, controller)

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
    const result = await executeDiagnosisTask(task, controller.signal)

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
  } finally {
    runningControllers.delete(taskId)
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
    const job = new CronJob(
      task.cron_expression,
      () => {
        executeTask(task.id).catch(console.error)
      },
      null,
      false,
      "Asia/Shanghai"
    )
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

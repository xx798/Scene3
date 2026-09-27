type JsonObject = Record<string, unknown>
export const DEFAULT_HIA_API_URL = "https://hiagent.deyunai.com/api/proxy/api/v1/sync_run_app_workflow"
const object = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value)

export function normalizeHiaApiUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 255) {
    throw new Error("请输入有效的 HIA API 地址")
  }
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error("HIA API 地址格式无效") }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error("HIA API 地址必须是无账号、查询参数和锚点的 HTTP/HTTPS 地址")
  }
  if (!url.pathname.replace(/\/$/, "").endsWith("/sync_run_app_workflow")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/sync_run_app_workflow`
  }
  return url.toString()
}

export function validateHiaConfig(apiKey: unknown, apiUrl: unknown, parameters: unknown): string | null {
  if (typeof apiKey !== "string" || !apiKey.trim() || /^HIA_API_KEY(?:_[A-Z0-9_]+)?$/.test(apiKey.trim())) {
    return "请输入 HIA API Key"
  }
  if (apiKey.length > 255 || /[\r\n\0]/.test(apiKey)) {
    return "HIA API Key 格式无效"
  }
  try { normalizeHiaApiUrl(apiUrl) } catch (error) {
    return error instanceof Error ? error.message : "HIA API 地址格式无效"
  }
  try {
    const params: unknown = JSON.parse(typeof parameters === "string" ? parameters : "")
    if (!object(params) || !Number.isInteger(params.limit) || Number(params.limit) < 0) {
      return 'HIA 参数必须是 JSON 对象，包含非负整数 limit，例如 {"limit":0}'
    }
  } catch { return "HIA 工作流参数不是有效 JSON" }
  return null
}

/** Do not turn unresolved template values or camera-list metadata into diagnoses. */
export function extractHiaDiagnoses(value: unknown): JsonObject[] {
  const found = new Map<string, JsonObject>()
  let visited = 0
  function visit(item: unknown, depth = 0): void {
    if (++visited > 100000 || depth > 40) throw new Error("HIA 返回内容过于复杂，无法安全解析")
    if (typeof item === "string") {
      const text = item.trim()
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch {
        for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) visit(match[1], depth + 1)
        return
      }
      visit(parsed, depth + 1)
    } else if (Array.isArray(item)) {
      for (const child of item) visit(child, depth + 1)
    } else if (object(item)) {
      if (typeof item.camera_id === "string" && item.camera_id.trim() &&
          typeof item.camera_status === "string" && item.camera_status.trim() &&
          Array.isArray(item.risk_items) &&
          item.risk_items.every(risk => object(risk) &&
            typeof risk.item_name === "string" && typeof risk.status === "string" &&
            risk.status.trim() && typeof risk.risk_desc === "string") &&
          !JSON.stringify(item).includes("{{")) {
        const result = Object.fromEntries(
          ["camera_id", "site_name_watermark", "camera_status", "camera_abnormal_desc", "risk_items", "capture_time", "image_url"]
            .filter(key => item[key] !== undefined).map(key => [key, item[key]])
        )
        // HIA watermarks use China local time, including Chinese date notation.
        if (typeof result.capture_time === "string") {
          const match = result.capture_time.trim().match(/^(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})日?[ T]+(\d{1,2}):(\d{2}):(\d{2})$/)
          if (match) {
            const [, y, m, d, h, min, s] = match
            result.capture_time = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${min}:${s}+08:00`
          }
        }
        const key = `${result.camera_id}|${result.capture_time ?? ""}`
        const existing = found.get(key)
        if (!existing) found.set(key, result)
        else for (const [field, value] of Object.entries(result)) {
          if (!existing[field]) existing[field] = value
        }
        return
      }
      // Failed/skipped node records must not contribute intermediate input data.
      if (typeof item.nodeType === "string" && item.status !== "success") return
      for (const child of Object.values(item)) visit(child, depth + 1)
    }
  }
  visit(value)
  return [...found.values()]
}

export function parseHiaResponse(value: unknown) {
  if (!object(value) || value.status !== "success") {
    throw new Error("HIA 工作流未成功完成，请在 HIA 平台检查执行记录或密钥有效期")
  }
  let diagnoses = extractHiaDiagnoses(value.output)
  if (!diagnoses.length) diagnoses = extractHiaDiagnoses(value.nodes)
  // Only an explicit business output counts as a valid empty result, never a prompt.
  const outputs: unknown[] = [value.output]
  function collect(item: unknown): void {
    if (Array.isArray(item)) item.forEach(collect)
    else if (object(item)) {
      if (item.nodeType === "message" && item.status === "success") outputs.push(item.output)
      for (const [key, child] of Object.entries(item)) if (key !== "input" && key !== "output") collect(child)
    }
  }
  collect(value.nodes)
  const noConstruction = outputs.some(output => {
    let candidate = output
    for (let i = 0; i < 4; i++) {
      if (typeof candidate === "string") {
        if (/^当前无施工[。！!\s]*$/.test(candidate.trim())) return true
        try { candidate = JSON.parse(candidate) } catch { return false }
      } else if (object(candidate)) candidate = candidate.content ?? candidate.answer ?? candidate.message
      else return false
    }
    return false
  })
  if (!diagnoses.length && !noConstruction) throw new Error("HIA 执行成功，但未找到有效诊断结果；请检查结束输出或 nodes（占位符结果不会入库）")
  return {
    diagnoses,
    summary: {
      provider: "hia", runId: value.runId, status: value.status,
      count: diagnoses.length, costMs: value.costMs,
      message: diagnoses.length ? "诊断结果已解析" : "当前无施工",
      // Deliberately omit raw nodes, image URLs, tokens and HTTP headers from logs.
      cameras: diagnoses.map(d => ({ camera_id: d.camera_id, site_name_watermark: d.site_name_watermark, camera_status: d.camera_status, risk_items: d.risk_items, capture_time: d.capture_time })),
    },
  }
}

export async function callHiaWorkflow(
  apiKey: string, apiUrl: string, parameters: string, taskId: number, signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const invalid = validateHiaConfig(apiKey, apiUrl, parameters)
  if (invalid) throw new Error(invalid)
  const normalizedApiKey = apiKey.trim()
  const normalizedApiUrl = normalizeHiaApiUrl(apiUrl)
  const timeout = Number(process.env.HIA_TIMEOUT_MS || 300000)
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600000) throw new Error("HIA_TIMEOUT_MS 必须为 1–600000 毫秒")
  const timeoutSignal = AbortSignal.timeout(timeout)
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  combined.throwIfAborted()
  let response: Response
  let value: unknown
  try {
    response = await fetcher(normalizedApiUrl, {
      method: "POST", redirect: "error", signal: combined,
      headers: { Apikey: normalizedApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ InputData: parameters, UserID: `scene3-task-${taskId}`, Debug: true, IsStream: false }),
    })
    if (!response.ok) throw new Error(`HIA HTTP ${response.status}${[401, 403].includes(response.status) ? "：密钥无效、已过期或无权限" : "：调用失败"}`)
    value = await response.json()
  } catch (error) {
    if (signal?.aborted) throw new Error("HIA 任务已被中止（远端工作流可能仍在运行）")
    if (timeoutSignal.aborted) throw new Error(`HIA 调用超时（${timeout / 1000}秒），未自动重试，远端可能仍在运行`)
    if (error instanceof Error && error.message.startsWith("HIA HTTP")) throw error
    throw new Error("HIA 请求失败或响应不是有效 JSON，请检查网络及平台执行记录")
  }
  return parseHiaResponse(value)
}

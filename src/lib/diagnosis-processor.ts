import { getSupabaseClient } from "@/storage/database/supabase-client"

export interface RiskItem {
  item_name: string
  status: string
  risk_desc: string
}

export interface DiagnosisData {
  camera_id?: string
  site_name_watermark?: string
  camera_status?: string
  camera_abnormal_desc?: string
  risk_items?: RiskItem[]
  capture_time?: string
  image_url?: string
  excel_url?: string
}

/**
 * 从文本中提取诊断 JSON
 * 支持 markdown 代码块包裹的 JSON 或纯 JSON
 */
export function parseDiagnosisJSON(text: string): DiagnosisData | null {
  try {
    // 尝试提取 markdown 代码块中的 JSON
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : text.trim()
    const parsed = JSON.parse(jsonStr)

    // 如果是数组包含单条记录，取第一条
    const record = Array.isArray(parsed) ? parsed[0] : parsed

    // 检查是否有 name 字段映射到 camera_id
    if (record.name && !record.camera_id) {
      record.camera_id = record.name
    }

    return record as DiagnosisData
  } catch {
    return null
  }
}

/**
 * 判断综合状态
 */
function determineOverallStatus(riskItems: RiskItem[]): string {
  if (!riskItems || riskItems.length === 0) return "normal"
  const hasAbnormal = riskItems.some((r) => r.status === "异常")
  return hasAbnormal ? "abnormal" : "normal"
}

/**
 * 保存诊断结果到数据库
 */
export async function saveDiagnosisResult(data: DiagnosisData): Promise<void> {
  if (!data || !data.camera_id) {
    console.warn("[DiagnosisProcessor] 诊断数据无效，跳过保存")
    return
  }

  const riskItems = data.risk_items || []
  const status = determineOverallStatus(riskItems)

  const supabase = getSupabaseClient()
  const { error } = await supabase.from("daily_diagnose_data").insert({
    diagnose_time: new Date().toISOString(),
    camera_id: data.camera_id,
    site_name_watermark: data.site_name_watermark || "无",
    camera_status: data.camera_status || "正常",
    camera_abnormal_desc: data.camera_abnormal_desc || "正常",
    risk_items: JSON.stringify(riskItems),
    capture_time: data.capture_time || new Date().toISOString(),
    image_url: data.image_url || "",
    excel_url: data.excel_url || "",
    status,
  })

  if (error) {
    console.error("[DiagnosisProcessor] 保存诊断结果失败:", error)
  } else {
    console.log(`[DiagnosisProcessor] 诊断结果已保存: ${data.camera_id} -> ${status}`)
  }
}
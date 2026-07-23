import ExcelJS from "exceljs"
import path from "path"
import fs from "fs"
import { getSupabaseClient } from "@/storage/database/supabase-client"

/**
 * 生成每日汇总 Excel 报告
 * 从数据库读取当日所有诊断记录，生成 Excel 文件保存到 public/reports/
 */
export async function generateDailyExcelReport(reportDate: string): Promise<{
  url: string
  file_name: string
  total_count: number
  abnormal_count: number
  normal_count: number
}> {
  const supabase = getSupabaseClient()

  // 查询当日所有诊断记录
  const startOfDay = `${reportDate}T00:00:00+08:00`
  const endOfDay = `${reportDate}T23:59:59+08:00`

  const { data: records, error } = await supabase
    .from("daily_diagnose_data")
    .select("*")
    .gte("diagnose_time", startOfDay)
    .lte("diagnose_time", endOfDay)
    .order("diagnose_time", { ascending: true })

  if (error) {
    throw new Error(`查询数据失败: ${error.message}`)
  }

  const rows = records || []
  const totalCount = rows.length
  const abnormalCount = rows.filter((r: Record<string, unknown>) => r.status === "abnormal").length
  const normalCount = rows.filter((r: Record<string, unknown>) => r.status === "normal").length

  // 创建工作簿
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "AI诊断管理系统"
  workbook.created = new Date()

  // 样式定义
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0EA5E9" },
  }
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 12,
  }
  const thinBorder = {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  }

  // === Sheet 1: 汇总概览 ===
  const summarySheet = workbook.addWorksheet("汇总概览")
  summarySheet.columns = [
    { header: "项目", key: "item", width: 25 },
    { header: "数值", key: "value", width: 20 },
  ]

  summarySheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
  })

  summarySheet.addRows([
    { item: "报告日期", value: reportDate },
    { item: "诊断总次数", value: totalCount },
    { item: "正常次数", value: normalCount },
    { item: "异常次数", value: abnormalCount },
    { item: "生成时间", value: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) },
  ])

  // === Sheet 2: 诊断明细 ===
  const detailSheet = workbook.addWorksheet("诊断明细")
  detailSheet.columns = [
    { header: "序号", key: "index", width: 6 },
    { header: "诊断时间", key: "diagnose_time", width: 20 },
    { header: "摄像头编号", key: "camera_id", width: 14 },
    { header: "场地名称", key: "site_name", width: 28 },
    { header: "设备状态", key: "camera_status", width: 12 },
    { header: "设备异常描述", key: "camera_desc", width: 30 },
    { header: "拍摄时间", key: "capture_time", width: 20 },
    { header: "综合状态", key: "status", width: 10 },
    { header: "风险项明细", key: "risk_all", width: 60 },
  ]

  detailSheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = thinBorder
  })

  rows.forEach((record: Record<string, unknown>, idx: number) => {
    const riskItems = (Array.isArray(record.risk_items) ? record.risk_items : []) as Array<{
      item_name: string
      status: string
      risk_desc: string
    }>
    const allRisks = riskItems
      .map((r) => {
        if (r.status === "异常") return `${r.item_name}: 异常 - ${r.risk_desc}`
        if (r.status === "无法识别") return `${r.item_name}: 无法识别`
        return `${r.item_name}: 正常`
      })
      .join("\n")

    const row = detailSheet.addRow({
      index: idx + 1,
      diagnose_time: record.diagnose_time
        ? new Date(record.diagnose_time as string).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        : "",
      camera_id: (record.camera_id as string) || "",
      site_name: (record.site_name_watermark as string) || "",
      camera_status: (record.camera_status as string) || "",
      camera_desc: (record.camera_abnormal_desc as string) || "",
      capture_time: record.capture_time
        ? new Date(record.capture_time as string).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        : "",
      status: record.status === "normal" ? "正常" : "异常",
      risk_all: allRisks || "无",
    })

    if (record.status === "abnormal") {
      row.getCell("status").font = { color: { argb: "FFF43F5E" }, bold: true }
    }

    row.eachCell((cell) => {
      cell.border = thinBorder
      cell.alignment = { vertical: "middle", wrapText: true }
    })
  })

  // === Sheet 3: 风险项明细 ===
  const riskSheet = workbook.addWorksheet("风险项明细")
  riskSheet.columns = [
    { header: "序号", key: "index", width: 6 },
    { header: "诊断时间", key: "diagnose_time", width: 20 },
    { header: "摄像头编号", key: "camera_id", width: 14 },
    { header: "场地名称", key: "site_name", width: 28 },
    { header: "检查项", key: "item_name", width: 16 },
    { header: "状态", key: "item_status", width: 10 },
    { header: "异常描述", key: "risk_desc", width: 50 },
  ]

  riskSheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = thinBorder
  })

  let rowIndex = 0
  rows.forEach((record: Record<string, unknown>) => {
    const riskItems = (Array.isArray(record.risk_items) ? record.risk_items : []) as Array<{
      item_name: string
      status: string
      risk_desc: string
    }>
    riskItems.forEach((risk) => {
      rowIndex++
      const row = riskSheet.addRow({
        index: rowIndex,
        diagnose_time: record.diagnose_time
          ? new Date(record.diagnose_time as string).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
          : "",
        camera_id: (record.camera_id as string) || "",
        site_name: (record.site_name_watermark as string) || "",
        item_name: risk.item_name,
        item_status: risk.status,
        risk_desc: risk.risk_desc || "",
      })

      if (risk.status === "异常") {
        row.getCell("item_status").font = { color: { argb: "FFF43F5E" }, bold: true }
      }

      row.eachCell((cell) => {
        cell.border = thinBorder
        cell.alignment = { vertical: "middle", wrapText: true }
      })
    })
  })

  // 保存文件（生产环境使用 /tmp，开发环境使用 public/reports）
  const isProd = process.env.COZE_PROJECT_ENV === "PROD"
  const reportsDir = isProd
    ? path.join("/tmp", "reports")
    : path.join(process.cwd(), "public", "reports")
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  const fileName = `诊断日报_${reportDate}.xlsx`
  const filePath = path.join(reportsDir, fileName)
  await workbook.xlsx.writeFile(filePath)

  // 生产环境返回 /tmp 路径，开发环境返回 /reports 路径
  const url = isProd ? `file://${filePath}` : `/reports/${fileName}`

  return {
    url,
    file_name: fileName,
    total_count: totalCount,
    abnormal_count: abnormalCount,
    normal_count: normalCount,
  }
}

/**
 * 执行每日报告合并并存入数据库
 */
export async function mergeAndSaveDailyReport(reportDate: string): Promise<{
  success: boolean
  message: string
  url: string
}> {
  try {
    const result = await generateDailyExcelReport(reportDate)

    if (result.total_count === 0) {
      return { success: false, message: "当日无诊断记录，未生成报告", url: "" }
    }

    const supabase = getSupabaseClient()
    // 存储相对路径，前端下载时直接使用，避免外部域名 fetch 失败
    const { data: existing } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("report_date", reportDate)
      .limit(1)

    if (existing && existing.length > 0) {
      // 更新
      await supabase
        .from("daily_reports")
        .update({
          excel_url: result.url,
          file_name: result.file_name,
          total_count: result.total_count,
          abnormal_count: result.abnormal_count,
          normal_count: result.normal_count,
          updated_at: new Date().toISOString(),
        })
        .eq("report_date", reportDate)
    } else {
      // 新增
      await supabase.from("daily_reports").insert({
        report_date: reportDate,
        excel_url: result.url,
        file_name: result.file_name,
        total_count: result.total_count,
        abnormal_count: result.abnormal_count,
        normal_count: result.normal_count,
      })
    }

    return {
      success: true,
      message: `报告生成成功：${result.file_name}，共 ${result.total_count} 条记录`,
      url: result.url,
    }
  } catch (error) {
    console.error("[ReportMerger] 合并报告失败:", error)
    return {
      success: false,
      message: `合并失败: ${error instanceof Error ? error.message : String(error)}`,
      url: "",
    }
  }
}

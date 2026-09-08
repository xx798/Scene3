import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { generateDailyExcelReport } from "@/lib/report-generator"
import { authenticateRequest } from "@/lib/auth-utils"
import { getReportPath } from '@/lib/report-storage';
import fs from "fs"

/**
 * 下载报告文件
 * 如果文件不存在或已过期，自动重新生成
 */
export async function GET(request: NextRequest) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "缺少报告 ID" }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // 查询报告信息
    const { data: report, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("id", parseInt(id))
      .single()

    if (error || !report) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 })
    }

    // 根据环境确定文件路径
    let filePath = getReportPath(report.file_name)

    // 检查文件是否存在且未过期（24小时内）
    let needRegenerate = false
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      const fileAge = Date.now() - stats.mtimeMs
      const maxAge = 24 * 60 * 60 * 1000 // 24小时
      if (fileAge > maxAge) {
        needRegenerate = true
      }
    } else {
      needRegenerate = true
    }

    // 如果需要重新生成
    if (needRegenerate) {
      console.log(`[Download] 文件不存在或已过期，重新生成: ${report.file_name}`)
      const result = await generateDailyExcelReport(report.report_date)
      filePath = getReportPath(result.file_name)
      if (result.total_count === 0) {
        return NextResponse.json(
          { error: "当日无诊断记录，无法生成报告" },
          { status: 400 }
        )
      }
    }

    // 读取文件并返回
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "文件生成失败" }, { status: 500 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    const fileName = encodeURIComponent(report.file_name)

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
        "Content-Length": fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("[Download] 下载报告失败:", error)
    return NextResponse.json(
      { error: `下载失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

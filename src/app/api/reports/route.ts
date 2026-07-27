import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import path from "path"
import fs from "fs"

export async function GET() {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("daily_reports")
      .select("*")
      .order("report_date", { ascending: false })
      .limit(30)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "缺少报告 ID" }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // 查询报告信息
    const { data: report, error: queryError } = await supabase
      .from("daily_reports")
      .select("file_name")
      .eq("id", parseInt(id))
      .single()

    if (queryError || !report) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 })
    }

    // 删除数据库记录
    const { error: deleteError } = await supabase
      .from("daily_reports")
      .delete()
      .eq("id", parseInt(id))

    if (deleteError) throw deleteError

    // 删除物理文件（根据环境选择路径）
    const isProd = process.env.COZE_PROJECT_ENV === "PROD"
    const reportsDir = isProd
      ? path.join("/tmp", "reports")
      : path.join(process.cwd(), "public", "reports")
    const filePath = path.join(reportsDir, report.file_name)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: `删除失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

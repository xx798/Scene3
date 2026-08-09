import { NextRequest, NextResponse } from "next/server"
import { mergeAndSaveDailyReport } from "@/lib/report-generator"
import { authenticateRequest } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  try {
    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json({ error: "缺少日期参数" }, { status: 400 })
    }

    const result = await mergeAndSaveDailyReport(date)

    return NextResponse.json({
      success: result.success,
      date,
      message: result.message,
      url: result.url,
    })
  } catch (error) {
    return NextResponse.json(
      { error: `生成报告失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { checkAndExecuteDueTasks } from "@/lib/scheduler"

/**
 * POST /api/scheduled-tasks/trigger-due
 *
 * 外部定时触发器（如 GitHub Actions）每分钟调用此接口，
 * 由应用层判断哪些任务到期并执行。
 *
 * 支持通过 CRON_TRIGGER_TOKEN 环境变量进行鉴权（可选）。
 */
export async function POST(request: NextRequest) {
  try {
    // 可选鉴权：如果配置了 CRON_TRIGGER_TOKEN，则要求请求携带
    const expectedToken = process.env.CRON_TRIGGER_TOKEN
    if (!expectedToken) return NextResponse.json({ error: '外部定时触发未启用' }, { status: 503 });
    if (expectedToken) {
      const authHeader = request.headers.get("authorization")
      const bearerToken = authHeader?.replace("Bearer ", "")
      if (bearerToken !== expectedToken) {
        return NextResponse.json({ error: "未授权" }, { status: 401 })
      }
    }

    // 从 query 读取补偿窗口（默认 5 分钟）
    const { searchParams } = new URL(request.url)
    const windowMinutes = parseInt(searchParams.get("window") || "5", 10)

    if (!Number.isInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 60) return NextResponse.json({ error: 'window 必须为 1–60 分钟' }, { status: 400 });
    const result = await checkAndExecuteDueTasks(windowMinutes)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[TriggerDue] 接口异常:", error)
    return NextResponse.json(
      { error: "触发失败", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

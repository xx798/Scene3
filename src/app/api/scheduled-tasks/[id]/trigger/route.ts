import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { executeTask } from "@/lib/scheduler"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const taskId = parseInt(id)

    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", taskId)
      .limit(1)

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 异步执行任务（force=true 绕过 is_active 检查，暂停态也可手动触发）
    executeTask(taskId, true).catch(console.error)

    return NextResponse.json({ success: true, message: "任务已触发" })
  } catch (error) {
    return NextResponse.json({ error: "触发失败" }, { status: 500 })
  }
}

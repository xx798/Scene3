import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { executeTask } from "@/lib/scheduler"
import { authenticateRequest, requireSuperAdmin } from "@/lib/auth-utils"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  const adminCheck = requireSuperAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

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

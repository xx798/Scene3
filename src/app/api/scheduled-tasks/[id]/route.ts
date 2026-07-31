import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { reloadTask, stopTask, abortTask } from "@/lib/scheduler"
import { authenticateRequest, requireAdmin } from "@/lib/auth-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  try {
    const { id } = await params
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("id", parseInt(id))
      .limit(1)

    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }
    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  try {
    const { id } = await params
    const body = await request.json()

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parseInt(id))
      .select()
      .limit(1)

    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    if (data[0].is_active) {
      await reloadTask(data[0].id)
    } else {
      // 暂停时先中止正在执行的任务，再停止 cron 调度
      abortTask(data[0].id)
      await stopTask(data[0].id)
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  const adminCheck = requireAdmin(user);
  if (adminCheck.error) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  try {
    const { id } = await params
    await stopTask(parseInt(id))

    const supabase = getSupabaseClient()
    await supabase.from("scheduled_tasks").delete().eq("id", parseInt(id))

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
}

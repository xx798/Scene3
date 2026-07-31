import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { reloadTask } from "@/lib/scheduler"
import { authenticateRequest } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError, status: authStatus } = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: authStatus });

  try {
    const body = await request.json()
    const { name, task_type, bot_id, workflow_id, cron_expression, prompt_template, workflow_parameters, is_active } = body

    if (!name || !cron_expression) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .insert({
        name,
        task_type: task_type || "bot",
        bot_id: bot_id || null,
        workflow_id: workflow_id || null,
        cron_expression,
        prompt_template: prompt_template || "",
        workflow_parameters: workflow_parameters || "",
        is_active: is_active !== false,
      })
      .select()
      .limit(1)

    if (error) throw error

    if (data && data.length > 0) {
      await reloadTask(data[0].id)
    }

    return NextResponse.json(data?.[0] || {})
  } catch (error) {
    return NextResponse.json({ error: "创建失败" }, { status: 500 })
  }
}

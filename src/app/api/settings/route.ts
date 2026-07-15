import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// GET /api/settings - 获取设置
export async function GET() {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .eq("setting_key", "workflow_selection")
      .single()

    if (error) throw error
    return NextResponse.json(data.setting_value)
  } catch (e: any) {
    return NextResponse.json({ selected_workflow_ids: [] })
  }
}

// PUT /api/settings - 更新设置
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { selected_workflow_ids } = body

    if (!Array.isArray(selected_workflow_ids)) {
      return NextResponse.json({ error: "selected_workflow_ids 必须是数组" }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          setting_key: "workflow_selection",
          setting_value: { selected_workflow_ids },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      )

    if (error) throw error
    return NextResponse.json({ success: true, selected_workflow_ids })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "更新设置失败" }, { status: 500 })
  }
}
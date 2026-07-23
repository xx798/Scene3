import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("task_execution_logs")
      .select("*")
      .eq("task_id", parseInt(id))
      .order("started_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: `查询失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

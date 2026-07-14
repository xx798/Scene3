import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

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

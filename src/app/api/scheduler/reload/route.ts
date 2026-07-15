import { NextResponse } from "next/server"
import { reloadScheduler } from "@/lib/scheduler"

export async function POST() {
  try {
    await reloadScheduler()
    return NextResponse.json({ success: true, message: "调度器已重新加载" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "重新加载调度器失败" }, { status: 500 })
  }
}
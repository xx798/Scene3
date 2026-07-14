import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { executeScheduledTask } from "@/lib/bot-caller";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/scheduled-tasks/[id]/trigger - 手动触发一次任务
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data: task, error } = await client
      .from("scheduled_tasks")
      .select("id, bot_id, prompt_template, name")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // Resolve prompt template
    let prompt = (task as { prompt_template: string }).prompt_template;
    const now = new Date();
    prompt = prompt.replace(/\{\{now\}\}/g, now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
    prompt = prompt.replace(/\{\{date\}\}/g, now.toISOString().split("T")[0]);
    prompt = prompt.replace(/\{\{timestamp\}\}/g, String(Date.now()));

    // Execute asynchronously - don't wait for completion
    // But we return immediately with a status
    executeScheduledTask(
      taskId,
      (task as { bot_id: string }).bot_id,
      prompt
    ).catch((err: unknown) => {
      console.error(`[Trigger] 手动触发任务 ${taskId} 失败:`, err);
    });

    return NextResponse.json({
      success: true,
      message: `任务 "${(task as { name: string }).name}" 已触发，正在后台执行`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

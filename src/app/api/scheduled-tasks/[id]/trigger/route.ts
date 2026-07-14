import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { executeScheduledTask, resolveTemplate } from "@/lib/bot-caller";

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
      .select("id, task_type, bot_id, workflow_id, prompt_template, workflow_parameters, name")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const t = task as {
      id: number;
      task_type: string;
      bot_id: string | null;
      workflow_id: string | null;
      prompt_template: string;
      workflow_parameters: string;
      name: string;
    };

    // Resolve template variables
    const prompt = resolveTemplate(t.prompt_template);
    const workflowParams = resolveTemplate(t.workflow_parameters);

    // Execute asynchronously
    executeScheduledTask(
      t.id,
      t.task_type,
      t.bot_id,
      t.workflow_id,
      prompt,
      workflowParams
    ).catch((err: unknown) => {
      console.error(`[Trigger] 手动触发任务 ${taskId} 失败:`, err);
    });

    return NextResponse.json({
      success: true,
      message: `任务 "${t.name}" (${t.task_type}) 已触发，正在后台执行`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

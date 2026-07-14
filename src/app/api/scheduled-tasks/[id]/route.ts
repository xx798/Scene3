import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { reloadScheduler, stopSchedulerTask } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/scheduled-tasks/[id] - 获取单个任务详情
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("scheduled_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/scheduled-tasks/[id] - 更新定时任务
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, bot_id, cron_expression, prompt_template, is_active } = body as {
      name?: string;
      bot_id?: string;
      cron_expression?: string;
      prompt_template?: string;
      is_active?: boolean;
    };

    // Validate cron if provided
    if (cron_expression) {
      const cron = await import("node-cron");
      if (!cron.default.validate(cron_expression)) {
        return NextResponse.json(
          { error: `无效的 cron 表达式: ${cron_expression}` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (bot_id !== undefined) updateData.bot_id = bot_id;
    if (cron_expression !== undefined) updateData.cron_expression = cron_expression;
    if (prompt_template !== undefined) updateData.prompt_template = prompt_template;
    if (is_active !== undefined) updateData.is_active = is_active;

    const client = getSupabaseClient();

    // Check if task exists first
    const { data: existing, error: checkError } = await client
      .from("scheduled_tasks")
      .select("id")
      .eq("id", taskId)
      .maybeSingle();

    if (checkError) throw new Error(checkError.message);
    if (!existing) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const { data, error } = await client
      .from("scheduled_tasks")
      .update(updateData)
      .eq("id", taskId)
      .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // Reload scheduler
    if (is_active === false) {
      stopSchedulerTask(taskId);
    } else {
      await reloadScheduler();
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/scheduled-tasks/[id] - 删除定时任务
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    // Stop the task first
    stopSchedulerTask(taskId);

    const client = getSupabaseClient();
    const { error } = await client
      .from("scheduled_tasks")
      .delete()
      .eq("id", taskId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

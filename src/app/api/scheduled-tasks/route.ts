import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { reloadScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

/**
 * GET /api/scheduled-tasks - 获取所有定时任务
 */
export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("scheduled_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/scheduled-tasks - 创建定时任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, bot_id, cron_expression, prompt_template } = body as {
      name?: string;
      bot_id?: string;
      cron_expression?: string;
      prompt_template?: string;
    };

    if (!name || !bot_id || !cron_expression) {
      return NextResponse.json(
        { error: "缺少必填字段: name, bot_id, cron_expression" },
        { status: 400 }
      );
    }

    // Validate cron expression
    const cron = await import("node-cron");
    if (!cron.default.validate(cron_expression)) {
      return NextResponse.json(
        { error: `无效的 cron 表达式: ${cron_expression}` },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("scheduled_tasks")
      .insert({
        name,
        bot_id,
        cron_expression,
        prompt_template: prompt_template || "",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Reload scheduler to pick up new task
    await reloadScheduler();

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

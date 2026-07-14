/**
 * Scheduler - 定时任务调度引擎
 * 基于 node-cron 实现，管理服务端所有定时任务的调度
 */

import cron from "node-cron";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { executeScheduledTask, resolveTemplate } from "@/lib/bot-caller";

interface TaskConfig {
  id: number;
  name: string;
  task_type: string;
  bot_id: string | null;
  workflow_id: string | null;
  cron_expression: string;
  prompt_template: string;
  workflow_parameters: string;
  is_active: boolean;
}

// 存储活跃的 cron job 实例
const activeJobs = new Map<number, ReturnType<typeof cron.schedule>>();

/**
 * 启动单个任务
 */
function startTask(task: TaskConfig): void {
  // 先停止已有的
  stopTask(task.id);

  if (!task.is_active) return;
  if (!cron.validate(task.cron_expression)) {
    console.error(`[Scheduler] 任务 ${task.id} cron 表达式无效: ${task.cron_expression}`);
    return;
  }

  const job = cron.schedule(task.cron_expression, async () => {
    console.log(`[Scheduler] 触发任务 ${task.id}: ${task.name} (${task.task_type})`);

    // 解析模板中的变量
    const prompt = resolveTemplate(task.prompt_template);
    const workflowParams = resolveTemplate(task.workflow_parameters);

    await executeScheduledTask(
      task.id,
      task.task_type,
      task.bot_id,
      task.workflow_id,
      prompt,
      workflowParams
    );
  }, {
    timezone: "Asia/Shanghai",
  });

  activeJobs.set(task.id, job);
  console.log(`[Scheduler] 任务 ${task.id} 已启动, cron: ${task.cron_expression}`);
}

/**
 * 停止单个任务
 */
function stopTask(taskId: number): void {
  const existing = activeJobs.get(taskId);
  if (existing) {
    existing.stop();
    activeJobs.delete(taskId);
    console.log(`[Scheduler] 任务 ${taskId} 已停止`);
  }
}

/**
 * 初始化调度器：从数据库加载所有活跃任务并启动
 */
export async function initScheduler(): Promise<void> {
  console.log("[Scheduler] 正在初始化调度引擎...");

  const client = getSupabaseClient();
  const { data: tasks, error } = await client
    .from("scheduled_tasks")
    .select("id, name, task_type, bot_id, workflow_id, cron_expression, prompt_template, workflow_parameters, is_active");

  if (error) {
    console.error(`[Scheduler] 加载任务失败: ${error.message}`);
    return;
  }

  const taskList = (tasks || []) as TaskConfig[];
  console.log(`[Scheduler] 加载到 ${taskList.length} 个定时任务`);

  for (const task of taskList) {
    startTask(task);
  }
}

/**
 * 重新加载调度器（任务增删改后调用）
 */
export async function reloadScheduler(): Promise<void> {
  // 停止所有现有任务
  for (const [id] of activeJobs) {
    stopTask(id);
  }

  // 重新加载
  await initScheduler();
}

/**
 * 启动指定任务
 */
export function startSchedulerTask(task: TaskConfig): void {
  startTask(task);
}

/**
 * 停止指定任务
 */
export function stopSchedulerTask(taskId: number): void {
  stopTask(taskId);
}

/**
 * 获取所有活跃任务 ID
 */
export function getActiveTaskIds(): number[] {
  return Array.from(activeJobs.keys());
}

// Explicit live integration check: runs one workflow and retains its paused task/log/data.
import { loadEnvConfig } from "@next/env"
import { getSupabaseClient } from "../src/storage/database/supabase-client"
import { executeTask } from "../src/lib/scheduler"
import { DEFAULT_HIA_API_URL } from "../src/lib/hia-workflow"

async function main() {
  loadEnvConfig(process.cwd())
  const apiKey = process.argv[2]?.trim()
  if (!apiKey) throw new Error("请将限时 HIA API Key 作为命令参数传入；脚本不会读取 .env.local")
  const db = getSupabaseClient()
  const { data: task, error } = await db.from("scheduled_tasks").insert({
    name: "HIA 接入验证（手动执行，已暂停）", task_type: "hia_workflow",
    bot_id: DEFAULT_HIA_API_URL, workflow_id: apiKey, cron_expression: "0 9 * * *", is_active: false,
    workflow_parameters: '{"limit":0}', prompt_template: "",
  }).select("id").single()
  if (error || !task) throw new Error("无法创建本地验证任务")
  const started = new Date().toISOString()
  console.log(JSON.stringify({ taskId: task.id, status: "running", scheduled: false }))
  await executeTask(task.id, true)
  const { data: log, error: logError } = await db.from("task_execution_logs")
    .select("status,response_content,error_message").eq("task_id", task.id).order("id", { ascending: false }).limit(1).single()
  if (logError || !log) throw new Error("无法读取验证日志")
  const { data: records, error: recordsError } = await db.from("daily_diagnose_data")
    .select("id,camera_id,camera_status,capture_time,risk_items").gte("diagnose_time", started)
  if (recordsError) throw new Error("无法查询诊断记录")
  console.log(JSON.stringify({ taskId: task.id, log, records }, null, 2))
  if (log.status !== "success") process.exitCode = 1
}
main().catch(error => { console.error(error instanceof Error ? error.message : "验证失败"); process.exitCode = 1 })

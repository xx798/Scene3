import test from "node:test"
import assert from "node:assert/strict"
import { executeTask, isTaskRunning } from "../src/lib/scheduler"

test("HIA scheduler routes through diagnosis insert, execution log and last_run_at", async () => {
  const originalFetch = globalThis.fetch
  process.env.SUPABASE_URL = "http://127.0.0.1:59999"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only"
  const diagnoses: Record<string, unknown>[] = []
  const logs: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []
  let failHia = false
  let failInsert = false
  let hiaCalls = 0
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method || "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (url.includes("/sync_run_app_workflow")) {
      assert.equal(url, "https://hiagent.example/api/v1/sync_run_app_workflow")
      hiaCalls++
      if (failHia) return new Response("expired", { status: 403 })
      return Response.json({ status: "success", runId: "test", output: "{}", nodes: {
        result: { status: "success", nodeType: "llm", output: JSON.stringify({ camera_id: "test-camera", camera_status: "正常",
          capture_time: "2026年09月21日 15:02:41", risk_items: [{ item_name: "安全", status: "异常", risk_desc: "未佩戴安全帽" }] }) },
      } })
    }
    if (url.includes("/rest/v1/scheduled_tasks")) {
      if (method === "GET") return Response.json([{ id: 101, name: "test", task_type: "hia_workflow", bot_id: "https://hiagent.example/api/v1/sync_run_app_workflow", workflow_id: "test-api-key", workflow_parameters: '{"limit":0}', is_active: false }])
      updates.push(body)
      return new Response(null, { status: 204 })
    }
    if (url.includes("/rest/v1/task_execution_logs")) {
      if (method === "POST") return Response.json([{ id: 201 }])
      logs.push(body)
      return new Response(null, { status: 204 })
    }
    if (url.includes("/rest/v1/daily_diagnose_data")) {
      if (failInsert) return Response.json({ message: "test insert failed" }, { status: 400 })
      diagnoses.push(body)
      return new Response(null, { status: 201 })
    }
    throw new Error(`Unexpected test URL: ${url}`)
  }
  try {
    await executeTask(101) // paused tasks must not run automatically
    assert.equal(hiaCalls, 0)
    await executeTask(101, true)
    assert.equal(diagnoses.length, 1)
    assert.equal(diagnoses[0].status, "abnormal")
    assert.equal(diagnoses[0].capture_time, "2026-09-21T07:02:41.000Z")
    assert.equal(logs[0].status, "success")
    assert.equal(JSON.parse(String(logs[0].response_content)).saved, 1)
    assert.ok(updates[0].last_run_at)
    assert.equal(isTaskRunning(101), false)
    failHia = true
    await executeTask(101, true)
    assert.equal(logs[1].status, "failed")
    assert.match(String(logs[1].error_message), /403/)
    assert.equal(diagnoses.length, 1)
    failHia = false
    failInsert = true
    await executeTask(101, true)
    assert.equal(logs[2].status, "failed")
    assert.match(String(logs[2].error_message), /0\/1/)
    assert.equal(isTaskRunning(101), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

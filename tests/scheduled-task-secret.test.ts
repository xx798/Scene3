import test from "node:test"
import assert from "node:assert/strict"
import { sanitizeScheduledTask, sanitizeScheduledTasks } from "../src/lib/scheduled-task-secret"

test("HIA task responses never expose stored API keys", () => {
  const hia = sanitizeScheduledTask({ id: 1, task_type: "hia_workflow", workflow_id: "private-key" })
  assert.equal(hia.workflow_id, null)
  assert.equal(hia.has_hia_api_key, true)
  assert.ok(!JSON.stringify(hia).includes("private-key"))
  assert.equal(sanitizeScheduledTask({ task_type: "hia_workflow", workflow_id: "HIA_API_KEY" }).has_hia_api_key, false)

  const coze = sanitizeScheduledTasks([{ id: 2, task_type: "workflow", workflow_id: "coze-id" }])[0]
  assert.equal(coze.workflow_id, "coze-id")
  assert.equal(coze.has_hia_api_key, undefined)
})

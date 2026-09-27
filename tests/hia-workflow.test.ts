import test from "node:test"
import assert from "node:assert/strict"
import { callHiaWorkflow, DEFAULT_HIA_API_URL, extractHiaDiagnoses, normalizeHiaApiUrl, parseHiaResponse, validateHiaConfig } from "../src/lib/hia-workflow"

const diagnosis = {
  camera_id: "camera-001", camera_status: "正常", site_name_watermark: "测试现场",
  capture_time: "2026年09月21日 15:02:41",
  risk_items: [{ item_name: "土方堆放安全", status: "无法识别", risk_desc: "遮挡" }],
  image_url: "https://example.invalid/image?token=private",
}
const response = {
  status: "success", runId: "test-run", output: "{}", nodes: {
    loop: { status: "success", nodeType: "loop", iterations: [{ nodes: {
      llm: { status: "success", nodeType: "llm", output: JSON.stringify(diagnosis) },
      message: { status: "success", nodeType: "message", input: JSON.stringify(diagnosis),
        output: JSON.stringify({ content: JSON.stringify({ ...diagnosis, risk_items: [{ item_name: "模板", status: "{{status}}", risk_desc: "{{desc}}" }] }) }) },
    } }] },
  },
}

test("HIA nodes: nested JSON, placeholders, deduplication, China time and safe logs", () => {
  const result = parseHiaResponse(response)
  assert.equal(result.diagnoses.length, 1)
  assert.equal(result.diagnoses[0].capture_time, "2026-09-21T15:02:41+08:00")
  assert.deepEqual(result.diagnoses[0].risk_items, diagnosis.risk_items)
  assert.ok(!JSON.stringify(result.summary).includes("private"))
  assert.ok(!JSON.stringify(result.summary).includes("{{"))
})
test("HIA prioritizes valid final output and supports multiple cameras", () => {
  const result = parseHiaResponse({ ...response, output: JSON.stringify([diagnosis, { ...diagnosis, camera_id: "camera-002" }]) })
  assert.equal(result.diagnoses.length, 2)
})
test("HIA rejects empty output, failed/skipped node input, and metadata", () => {
  assert.throws(() => parseHiaResponse({ status: "success", output: "{}" }), /未找到/)
  assert.throws(() => parseHiaResponse({ status: "failed", nodes: response.nodes }), /未成功/)
  assert.deepEqual(extractHiaDiagnoses({ nodeType: "llm", status: "failed", input: diagnosis }), [])
  assert.deepEqual(extractHiaDiagnoses({ camera_id: "metadata" }), [])
})
test("HIA accepts only explicit no-construction business output, not prompt input", () => {
  assert.equal(parseHiaResponse({ status: "success", output: JSON.stringify({ content: "当前无施工" }) }).diagnoses.length, 0)
  assert.throws(() => parseHiaResponse({ status: "success", nodes: { nodeType: "message", status: "success", input: "当前无施工", output: "{}" } }), /未找到/)
})
test("HIA validates user-entered API keys and limit parameters", () => {
  assert.equal(validateHiaConfig("test-api-key", DEFAULT_HIA_API_URL, '{"limit":0}'), null)
  assert.equal(normalizeHiaApiUrl("https://example.com/api/v1"), "https://example.com/api/v1/sync_run_app_workflow")
  assert.equal(normalizeHiaApiUrl("https://example.com/sync_run_app_workflow"), "https://example.com/sync_run_app_workflow")
  for (const params of ["{}", "[]", "bad", '{"limit":-1}', '{"limit":"0"}']) assert.ok(validateHiaConfig("test-key", DEFAULT_HIA_API_URL, params))
  assert.ok(validateHiaConfig("", DEFAULT_HIA_API_URL, '{"limit":0}'))
  assert.ok(validateHiaConfig("HIA_API_KEY", DEFAULT_HIA_API_URL, '{"limit":0}'))
  assert.ok(validateHiaConfig("bad\nkey", DEFAULT_HIA_API_URL, '{"limit":0}'))
  assert.ok(validateHiaConfig("test-key", "file:///etc/passwd", '{"limit":0}'))
  assert.ok(validateHiaConfig("test-key", "https://user:password@example.com", '{"limit":0}'))
})
test("HIA HTTP contract, expired keys, invalid response and abort", async () => {
  const mockFetch: typeof fetch = async (url, init) => {
    assert.ok(String(url).endsWith("/sync_run_app_workflow"))
    assert.equal(new Headers(init?.headers).get("Apikey"), "test-secret")
    assert.deepEqual(JSON.parse(String(init?.body)), { InputData: '{"limit":0}', UserID: "scene3-task-1", Debug: true, IsStream: false })
    return Response.json(response)
  }
  assert.equal((await callHiaWorkflow("test-secret", DEFAULT_HIA_API_URL, '{"limit":0}', 1, undefined, mockFetch)).diagnoses.length, 1)
  await assert.rejects(callHiaWorkflow("test-secret", DEFAULT_HIA_API_URL, '{"limit":0}', 1, undefined, async () => new Response("secret", { status: 403 })), /已过期/)
  await assert.rejects(callHiaWorkflow("test-secret", DEFAULT_HIA_API_URL, '{"limit":0}', 1, undefined, async () => new Response("bad")), /有效 JSON/)
  await assert.rejects(callHiaWorkflow("test-secret", DEFAULT_HIA_API_URL, '{"limit":0}', 1, AbortSignal.abort(), mockFetch))
})

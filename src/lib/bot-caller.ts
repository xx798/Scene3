/**
 * Bot & Workflow Caller - 调用扣子平台智能体/工作流并解析返回内容
 * Bot: 基于 Coze Open API v3/chat
 * Workflow: 基于 Coze Open API v1/workflow/run
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";

const COZE_API_TOKEN = process.env.COZE_WORKLOAD_API_TOKEN;
const COZE_API_BASE = process.env.COZE_API_BASE_URL || "https://api.coze.cn";

interface CallResult {
  success: boolean;
  conversationId?: string;
  chatId?: string;
  content?: string;
  error?: string;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (COZE_API_TOKEN) {
    headers["Authorization"] = `Bearer ${COZE_API_TOKEN}`;
  }
  const extraHeaders = process.env.COZE_EXTRA_HEADERS;
  if (extraHeaders) {
    for (const pair of extraHeaders.split(";")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        headers[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
      }
    }
  }
  return headers;
}

/**
 * 替换模板中的变量
 */
export function resolveTemplate(template: string): string {
  const now = new Date();
  let result = template;
  result = result.replace(/\{\{now\}\}/g, now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
  result = result.replace(/\{\{date\}\}/g, now.toISOString().split("T")[0]);
  result = result.replace(/\{\{timestamp\}\}/g, String(Date.now()));
  return result;
}

/**
 * 调用智能体进行同步对话（自动轮询等待完成）
 */
async function callBot(botId: string, message: string): Promise<CallResult> {
  const headers = buildHeaders();

  try {
    // Step 1: Create chat
    const response = await fetch(`${COZE_API_BASE}/v3/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bot_id: botId,
        user_id: `scheduler_${Date.now()}`,
        stream: false,
        additional_messages: [
          {
            role: "user",
            content: message,
            content_type: "text",
          },
        ],
        auto_save_history: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `创建对话失败: ${response.status} ${errText}` };
    }

    const chatResult = await response.json();
    const conversationId = chatResult.data?.conversation_id;
    const chatId = chatResult.data?.id;

    if (!conversationId || !chatId) {
      return { success: false, error: `对话创建异常: ${JSON.stringify(chatResult)}` };
    }

    // Step 2: Poll until completion (max 2 minutes)
    const terminalStatuses = ["completed", "failed", "canceled"];
    const maxPollTime = 120000;
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const params = new URLSearchParams({
        conversation_id: conversationId,
        chat_id: chatId,
      });

      const retrieveResponse = await fetch(
        `${COZE_API_BASE}/v3/chat/retrieve?${params}`,
        { headers }
      );

      const retrieveResult = await retrieveResponse.json();
      const status = retrieveResult.data?.status;

      if (terminalStatuses.includes(status)) {
        if (status === "failed" || status === "canceled") {
          return {
            success: false,
            conversationId,
            chatId,
            error: `对话状态: ${status}`,
          };
        }

        // Step 3: Get messages
        const messageParams = new URLSearchParams({
          conversation_id: conversationId,
          chat_id: chatId,
        });

        const messageResponse = await fetch(
          `${COZE_API_BASE}/v3/chat/message/list?${messageParams}`,
          { headers }
        );

        const messageResult = await messageResponse.json();
        const messages = messageResult.data || [];

        // Find the answer message
        const answerMsg = messages.find(
          (m: { type: string; role: string }) => m.type === "answer" && m.role === "assistant"
        );

        const content = answerMsg?.content || "";

        return {
          success: true,
          conversationId,
          chatId,
          content,
        };
      }
    }

    return { success: false, error: "对话超时（超过2分钟）" };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `调用异常: ${errMsg}` };
  }
}

/**
 * 调用工作流（同步执行，等待完成后返回结果）
 */
async function callWorkflow(workflowId: string, parametersJson: string): Promise<CallResult> {
  const headers = buildHeaders();

  try {
    // Parse parameters template
    let parameters: Record<string, unknown> = {};
    if (parametersJson.trim()) {
      const resolved = resolveTemplate(parametersJson);
      try {
        parameters = JSON.parse(resolved);
      } catch {
        return { success: false, error: `工作流参数 JSON 解析失败: ${resolved}` };
      }
    }

    const response = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `工作流调用失败: ${response.status} ${errText}` };
    }

    const result = await response.json();

    // Extract output content
    let content = "";
    if (result.data) {
      if (typeof result.data === "string") {
        content = result.data;
      } else {
        content = JSON.stringify(result.data, null, 2);
      }
    }

    return {
      success: true,
      content,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `工作流调用异常: ${errMsg}` };
  }
}

/**
 * 执行一次定时任务：根据 task_type 调用 Bot 或 Workflow → 记录日志
 */
export async function executeScheduledTask(
  taskId: number,
  taskType: string,
  botId: string | null,
  workflowId: string | null,
  prompt: string,
  workflowParameters: string
): Promise<void> {
  const client = getSupabaseClient();

  // Create execution log
  const { data: logRow, error: logError } = await client
    .from("task_execution_logs")
    .insert({
      task_id: taskId,
      status: "running",
      prompt_sent: taskType === "workflow" ? workflowParameters : prompt,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (logError) {
    console.error(`[Scheduler] 创建执行日志失败: ${logError.message}`);
    return;
  }

  const logId = logRow.id as number;

  try {
    let result: CallResult;

    if (taskType === "workflow") {
      if (!workflowId) {
        throw new Error("工作流任务缺少 workflow_id");
      }
      result = await callWorkflow(workflowId, workflowParameters);
    } else {
      if (!botId) {
        throw new Error("智能体任务缺少 bot_id");
      }
      result = await callBot(botId, prompt);
    }

    const completedAt = new Date().toISOString();

    if (result.success) {
      await client
        .from("task_execution_logs")
        .update({
          status: "success",
          response_content: result.content,
          completed_at: completedAt,
        })
        .eq("id", logId);

      await client
        .from("scheduled_tasks")
        .update({ last_run_at: completedAt })
        .eq("id", taskId);

      console.log(`[Scheduler] 任务 ${taskId} (${taskType}) 执行成功, logId=${logId}`);
    } else {
      await client
        .from("task_execution_logs")
        .update({
          status: "failed",
          error_message: result.error,
          completed_at: completedAt,
        })
        .eq("id", logId);

      console.error(`[Scheduler] 任务 ${taskId} (${taskType}) 执行失败: ${result.error}`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await client
      .from("task_execution_logs")
      .update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", logId);

    console.error(`[Scheduler] 任务 ${taskId} (${taskType}) 执行异常: ${errMsg}`);
  }
}
